import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { logActivity, getUserDisplayName } from "./activity-logger";
import { sendNotifications } from "./notification-helper";
import type { Env } from "@/shared/types";

// Helper functions for role checking
async function getUserRoles(db: any, userId: string) {
  const result = await db.prepare("SELECT role, team_id FROM user_roles WHERE user_id = ?").bind(userId).all();
  return result.results || [];
}

async function hasRole(db: any, userId: string, role: string) {
  const roles = await getUserRoles(db, userId);
  return roles.some((r: any) => r.role.toLowerCase() === role.toLowerCase());
}

async function isAdmin(db: any, userId: string, email: string) {
  await db.prepare("SELECT id FROM admins WHERE email = ?").bind(email).first();
  return hasRole(db, userId, 'admin');
}

async function canAccessTeam(db: any, userId: string, email: string, teamId: number) {
  // Admin can access all teams
  const adminCheck = await isAdmin(db, userId, email);
  if (adminCheck) return true;
  
  // Check if user is a coach for this team
  const roles = await getUserRoles(db, userId);
  const isCoachForTeam = roles.some((r: any) => 
    r.role.toLowerCase() === 'coach' && r.team_id === teamId
  );
  if (isCoachForTeam) return true;
  
  // Check if user is a family member with a player on this team
  const familyRole = roles.find((r: any) => r.role.toLowerCase() === 'family');
  if (familyRole && familyRole.family_id) {
    const playerOnTeam = await db.prepare(
      `SELECT tp.id FROM team_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.team_id = ? AND p.family_id = ?`
    ).bind(teamId, familyRole.family_id).first();
    
    if (playerOnTeam) return true;
  }
  
  return false;
}

export function setupTeamMessageEndpoints(app: Hono<{ Bindings: Env }>, authMiddleware: any) {
  // Get all messages for a team with reply counts
  app.get("/api/portal/teams/:teamId/messages", authMiddleware, async (c) => {
    const db = c.env.DB;
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const teamId = Number(c.req.param("teamId"));
    
    // Check access
    const hasAccess = await canAccessTeam(db, user.id, user.email, teamId);
    if (!hasAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }
    
    const result = await db
      .prepare(
        `SELECT 
          m.*,
          COUNT(r.id) as reply_count
         FROM team_messages m
         LEFT JOIN team_message_replies r ON m.id = r.message_id
         WHERE m.team_id = ?
         GROUP BY m.id
         ORDER BY m.is_pinned DESC, m.created_at DESC`
      )
      .bind(teamId)
      .all();
    
    return c.json(result.results || []);
  });

  // Get a single message with replies
  app.get("/api/portal/teams/:teamId/messages/:id", authMiddleware, async (c) => {
    const db = c.env.DB;
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const teamId = Number(c.req.param("teamId"));
    const id = c.req.param("id");
    
    // Check access
    const hasAccess = await canAccessTeam(db, user.id, user.email, teamId);
    if (!hasAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }
    
    const message = await db
      .prepare("SELECT * FROM team_messages WHERE id = ? AND team_id = ?")
      .bind(id, teamId)
      .first();
    
    if (!message) {
      return c.json({ error: "Message not found" }, 404);
    }

    const replies = await db
      .prepare(
        "SELECT * FROM team_message_replies WHERE message_id = ? ORDER BY created_at ASC"
      )
      .bind(id)
      .all();
    
    return c.json({ message, replies: replies.results || [] });
  });

  // Create a message
  app.post(
    "/api/portal/teams/:teamId/messages",
    authMiddleware,
    zValidator(
      "json",
      z.object({
        title: z.string(),
        content: z.string(),
      })
    ),
    async (c) => {
      const db = c.env.DB;
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      
      const teamId = Number(c.req.param("teamId"));
      const data = c.req.valid("json");
      
      // Check access
      const hasAccess = await canAccessTeam(db, user.id, user.email, teamId);
      if (!hasAccess) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const userName = getUserDisplayName(user);

      const result = await db
        .prepare(
          `INSERT INTO team_messages (team_id, title, content, author_user_id, author_name)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(teamId, data.title, data.content, user.id, userName)
        .run();

      await logActivity({
        db,
        userId: user.id,
        userName,
        action: "created",
        entityType: "team_message",
        entityId: result.meta.last_row_id,
        entityName: data.title,
        teamId,
      });

      // Send notifications
      const host = c.req.header("host") || "";
      const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
      
      if (isProduction) {
        const teamName = await db.prepare("SELECT name FROM teams WHERE id = ?").bind(teamId).first();
        
        const emailHtml = `
          <h2>New Team Message</h2>
          <p><strong>Team:</strong> ${teamName?.name || 'Team'}</p>
          <p><strong>From:</strong> ${userName}</p>
          <p><strong>Subject:</strong> ${data.title}</p>
          <p><strong>Message:</strong></p>
          <p>${data.content.replace(/\n/g, '<br>')}</p>
          <p><a href="https://capeannnoreasters.com/portal/teams/${teamId}">View Team Messages</a></p>
        `;
        
        const smsText = `New team message from ${userName}: ${data.title}. View at capeannnoreasters.com/portal/teams/${teamId}`;
        
        await sendNotifications({
          env: c.env,
          type: 'team_messages',
          subject: `Team Message: ${data.title}`,
          emailHtml,
          smsText,
          teamId,
        }).catch(err => console.error('Failed to send team message notifications:', err));
      }

      return c.json({ id: result.meta.last_row_id });
    }
  );

  // Reply to a message
  app.post(
    "/api/portal/teams/:teamId/messages/:id/replies",
    authMiddleware,
    zValidator(
      "json",
      z.object({
        content: z.string(),
      })
    ),
    async (c) => {
      const db = c.env.DB;
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      
      const teamId = Number(c.req.param("teamId"));
      const messageId = c.req.param("id");
      const data = c.req.valid("json");
      
      // Check access
      const hasAccess = await canAccessTeam(db, user.id, user.email, teamId);
      if (!hasAccess) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const userName = getUserDisplayName(user);

      const result = await db
        .prepare(
          `INSERT INTO team_message_replies (message_id, content, author_user_id, author_name)
           VALUES (?, ?, ?, ?)`
        )
        .bind(messageId, data.content, user.id, userName)
        .run();

      await logActivity({
        db,
        userId: user.id,
        userName,
        action: "replied",
        entityType: "team_message",
        entityId: Number(messageId),
        details: "Added a reply",
        teamId,
      });

      return c.json({ id: result.meta.last_row_id });
    }
  );

  // Toggle pin status (admin and coaches only)
  app.put("/api/portal/teams/:teamId/messages/:id/pin", authMiddleware, async (c) => {
    const db = c.env.DB;
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const teamId = Number(c.req.param("teamId"));
    const id = c.req.param("id");
    
    // Only admin and coaches can pin
    const adminCheck = await isAdmin(db, user.id, user.email);
    const roles = await getUserRoles(db, user.id);
    const isCoachForTeam = roles.some((r: any) => 
      r.role.toLowerCase() === 'coach' && r.team_id === teamId
    );
    
    if (!adminCheck && !isCoachForTeam) {
      return c.json({ error: "Forbidden - Admin or coach access required" }, 403);
    }

    const message = await db
      .prepare("SELECT * FROM team_messages WHERE id = ? AND team_id = ?")
      .bind(id, teamId)
      .first();

    if (!message) {
      return c.json({ error: "Message not found" }, 404);
    }

    const newPinStatus = message.is_pinned ? 0 : 1;

    await db
      .prepare("UPDATE team_messages SET is_pinned = ? WHERE id = ?")
      .bind(newPinStatus, id)
      .run();

    return c.json({ success: true, is_pinned: newPinStatus });
  });

  // Delete a message (admin and coaches only)
  app.delete("/api/portal/teams/:teamId/messages/:id", authMiddleware, async (c) => {
    const db = c.env.DB;
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const teamId = Number(c.req.param("teamId"));
    const id = c.req.param("id");
    
    // Only admin and coaches can delete
    const adminCheck = await isAdmin(db, user.id, user.email);
    const roles = await getUserRoles(db, user.id);
    const isCoachForTeam = roles.some((r: any) => 
      r.role.toLowerCase() === 'coach' && r.team_id === teamId
    );
    
    if (!adminCheck && !isCoachForTeam) {
      return c.json({ error: "Forbidden - Admin or coach access required" }, 403);
    }

    const userName = getUserDisplayName(user);

    // Get message details for logging
    const message = await db.prepare("SELECT * FROM team_messages WHERE id = ? AND team_id = ?").bind(id, teamId).first();

    // Delete replies first
    await db.prepare("DELETE FROM team_message_replies WHERE message_id = ?").bind(id).run();
    
    // Delete message
    await db.prepare("DELETE FROM team_messages WHERE id = ?").bind(id).run();

    if (message) {
      await logActivity({
        db,
        userId: user.id,
        userName,
        action: "deleted",
        entityType: "team_message",
        entityId: Number(id),
        entityName: message.title as string,
        teamId,
      });
    }

    return c.json({ success: true });
  });
}

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { logActivity, getUserDisplayName } from "./activity-logger";
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

async function isCoach(db: any, userId: string) {
  return hasRole(db, userId, 'coach');
}

// Middleware to require coach or admin access
const requireCoachOrAdmin = async (c: any, next: any) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const coachCheck = await isCoach(c.env.DB, user.id);
  
  if (!adminCheck && !coachCheck) {
    return c.json({ error: "Forbidden - Coach or Admin access required" }, 403);
  }
  
  await next();
};

export function setupCoachesEndpoints(app: Hono<{ Bindings: Env }>, authMiddleware: any) {
  // Upload file to R2 for coaches documents
  app.post("/api/portal/coaches/documents/upload", authMiddleware, requireCoachOrAdmin, async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Determine content type
    const getContentType = (filename: string) => {
      const ext = filename.toLowerCase().split('.').pop();
      const types: Record<string, string> = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'txt': 'text/plain',
        'csv': 'text/csv',
      };
      return types[ext || ''] || 'application/octet-stream';
    };

    const contentType = file.type || getContentType(file.name);
    const fileBuffer = await file.arrayBuffer();
    const fileKey = `coaches-documents/${Date.now()}-${file.name}`;

    await c.env.R2_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    return c.json({ file_key: fileKey });
  });

  // Download coaches document
  app.get("/api/portal/coaches/documents/download/*", authMiddleware, requireCoachOrAdmin, async (c) => {
    // Get the file key from the path after /download/
    const path = c.req.path;
    const fileKey = path.replace('/api/portal/coaches/documents/download/', '');

    const object = await c.env.R2_BUCKET.get(fileKey);
    if (!object) {
      return c.json({ error: "File not found" }, 404);
    }

    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    
    // Extract filename from key
    const fileName = fileKey.split('/').pop() || 'download';
    const safeFileName = fileName.replace(/[^\x20-\x7E]/g, '_');

    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Content-Length": object.size.toString(),
        "Cache-Control": "no-cache",
      },
    });
  });

  // Get all coaches documents
  app.get("/api/portal/coaches/documents", authMiddleware, requireCoachOrAdmin, async (c) => {
    const db = c.env.DB;
    
    const result = await db
      .prepare("SELECT * FROM coaches_documents ORDER BY created_at DESC")
      .all();
    
    return c.json(result.results || []);
  });

  // Upload a coaches document
  app.post(
    "/api/portal/coaches/documents",
    authMiddleware,
    requireCoachOrAdmin,
    zValidator(
      "json",
      z.object({
        title: z.string(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        file_key: z.string(),
        file_name: z.string(),
        file_size: z.number().nullable().optional(),
      })
    ),
    async (c) => {
      const db = c.env.DB;
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const userId = user.id;
      const data = c.req.valid("json");

      const userName = getUserDisplayName(user);

      const result = await db
        .prepare(
          `INSERT INTO coaches_documents (title, description, category, file_key, file_name, file_size, uploaded_by_user_id, uploaded_by_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          data.title,
          data.description || null,
          data.category || null,
          data.file_key,
          data.file_name,
          data.file_size || null,
          userId,
          userName
        )
        .run();

      await logActivity({
        db,
        userId,
        userName,
        action: "created",
        entityType: "coaches_document",
        entityId: result.meta.last_row_id,
        entityName: data.title,
        details: `Uploaded ${data.file_name}`,
      });

      return c.json({ id: result.meta.last_row_id });
    }
  );

  // Delete a coaches document
  app.delete("/api/portal/coaches/documents/:id", authMiddleware, requireCoachOrAdmin, async (c) => {
    const db = c.env.DB;
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const userId = user.id;
    const id = c.req.param("id");

    const userName = getUserDisplayName(user);

    // Get document details for logging
    const doc = await db.prepare("SELECT * FROM coaches_documents WHERE id = ?").bind(id).first();

    await db.prepare("DELETE FROM coaches_documents WHERE id = ?").bind(id).run();

    if (doc) {
      await logActivity({
        db,
        userId,
        userName,
        action: "deleted",
        entityType: "coaches_document",
        entityId: Number(id),
        entityName: doc.title as string,
        details: `Deleted ${doc.file_name}`,
      });
    }

    return c.json({ success: true });
  });

  // Get all coaches messages with reply counts
  app.get("/api/portal/coaches/messages", authMiddleware, requireCoachOrAdmin, async (c) => {
    const db = c.env.DB;
    
    const result = await db
      .prepare(
        `SELECT 
          m.*,
          COUNT(r.id) as reply_count
         FROM coaches_messages m
         LEFT JOIN coaches_message_replies r ON m.id = r.message_id
         GROUP BY m.id
         ORDER BY m.is_pinned DESC, m.created_at DESC`
      )
      .all();
    
    return c.json(result.results || []);
  });

  // Get a single message with replies
  app.get("/api/portal/coaches/messages/:id", authMiddleware, requireCoachOrAdmin, async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    
    const message = await db
      .prepare("SELECT * FROM coaches_messages WHERE id = ?")
      .bind(id)
      .first();
    
    if (!message) {
      return c.json({ error: "Message not found" }, 404);
    }

    const replies = await db
      .prepare(
        "SELECT * FROM coaches_message_replies WHERE message_id = ? ORDER BY created_at ASC"
      )
      .bind(id)
      .all();
    
    return c.json({ message, replies: replies.results || [] });
  });

  // Create a message
  app.post(
    "/api/portal/coaches/messages",
    authMiddleware,
    requireCoachOrAdmin,
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
      const userId = user.id;
      const data = c.req.valid("json");

      const userName = getUserDisplayName(user);

      const result = await db
        .prepare(
          `INSERT INTO coaches_messages (title, content, author_user_id, author_name)
           VALUES (?, ?, ?, ?)`
        )
        .bind(data.title, data.content, userId, userName)
        .run();

      await logActivity({
        db,
        userId,
        userName,
        action: "created",
        entityType: "coaches_message",
        entityId: result.meta.last_row_id,
        entityName: data.title,
      });

      // Send notifications to users who opted in for coach messages
      const host = c.req.header("host") || "";
      const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
      
      if (isProduction) {
        try {
          const prefs = await db.prepare(`
            SELECT np.user_id, np.notification_email, np.notification_phone,
                   np.coach_messages_email, np.coach_messages_text
            FROM notification_preferences np
            WHERE (np.coach_messages_email = 1 OR np.coach_messages_text = 1)
              AND (np.notification_email IS NOT NULL OR np.notification_phone IS NOT NULL)
          `).all();

          for (const pref of prefs.results || []) {
            if (pref.coach_messages_email && pref.notification_email) {
              const emailHtml = `
                <h2>New Message in Coaches Portal</h2>
                <p><strong>From:</strong> ${userName}</p>
                <p><strong>Subject:</strong> ${data.title}</p>
                <p><strong>Message:</strong></p>
                <p>${data.content.replace(/\n/g, '<br>')}</p>
                <p><a href="https://capeannnoreasters.com/portal/coaches/messages/${result.meta.last_row_id}">View Message</a></p>
              `;

              await c.env.EMAILS.send({
                to: pref.notification_email as string,
                subject: `Coaches Portal: ${data.title}`,
                html_body: emailHtml,
              }).catch(err => console.error('Failed to send coach message notification:', err));
            }
          }
        } catch (error) {
          console.error('Error sending coach message notifications:', error);
        }
      }

      return c.json({ id: result.meta.last_row_id });
    }
  );

  // Reply to a message
  app.post(
    "/api/portal/coaches/messages/:id/replies",
    authMiddleware,
    requireCoachOrAdmin,
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
      const userId = user.id;
      const messageId = c.req.param("id");
      const data = c.req.valid("json");

      const userName = getUserDisplayName(user);

      const result = await db
        .prepare(
          `INSERT INTO coaches_message_replies (message_id, content, author_user_id, author_name)
           VALUES (?, ?, ?, ?)`
        )
        .bind(messageId, data.content, userId, userName)
        .run();

      await logActivity({
        db,
        userId,
        userName,
        action: "replied",
        entityType: "coaches_message",
        entityId: Number(messageId),
        details: "Added a reply",
      });

      return c.json({ id: result.meta.last_row_id });
    }
  );

  // Toggle pin status (admin only)
  app.put("/api/portal/coaches/messages/:id/pin", authMiddleware, requireCoachOrAdmin, async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");

    const message = await db
      .prepare("SELECT * FROM coaches_messages WHERE id = ?")
      .bind(id)
      .first();

    if (!message) {
      return c.json({ error: "Message not found" }, 404);
    }

    const newPinStatus = message.is_pinned ? 0 : 1;

    await db
      .prepare("UPDATE coaches_messages SET is_pinned = ? WHERE id = ?")
      .bind(newPinStatus, id)
      .run();

    return c.json({ success: true, is_pinned: newPinStatus });
  });

  // Delete a message
  app.delete("/api/portal/coaches/messages/:id", authMiddleware, requireCoachOrAdmin, async (c) => {
    const db = c.env.DB;
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const userId = user.id;
    const id = c.req.param("id");

    const userName = getUserDisplayName(user);

    // Get message details for logging
    const message = await db.prepare("SELECT * FROM coaches_messages WHERE id = ?").bind(id).first();

    // Delete replies first
    await db.prepare("DELETE FROM coaches_message_replies WHERE message_id = ?").bind(id).run();
    
    // Delete message
    await db.prepare("DELETE FROM coaches_messages WHERE id = ?").bind(id).run();

    if (message) {
      await logActivity({
        db,
        userId,
        userName,
        action: "deleted",
        entityType: "coaches_message",
        entityId: Number(id),
        entityName: message.title as string,
      });
    }

    return c.json({ success: true });
  });
}

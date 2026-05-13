import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { logActivity, getUserDisplayName } from "./activity-logger";
import type { Env } from "@/shared/types";

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'coach', 'parent']),
  team_id: z.number().nullable().optional(),
  family_id: z.number().nullable().optional(),
  expires_in_days: z.number().default(7),
});

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function setupInviteEndpoints(app: Hono<{ Bindings: Env }>, authMiddleware: any, requireAdmin: any) {
  // Create invite (admin only)
  app.post("/api/portal/invites", authMiddleware, requireAdmin, zValidator("json", createInviteSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const data = c.req.valid("json");
    
    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await c.env.DB.prepare("SELECT id FROM invites WHERE code = ?").bind(code).first();
      if (!existing) break;
      code = generateInviteCode();
      attempts++;
    }
    
    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.expires_in_days);
    
    const result = await c.env.DB.prepare(`
      INSERT INTO invites (email, code, role, team_id, family_id, invited_by_user_id, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      data.email,
      code,
      data.role,
      data.team_id || null,
      data.family_id || null,
      user.id,
      expiresAt.toISOString()
    ).run();
    
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'created',
      entityType: 'invite',
      entityId: Number(result.meta.last_row_id),
      entityName: data.email,
      details: `${data.role} role`,
    });
    
    // Send invite email
    const inviteUrl = `${c.req.url.split('/api')[0]}/invite/${code}`;
    const inviterName = getUserDisplayName(user);
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
    <div style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e4e4e7;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">You've Been Invited</h1>
    </div>
    <div style="padding: 32px 40px;">
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        ${inviterName} has invited you to join Cape Ann Nor'easters as a ${data.role}.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Click the button below to accept your invitation and complete your registration.
      </p>
      <a href="${inviteUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background-color: #00c4ff; color: #18181b; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">Accept Invitation</a>
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Or copy and paste this link into your browser:<br>
        <span style="color: #3f3f46;">${inviteUrl}</span>
      </p>
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        This invitation expires in ${data.expires_in_days} days.
      </p>
    </div>
    <div style="padding: 24px 40px; border-top: 1px solid #e4e4e7;">
      <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">Cape Ann Nor'easters Flag Football</p>
    </div>
  </div>
</body>
</html>
    `;
    
    const emailText = `${inviterName} has invited you to join Cape Ann Nor'easters as a ${data.role}.\n\nAccept your invitation here: ${inviteUrl}\n\nThis invitation expires in ${data.expires_in_days} days.`;
    
    await c.env.EMAILS.send({
      to: data.email,
      subject: 'Invitation to Cape Ann Nor\'easters',
      html_body: emailHtml,
      text_body: emailText,
    });
    
    return c.json({ 
      id: result.meta.last_row_id,
      code,
      email: data.email,
      role: data.role,
      expires_at: expiresAt.toISOString()
    }, 201);
  });

  // Get all invites (admin only)
  app.get("/api/portal/invites", authMiddleware, requireAdmin, async (c) => {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        i.*,
        t.name as team_name,
        f.name as family_name
      FROM invites i
      LEFT JOIN teams t ON i.team_id = t.id
      LEFT JOIN families f ON i.family_id = f.id
      ORDER BY i.created_at DESC
    `).all();
    
    return c.json(results);
  });

  // Delete/revoke invite (admin only)
  app.delete("/api/portal/invites/:id", authMiddleware, requireAdmin, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    
    // Get invite info before deleting
    const invite = await c.env.DB.prepare(
      "SELECT * FROM invites WHERE id = ?"
    ).bind(id).first();
    
    await c.env.DB.prepare("DELETE FROM invites WHERE id = ?").bind(id).run();
    
    if (invite && user) {
      await logActivity({
        db: c.env.DB,
        userId: user.id,
        userName: getUserDisplayName(user),
        action: 'deleted',
        entityType: 'invite',
        entityId: Number(id),
        entityName: (invite as any).email,
        details: `${(invite as any).role} role`,
      });
    }
    
    return c.json({ success: true });
  });

  // Resend invite (admin only)
  app.post("/api/portal/invites/:id/resend", authMiddleware, requireAdmin, async (c) => {
    const id = c.req.param("id");
    
    const invite = await c.env.DB.prepare("SELECT * FROM invites WHERE id = ?").bind(id).first();
    if (!invite) {
      return c.json({ error: "Invite not found" }, 404);
    }
    
    // Generate new code and extend expiration
    let code = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await c.env.DB.prepare(`
      UPDATE invites 
      SET code = ?, expires_at = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(code, expiresAt.toISOString(), id).run();
    
    // Send invite email
    const inviteUrl = `${c.req.url.split('/api')[0]}/invite/${code}`;
    const user = c.get("user");
    const inviterName = user ? getUserDisplayName(user) : 'An administrator';
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
    <div style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e4e4e7;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">You've Been Invited</h1>
    </div>
    <div style="padding: 32px 40px;">
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        ${inviterName} has invited you to join Cape Ann Nor'easters as a ${(invite as any).role}.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Click the button below to accept your invitation and complete your registration.
      </p>
      <a href="${inviteUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background-color: #00c4ff; color: #18181b; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">Accept Invitation</a>
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Or copy and paste this link into your browser:<br>
        <span style="color: #3f3f46;">${inviteUrl}</span>
      </p>
    </div>
    <div style="padding: 24px 40px; border-top: 1px solid #e4e4e7;">
      <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">Cape Ann Nor'easters Flag Football</p>
    </div>
  </div>
</body>
</html>
    `;
    
    const emailText = `${inviterName} has invited you to join Cape Ann Nor'easters as a ${(invite as any).role}.\n\nAccept your invitation here: ${inviteUrl}`;
    
    await c.env.EMAILS.send({
      to: (invite as any).email,
      subject: 'Invitation to Cape Ann Nor\'easters',
      html_body: emailHtml,
      text_body: emailText,
    });
    
    return c.json({ 
      code,
      expires_at: expiresAt.toISOString()
    });
  });

  // Validate invite code (public - no auth required)
  app.get("/api/invites/validate/:code", async (c) => {
    const code = c.req.param("code");
    
    const invite = await c.env.DB.prepare(`
      SELECT email, role, expires_at, status
      FROM invites 
      WHERE code = ?
    `).bind(code).first();
    
    if (!invite) {
      return c.json({ valid: false, error: "Invalid invite code" }, 404);
    }
    
    if ((invite as any).status !== 'pending') {
      return c.json({ valid: false, error: "Invite already used" }, 400);
    }
    
    const expiresAt = new Date((invite as any).expires_at);
    if (expiresAt < new Date()) {
      return c.json({ valid: false, error: "Invite expired" }, 400);
    }
    
    return c.json({ 
      valid: true,
      email: (invite as any).email,
      role: (invite as any).role
    });
  });

  // Accept invite and complete onboarding (authenticated)
  app.post("/api/portal/invites/accept", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const body = await c.req.json();
    const { code } = body;
    
    if (!code) {
      return c.json({ error: "Invite code required" }, 400);
    }
    
    // Find and validate invite
    const invite = await c.env.DB.prepare(`
      SELECT * FROM invites WHERE code = ?
    `).bind(code).first() as any;
    
    if (!invite) {
      return c.json({ error: "Invalid invite code" }, 404);
    }
    
    if (invite.status !== 'pending') {
      return c.json({ error: "Invite already used" }, 400);
    }
    
    const expiresAt = new Date(invite.expires_at);
    if (expiresAt < new Date()) {
      return c.json({ error: "Invite expired" }, 400);
    }
    
    // Note: We don't check if the logged-in email matches the invited email
    // because users may log in with different Google accounts than the email
    // they were invited to (e.g., personal vs work email)
    
    // Create user role with email and name
    const userName = (user as any).google_user_data?.name || (user as any).google_user_data?.given_name || user.email;
    await c.env.DB.prepare(`
      INSERT INTO user_roles (user_id, email, name, role, team_id, family_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(user.id, user.email, userName, invite.role, invite.team_id, invite.family_id).run();
    
    // Mark invite as accepted
    await c.env.DB.prepare(`
      UPDATE invites 
      SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(invite.id).run();
    
    if (user) {
      await logActivity({
        db: c.env.DB,
        userId: user.id,
        userName: getUserDisplayName(user),
        action: 'accepted',
        entityType: 'invite',
        entityId: Number(invite.id),
        entityName: invite.email,
        details: `${invite.role} role`,
      });
    }
    
    return c.json({ 
      success: true,
      role: invite.role,
      family_id: invite.family_id
    });
  });
}

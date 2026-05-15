import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";
import { sendEmail } from "../lib/email.ts";

export const invitesRouter = Router();

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function buildInviteEmailHtml(inviterName: string, role: string, inviteUrl: string, inviteCode: string, expiresInDays: number) {
  const signInUrl = inviteUrl.substring(0, inviteUrl.lastIndexOf("/invite/")) + "/sign-in";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
    <div style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e4e4e7;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">You've Been Invited</h1>
    </div>
    <div style="padding: 32px 40px;">
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        ${inviterName} has invited you to join Cape Ann Nor'easters as a ${role}.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Click the button below to accept your invitation and complete your registration.
      </p>
      <a href="${inviteUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background-color: #00c4ff; color: #18181b; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">Accept Invitation</a>
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Or copy and paste this link into your browser:<br>
        <span style="color: #3f3f46;">${inviteUrl}</span>
      </p>
      <div style="margin: 24px 0; padding: 16px; background-color: #f4f4f5; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #71717a;">Signing up with email and password instead? Use this invite code on the Sign Up tab at <a href="${signInUrl}" style="color: #00c4ff;">${signInUrl}</a>:</p>
        <p style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #18181b; font-family: monospace;">${inviteCode}</p>
      </div>
      ${expiresInDays ? `<p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">This invitation expires in ${expiresInDays} days.</p>` : ""}
    </div>
    <div style="padding: 24px 40px; border-top: 1px solid #e4e4e7;">
      <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">Cape Ann Nor'easters Flag Football</p>
    </div>
  </div>
</body>
</html>`;
}

invitesRouter.post("/invites", requireAuth, requireAdmin, async (req, res) => {
  const { email, role, team_id, family_id, expires_in_days = 7 } = req.body;
  if (!email || !role) {
    res.status(400).json({ error: "email and role are required" });
    return;
  }

  let code = generateInviteCode();
  for (let i = 0; i < 10; i++) {
    const existing = await pool.query("SELECT id FROM invites WHERE code = $1", [code]);
    if (existing.rows.length === 0) break;
    code = generateInviteCode();
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expires_in_days);

  const result = await pool.query(
    `INSERT INTO invites (email, code, role, team_id, family_id, invited_by_user_id, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [email, code, role, team_id || null, family_id || null, req.user!.id, expiresAt.toISOString()]
  );

  await logActivity({
    userId: req.user!.id,
    userName: getUserDisplayName(req.user!),
    action: "created",
    entityType: "invite",
    entityId: result.rows[0].id,
    entityName: email,
    details: `${role} role`,
  });

  const origin = `${req.protocol}://${req.get("host")}`;
  const inviteUrl = `${process.env.FRONTEND_URL ?? origin}/invite/${code}`;
  const inviterName = getUserDisplayName(req.user!);

  const emailResult = await sendEmail({
    to: email,
    subject: "Invitation to Cape Ann Nor'easters",
    html: buildInviteEmailHtml(inviterName, role, inviteUrl, code, expires_in_days),
  });
  if (!emailResult.success) {
    console.warn(`Failed to send invite email to ${email}:`, emailResult.error);
  }

  res.status(201).json({ id: result.rows[0].id, code, email, role, expires_at: expiresAt.toISOString() });
});

invitesRouter.get("/invites", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query(`
    SELECT i.*, t.name as team_name, f.name as family_name
    FROM invites i
    LEFT JOIN teams t ON i.team_id = t.id
    LEFT JOIN families f ON i.family_id = f.id
    ORDER BY i.created_at DESC
  `);
  res.json(result.rows);
});

invitesRouter.delete("/invites/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const existing = await pool.query("SELECT * FROM invites WHERE id = $1", [id]);
  const invite = existing.rows[0];

  await pool.query("DELETE FROM invites WHERE id = $1", [id]);

  if (invite) {
    await logActivity({
      userId: req.user!.id,
      userName: getUserDisplayName(req.user!),
      action: "deleted",
      entityType: "invite",
      entityId: Number(id),
      entityName: invite.email,
      details: `${invite.role} role`,
    });
  }

  res.json({ success: true });
});

invitesRouter.post("/invites/:id/resend", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const existing = await pool.query("SELECT * FROM invites WHERE id = $1", [id]);
  const invite = existing.rows[0];
  if (!invite) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    `UPDATE invites SET code = $1, expires_at = $2, status = 'pending', updated_at = NOW() WHERE id = $3`,
    [code, expiresAt.toISOString(), id]
  );

  const inviteUrl = `${process.env.FRONTEND_URL ?? `${req.protocol}://${req.get("host")}`}/invite/${code}`;
  const inviterName = getUserDisplayName(req.user!);

  const resendResult = await sendEmail({
    to: invite.email,
    subject: "Invitation to Cape Ann Nor'easters",
    html: buildInviteEmailHtml(inviterName, invite.role, inviteUrl, code, 7),
  });
  if (!resendResult.success) {
    console.warn(`Failed to resend invite email to ${invite.email}:`, resendResult.error);
  }

  res.json({ code, expires_at: expiresAt.toISOString() });
});

invitesRouter.post("/invites/accept", requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: "Invite code required" });
    return;
  }

  const existing = await pool.query("SELECT * FROM invites WHERE code = $1", [code]);
  const invite = existing.rows[0];
  if (!invite) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }

  if (invite.status !== "pending") {
    res.status(400).json({ error: "Invite already used" });
    return;
  }

  if (new Date(invite.expires_at) < new Date()) {
    res.status(400).json({ error: "Invite expired" });
    return;
  }

  const userName = getUserDisplayName(req.user!);
  await pool.query(
    `INSERT INTO user_roles (user_id, email, name, role, team_id, family_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [req.user!.id, req.user!.email, userName, invite.role, invite.team_id, invite.family_id]
  );

  await pool.query(
    `UPDATE invites SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [invite.id]
  );

  await logActivity({
    userId: req.user!.id,
    userName: getUserDisplayName(req.user!),
    action: "accepted",
    entityType: "invite",
    entityId: Number(invite.id),
    entityName: invite.email,
    details: `${invite.role} role`,
  });

  res.json({ success: true, role: invite.role, family_id: invite.family_id });
});

import { Router } from "express";
import { pool } from "../lib/db.ts";
import { supabase } from "../lib/supabase.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles, getFamilyId } from "../middleware/roles.ts";

export const authRouter = Router();

authRouter.get("/oauth/google/redirect_url", async (req, res) => {
  const origin = process.env.FRONTEND_URL ?? `${req.protocol}://${req.get("host")}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ redirectUrl: data.url });
});

authRouter.get("/users/me", requireAuth, async (req, res) => {
  const user = req.user!;
  const adminCheck = await isAdmin(user.id, user.email!);
  const roles = await getUserRoles(user.id);
  const familyId = await getFamilyId(user.id);
  res.json({ ...user, is_admin: adminCheck, roles, family_id: familyId });
});

authRouter.get("/logout", (_req, res) => {
  res.json({ success: true });
});

authRouter.get("/invites/validate/:code", async (req, res) => {
  const { code } = req.params;
  const result = await pool.query(
    "SELECT email, role, expires_at, status FROM invites WHERE code = $1",
    [code]
  );
  const invite = result.rows[0];
  if (!invite) { res.status(404).json({ valid: false, error: "Invalid invite code" }); return; }
  if (invite.status !== "pending") { res.status(400).json({ valid: false, error: "Invite already used" }); return; }
  if (new Date(invite.expires_at) < new Date()) { res.status(400).json({ valid: false, error: "Invite expired" }); return; }
  res.json({ valid: true, email: invite.email, role: invite.role });
});

// Same validation via query param — called from sign-up form before account creation
authRouter.get("/invites/validate", async (req, res) => {
  const code = req.query.code as string;
  if (!code) { res.status(400).json({ valid: false, error: "code is required" }); return; }
  const result = await pool.query(
    "SELECT email, role, expires_at, status FROM invites WHERE code = $1",
    [code]
  );
  const invite = result.rows[0];
  if (!invite) { res.status(404).json({ valid: false, error: "Invalid invite code" }); return; }
  if (invite.status !== "pending") { res.status(400).json({ valid: false, error: "Invite already used" }); return; }
  if (new Date(invite.expires_at) < new Date()) { res.status(400).json({ valid: false, error: "Invite expired" }); return; }
  res.json({ valid: true, email: invite.email, role: invite.role });
});

// Called after email confirmation — assigns role from the invite and marks it used
authRouter.post("/invites/redeem", requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "code is required" }); return; }

  const result = await pool.query(
    "SELECT * FROM invites WHERE code = $1",
    [code]
  );
  const invite = result.rows[0];
  if (!invite) { res.status(404).json({ error: "Invalid invite code" }); return; }
  if (invite.status !== "pending") { res.status(400).json({ error: "Invite already used" }); return; }
  if (new Date(invite.expires_at) < new Date()) { res.status(400).json({ error: "Invite expired" }); return; }

  const user = req.user!;
  await pool.query(
    `INSERT INTO user_roles (user_id, email, name, role, team_id, family_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT DO NOTHING`,
    [user.id, user.email, user.user_metadata?.full_name ?? null, invite.role, invite.team_id, invite.family_id]
  );

  await pool.query(
    `UPDATE invites SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [invite.id]
  );

  res.json({ success: true, role: invite.role, family_id: invite.family_id });
});

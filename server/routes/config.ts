import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin } from "../middleware/roles.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";
import { sendEmail } from "../lib/email.ts";

export const configRouter = Router();

configRouter.get("/tryout-config", async (_req, res) => {
  const result = await pool.query(
    "SELECT * FROM tryout_config WHERE is_enabled = TRUE ORDER BY id DESC LIMIT 1"
  );
  res.json(result.rows[0] || null);
});

configRouter.get("/site-config/banner", async (_req, res) => {
  const result = await pool.query(
    "SELECT config_key, config_value FROM site_config WHERE config_key LIKE 'banner_%'"
  );
  const cfg: Record<string, string> = {};
  for (const row of result.rows) cfg[row.config_key] = row.config_value || "";
  if (cfg.banner_enabled !== "1") { res.json(null); return; }
  res.json({ text: cfg.banner_text || "", link: cfg.banner_link || "", type: cfg.banner_type || "info" });
});

configRouter.post("/request-tryout", async (req, res) => {
  const { playerName, parentName, email, phone, preferredContact, birthYear, flagExperience, tournamentExperience, primaryGoal, coachingInterest, additionalComments } = req.body;
  if (!playerName || !parentName || !email || !phone || !birthYear) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const nameParts = playerName.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const birthDate = `${birthYear}-01-01`;
  const notes = [
    preferredContact ? `Preferred Contact: ${preferredContact}` : null,
    flagExperience ? `Flag Football Experience: ${flagExperience} years` : null,
    tournamentExperience ? `Tournament Experience: ${tournamentExperience} years` : null,
    primaryGoal ? `Primary Goal: ${primaryGoal}` : null,
    coachingInterest ? `Coaching/Volunteering Interest: ${coachingInterest}` : null,
    additionalComments ? `Additional Comments: ${additionalComments}` : null,
  ].filter(Boolean).join("\n");

  const result = await pool.query(
    `INSERT INTO prospects (first_name, last_name, birth_date, parent_name, parent_email, parent_phone, status, interest_level, source, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'New','High','Website Tryout Request',$7,NOW(),NOW()) RETURNING id`,
    [firstName, lastName, birthDate, parentName, email, phone, notes]
  );

  await sendEmail({
    to: process.env.ADMIN_EMAIL ?? "admin@capeannnoreasters.com",
    subject: `Tryout Request: ${playerName}`,
    html: `<h2>New Tryout Request</h2>
      <p><strong>Player:</strong> ${playerName}</p>
      <p><strong>Parent:</strong> ${parentName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Birth Year:</strong> ${birthYear}</p>
      ${flagExperience ? `<p><strong>Flag Experience:</strong> ${flagExperience} years</p>` : ""}
      ${additionalComments ? `<p><strong>Comments:</strong> ${additionalComments}</p>` : ""}`,
  });

  res.json({ success: true, prospectId: result.rows[0].id });
});

configRouter.get("/public-events", async (_req, res) => {
  const result = await pool.query(
    `SELECT e.id, e.team_id, e.event_type, e.title, e.description, e.location, e.start_at, e.end_at, e.is_cancelled, e.cost, t.name as team_name
     FROM events e LEFT JOIN teams t ON e.team_id = t.id
     WHERE e.start_at >= NOW() AND e.event_type = 'tournament'
     ORDER BY e.start_at ASC LIMIT 100`
  );
  res.json(result.rows);
});

// Authenticated config routes
configRouter.get("/portal/tryout-config", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query("SELECT * FROM tryout_config ORDER BY id DESC LIMIT 1");
  res.json(result.rows[0] || null);
});

configRouter.put("/portal/tryout-config", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { is_enabled, tryout_date, title, description } = req.body;
  const existing = await pool.query("SELECT id FROM tryout_config ORDER BY id DESC LIMIT 1");
  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE tryout_config SET is_enabled = $1, tryout_date = $2, title = $3, description = $4, updated_at = NOW() WHERE id = $5",
      [!!is_enabled, tryout_date || null, title || null, description || null, existing.rows[0].id]
    );
  } else {
    await pool.query(
      "INSERT INTO tryout_config (is_enabled, tryout_date, title, description, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())",
      [!!is_enabled, tryout_date || null, title || null, description || null]
    );
  }
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated", entityType: "tryout_config", entityName: "Tryout Configuration" });
  res.json({ success: true });
});

configRouter.get("/portal/site-config", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query("SELECT config_key, config_value FROM site_config");
  const cfg: Record<string, string> = {};
  for (const row of result.rows) cfg[row.config_key] = row.config_value || "";
  res.json(cfg);
});

configRouter.put("/portal/site-config/banner", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { enabled, text, link, type } = req.body;
  const updates = [
    ["banner_enabled", enabled ? "1" : "0"],
    ["banner_text", text],
    ["banner_link", link],
    ["banner_type", type],
  ];
  for (const [key, value] of updates) {
    await pool.query("UPDATE site_config SET config_value = $1, updated_at = NOW() WHERE config_key = $2", [value, key]);
  }
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated", entityType: "site_config", entityName: "Homepage Banner" });
  res.json({ success: true });
});

configRouter.get("/portal/user-permissions/:userId", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query(
    "SELECT permission_key, permission_value FROM user_permissions WHERE user_id = $1",
    [req.params.userId]
  );
  const perms: Record<string, string> = {};
  for (const row of result.rows) perms[row.permission_key] = row.permission_value || "";
  res.json(perms);
});

configRouter.put("/portal/user-permissions/:userId", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { userId } = req.params;
  const permKeys = ["recruiting_access", "recruiting_age_groups", "messaging_send", "documents_upload", "documents_download", "events_manage"];
  for (const key of permKeys) {
    const value = req.body[key];
    if (value === undefined) continue;
    const existing = await pool.query("SELECT id FROM user_permissions WHERE user_id = $1 AND permission_key = $2", [userId, key]);
    if (existing.rows.length > 0) {
      await pool.query("UPDATE user_permissions SET permission_value = $1, updated_at = NOW() WHERE user_id = $2 AND permission_key = $3", [value, userId, key]);
    } else {
      await pool.query("INSERT INTO user_permissions (user_id, permission_key, permission_value, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())", [userId, key, value]);
    }
  }
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated", entityType: "user_permissions", entityName: "User Permissions" });
  res.json({ success: true });
});

configRouter.get("/portal/stats", requireAuth, async (req, res) => {
  const user = req.user!;
  const adminCheck = await isAdmin(user.id, user.email!);

  if (adminCheck) {
    const [teams, players, events, payments, prospects, uniforms, surveys, docs] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM teams"),
      pool.query("SELECT COUNT(*) as count FROM players"),
      pool.query("SELECT COUNT(*) as count FROM events WHERE start_at > NOW()"),
      pool.query("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as count FROM prospects"),
      pool.query("SELECT COUNT(*) as count FROM uniform_orders WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as count FROM surveys WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())"),
      pool.query("SELECT COUNT(*) as count FROM team_documents"),
    ]);
    res.json({
      totalTeams: Number(teams.rows[0].count),
      totalPlayers: Number(players.rows[0].count),
      upcomingEvents: Number(events.rows[0].count),
      pendingPayments: Number(payments.rows[0].count),
      totalRecruits: Number(prospects.rows[0].count),
      pendingUniformOrders: Number(uniforms.rows[0].count),
      activeSurveys: Number(surveys.rows[0].count),
      totalDocuments: Number(docs.rows[0].count),
      unreadMessages: 0,
    });
  } else {
    res.json({ totalTeams: 0, totalPlayers: 0, upcomingEvents: 0, pendingPayments: 0, totalRecruits: 0, pendingUniformOrders: 0, activeSurveys: 0, totalDocuments: 0, unreadMessages: 0 });
  }
});

configRouter.get("/portal/admin-check", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email!);
  res.json({ isAdmin: adminCheck });
});

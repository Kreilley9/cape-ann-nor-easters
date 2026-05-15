import { Router } from "express";
import multer from "multer";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin, isAdmin, getUserRoles, getFamilyId } from "../middleware/roles.ts";
import { uploadFile, getSignedUrl } from "../lib/storage.ts";
import { sendNotifications } from "../lib/notification-helper.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";
import { canUploadDocuments, canDownloadDocuments } from "../lib/permissions-helper.ts";

export const teamsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
};

function getContentType(filename: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

async function canAccessTeam(userId: string, userEmail: string | undefined, teamId: string) {
  const adminCheck = await isAdmin(userId, userEmail);
  if (adminCheck) return true;
  const roles = await getUserRoles(userId);
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);
  if (coachTeamIds.includes(parseInt(teamId as string))) return true;
  const isParent = roles.some(r => r.role === "parent");
  if (isParent) {
    const familyId = await getFamilyId(userId);
    if (familyId) {
      const res = await pool.query(
        `SELECT 1 FROM team_players tp JOIN players p ON tp.player_id = p.id WHERE tp.team_id = $1 AND p.family_id = $2 LIMIT 1`,
        [teamId, familyId]
      );
      if (res.rows.length > 0) return true;
    }
  }
  return false;
}

teamsRouter.get("/teams", requireAuth, async (_req, res) => {
  const result = await pool.query(`
    SELECT t.*, (SELECT COUNT(*) FROM team_players WHERE team_id = t.id AND is_active = TRUE) as player_count
    FROM teams t ORDER BY t.name ASC
  `);
  res.json(result.rows);
});

teamsRouter.get("/seasons/:seasonId/teams", requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT t.*, ts.division,
      (SELECT COUNT(*) FROM team_players WHERE team_id = t.id AND is_active = TRUE) as player_count
    FROM teams t
    JOIN team_seasons ts ON t.id = ts.team_id
    WHERE ts.season_id = $1
    ORDER BY t.age_group ASC, t.name ASC
  `, [req.params.seasonId]);
  res.json(result.rows);
});

teamsRouter.post("/teams", requireAuth, requireAdmin, async (req, res) => {
  const { name, age_group, head_coach_user_id, assistant_coach_user_id } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const result = await pool.query(
    `INSERT INTO teams (name, age_group, head_coach_user_id, assistant_coach_user_id, season_id, updated_at)
     VALUES ($1,$2,$3,$4,1,NOW()) RETURNING id`,
    [name, age_group || null, head_coach_user_id || null, assistant_coach_user_id || null]
  );
  const id = result.rows[0].id;
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created", entityType: "team", entityId: id, entityName: name });
  res.status(201).json({ id });
});

teamsRouter.get("/teams/:teamId/seasons", requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT s.*, ts.division FROM seasons s
    JOIN team_seasons ts ON s.id = ts.season_id
    WHERE ts.team_id = $1 ORDER BY s.year DESC, s.name ASC
  `, [req.params.teamId]);
  res.json(result.rows);
});

teamsRouter.post("/teams/:teamId/seasons", requireAuth, requireAdmin, async (req, res) => {
  const { season_id, division } = req.body;
  if (!season_id) { res.status(400).json({ error: "season_id required" }); return; }
  const result = await pool.query(
    `INSERT INTO team_seasons (team_id, season_id, division, updated_at) VALUES ($1,$2,$3,NOW()) RETURNING id`,
    [req.params.teamId, season_id, division || null]
  );
  res.status(201).json({ id: result.rows[0].id });
});

teamsRouter.get("/teams/:teamId/roster", requireAuth, async (req, res) => {
  const { teamId } = req.params;
  if (!(await canAccessTeam(req.user!.id, req.user!.email, teamId as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const result = await pool.query(`
    SELECT p.id, p.first_name, p.last_name, p.jersey_number, p.birth_date, p.status, p.zorts_expiration_date,
           tp.position, f.name as family_name
    FROM team_players tp
    JOIN players p ON tp.player_id = p.id
    LEFT JOIN families f ON p.family_id = f.id
    WHERE tp.team_id = $1 AND tp.is_active = TRUE
    ORDER BY p.last_name ASC, p.first_name ASC
  `, [teamId]);
  res.json(result.rows);
});

teamsRouter.get("/teams/:teamId/coaches", requireAuth, async (req, res) => {
  const { teamId } = req.params;
  if (!(await canAccessTeam(req.user!.id, req.user!.email, teamId as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const result = await pool.query(`
    SELECT * FROM team_coaches WHERE team_id = $1 AND is_active = TRUE
    ORDER BY CASE title WHEN 'Head Coach' THEN 1 WHEN 'Assistant Coach' THEN 2 ELSE 3 END, name ASC
  `, [teamId]);
  res.json(result.rows);
});

teamsRouter.post("/teams/:teamId/coaches", requireAuth, requireAdmin, async (req, res) => {
  const { name, title, email, phone } = req.body;
  if (!name || !title) { res.status(400).json({ error: "name and title required" }); return; }
  const result = await pool.query(
    `INSERT INTO team_coaches (team_id, name, title, email, phone, updated_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id`,
    [req.params.teamId, name, title, email || null, phone || null]
  );
  res.status(201).json({ id: result.rows[0].id });
});

teamsRouter.put("/team-coaches/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name, title, email, phone } = req.body;
  await pool.query(
    `UPDATE team_coaches SET name=$1, title=$2, email=$3, phone=$4, updated_at=NOW() WHERE id=$5`,
    [name, title, email || null, phone || null, req.params.id]
  );
  res.json({ success: true });
});

teamsRouter.delete("/team-coaches/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("UPDATE team_coaches SET is_active=FALSE, updated_at=NOW() WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

teamsRouter.get("/teams/:teamId/documents", requireAuth, async (req, res) => {
  const { teamId } = req.params;
  if (!(await canAccessTeam(req.user!.id, req.user!.email, teamId as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const result = await pool.query(
    `SELECT * FROM team_documents WHERE team_id = $1 ORDER BY created_at DESC`,
    [teamId]
  );
  res.json(result.rows);
});

teamsRouter.post("/teams/:teamId/documents", requireAuth, upload.single("file"), async (req, res) => {
  const { teamId } = req.params;
  if (!(await canUploadDocuments(req.user!.id))) {
    res.status(403).json({ error: "Document upload access denied" }); return;
  }
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const { title, description } = req.body;
  const fileKey = `team-documents/${teamId}/${Date.now()}-${req.file.originalname}`;
  await uploadFile("team-documents", `${teamId}/${Date.now()}-${req.file.originalname}`, req.file.buffer, getContentType(req.file.originalname));
  const result = await pool.query(
    `INSERT INTO team_documents (team_id, title, description, file_key, file_name, file_size, uploaded_by_user_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id`,
    [teamId, title, description || null, fileKey, req.file.originalname, req.file.size, req.user!.id]
  );
  const teamRow = await pool.query("SELECT name FROM teams WHERE id = $1", [teamId]);
  const teamName = teamRow.rows[0]?.name || "Team";
  const userName = getUserDisplayName(req.user!);
  await sendNotifications({
    type: "documents",
    subject: `New Document: ${title}`,
    emailHtml: `<h2>New Team Document</h2><p><strong>Team:</strong> ${teamName}</p><p><strong>Uploaded by:</strong> ${userName}</p><p><strong>Document:</strong> ${title}</p>${description ? `<p><strong>Description:</strong> ${description}</p>` : ""}<p><strong>File:</strong> ${req.file.originalname}</p>`,
    smsText: `New document uploaded to ${teamName}: ${title}. View at capeannnoreasters.com/portal/teams/${teamId}`,
    teamId: parseInt(teamId as string),
  }).catch(err => console.error("Failed to send document notifications:", err));
  res.status(201).json({ id: result.rows[0].id });
});

teamsRouter.get("/teams/documents/download/*", requireAuth, async (req, res) => {
  if (!(await canDownloadDocuments(req.user!.id))) {
    res.status(403).json({ error: "Document download access denied" }); return;
  }
  const fileKey = req.path.replace("/teams/documents/download/", "");
  try {
    const signedUrl = await getSignedUrl("team-documents", fileKey.replace("team-documents/", ""));
    res.redirect(signedUrl);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

teamsRouter.post("/team-players", requireAuth, requireAdmin, async (req, res) => {
  const { team_id, player_id } = req.body;
  if (!team_id || !player_id) { res.status(400).json({ error: "team_id and player_id required" }); return; }
  const existing = await pool.query("SELECT id FROM team_players WHERE team_id=$1 AND player_id=$2", [team_id, player_id]);
  if (existing.rows.length > 0) {
    await pool.query("UPDATE team_players SET is_active=TRUE, updated_at=NOW() WHERE id=$1", [existing.rows[0].id]);
    res.json({ id: existing.rows[0].id }); return;
  }
  const result = await pool.query(
    `INSERT INTO team_players (team_id, player_id, is_active, updated_at) VALUES ($1,$2,TRUE,NOW()) RETURNING id`,
    [team_id, player_id]
  );
  res.status(201).json({ id: result.rows[0].id });
});

teamsRouter.delete("/team-players/:teamId/:playerId", requireAuth, requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE team_players SET is_active=FALSE, updated_at=NOW() WHERE team_id=$1 AND player_id=$2",
    [req.params.teamId, req.params.playerId]
  );
  res.json({ success: true });
});

teamsRouter.get("/teams/all", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const coachTeamIds = roles.filter(r => r.role === "Coach" && r.team_id).map(r => r.team_id);
  const familyId = await getFamilyId(req.user!.id);
  const isParentOnly = !adminCheck && coachTeamIds.length === 0 && !!familyId;

  let query = "SELECT id, name, age_group FROM teams";
  let params: unknown[] = [];

  if (!adminCheck && coachTeamIds.length > 0) {
    const placeholders = coachTeamIds.map((_, i) => `$${i + 1}`).join(",");
    query += ` WHERE id IN (${placeholders})`;
    params = coachTeamIds;
  } else if (isParentOnly) {
    query += ` WHERE id IN (SELECT DISTINCT tp.team_id FROM team_players tp JOIN players p ON tp.player_id = p.id WHERE p.family_id = $1)`;
    params = [familyId];
  }
  query += " ORDER BY age_group ASC, name ASC";
  const result = await pool.query(query, params);
  res.json(result.rows);
});

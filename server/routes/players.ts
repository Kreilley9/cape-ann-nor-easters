import { Router } from "express";
import multer from "multer";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin, isAdmin, getUserRoles, getFamilyId } from "../middleware/roles.ts";
import { uploadFile, getPublicUrl } from "../lib/storage.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";

export const playersRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function canAccessPlayer(userId: string, userEmail: string | undefined, playerId: string): Promise<boolean> {
  const adminCheck = await isAdmin(userId, userEmail);
  if (adminCheck) return true;
  const roles = await getUserRoles(userId);
  const isParent = roles.some(r => r.role === "parent");
  const familyId = await getFamilyId(userId);
  if (isParent && familyId) {
    const res = await pool.query("SELECT family_id FROM players WHERE id = $1", [playerId]);
    if (res.rows[0]?.family_id !== familyId) return false;
    return true;
  }
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);
  if (coachTeamIds.length > 0) {
    const placeholders = coachTeamIds.map((_, i) => `$${i + 2}`).join(",");
    const res = await pool.query(
      `SELECT 1 FROM team_players WHERE player_id = $1 AND team_id IN (${placeholders}) LIMIT 1`,
      [playerId, ...coachTeamIds]
    );
    return res.rows.length > 0;
  }
  return false;
}

playersRouter.get("/players", requireAuth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, first_name, last_name, family_id, jersey_number, birth_date, status, zorts_expiration_date FROM players ORDER BY last_name ASC, first_name ASC"
  );
  res.json(result.rows);
});

playersRouter.get("/players/all", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  if (adminCheck) {
    const result = await pool.query(
      `SELECT p.*, f.name as family_name FROM players p LEFT JOIN families f ON p.family_id = f.id ORDER BY p.last_name ASC, p.first_name ASC`
    );
    res.json(result.rows); return;
  }
  const roles = await getUserRoles(req.user!.id);
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id);
  if (coachTeamIds.length > 0) {
    const placeholders = coachTeamIds.map((_, i) => `$${i + 1}`).join(",");
    const result = await pool.query(
      `SELECT DISTINCT p.*, f.name as family_name FROM players p LEFT JOIN families f ON p.family_id = f.id INNER JOIN team_players tp ON p.id = tp.player_id WHERE tp.team_id IN (${placeholders}) ORDER BY p.last_name ASC, p.first_name ASC`,
      coachTeamIds
    );
    res.json(result.rows); return;
  }
  const familyId = await getFamilyId(req.user!.id);
  if (familyId) {
    const result = await pool.query(
      `SELECT p.*, f.name as family_name FROM players p LEFT JOIN families f ON p.family_id = f.id WHERE p.family_id = $1 ORDER BY p.last_name ASC, p.first_name ASC`,
      [familyId]
    );
    res.json(result.rows); return;
  }
  res.json([]);
});

playersRouter.get("/players/:id", requireAuth, async (req, res) => {
  const player = await pool.query(
    `SELECT p.*, f.name as family_name FROM players p LEFT JOIN families f ON p.family_id = f.id WHERE p.id = $1`,
    [req.params.id]
  );
  if (!player.rows[0]) { res.status(404).json({ error: "Player not found" }); return; }
  if (!(await canAccessPlayer(req.user!.id, req.user!.email, req.params.id as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  res.json(player.rows[0]);
});

playersRouter.post("/players/:id/photo", requireAuth, requireAdmin, upload.single("photo"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No photo provided" }); return; }
  if (!req.file.mimetype.startsWith("image/")) { res.status(400).json({ error: "File must be an image" }); return; }
  const path = `${req.params.id}/${Date.now()}-${req.file.originalname}`;
  await uploadFile("player-photos", path, req.file.buffer, req.file.mimetype);
  const fileKey = `player-photos/${path}`;
  await pool.query("UPDATE players SET photo_key=$1, updated_at=NOW() WHERE id=$2", [fileKey, req.params.id]);
  res.json({ photo_key: fileKey });
});

playersRouter.get("/players/:id/photo", requireAuth, async (req, res) => {
  if (!(await canAccessPlayer(req.user!.id, req.user!.email, req.params.id as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const player = await pool.query("SELECT photo_key FROM players WHERE id = $1", [req.params.id]);
  if (!player.rows[0]?.photo_key) { res.status(404).json({ error: "Photo not found" }); return; }
  const url = getPublicUrl("player-photos", player.rows[0].photo_key.replace("player-photos/", ""));
  res.redirect(url);
});

playersRouter.post("/players", requireAuth, requireAdmin, async (req, res) => {
  const {
    family_id, first_name, last_name, birth_date, jersey_number, notes, status, uniform_size,
    zorts_expiration_date, zorts_id, grade, is_female, address_1, address_2, town, state, zip_code,
    parent_1_name, parent_1_phone, parent_1_email, parent_2_name, parent_2_phone, parent_2_email,
  } = req.body;
  if (!family_id || !first_name || !last_name) { res.status(400).json({ error: "family_id, first_name, last_name required" }); return; }
  const result = await pool.query(
    `INSERT INTO players (family_id, first_name, last_name, birth_date, jersey_number, notes, status, uniform_size,
      zorts_expiration_date, zorts_id, grade, is_female, address_1, address_2, town, state, zip_code,
      parent_1_name, parent_1_phone, parent_1_email, parent_2_name, parent_2_phone, parent_2_email, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW()) RETURNING id`,
    [family_id, first_name, last_name, birth_date || null, jersey_number || null, notes || null,
     status || null, uniform_size || null, zorts_expiration_date || null, zorts_id || null, grade || null,
     is_female ?? false,
     address_1 || null, address_2 || null, town || null, state || null, zip_code || null,
     parent_1_name || null, parent_1_phone || null, parent_1_email || null,
     parent_2_name || null, parent_2_phone || null, parent_2_email || null]
  );
  const id = result.rows[0].id;
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created", entityType: "player", entityId: id, entityName: `${first_name} ${last_name}`, familyId: family_id });
  res.status(201).json({ id });
});

playersRouter.put("/players/:id", requireAuth, requireAdmin, async (req, res) => {
  const {
    family_id, first_name, last_name, birth_date, jersey_number, notes, status, uniform_size,
    zorts_expiration_date, zorts_id, grade, address_1, address_2, town, state, zip_code,
    parent_1_name, parent_1_phone, parent_1_email, parent_2_name, parent_2_phone, parent_2_email,
  } = req.body;
  await pool.query(
    `UPDATE players SET family_id=$1, first_name=$2, last_name=$3, birth_date=$4, jersey_number=$5, notes=$6,
      status=$7, uniform_size=$8, zorts_expiration_date=$9, zorts_id=$10, grade=$11, address_1=$12, address_2=$13,
      town=$14, state=$15, zip_code=$16, parent_1_name=$17, parent_1_phone=$18, parent_1_email=$19,
      parent_2_name=$20, parent_2_phone=$21, parent_2_email=$22, updated_at=NOW() WHERE id=$23`,
    [family_id, first_name, last_name, birth_date || null, jersey_number || null, notes || null,
     status || null, uniform_size || null, zorts_expiration_date || null, zorts_id || null, grade || null,
     address_1 || null, address_2 || null, town || null, state || null, zip_code || null,
     parent_1_name || null, parent_1_phone || null, parent_1_email || null,
     parent_2_name || null, parent_2_phone || null, parent_2_email || null, req.params.id]
  );
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated", entityType: "player", entityId: Number(req.params.id), entityName: `${first_name} ${last_name}`, familyId: family_id });
  res.json({ success: true });
});

playersRouter.delete("/players/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM team_players WHERE player_id=$1", [req.params.id]);
  await pool.query("DELETE FROM attendance WHERE player_id=$1", [req.params.id]);
  await pool.query("DELETE FROM event_invites WHERE player_id=$1", [req.params.id]);
  await pool.query("DELETE FROM player_payments WHERE player_id=$1", [req.params.id]);
  await pool.query("DELETE FROM uniform_orders WHERE player_id=$1", [req.params.id]);
  await pool.query("DELETE FROM players WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

playersRouter.get("/players/:id/events/upcoming", requireAuth, async (req, res) => {
  if (!(await canAccessPlayer(req.user!.id, req.user!.email, req.params.id as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const result = await pool.query(
    `SELECT e.id, e.title, e.event_type, e.start_at, e.location, a.status as rsvp_status
     FROM event_invites ei
     JOIN events e ON ei.event_id = e.id
     LEFT JOIN attendance a ON a.event_id = e.id AND a.player_id = ei.player_id
     WHERE ei.player_id = $1 AND e.start_at >= NOW() AND e.is_cancelled = FALSE
     ORDER BY e.start_at ASC`,
    [req.params.id]
  );
  res.json(result.rows);
});

playersRouter.get("/players/:id/events/past", requireAuth, async (req, res) => {
  if (!(await canAccessPlayer(req.user!.id, req.user!.email, req.params.id as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const result = await pool.query(
    `SELECT e.id, e.title, e.event_type, e.start_at, e.location, a.status as rsvp_status
     FROM event_invites ei
     JOIN events e ON ei.event_id = e.id
     LEFT JOIN attendance a ON a.event_id = e.id AND a.player_id = ei.player_id
     WHERE ei.player_id = $1 AND e.start_at < NOW()
     ORDER BY e.start_at DESC`,
    [req.params.id]
  );
  res.json(result.rows);
});

playersRouter.get("/players/:id/payments", requireAuth, async (req, res) => {
  if (!(await canAccessPlayer(req.user!.id, req.user!.email, req.params.id as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const result = await pool.query(
    `SELECT pp.id, p.description, pp.amount, p.due_date, pp.paid_at, pp.status, p.notes
     FROM player_payments pp JOIN payments p ON pp.payment_id = p.id
     WHERE pp.player_id = $1 ORDER BY p.due_date DESC, pp.created_at DESC`,
    [req.params.id]
  );
  res.json(result.rows);
});

playersRouter.get("/players/:id/uniform-orders", requireAuth, async (req, res) => {
  if (!(await canAccessPlayer(req.user!.id, req.user!.email, req.params.id as string))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const result = await pool.query(
    `SELECT * FROM uniform_orders WHERE player_id = $1 ORDER BY submitted_at DESC, created_at DESC`,
    [req.params.id]
  );
  res.json(result.rows);
});

import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles } from "../middleware/roles.ts";
import { checkRecruitingAccess } from "../lib/permissions-helper.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";

export const prospectsRouter = Router();

async function requireRecruitingAccess(userId: string, userEmail: string | undefined): Promise<string | null> {
  const adminCheck = await isAdmin(userId, userEmail);
  const roles = await getUserRoles(userId);
  const isCoach = roles.some(r => r.role === "coach");
  if (!adminCheck && !isCoach) return "Forbidden - recruiting access is restricted to admins and coaches";
  const access = await checkRecruitingAccess(userId);
  if (!access.allowed) return access.reason || "Recruiting access denied";
  return null;
}

prospectsRouter.get("/prospects", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  const result = await pool.query(`
    SELECT * FROM prospects
    ORDER BY CASE WHEN next_follow_up_date IS NOT NULL THEN 0 ELSE 1 END,
             next_follow_up_date ASC, last_name ASC, first_name ASC
  `);
  res.json(result.rows);
});

prospectsRouter.get("/prospects/:id", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  const result = await pool.query("SELECT * FROM prospects WHERE id = $1", [req.params.id]);
  if (!result.rows[0]) { res.status(404).json({ error: "Prospect not found" }); return; }
  res.json(result.rows[0]);
});

prospectsRouter.post("/prospects", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  const {
    first_name, last_name, birth_date, age_group, email, phone,
    parent_name, parent_email, parent_phone, status, interest_level,
    next_follow_up_date, source, address, city, state, zip,
    current_team, position, notes, rating,
  } = req.body;
  if (!first_name || !last_name) { res.status(400).json({ error: "first_name and last_name required" }); return; }
  const result = await pool.query(`
    INSERT INTO prospects (
      first_name, last_name, birth_date, age_group, email, phone,
      parent_name, parent_email, parent_phone, status, interest_level,
      next_follow_up_date, source, address, city, state, zip,
      current_team, position, notes, rating, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW()) RETURNING id`,
    [first_name, last_name, birth_date || null, age_group || null, email || null, phone || null,
     parent_name || null, parent_email || null, parent_phone || null, status || null, interest_level || null,
     next_follow_up_date || null, source || null, address || null, city || null, state || null, zip || null,
     current_team || null, position || null, notes || null, rating ?? null]
  );
  const id = result.rows[0].id;
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created", entityType: "recruit", entityId: id, entityName: `${first_name} ${last_name}`, details: status || undefined });
  res.status(201).json({ id });
});

prospectsRouter.put("/prospects/:id", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  const body = req.body;
  const fields = ["first_name", "last_name", "birth_date", "age_group", "email", "phone",
    "parent_name", "parent_email", "parent_phone", "status", "interest_level",
    "next_follow_up_date", "source", "address", "city", "state", "zip",
    "current_team", "position", "notes", "rating"];
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${idx++}`);
      values.push(body[field] === "" ? null : body[field]);
    }
  }
  if (updates.length === 0) { res.status(400).json({ error: "No updates provided" }); return; }
  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);
  await pool.query(`UPDATE prospects SET ${updates.join(", ")} WHERE id = $${idx}`, values);
  const prospect = await pool.query("SELECT first_name, last_name FROM prospects WHERE id = $1", [req.params.id]);
  if (prospect.rows[0]) {
    await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated", entityType: "recruit", entityId: Number(req.params.id), entityName: `${prospect.rows[0].first_name} ${prospect.rows[0].last_name}`, details: body.status || undefined });
  }
  res.json({ success: true });
});

prospectsRouter.delete("/prospects/:id", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  await pool.query("DELETE FROM prospect_notes WHERE prospect_id = $1", [req.params.id]);
  await pool.query("DELETE FROM prospects WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

prospectsRouter.get("/prospects/:id/notes", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  const result = await pool.query(
    "SELECT * FROM prospect_notes WHERE prospect_id = $1 ORDER BY created_at DESC",
    [req.params.id]
  );
  res.json(result.rows);
});

prospectsRouter.post("/prospects/:id/notes", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  const { note, contact_type } = req.body;
  if (!note) { res.status(400).json({ error: "note required" }); return; }
  const result = await pool.query(
    `INSERT INTO prospect_notes (prospect_id, note, contact_type, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
    [req.params.id, note, contact_type || null, req.user!.email]
  );
  res.status(201).json({ id: result.rows[0].id });
});

prospectsRouter.delete("/prospect-notes/:id", requireAuth, async (req, res) => {
  const err = await requireRecruitingAccess(req.user!.id, req.user!.email);
  if (err) { res.status(403).json({ error: err }); return; }
  await pool.query("DELETE FROM prospect_notes WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

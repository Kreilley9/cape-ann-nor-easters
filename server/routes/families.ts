import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin } from "../middleware/roles.ts";

export const familiesRouter = Router();

familiesRouter.get("/families", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  if (!adminCheck) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query("SELECT id, name, email FROM families ORDER BY name");
  res.json(result.rows);
});

familiesRouter.get("/families/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const adminCheck = await isAdmin(userId, req.user!.email);
  const result = await pool.query("SELECT * FROM families WHERE id = $1", [req.params.id]);
  const family = result.rows[0];
  if (!family) { res.status(404).json({ error: "Family not found" }); return; }
  if (!adminCheck && family.user_id !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(family);
});

familiesRouter.post("/families", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { name, email, phone, address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }

  const existing = await pool.query("SELECT id FROM families WHERE user_id = $1", [userId]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Family already exists for this user", id: existing.rows[0].id });
    return;
  }

  const result = await pool.query(
    `INSERT INTO families (name, email, phone, address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, user_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING id`,
    [name, email || null, phone || null, address || null, emergency_contact_name || null, emergency_contact_relationship || null, emergency_contact_phone || null, userId]
  );
  res.status(201).json({ id: result.rows[0].id });
});

familiesRouter.put("/families/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const adminCheck = await isAdmin(userId, req.user!.email);
  const check = await pool.query("SELECT user_id FROM families WHERE id = $1", [req.params.id]);
  if (!check.rows[0]) { res.status(404).json({ error: "Family not found" }); return; }
  if (!adminCheck && check.rows[0].user_id !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const {
    name, email, phone, address,
    emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
    onboarding_completed, photo_consent,
  } = req.body;

  await pool.query(
    `UPDATE families SET
      name=$1, email=$2, phone=$3, address=$4,
      emergency_contact_name=$5, emergency_contact_relationship=$6, emergency_contact_phone=$7,
      onboarding_completed=COALESCE($8::boolean, onboarding_completed),
      photo_consent=COALESCE($9::boolean, photo_consent),
      updated_at=NOW()
     WHERE id=$10`,
    [
      name, email || null, phone || null, address || null,
      emergency_contact_name || null, emergency_contact_relationship || null, emergency_contact_phone || null,
      onboarding_completed !== undefined ? onboarding_completed : null,
      photo_consent !== undefined ? photo_consent : null,
      req.params.id,
    ]
  );

  if (onboarding_completed === true) {
    await pool.query(
      `UPDATE user_roles SET family_id = $1, updated_at = NOW() WHERE user_id = $2 AND family_id IS NULL`,
      [req.params.id, userId]
    );
  }

  res.json({ success: true });
});

familiesRouter.get("/families/:id/players", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, f.name as family_name FROM players p
     JOIN families f ON p.family_id = f.id
     WHERE p.family_id = $1
     ORDER BY p.first_name ASC, p.last_name ASC`,
    [req.params.id]
  );
  res.json(result.rows);
});

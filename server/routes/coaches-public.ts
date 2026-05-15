import { Router } from "express";
import multer from "multer";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { uploadFile, getPublicUrl } from "../lib/storage.ts";

export const coachesPublicRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

coachesPublicRouter.get("/coaches", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query(`
    SELECT c.*, t.name as team_name FROM coaches c LEFT JOIN teams t ON c.team_id = t.id
    ORDER BY c.order_index ASC, c.created_at DESC
  `);
  res.json(result.rows);
});

coachesPublicRouter.get("/coaches/visible", async (_req, res) => {
  const result = await pool.query(`
    SELECT c.*, t.name as team_name FROM coaches c LEFT JOIN teams t ON c.team_id = t.id
    WHERE c.is_visible = TRUE ORDER BY c.order_index ASC, c.created_at DESC
  `);
  res.json(result.rows);
});

coachesPublicRouter.get("/coaches/public", async (_req, res) => {
  const result = await pool.query(`
    SELECT c.*, t.name as team_name FROM coaches c LEFT JOIN teams t ON c.team_id = t.id
    WHERE c.is_visible = TRUE ORDER BY c.order_index ASC, c.created_at DESC
  `);
  res.json(result.rows);
});

coachesPublicRouter.post("/coaches", requireAuth, requireAdmin, async (req, res) => {
  const { name, role, photo_key, team_id, bio, email, phone, order_index, is_visible } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const result = await pool.query(
    `INSERT INTO coaches (name, role, photo_key, team_id, bio, email, phone, order_index, is_visible, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING id`,
    [name, role || null, photo_key || null, team_id || null, bio || null, email || null, phone || null, order_index ?? 0, is_visible !== false]
  );
  res.json({ id: result.rows[0].id });
});

coachesPublicRouter.put("/coaches/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name, role, photo_key, team_id, bio, email, phone, order_index, is_visible } = req.body;
  await pool.query(
    `UPDATE coaches SET name=$1, role=$2, photo_key=$3, team_id=$4, bio=$5, email=$6, phone=$7, order_index=$8, is_visible=$9, updated_at=NOW() WHERE id=$10`,
    [name, role || null, photo_key || null, team_id || null, bio || null, email || null, phone || null, order_index ?? 0, is_visible !== false, req.params.id]
  );
  res.json({ success: true });
});

coachesPublicRouter.delete("/coaches/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM coaches WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

coachesPublicRouter.post("/coaches/upload-photo", requireAuth, requireAdmin, upload.single("photo"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const path = `${Date.now()}-${req.file.originalname}`;
  await uploadFile("coach-documents", `photos/${path}`, req.file.buffer, req.file.mimetype);
  res.json({ photo_key: `coach-photos/${path}` });
});

coachesPublicRouter.get("/coaches/photos/:key", async (req, res) => {
  const url = getPublicUrl("coach-documents", `photos/${req.params.key}`);
  res.redirect(url);
});

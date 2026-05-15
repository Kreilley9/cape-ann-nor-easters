import { Router } from "express";
import multer from "multer";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { uploadFile, getPublicUrl } from "../lib/storage.ts";

export const teamsPublicRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

teamsPublicRouter.get("/teams-public", async (_req, res) => {
  const result = await pool.query(`
    SELECT t.*, s.name as season_name FROM teams t LEFT JOIN seasons s ON t.season_id = s.id ORDER BY t.created_at DESC
  `);
  res.json(result.rows);
});

teamsPublicRouter.put("/teams-public/:id/photo", requireAuth, requireAdmin, async (req, res) => {
  const { photo_key } = req.body;
  await pool.query("UPDATE teams SET photo_key=$1, updated_at=NOW() WHERE id=$2", [photo_key || null, req.params.id]);
  res.json({ success: true });
});

teamsPublicRouter.post("/teams-public/upload-photo", requireAuth, requireAdmin, upload.single("photo"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const path = `${Date.now()}-${req.file.originalname}`;
  await uploadFile("player-photos", `team-photos/${path}`, req.file.buffer, req.file.mimetype);
  res.json({ photo_key: `team-photos/${path}` });
});

teamsPublicRouter.get("/teams-public/photos/:key", async (req, res) => {
  const url = getPublicUrl("player-photos", `team-photos/${req.params.key}`);
  res.redirect(url);
});

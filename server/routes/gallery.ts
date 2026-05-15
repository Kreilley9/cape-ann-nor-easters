import { Router } from "express";
import multer from "multer";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { uploadFile, getPublicUrl } from "../lib/storage.ts";

export const galleryRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

galleryRouter.get("/gallery", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query("SELECT * FROM gallery_photos ORDER BY order_index ASC, created_at DESC");
  res.json(result.rows);
});

galleryRouter.get("/gallery/public", async (_req, res) => {
  const result = await pool.query("SELECT * FROM gallery_photos WHERE is_visible = TRUE ORDER BY order_index ASC, created_at DESC");
  res.json(result.rows);
});

galleryRouter.post("/gallery", requireAuth, requireAdmin, async (req, res) => {
  const { image_key, caption, order_index, is_visible } = req.body;
  if (!image_key) { res.status(400).json({ error: "image_key required" }); return; }
  const result = await pool.query(
    `INSERT INTO gallery_photos (image_key, caption, order_index, is_visible, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
    [image_key, caption || null, order_index ?? 0, is_visible !== false]
  );
  res.json({ id: result.rows[0].id });
});

galleryRouter.put("/gallery/:id", requireAuth, requireAdmin, async (req, res) => {
  const { image_key, caption, order_index, is_visible } = req.body;
  await pool.query(
    `UPDATE gallery_photos SET image_key=$1, caption=$2, order_index=$3, is_visible=$4, updated_at=NOW() WHERE id=$5`,
    [image_key, caption || null, order_index ?? 0, is_visible !== false, req.params.id]
  );
  res.json({ success: true });
});

galleryRouter.delete("/gallery/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM gallery_photos WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

galleryRouter.post("/gallery/upload-image", requireAuth, requireAdmin, upload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const path = `${Date.now()}-${req.file.originalname}`;
  await uploadFile("gallery-photos", path, req.file.buffer, req.file.mimetype);
  res.json({ image_key: `gallery-photos/${path}` });
});

galleryRouter.get("/gallery/images/:key", async (req, res) => {
  const url = getPublicUrl("gallery-photos", req.params.key);
  res.redirect(url);
});

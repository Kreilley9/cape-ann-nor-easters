import { Router } from "express";
import multer from "multer";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { uploadFile, getPublicUrl } from "../lib/storage.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";

export const newsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function withImages(posts: Record<string, unknown>[]) {
  return Promise.all(posts.map(async (post) => {
    const images = await pool.query(
      `SELECT id, image_key, caption, order_index FROM news_post_images WHERE news_post_id = $1 ORDER BY order_index ASC`,
      [post.id]
    );
    return { ...post, images: images.rows };
  }));
}

newsRouter.get("/news-posts/public", async (_req, res) => {
  const result = await pool.query(
    `SELECT id, title, content, author_name, published_at, created_at, updated_at, image_key FROM news_posts WHERE is_published = TRUE ORDER BY published_at DESC, created_at DESC`
  );
  res.json(await withImages(result.rows));
});

newsRouter.get("/news-posts", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query("SELECT * FROM news_posts ORDER BY created_at DESC");
  res.json(await withImages(result.rows));
});

newsRouter.post("/news-posts/upload-image", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const path = `${Date.now()}-${req.file.originalname}`;
  await uploadFile("news-images", path, req.file.buffer, req.file.mimetype);
  res.json({ image_key: `news-images/${path}`, success: true });
});

newsRouter.post("/news-posts", requireAuth, requireAdmin, async (req, res) => {
  const { title, content, is_published, image_key, images } = req.body;
  if (!title || !content) { res.status(400).json({ error: "title and content required" }); return; }
  const publishedAt = is_published ? new Date().toISOString() : null;
  const result = await pool.query(
    `INSERT INTO news_posts (title, content, author_user_id, author_name, is_published, published_at, image_key, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id`,
    [title, content, req.user!.id, getUserDisplayName(req.user!), !!is_published, publishedAt, image_key || null]
  );
  const postId = result.rows[0].id;
  if (images?.length) {
    for (let i = 0; i < images.length; i++) {
      await pool.query(
        `INSERT INTO news_post_images (news_post_id, image_key, caption, order_index, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
        [postId, images[i].image_key, images[i].caption || null, i]
      );
    }
  }
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created", entityType: "news_post", entityId: postId, entityName: title });
  res.json({ id: postId, success: true });
});

newsRouter.put("/news-posts/:id", requireAuth, requireAdmin, async (req, res) => {
  const { title, content, is_published, image_key, images } = req.body;
  const current = await pool.query("SELECT is_published, published_at FROM news_posts WHERE id = $1", [req.params.id]);
  if (!current.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  const wasPublished = current.rows[0].is_published;
  const isPublishing = is_published && !wasPublished;
  const publishedAt = isPublishing ? new Date().toISOString() : current.rows[0].published_at;
  await pool.query(
    `UPDATE news_posts SET title=$1, content=$2, is_published=$3, published_at=$4, image_key=$5, updated_at=NOW() WHERE id=$6`,
    [title, content, !!is_published, publishedAt, image_key || null, req.params.id]
  );
  await pool.query("DELETE FROM news_post_images WHERE news_post_id = $1", [req.params.id]);
  if (images?.length) {
    for (let i = 0; i < images.length; i++) {
      await pool.query(
        `INSERT INTO news_post_images (news_post_id, image_key, caption, order_index, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
        [req.params.id, images[i].image_key, images[i].caption || null, i]
      );
    }
  }
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated", entityType: "news_post", entityId: Number(req.params.id), entityName: title });
  res.json({ success: true });
});

newsRouter.delete("/news-posts/:id", requireAuth, requireAdmin, async (req, res) => {
  const post = await pool.query("SELECT title FROM news_posts WHERE id = $1", [req.params.id]);
  await pool.query("DELETE FROM news_post_images WHERE news_post_id = $1", [req.params.id]);
  await pool.query("DELETE FROM news_posts WHERE id = $1", [req.params.id]);
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "deleted", entityType: "news_post", entityId: Number(req.params.id), entityName: post.rows[0]?.title });
  res.json({ success: true });
});

newsRouter.get("/news-images/:key", async (req, res) => {
  const url = getPublicUrl("news-images", req.params.key);
  res.redirect(url);
});

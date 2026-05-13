import { Hono } from "hono";
import { z } from "zod";

const galleryPhotoSchema = z.object({
  image_key: z.string(),
  caption: z.string().nullable().optional(),
  order_index: z.number().nullable().optional(),
  is_visible: z.boolean().nullable().optional(),
});

export const galleryEndpoints = new Hono<{ Bindings: Env }>();

// Helper function to check if user is admin
async function isAdmin(userId: string | null, email: string | null, env: Env): Promise<boolean> {
  if (!userId && !email) return false;
  if (email === "kevin@capeannnoreasters.com") return true;
  
  const query = `
    SELECT COUNT(*) as count 
    FROM user_roles 
    WHERE (user_id = ? OR email = ?) AND role = 'Admin'
  `;
  const result = await env.DB.prepare(query).bind(userId, email).first<{ count: number }>();
  return (result?.count ?? 0) > 0;
}

// Middleware to require admin
async function requireAdmin(c: any, next: any) {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const admin = await isAdmin(user.id, user.email, c.env);
  if (!admin) {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  await next();
}

// GET all gallery photos (admin only)
galleryEndpoints.get("/", requireAdmin, async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT * FROM gallery_photos
    ORDER BY order_index ASC, created_at DESC
  `).all();
  
  return c.json(result.results || []);
});

// GET public gallery photos (visible only) - NO AUTH REQUIRED
galleryEndpoints.get("/public", async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT * FROM gallery_photos
    WHERE is_visible = 1
    ORDER BY order_index ASC, created_at DESC
  `).all();
  
  return c.json(result.results || []);
});

// POST new gallery photo
galleryEndpoints.post("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const data = galleryPhotoSchema.parse(body);
    
    const result = await c.env.DB.prepare(`
      INSERT INTO gallery_photos (image_key, caption, order_index, is_visible)
      VALUES (?, ?, ?, ?)
    `).bind(
      data.image_key,
      data.caption || null,
      data.order_index ?? 0,
      data.is_visible ?? true ? 1 : 0
    ).run();
    
    return c.json({ id: result.meta.last_row_id, ...data });
  } catch (error) {
    console.error("Error creating gallery photo:", error);
    return c.json({ error: "Failed to create gallery photo" }, 500);
  }
});

// PUT update gallery photo
galleryEndpoints.put("/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = galleryPhotoSchema.parse(body);
    
    await c.env.DB.prepare(`
      UPDATE gallery_photos
      SET image_key = ?, caption = ?, order_index = ?, is_visible = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.image_key,
      data.caption || null,
      data.order_index ?? 0,
      data.is_visible ?? true ? 1 : 0,
      id
    ).run();
    
    return c.json({ id, ...data });
  } catch (error) {
    console.error("Error updating gallery photo:", error);
    return c.json({ error: "Failed to update gallery photo" }, 500);
  }
});

// DELETE gallery photo
galleryEndpoints.delete("/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    
    await c.env.DB.prepare(`
      DELETE FROM gallery_photos WHERE id = ?
    `).bind(id).run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting gallery photo:", error);
    return c.json({ error: "Failed to delete gallery photo" }, 500);
  }
});

// POST upload image
galleryEndpoints.post("/upload-image", requireAdmin, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("image") as File;
    
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    
    const key = `gallery-photos/${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    
    await c.env.R2_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });
    
    return c.json({ image_key: key });
  } catch (error) {
    console.error("Error uploading image:", error);
    return c.json({ error: "Failed to upload image" }, 500);
  }
});

// GET serve image
galleryEndpoints.get("/images/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const fullKey = `gallery-photos/${key}`;
    
    const object = await c.env.R2_BUCKET.get(fullKey);
    if (!object) {
      return c.json({ error: "Image not found" }, 404);
    }
    
    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=31536000");
    
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Error serving image:", error);
    return c.json({ error: "Failed to serve image" }, 500);
  }
});

import { Hono } from "hono";
import { z } from "zod";

const coachSchema = z.object({
  name: z.string(),
  role: z.string().nullable().optional(),
  photo_key: z.string().nullable().optional(),
  team_id: z.number().nullable().optional(),
  bio: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  order_index: z.number().nullable().optional(),
  is_visible: z.boolean().nullable().optional(),
});

export const coachesPublicEndpoints = new Hono<{ Bindings: Env }>();

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
  const userId = c.get("userId");
  const email = c.get("email");
  
  const admin = await isAdmin(userId, email, c.env);
  if (!admin) {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  await next();
}

// GET all coaches (admin only)
coachesPublicEndpoints.get("/", requireAdmin, async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT c.*, t.name as team_name
    FROM coaches c
    LEFT JOIN teams t ON c.team_id = t.id
    ORDER BY c.order_index ASC, c.created_at DESC
  `).all();
  
  return c.json(result.results || []);
});

// GET public coaches (visible only) - also accessible without /public for backward compatibility
coachesPublicEndpoints.get("/visible", async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT c.*, t.name as team_name
    FROM coaches c
    LEFT JOIN teams t ON c.team_id = t.id
    WHERE c.is_visible = 1
    ORDER BY c.order_index ASC, c.created_at DESC
  `).all();
  
  return c.json(result.results || []);
});

// GET public coaches (alias)
coachesPublicEndpoints.get("/public", async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT c.*, t.name as team_name
    FROM coaches c
    LEFT JOIN teams t ON c.team_id = t.id
    WHERE c.is_visible = 1
    ORDER BY c.order_index ASC, c.created_at DESC
  `).all();
  
  return c.json(result.results || []);
});

// POST new coach
coachesPublicEndpoints.post("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const data = coachSchema.parse(body);
    
    const result = await c.env.DB.prepare(`
      INSERT INTO coaches (name, role, photo_key, team_id, bio, email, phone, order_index, is_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.name,
      data.role || null,
      data.photo_key || null,
      data.team_id || null,
      data.bio || null,
      data.email || null,
      data.phone || null,
      data.order_index ?? 0,
      data.is_visible ?? true ? 1 : 0
    ).run();
    
    return c.json({ id: result.meta.last_row_id, ...data });
  } catch (error) {
    console.error("Error creating coach:", error);
    return c.json({ error: "Failed to create coach" }, 500);
  }
});

// PUT update coach
coachesPublicEndpoints.put("/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = coachSchema.parse(body);
    
    await c.env.DB.prepare(`
      UPDATE coaches
      SET name = ?, role = ?, photo_key = ?, team_id = ?, bio = ?, 
          email = ?, phone = ?, order_index = ?, is_visible = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.name,
      data.role || null,
      data.photo_key || null,
      data.team_id || null,
      data.bio || null,
      data.email || null,
      data.phone || null,
      data.order_index ?? 0,
      data.is_visible ?? true ? 1 : 0,
      id
    ).run();
    
    return c.json({ id, ...data });
  } catch (error) {
    console.error("Error updating coach:", error);
    return c.json({ error: "Failed to update coach" }, 500);
  }
});

// DELETE coach
coachesPublicEndpoints.delete("/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    
    await c.env.DB.prepare(`
      DELETE FROM coaches WHERE id = ?
    `).bind(id).run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting coach:", error);
    return c.json({ error: "Failed to delete coach" }, 500);
  }
});

// POST upload coach photo
coachesPublicEndpoints.post("/upload-photo", requireAdmin, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("photo") as File;
    
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    
    const key = `coach-photos/${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    
    await c.env.R2_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });
    
    return c.json({ photo_key: key });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return c.json({ error: "Failed to upload photo" }, 500);
  }
});

// GET serve coach photo
coachesPublicEndpoints.get("/photos/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const fullKey = `coach-photos/${key}`;
    
    const object = await c.env.R2_BUCKET.get(fullKey);
    if (!object) {
      return c.json({ error: "Photo not found" }, 404);
    }
    
    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=31536000");
    
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Error serving photo:", error);
    return c.json({ error: "Failed to serve photo" }, 500);
  }
});

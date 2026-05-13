import { Hono } from "hono";
import { z } from "zod";

const teamPhotoSchema = z.object({
  photo_key: z.string().nullable().optional(),
});

export const teamsPublicEndpoints = new Hono<{ Bindings: Env }>();

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

// GET all teams with photos - PUBLIC ENDPOINT
teamsPublicEndpoints.get("/", async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT t.*, s.name as season_name
    FROM teams t
    LEFT JOIN seasons s ON t.season_id = s.id
    ORDER BY t.created_at DESC
  `).all();
  
  return c.json(result.results || []);
});

// Handle trailing slash
teamsPublicEndpoints.get("/*", async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT t.*, s.name as season_name
    FROM teams t
    LEFT JOIN seasons s ON t.season_id = s.id
    ORDER BY t.created_at DESC
  `).all();
  
  return c.json(result.results || []);
});

// PUT update team photo
teamsPublicEndpoints.put("/:id/photo", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = teamPhotoSchema.parse(body);
    
    await c.env.DB.prepare(`
      UPDATE teams
      SET photo_key = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.photo_key || null,
      id
    ).run();
    
    return c.json({ id, ...data });
  } catch (error) {
    console.error("Error updating team photo:", error);
    return c.json({ error: "Failed to update team photo" }, 500);
  }
});

// POST upload team photo
teamsPublicEndpoints.post("/upload-photo", requireAdmin, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("photo") as File;
    
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    
    const key = `team-photos/${Date.now()}-${file.name}`;
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

// GET serve team photo
teamsPublicEndpoints.get("/photos/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const fullKey = `team-photos/${key}`;
    
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

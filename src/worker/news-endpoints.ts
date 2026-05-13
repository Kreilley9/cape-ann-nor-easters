import { Hono } from "hono";
import type { Env } from "@/shared/types";
import { z } from "zod";
import { logActivity, getUserDisplayName } from "./activity-logger";

const newsPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  is_published: z.boolean().optional(),
  image_key: z.string().nullable().optional(),
  images: z.array(z.object({
    image_key: z.string(),
    caption: z.string().optional(),
  })).optional(),
});

// Helper functions
async function getUserRoles(db: D1Database, userId: string): Promise<any[]> {
  const { results } = await db.prepare(
    "SELECT * FROM user_roles WHERE user_id = ?"
  ).bind(userId).all();
  return results as any[];
}

async function isAdmin(db: D1Database, userId: string, email: string): Promise<boolean> {
  const roles = await getUserRoles(db, userId);
  console.log("isAdmin check - roles:", roles, "for userId:", userId, "email:", email);
  if (roles.some((r: any) => r.role === 'Admin')) return true;
  const adminEmails = ['kevin@capeannnoreasters.com'];
  const result = adminEmails.includes(email.toLowerCase());
  console.log("isAdmin check - email check result:", result);
  return result;
}

async function requireAdmin(c: any) {
  const user = c.get("user");
  console.log("requireAdmin check - user:", user);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const roles = await getUserRoles(c.env.DB, user.id);
  const admin = await isAdmin(c.env.DB, user.id, user.email);
  console.log("requireAdmin check - isAdmin result:", admin, "for user:", user.id, user.email);
  
  if (!admin) {
    return c.json({ 
      error: "Forbidden",
      debug: {
        userId: user.id,
        email: user.email,
        rolesFound: roles,
        adminCheck: admin
      }
    }, 403);
  }
  
  return null;
}

export function setupNewsEndpoints(app: Hono<{ Bindings: Env }>, authMiddleware: any) {
  // Public endpoint - get published news posts
  app.get("/api/public/news-posts", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, content, author_name, published_at, created_at, updated_at, image_key 
       FROM news_posts 
       WHERE is_published = 1 
       ORDER BY published_at DESC, created_at DESC`
    ).all();
    
    // Fetch images for each post
    const postsWithImages = await Promise.all(
      (results as any[]).map(async (post) => {
        const { results: images } = await c.env.DB.prepare(
          `SELECT id, image_key, caption, order_index 
           FROM news_post_images 
           WHERE news_post_id = ? 
           ORDER BY order_index ASC`
        ).bind(post.id).all();
        
        return { ...post, images };
      })
    );
    
    return c.json(postsWithImages);
  });

  // Admin: Get all news posts (published and drafts)
  app.get("/api/portal/news-posts", authMiddleware, async (c) => {
    const authError = await requireAdmin(c);
    if (authError) return authError;

    const { results } = await c.env.DB.prepare(
      `SELECT * FROM news_posts ORDER BY created_at DESC`
    ).all();
    
    // Fetch images for each post
    const postsWithImages = await Promise.all(
      (results as any[]).map(async (post) => {
        const { results: images } = await c.env.DB.prepare(
          `SELECT id, image_key, caption, order_index 
           FROM news_post_images 
           WHERE news_post_id = ? 
           ORDER BY order_index ASC`
        ).bind(post.id).all();
        
        return { ...post, images };
      })
    );
    
    return c.json(postsWithImages);
  });

  // Admin: Create news post
  app.post("/api/portal/news-posts", authMiddleware, async (c) => {
    try {
      console.log("=== START CREATE NEWS POST ===");
      
      const authError = await requireAdmin(c);
      if (authError) {
        console.log("Auth error occurred");
        return authError;
      }

      const user = c.get("user");
      console.log("User from context:", user);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      
      const body = await c.req.json();
      console.log("Creating news post with data:", JSON.stringify(body, null, 2));
      
      const data = newsPostSchema.parse(body);

      const now = new Date().toISOString();
      const publishedAt = data.is_published ? now : null;

      const result = await c.env.DB.prepare(
        `INSERT INTO news_posts (title, content, author_user_id, author_name, is_published, published_at, image_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.title,
        data.content,
        user.id,
        getUserDisplayName(user),
        data.is_published ? 1 : 0,
        publishedAt,
        data.image_key || null,
        now,
        now
      ).run();

      console.log("Insert result:", JSON.stringify(result));
      
      if (!result.meta?.last_row_id) {
        throw new Error("Failed to get post ID from database insert");
      }
      
      const postId = Number(result.meta.last_row_id);
      console.log("Created post with ID:", postId, "type:", typeof postId);

      // Insert images if provided
      if (data.images && data.images.length > 0) {
        console.log("Inserting", data.images.length, "images for post ID:", postId);
        for (let i = 0; i < data.images.length; i++) {
          const image = data.images[i];
          console.log("Inserting image", i, ":", image.image_key, "caption:", image.caption);
          await c.env.DB.prepare(
            `INSERT INTO news_post_images (news_post_id, image_key, caption, order_index, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            postId,
            image.image_key,
            image.caption || null,
            i,
            now,
            now
          ).run();
          console.log("Successfully inserted image", i);
        }
      }

      console.log("Logging activity for post:", postId);
      await logActivity({
        db: c.env.DB,
        userId: user.id,
        userName: getUserDisplayName(user),
        action: 'created',
        entityType: 'news_post',
        entityId: postId,
        entityName: data.title
      });
      console.log("Activity logged successfully");

      console.log("=== END CREATE NEWS POST SUCCESS ===");
      return c.json({ id: postId, success: true });
    } catch (error) {
      console.error("=== ERROR IN CREATE NEWS POST ===");
      console.error("Error type:", typeof error);
      console.error("Error:", error);
      console.error("Stack:", error instanceof Error ? error.stack : 'No stack');
      return c.json({ 
        error: "Failed to create post",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 500);
    }
  });

  // Admin: Update news post
  app.put("/api/portal/news-posts/:id", authMiddleware, async (c) => {
    try {
      const authError = await requireAdmin(c);
      if (authError) return authError;

      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      
      const id = c.req.param("id");
      const body = await c.req.json();
      console.log("Updating news post", id, "with data:", JSON.stringify(body, null, 2));
      
      const data = newsPostSchema.parse(body);

      const now = new Date().toISOString();
      
      // Get current post to check if we're publishing for the first time
      const current = await c.env.DB.prepare(
        "SELECT is_published, published_at FROM news_posts WHERE id = ?"
      ).bind(id).first();

      const wasPublished = current?.is_published === 1;
      const isPublishing = data.is_published && !wasPublished;
      const publishedAt = isPublishing ? now : current?.published_at;

      await c.env.DB.prepare(
        `UPDATE news_posts 
         SET title = ?, content = ?, is_published = ?, published_at = ?, image_key = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        data.title,
        data.content,
        data.is_published ? 1 : 0,
        publishedAt,
        data.image_key || null,
        now,
        id
      ).run();

      // Delete existing images and insert new ones
      await c.env.DB.prepare(
        `DELETE FROM news_post_images WHERE news_post_id = ?`
      ).bind(id).run();

      if (data.images && data.images.length > 0) {
        console.log("Inserting", data.images.length, "images for post", id);
        for (let i = 0; i < data.images.length; i++) {
          const image = data.images[i];
          await c.env.DB.prepare(
            `INSERT INTO news_post_images (news_post_id, image_key, caption, order_index, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            id,
            image.image_key,
            image.caption || null,
            i,
            now,
            now
          ).run();
        }
      }

      await logActivity({
        db: c.env.DB,
        userId: user.id,
        userName: getUserDisplayName(user),
        action: 'updated',
        entityType: 'news_post',
        entityId: parseInt(id),
        entityName: data.title
      });

      return c.json({ success: true });
    } catch (error) {
      console.error("Error updating news post:", error);
      return c.json({ 
        error: "Failed to update post",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });

  // Admin: Delete news post
  app.delete("/api/portal/news-posts/:id", authMiddleware, async (c) => {
    const authError = await requireAdmin(c);
    if (authError) return authError;

    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const id = c.req.param("id");

    const post = await c.env.DB.prepare(
      "SELECT title FROM news_posts WHERE id = ?"
    ).bind(id).first();

    await c.env.DB.prepare("DELETE FROM news_posts WHERE id = ?").bind(id).run();

    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'deleted',
      entityType: 'news_post',
      entityId: parseInt(id),
      entityName: post?.title as string
    });

    return c.json({ success: true });
  });

  // Admin: Upload image for news post
  app.post("/api/portal/news-posts/upload-image", authMiddleware, async (c) => {
    const authError = await requireAdmin(c);
    if (authError) return authError;

    try {
      const formData = await c.req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        console.error("No file in formData");
        return c.json({ error: "No file provided" }, 400);
      }

      console.log("Uploading file:", file.name, "type:", file.type, "size:", file.size);

      // Generate unique key for the file
      const fileKey = `news-images/${Date.now()}-${file.name}`;
      
      // Convert file to ArrayBuffer for R2 compatibility
      const arrayBuffer = await file.arrayBuffer();
      
      console.log("ArrayBuffer size:", arrayBuffer.byteLength);
      
      // Upload to R2
      await c.env.R2_BUCKET.put(fileKey, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
      });

      console.log("Successfully uploaded to R2:", fileKey);

      return c.json({ image_key: fileKey, success: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      return c.json({ error: error instanceof Error ? error.message : "Failed to upload image" }, 500);
    }
  });

  // Public endpoint to get news post images
  app.get("/api/public/news-images/:key{.*}", async (c) => {
    try {
      const key = c.req.param("key");
      const object = await c.env.R2_BUCKET.get(`news-images/${key}`);

      if (!object) {
        return c.json({ error: "Image not found" }, 404);
      }

      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    } catch (error) {
      console.error("Error fetching image:", error);
      return c.json({ error: "Failed to fetch image" }, 500);
    }
  });
}

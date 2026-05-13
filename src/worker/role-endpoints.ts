import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { logActivity, getUserDisplayName } from "./activity-logger";
import type { Env } from "@/shared/types";

// Schema for role assignment
const assignRoleSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['admin', 'coach', 'parent']),
  team_id: z.number().nullable().optional(),
  family_id: z.number().nullable().optional(),
});

export function setupRoleEndpoints(app: Hono<{ Bindings: Env }>, authMiddleware: any, requireAdmin: any) {
  // Get all user roles (admin only)
  app.get("/api/portal/user-roles", authMiddleware, requireAdmin, async (c) => {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        ur.*,
        f.name as family_name,
        t.name as team_name
      FROM user_roles ur
      LEFT JOIN families f ON ur.family_id = f.id
      LEFT JOIN teams t ON ur.team_id = t.id
      ORDER BY ur.created_at DESC
    `).all();
    
    return c.json(results);
  });

  // Assign role to user (admin only)
  app.post("/api/portal/user-roles", authMiddleware, requireAdmin, zValidator("json", assignRoleSchema), async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");
    
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO user_roles (user_id, email, name, role, team_id, family_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(data.user_id, data.email, data.name || null, data.role, data.team_id || null, data.family_id || null).run();
    
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'created',
      entityType: 'role',
      entityId: Number(result.meta.last_row_id),
      entityName: `${data.role} role`,
      teamId: data.team_id || undefined,
      familyId: data.family_id || undefined,
      details: `Assigned to user ${data.user_id}`,
    });
    
    return c.json({ id: result.meta.last_row_id }, 201);
  });

  // Update role assignment (admin only)
  app.put("/api/portal/user-roles/:id", authMiddleware, requireAdmin, zValidator("json", assignRoleSchema), async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const user = c.get("user");
    
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await c.env.DB.prepare(`
      UPDATE user_roles 
      SET user_id = ?, email = ?, name = ?, role = ?, team_id = ?, family_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(data.user_id, data.email, data.name || null, data.role, data.team_id || null, data.family_id || null, id).run();
    
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'updated',
      entityType: 'role',
      entityId: Number(id),
      entityName: `${data.role} role`,
      teamId: data.team_id || undefined,
      familyId: data.family_id || undefined,
      details: `Updated for user ${data.user_id}`,
    });
    
    return c.json({ success: true });
  });

  // Remove role from user (admin only)
  app.delete("/api/portal/user-roles/:id", authMiddleware, requireAdmin, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get role info before deleting
    const role = await c.env.DB.prepare(
      "SELECT * FROM user_roles WHERE id = ?"
    ).bind(id).first();
    
    await c.env.DB.prepare("DELETE FROM user_roles WHERE id = ?").bind(id).run();
    
    if (role) {
      await logActivity({
        db: c.env.DB,
        userId: user.id,
        userName: getUserDisplayName(user),
        action: 'deleted',
        entityType: 'role',
        entityId: Number(id),
        entityName: `${role.role} role`,
        details: `Removed from user ${role.user_id}`,
      });
    }
    
    return c.json({ success: true });
  });

  // Get roles for a specific user (admin only)
  app.get("/api/portal/users/:userId/roles", authMiddleware, requireAdmin, async (c) => {
    const userId = c.req.param("userId");
    
    const { results } = await c.env.DB.prepare(`
      SELECT 
        ur.*,
        f.name as family_name,
        t.name as team_name
      FROM user_roles ur
      LEFT JOIN families f ON ur.family_id = f.id
      LEFT JOIN teams t ON ur.team_id = t.id
      WHERE ur.user_id = ?
      ORDER BY ur.created_at DESC
    `).bind(userId).all();
    
    return c.json(results);
  });
}

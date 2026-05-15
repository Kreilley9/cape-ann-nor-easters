import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";

export const rolesRouter = Router();

rolesRouter.get("/user-roles", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query(`
    SELECT ur.*, f.name as family_name, t.name as team_name
    FROM user_roles ur
    LEFT JOIN families f ON ur.family_id = f.id
    LEFT JOIN teams t ON ur.team_id = t.id
    ORDER BY ur.created_at DESC
  `);
  res.json(result.rows);
});

rolesRouter.post("/user-roles", requireAuth, requireAdmin, async (req, res) => {
  const { user_id, email, name, role, team_id, family_id } = req.body;
  if (!user_id || !email || !role) {
    res.status(400).json({ error: "user_id, email, and role are required" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO user_roles (user_id, email, name, role, team_id, family_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
    [user_id, email, name || null, role, team_id || null, family_id || null]
  );

  await logActivity({
    userId: req.user!.id,
    userName: getUserDisplayName(req.user!),
    action: "created",
    entityType: "role",
    entityId: result.rows[0].id,
    entityName: `${role} role`,
    teamId: team_id || undefined,
    familyId: family_id || undefined,
    details: `Assigned to user ${user_id}`,
  });

  res.status(201).json({ id: result.rows[0].id });
});

rolesRouter.put("/user-roles/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { user_id, email, name, role, team_id, family_id } = req.body;

  await pool.query(
    `UPDATE user_roles
     SET user_id = $1, email = $2, name = $3, role = $4, team_id = $5, family_id = $6, updated_at = NOW()
     WHERE id = $7`,
    [user_id, email, name || null, role, team_id || null, family_id || null, id]
  );

  await logActivity({
    userId: req.user!.id,
    userName: getUserDisplayName(req.user!),
    action: "updated",
    entityType: "role",
    entityId: Number(id),
    entityName: `${role} role`,
    teamId: team_id || undefined,
    familyId: family_id || undefined,
    details: `Updated for user ${user_id}`,
  });

  res.json({ success: true });
});

rolesRouter.delete("/user-roles/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const existing = await pool.query("SELECT * FROM user_roles WHERE id = $1", [id]);
  const roleRow = existing.rows[0];

  await pool.query("DELETE FROM user_roles WHERE id = $1", [id]);

  if (roleRow) {
    await logActivity({
      userId: req.user!.id,
      userName: getUserDisplayName(req.user!),
      action: "deleted",
      entityType: "role",
      entityId: Number(id),
      entityName: `${roleRow.role} role`,
      details: `Removed from user ${roleRow.user_id}`,
    });
  }

  res.json({ success: true });
});

rolesRouter.get("/users/:userId/roles", requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const result = await pool.query(
    `SELECT ur.*, f.name as family_name, t.name as team_name
     FROM user_roles ur
     LEFT JOIN families f ON ur.family_id = f.id
     LEFT JOIN teams t ON ur.team_id = t.id
     WHERE ur.user_id = $1
     ORDER BY ur.created_at DESC`,
    [userId]
  );
  res.json(result.rows);
});

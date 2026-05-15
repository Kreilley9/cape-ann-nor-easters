import type { Request, Response, NextFunction } from "express";
import { pool } from "../lib/db.ts";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const result = await pool.query(
    "SELECT id FROM user_roles WHERE user_id = $1 AND role = 'admin'",
    [req.user.id]
  );

  if (result.rows.length === 0) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

export async function requireCoach(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const roleResult = await pool.query(
    "SELECT id FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'coach')",
    [req.user.id]
  );

  if (roleResult.rows.length === 0) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

export async function isAdmin(userId: string, _userEmail: string | undefined): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM user_roles WHERE user_id = $1 AND role = 'admin'",
    [userId]
  );
  return result.rows.length > 0;
}

export async function getUserRoles(userId: string): Promise<Array<{ role: string; team_id: number | null; family_id: number | null }>> {
  const result = await pool.query(
    "SELECT role, team_id, family_id FROM user_roles WHERE user_id = $1",
    [userId]
  );
  return result.rows;
}

export async function getFamilyId(userId: string): Promise<number | null> {
  const result = await pool.query(
    "SELECT id FROM families WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  return result.rows[0]?.id ?? null;
}

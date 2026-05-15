import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles, getFamilyId } from "../middleware/roles.ts";

export const activityRouter = Router();

activityRouter.get("/activity", requireAuth, async (req, res) => {
  const user = req.user!;
  const adminCheck = await isAdmin(user.id, user.email!);
  const roles = await getUserRoles(user.id);
  const isCoach = roles.some((r) => r.role === "coach");
  const isParent = roles.some((r) => r.role === "parent");
  const familyId = await getFamilyId(user.id);
  const coachTeamIds = roles.filter((r) => r.role === "coach" && r.team_id).map((r) => r.team_id!);

  let query: string;
  let bindings: (string | number)[] = [];

  if (adminCheck) {
    query = "SELECT * FROM activity_log WHERE 1=1 ORDER BY created_at DESC LIMIT 100";
  } else if (isCoach && coachTeamIds.length > 0) {
    const placeholders = coachTeamIds.map((_, i) => `$${i + 1}`).join(",");
    query = `SELECT * FROM activity_log WHERE team_id IN (${placeholders}) OR team_id IS NULL ORDER BY created_at DESC LIMIT 100`;
    bindings = coachTeamIds as number[];
  } else if (isParent && familyId) {
    query = "SELECT * FROM activity_log WHERE family_id = $1 ORDER BY created_at DESC LIMIT 100";
    bindings = [familyId];
  } else {
    res.json([]);
    return;
  }

  const result = await pool.query(query, bindings);
  res.json(result.rows);
});

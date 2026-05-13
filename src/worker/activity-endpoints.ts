import { Hono } from "hono";
import type { Env } from "@/shared/types";

// Import auth helper functions - these are defined in worker/index.ts
async function getUserRoles(db: D1Database, userId: string): Promise<any[]> {
  const { results } = await db.prepare(
    "SELECT * FROM user_roles WHERE user_id = ?"
  ).bind(userId).all();
  return results as any[];
}

async function isAdmin(db: D1Database, userId: string, email: string): Promise<boolean> {
  const roles = await getUserRoles(db, userId);
  if (roles.some((r: any) => r.role === 'Admin')) return true;
  const adminEmails = ['kevin@capeannnoreasters.com'];
  return adminEmails.includes(email.toLowerCase());
}

async function getFamilyIdForUser(db: D1Database, userId: string): Promise<number | null> {
  const roles = await getUserRoles(db, userId);
  const familyRole = roles.find((r: any) => r.role === 'Family' && r.family_id);
  return familyRole ? familyRole.family_id : null;
}

export function setupActivityEndpoints(app: Hono<{ Bindings: Env }>, authMiddleware: any) {
  // Get activity log filtered by role
  app.get("/api/portal/activity", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const roles = await getUserRoles(c.env.DB, user.id);
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    const isCoach = roles.some((r: any) => r.role === 'Coach');
    const isParent = roles.some((r: any) => r.role === 'Parent' || r.role === 'Family');
    const familyId = await getFamilyIdForUser(c.env.DB, user.id);
    const coachTeamIds = roles.filter((r: any) => r.role === 'Coach' && r.team_id).map((r: any) => r.team_id!);

    let query = `
      SELECT *
      FROM activity_log
    `;
    let whereClause = "";
    let bindings: any[] = [];

    if (adminCheck) {
      // Admin sees everything
      whereClause = "WHERE 1=1";
    } else if (isCoach && coachTeamIds.length > 0) {
      // Coach sees activities related to their teams
      const placeholders = coachTeamIds.map(() => "?").join(",");
      whereClause = `WHERE team_id IN (${placeholders}) OR team_id IS NULL`;
      bindings = coachTeamIds;
    } else if (isParent && familyId) {
      // Parent sees activities related to their family
      whereClause = "WHERE family_id = ?";
      bindings = [familyId];
    } else {
      // No role - no activity
      return c.json([]);
    }

    query += ` ${whereClause} ORDER BY created_at DESC LIMIT 100`;

    const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

    return c.json(results);
  });
}

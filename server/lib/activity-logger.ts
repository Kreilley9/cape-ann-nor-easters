import { pool } from "./db.ts";

interface ActivityLogParams {
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: number;
  entityName?: string;
  teamId?: number;
  familyId?: number;
  details?: string;
}

export async function logActivity(params: ActivityLogParams) {
  const { userId, userName, action, entityType, entityId, entityName, teamId, familyId, details } = params;
  try {
    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, entity_name, team_id, family_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [userId ?? null, userName ?? null, action, entityType, entityId ?? null, entityName ?? null, teamId ?? null, familyId ?? null, details ?? null]
    );
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export function getUserDisplayName(user: { email?: string; user_metadata?: { full_name?: string; given_name?: string } } | null): string {
  try {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.user_metadata?.given_name) return user.user_metadata.given_name;
    if (user?.email) return user.email.split("@")[0];
    return "Unknown User";
  } catch {
    return "Unknown User";
  }
}

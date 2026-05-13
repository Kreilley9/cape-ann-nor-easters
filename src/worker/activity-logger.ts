// Activity logging helper functions

interface ActivityLogParams {
  db: D1Database;
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
  const {
    db,
    userId,
    userName,
    action,
    entityType,
    entityId,
    entityName,
    teamId,
    familyId,
    details,
  } = params;

  const now = new Date().toISOString();

  try {
    await db.prepare(`
      INSERT INTO activity_log (
        user_id, user_name, action, entity_type, entity_id, entity_name,
        team_id, family_id, details, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId || null,
      userName || null,
      action,
      entityType,
      entityId || null,
      entityName || null,
      teamId || null,
      familyId || null,
      details || null,
      now,
      now
    ).run();
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw - logging shouldn't break the main operation
  }
}

export function getUserDisplayName(user: any): string {
  try {
    if (user?.google_user_data?.name) return user.google_user_data.name;
    if (user?.google_user_data?.given_name) return user.google_user_data.given_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Unknown User';
  } catch (error) {
    console.error("Error in getUserDisplayName:", error);
    return 'Unknown User';
  }
}

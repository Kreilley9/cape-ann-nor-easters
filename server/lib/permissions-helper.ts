import { pool } from "./db.ts";

async function getPermission(userId: string, key: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT permission_value FROM user_permissions WHERE user_id = $1 AND permission_key = $2",
    [userId, key]
  );
  return result.rows[0]?.permission_value ?? null;
}

async function hasRole(userId: string, role: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM user_roles WHERE user_id = $1 AND role = $2",
    [userId, role]
  );
  return result.rows.length > 0;
}

export async function getUserPermissions(userId: string): Promise<Map<string, string>> {
  const result = await pool.query(
    "SELECT permission_key, permission_value FROM user_permissions WHERE user_id = $1",
    [userId]
  );
  const permissions = new Map<string, string>();
  for (const row of result.rows) {
    permissions.set(row.permission_key, row.permission_value);
  }
  return permissions;
}

export async function checkRecruitingAccess(
  userId: string,
  prospectAgeGroup?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const access = await getPermission(userId, "recruiting_access");

  if (access) {
    if (access === "none") return { allowed: false, reason: "You do not have access to recruiting" };

    if (access === "limited" && prospectAgeGroup) {
      const allowedGroups = await getPermission(userId, "recruiting_age_groups");
      if (allowedGroups) {
        const groups = allowedGroups.split(",");
        if (!groups.includes(prospectAgeGroup)) {
          return { allowed: false, reason: `You do not have access to ${prospectAgeGroup} recruiting` };
        }
      }
    }

    return { allowed: true };
  }

  const isAdminUser = await hasRole(userId, "admin");
  const isCoachUser = await hasRole(userId, "coach");
  if (isAdminUser || isCoachUser) return { allowed: true };

  return { allowed: false, reason: "You do not have access to recruiting" };
}

export async function canSendMessages(userId: string): Promise<boolean> {
  const permission = await getPermission(userId, "messaging_send");
  if (permission !== null) return permission !== "false";

  const isAdminUser = await hasRole(userId, "admin");
  const isCoachUser = await hasRole(userId, "coach");
  return isAdminUser || isCoachUser;
}

export async function canUploadDocuments(userId: string): Promise<boolean> {
  const permission = await getPermission(userId, "documents_upload");
  if (permission !== null) return permission !== "false";

  const isAdminUser = await hasRole(userId, "admin");
  const isCoachUser = await hasRole(userId, "coach");
  return isAdminUser || isCoachUser;
}

export async function canDownloadDocuments(userId: string): Promise<boolean> {
  const permission = await getPermission(userId, "documents_download");
  if (permission !== null) return permission !== "false";
  return true;
}

export async function canManageEvents(userId: string): Promise<boolean> {
  const permission = await getPermission(userId, "events_manage");
  if (permission !== null) return permission !== "false";

  const isAdminUser = await hasRole(userId, "admin");
  const isCoachUser = await hasRole(userId, "coach");
  return isAdminUser || isCoachUser;
}

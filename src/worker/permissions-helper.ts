// Permission checking helper functions

interface UserPermission {
  permission_key: string;
  permission_value: string;
}

interface UserRole {
  role: string;
  team_id: number | null;
  family_id: number | null;
}

async function getUserRoles(db: D1Database, userId: string): Promise<UserRole[]> {
  const { results } = await db.prepare(
    "SELECT role, team_id, family_id FROM user_roles WHERE user_id = ?"
  ).bind(userId).all();
  return (results || []) as unknown as UserRole[];
}

async function hasRole(db: D1Database, userId: string, role: string): Promise<boolean> {
  const roles = await getUserRoles(db, userId);
  return roles.some(r => r.role === role);
}

export async function getUserPermissions(db: D1Database, userId: string): Promise<Map<string, string>> {
  const result = await db.prepare(
    "SELECT permission_key, permission_value FROM user_permissions WHERE user_id = ?"
  ).bind(userId).all();
  
  const permissions = new Map<string, string>();
  for (const row of (result.results || []) as unknown as UserPermission[]) {
    permissions.set(row.permission_key, row.permission_value);
  }
  return permissions;
}

export async function getPermission(db: D1Database, userId: string, key: string): Promise<string | null> {
  const result = await db.prepare(
    "SELECT permission_value FROM user_permissions WHERE user_id = ? AND permission_key = ?"
  ).bind(userId, key).first() as { permission_value: string } | null;
  
  return result?.permission_value || null;
}

// Check if user has recruiting access (full, limited, or none)
export async function checkRecruitingAccess(db: D1Database, userId: string, prospectAgeGroup?: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check for explicit permission override first
  const access = await getPermission(db, userId, 'recruiting_access');
  
  if (access) {
    // Explicit permission set - honor it
    if (access === 'none') {
      return { allowed: false, reason: 'You do not have access to recruiting' };
    }
    
    if (access === 'limited' && prospectAgeGroup) {
      const allowedGroups = await getPermission(db, userId, 'recruiting_age_groups');
      if (allowedGroups) {
        const groups = allowedGroups.split(',');
        if (!groups.includes(prospectAgeGroup)) {
          return { allowed: false, reason: `You do not have access to ${prospectAgeGroup} recruiting` };
        }
      }
    }
    
    return { allowed: true };
  }
  
  // No explicit permission - check role-based defaults
  const isAdminUser = await hasRole(db, userId, 'admin');
  const isCoachUser = await hasRole(db, userId, 'coach');
  
  // Only admins and coaches have recruiting access by default
  if (isAdminUser || isCoachUser) {
    return { allowed: true };
  }
  
  // Parents and other roles don't have recruiting access by default
  return { allowed: false, reason: 'You do not have access to recruiting' };
}

// Check if user can send messages
export async function canSendMessages(db: D1Database, userId: string): Promise<boolean> {
  const permission = await getPermission(db, userId, 'messaging_send');
  
  if (permission !== null) {
    // Explicit permission set - honor it
    return permission !== 'false';
  }
  
  // No explicit permission - check role-based defaults
  const isAdminUser = await hasRole(db, userId, 'admin');
  const isCoachUser = await hasRole(db, userId, 'coach');
  
  // Only admins and coaches can send messages by default
  return isAdminUser || isCoachUser;
}

// Check if user can upload documents
export async function canUploadDocuments(db: D1Database, userId: string): Promise<boolean> {
  const permission = await getPermission(db, userId, 'documents_upload');
  
  if (permission !== null) {
    // Explicit permission set - honor it
    return permission !== 'false';
  }
  
  // No explicit permission - check role-based defaults
  const isAdminUser = await hasRole(db, userId, 'admin');
  const isCoachUser = await hasRole(db, userId, 'coach');
  
  // Only admins and coaches can upload documents by default
  return isAdminUser || isCoachUser;
}

// Check if user can download documents
export async function canDownloadDocuments(db: D1Database, userId: string): Promise<boolean> {
  const permission = await getPermission(db, userId, 'documents_download');
  
  if (permission !== null) {
    // Explicit permission set - honor it
    return permission !== 'false';
  }
  
  // No explicit permission - everyone can download documents by default
  return true;
}

// Check if user can manage events
export async function canManageEvents(db: D1Database, userId: string): Promise<boolean> {
  const permission = await getPermission(db, userId, 'events_manage');
  
  if (permission !== null) {
    // Explicit permission set - honor it
    return permission !== 'false';
  }
  
  // No explicit permission - check role-based defaults
  const isAdminUser = await hasRole(db, userId, 'admin');
  const isCoachUser = await hasRole(db, userId, 'coach');
  
  // Only admins and coaches can manage events by default
  return isAdminUser || isCoachUser;
}

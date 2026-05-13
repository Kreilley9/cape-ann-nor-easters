import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@getmocha/users-service/react";

interface UserRole {
  role: string;
  team_id: number | null;
  family_id: number | null;
}

interface RoleContextType {
  isAdmin: boolean;
  isCoach: boolean;
  isParent: boolean;
  roles: UserRole[];
  familyId: number | null;
  coachTeamIds: number[];
  loading: boolean;
  // Helper function to check if user can access a team
  canAccessTeam: (teamId: number) => boolean;
  // Helper function to check if user can access a player (via family)
  canAccessPlayer: (playerId: number, playerFamilyId: number | null) => boolean;
  // Refresh roles from server
  refreshRoles: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType>({
  isAdmin: false,
  isCoach: false,
  isParent: false,
  roles: [],
  familyId: null,
  coachTeamIds: [],
  loading: true,
  canAccessTeam: () => false,
  canAccessPlayer: () => false,
  refreshRoles: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch("/api/users/me", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin || false);
        setRoles(data.roles || []);
        setFamilyId(data.family_id || null);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [user]);

  const isCoach = roles.some((r) => r.role === "coach") || isAdmin;
  const isParent = roles.some((r) => r.role === "parent") || !!familyId;
  
  // Get team IDs that the coach has access to
  const coachTeamIds = roles
    .filter((r) => r.role === "coach" && r.team_id !== null)
    .map((r) => r.team_id as number);

  // Admin coaches have access to all teams
  const canAccessTeam = (teamId: number): boolean => {
    if (isAdmin) return true;
    if (coachTeamIds.length === 0 && isCoach) return true; // Coach without specific teams = all teams
    return coachTeamIds.includes(teamId);
  };

  const canAccessPlayer = (_playerId: number, playerFamilyId: number | null): boolean => {
    if (isAdmin) return true;
    if (isCoach) return true; // Coaches can access all players on their teams
    if (isParent && familyId && playerFamilyId === familyId) return true;
    return false;
  };

  const refreshRoles = async () => {
    setLoading(true);
    await fetchRoles();
  };

  return (
    <RoleContext.Provider
      value={{
        isAdmin,
        isCoach,
        isParent,
        roles,
        familyId,
        coachTeamIds,
        loading,
        canAccessTeam,
        canAccessPlayer,
        refreshRoles,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRoles() {
  return useContext(RoleContext);
}

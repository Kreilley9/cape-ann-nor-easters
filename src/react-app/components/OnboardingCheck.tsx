import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@getmocha/users-service/react";

interface OnboardingCheckProps {
  children: React.ReactNode;
}

export function OnboardingCheck({ children }: OnboardingCheckProps) {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Skip check if user is not logged in, still loading, or already on onboarding/invite pages
      if (!user || isPending || 
          location.pathname === "/onboarding" || 
          location.pathname.startsWith("/invite/") ||
          location.pathname === "/auth/callback") {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch("/api/users/me", { credentials: "include" });
        if (!response.ok) {
          setChecking(false);
          return;
        }

        const userData = await response.json();
        
        // If user is a parent and has a family_id, check if onboarding is completed
        if (userData.roles?.some((r: any) => r.role === "parent") && userData.family_id) {
          const familyResponse = await fetch(`/api/portal/families/${userData.family_id}`, {
            credentials: "include"
          });
          
          if (familyResponse.ok) {
            const family = await familyResponse.json();
            
            // If onboarding not completed, redirect to onboarding
            if (!family.onboarding_completed && location.pathname !== "/onboarding") {
              navigate("/onboarding");
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setChecking(false);
      }
    };

    checkOnboardingStatus();
  }, [user, isPending, location.pathname, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

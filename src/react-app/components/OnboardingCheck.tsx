import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { apiFetch } from "@/react-app/lib/api";

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
      if (
        !user ||
        isPending ||
        location.pathname === "/onboarding" ||
        location.pathname.startsWith("/invite/") ||
        location.pathname === "/auth/callback"
      ) {
        setChecking(false);
        return;
      }

      try {
        const response = await apiFetch("/api/users/me");
        if (!response.ok) { setChecking(false); return; }

        const userData = await response.json();

        if (!userData.family_id) {
          navigate("/onboarding");
          return;
        }

        const familyResponse = await apiFetch(`/api/portal/families/${userData.family_id}`);
        if (familyResponse.ok) {
          const family = await familyResponse.json();
          if (!family.onboarding_completed) {
            navigate("/onboarding");
            return;
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

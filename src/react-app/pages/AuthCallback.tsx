import { useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/react-app/lib/supabase";
import { apiFetch } from "@/react-app/lib/api";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (error) throw error;

        // Invite accepted via the /invite/:code flow (Google OAuth + existing invite page)
        const pendingInviteCode = sessionStorage.getItem("pending_invite_code");
        if (pendingInviteCode) {
          sessionStorage.removeItem("pending_invite_code");
          navigate(`/invite/${pendingInviteCode}`);
          return;
        }

        // Invite redeemed inline — sign-up form stored code before email confirmation
        const signupInviteCode = sessionStorage.getItem("pending_signup_invite");
        if (signupInviteCode) {
          sessionStorage.removeItem("pending_signup_invite");
          await apiFetch("/api/invites/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: signupInviteCode }),
          }).catch((err) => console.error("Failed to redeem invite:", err));
        }

        navigate("/portal");
      } catch (error) {
        console.error("Authentication error:", error);
        navigate("/");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin">
        <Loader2 className="w-10 h-10 text-blue-600" />
      </div>
      <p className="mt-4 text-gray-600">Completing authentication...</p>
    </div>
  );
}

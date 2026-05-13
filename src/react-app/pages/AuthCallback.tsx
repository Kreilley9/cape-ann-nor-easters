import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const { exchangeCodeForSessionToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await exchangeCodeForSessionToken();
        
        // Check if user was accepting an invite before login
        const pendingInviteCode = sessionStorage.getItem('pending_invite_code');
        if (pendingInviteCode) {
          sessionStorage.removeItem('pending_invite_code');
          navigate(`/invite/${pendingInviteCode}`);
        } else {
          navigate("/portal");
        }
      } catch (error) {
        console.error("Authentication error:", error);
        navigate("/");
      }
    };

    handleCallback();
  }, [exchangeCodeForSessionToken, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin">
        <Loader2 className="w-10 h-10 text-blue-600" />
      </div>
      <p className="mt-4 text-gray-600">Completing authentication...</p>
    </div>
  );
}

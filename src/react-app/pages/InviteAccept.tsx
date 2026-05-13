import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { Mail, CheckCircle, XCircle, Loader } from "lucide-react";

export default function InviteAccept() {
  const { code } = useParams<{ code: string }>();
  const { user, redirectToLogin } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"validating" | "valid" | "invalid" | "accepting" | "accepted">("validating");
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    validateInvite();
  }, [code]);

  useEffect(() => {
    if (user && status === "valid") {
      acceptInvite();
    }
  }, [user, status]);

  const validateInvite = async () => {
    if (!code) {
      setStatus("invalid");
      setError("No invite code provided");
      return;
    }

    try {
      const response = await fetch(`/api/invites/validate/${code}`);
      const data = await response.json();

      if (data.valid) {
        setStatus("valid");
        setInviteData({ email: data.email, role: data.role });
      } else {
        setStatus("invalid");
        setError(data.error || "Invalid invite");
      }
    } catch (error) {
      setStatus("invalid");
      setError("Failed to validate invite");
    }
  };

  const acceptInvite = async () => {
    if (!user || !code) return;

    setStatus("accepting");

    try {
      const response = await fetch("/api/portal/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("accepted");
        // Redirect to onboarding if parent, otherwise to portal
        setTimeout(() => {
          if (data.role === "parent") {
            navigate("/onboarding");
          } else {
            navigate("/portal");
          }
        }, 2000);
      } else {
        setStatus("invalid");
        setError(data.error || "Failed to accept invite");
      }
    } catch (error) {
      setStatus("invalid");
      setError("Failed to accept invite");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {status === "validating" && (
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white font-[Oswald] mb-2">Validating Invite</h2>
            <p className="text-gray-400">Please wait...</p>
          </div>
        )}

        {status === "valid" && !user && (
          <div className="text-center">
            <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white font-[Oswald] mb-2">Portal Invite</h2>
            <p className="text-gray-400 mb-4">
              You've been invited to join the Cape Ann Nor'easters portal as a{" "}
              <span className="font-semibold capitalize">{inviteData?.role}</span>.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This invite is for: <span className="font-medium">{inviteData?.email}</span>
            </p>
            <button
              onClick={() => {
                // Store invite code so we can return after login
                if (code) {
                  sessionStorage.setItem('pending_invite_code', code);
                }
                redirectToLogin();
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Sign in with Google to Accept
            </button>
          </div>
        )}

        {status === "accepting" && (
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white font-[Oswald] mb-2">Accepting Invite</h2>
            <p className="text-gray-400">Setting up your access...</p>
          </div>
        )}

        {status === "accepted" && (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white font-[Oswald] mb-2">Welcome!</h2>
            <p className="text-gray-400 mb-4">Your invite has been accepted.</p>
            <p className="text-sm text-gray-500">Redirecting you to the portal...</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white font-[Oswald] mb-2">Invalid Invite</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Go to Home
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

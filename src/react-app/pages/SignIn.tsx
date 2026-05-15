import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Loader2, Mail, Lock, ArrowRight, CheckCircle, KeyRound } from "lucide-react";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";

type Tab = "signin" | "signup" | "magic";

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function SignIn() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate("/portal");
  }, [user, navigate]);

  const clearState = () => { setError(null); setSuccess(null); };

  const handleGoogleSignIn = async () => {
    clearState();
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // browser redirects, no need to setLoading(false)
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // on success, onAuthStateChange fires → user updates → useEffect navigates
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!inviteCode.trim()) {
      setError("An invite code is required to create an account.");
      return;
    }

    setLoading(true);

    // Validate invite before creating the account
    const validateRes = await fetch(`/api/invites/validate?code=${encodeURIComponent(inviteCode.trim().toUpperCase())}`);
    const validateData = await validateRes.json().catch(() => ({}));
    if (!validateRes.ok || !validateData.valid) {
      setError(validateData.error ?? "Invalid invite code.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Store the invite code — AuthCallback redeems it after email confirmation
    sessionStorage.setItem("pending_signup_invite", inviteCode.trim().toUpperCase());
    setSuccess("Account created! Check your email to confirm, then click the link to finish signing in.");
    setPassword("");
    setConfirmPassword("");
    setInviteCode("");
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess("Magic link sent! Check your email and click the link to sign in.");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "signin", label: "Sign In" },
    { id: "signup", label: "Sign Up" },
    { id: "magic", label: "Magic Link" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f14] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link to="/" className="mb-8">
        <img
          src="https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Noreasters%20Snow%20Logo%20No%20Background.png"
          alt="Cape Ann Nor'easters"
          className="h-20 w-auto"
        />
      </Link>

      <div className="w-full max-w-md">
        <div className="bg-[#121a24] border border-[#007ba7]/30 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#007ba7]/20">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); clearState(); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? "text-[#00c4ff] border-b-2 border-[#00c4ff] bg-[#007ba7]/10"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* Google OAuth — Sign In tab only */}
            {tab === "signin" && (
              <>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-[#007ba7]/20" />
                  <span className="text-white/30 text-xs font-medium uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-[#007ba7]/20" />
                </div>
              </>
            )}

            {/* Error / Success banners */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {success}
              </div>
            )}

            {/* Sign In form */}
            {tab === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-[#00c4ff] transition-colors text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-[#00c4ff] transition-colors text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#007ba7] text-white font-semibold rounded-lg hover:bg-[#00a3d9] transition-colors disabled:opacity-50 shadow-lg shadow-[#007ba7]/30"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Sign In
                </button>
                <p className="text-center text-xs text-white/30 mt-2">
                  No account?{" "}
                  <button type="button" onClick={() => { setTab("signup"); clearState(); }} className="text-[#00c4ff] hover:underline">
                    Sign up
                  </button>
                  {" "}or use a{" "}
                  <button type="button" onClick={() => { setTab("magic"); clearState(); }} className="text-[#00c4ff] hover:underline">
                    magic link
                  </button>
                </p>
              </form>
            )}

            {/* Sign Up form */}
            {tab === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="px-4 py-3 rounded-lg bg-[#007ba7]/10 border border-[#007ba7]/20 text-[#00c4ff]/80 text-sm">
                  Have a Google account? Use the <strong>Accept Invitation</strong> link in your invite email — it connects your Google account automatically.
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    Invite Code <span className="text-[#00c4ff]">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      required
                      placeholder="XXXXXXXX"
                      maxLength={8}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-[#00c4ff] transition-colors text-sm font-mono tracking-widest"
                    />
                  </div>
                  <p className="mt-1 text-xs text-white/30">Registration is by invitation only. Check your email for a code.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-[#00c4ff] transition-colors text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-[#00c4ff] transition-colors text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-[#00c4ff] transition-colors text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#007ba7] text-white font-semibold rounded-lg hover:bg-[#00a3d9] transition-colors disabled:opacity-50 shadow-lg shadow-[#007ba7]/30"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Create Account
                </button>
                <p className="text-center text-xs text-white/30 mt-2">
                  Already have an account?{" "}
                  <button type="button" onClick={() => { setTab("signin"); clearState(); }} className="text-[#00c4ff] hover:underline">
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* Magic Link form */}
            {tab === "magic" && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <p className="text-white/50 text-sm mb-4">
                  Enter your email and we'll send you a link to sign in — no password needed.
                </p>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-[#00c4ff] transition-colors text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !!success}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#007ba7] text-white font-semibold rounded-lg hover:bg-[#00a3d9] transition-colors disabled:opacity-50 shadow-lg shadow-[#007ba7]/30"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Magic Link
                </button>
                <p className="text-center text-xs text-white/30 mt-2">
                  Prefer a password?{" "}
                  <button type="button" onClick={() => { setTab("signin"); clearState(); }} className="text-[#00c4ff] hover:underline">
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          <Link to="/" className="hover:text-white/40 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}

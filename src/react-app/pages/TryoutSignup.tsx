import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";

export default function TryoutSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    playerName: "",
    parentName: "",
    email: "",
    phone: "",
    preferredContact: "",
    birthYear: "",
    flagExperience: "",
    tournamentExperience: "",
    primaryGoal: "",
    coachingInterest: "",
    additionalComments: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/public/tryout-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit request");
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const experienceOptions = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"];
  const currentYear = new Date().getFullYear();
  const birthYearOptions = Array.from({ length: 15 }, (_, i) => currentYear - 5 - i);

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050a0f] via-[#0a1018] to-[#101820]">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-[#121a24]/80 backdrop-blur rounded-2xl p-8 border border-[#007ba7]/30 text-center">
            <div className="w-16 h-16 bg-[#007ba7]/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-[#00c4ff]" />
            </div>
            <h1 className="text-3xl font-black text-white mb-4" style={{ fontFamily: 'Oswald, sans-serif' }}>
              SIGN UP COMPLETE!
            </h1>
            <p className="text-white/70 mb-8">
              Thank you for signing up for tryouts! We've received your information and will be in touch soon with more details.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#007ba7] text-white font-bold rounded-lg hover:bg-[#00a3d9] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050a0f] via-[#0a1018] to-[#101820]">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L30 60M0 30L60 30' stroke='%23007ba7' stroke-width='0.5'/%3E%3C/svg%3E\")" }}></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#007ba7]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#00c4ff]/5 rounded-full blur-2xl"></div>
        
        <div className="relative max-w-4xl mx-auto px-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[#00c4ff] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>
          
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4" style={{ fontFamily: 'Oswald, sans-serif' }}>
            <span className="text-[#00c4ff]">TRYOUT</span> SIGN UP
          </h1>
          <p className="text-lg text-white/70 max-w-2xl">
            Register for our upcoming tryout session. We'll contact you with all the details!
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="pb-16">
        <div className="max-w-2xl mx-auto px-4">
          <form onSubmit={handleSubmit} className="bg-[#121a24]/80 backdrop-blur rounded-2xl p-8 border border-[#007ba7]/30">
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Player Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Player's Name <span className="text-[#00c4ff]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.playerName}
                  onChange={(e) => setForm({ ...form, playerName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                  placeholder="Enter player's full name"
                />
              </div>

              {/* Parent Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Parent's Name <span className="text-[#00c4ff]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.parentName}
                  onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                  placeholder="Enter parent's full name"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Email Address <span className="text-[#00c4ff]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Phone Number <span className="text-[#00c4ff]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>

              {/* Preferred Contact Method */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Preferred Method of Communication <span className="text-[#00c4ff]">*</span>
                </label>
                <select
                  required
                  value={form.preferredContact}
                  onChange={(e) => setForm({ ...form, preferredContact: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                >
                  <option value="">Select preference...</option>
                  <option value="Email">Email</option>
                  <option value="Phone">Phone</option>
                  <option value="Text">Text</option>
                  <option value="No preference">No preference</option>
                </select>
              </div>

              {/* Birth Year */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Player's Birth Year <span className="text-[#00c4ff]">*</span>
                </label>
                <select
                  required
                  value={form.birthYear}
                  onChange={(e) => setForm({ ...form, birthYear: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                >
                  <option value="">Select birth year...</option>
                  {birthYearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Experience */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Years of Flag Football Experience <span className="text-[#00c4ff]">*</span>
                  </label>
                  <select
                    required
                    value={form.flagExperience}
                    onChange={(e) => setForm({ ...form, flagExperience: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                  >
                    <option value="">Select...</option>
                    {experienceOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Years of Tournament Level Experience <span className="text-[#00c4ff]">*</span>
                  </label>
                  <select
                    required
                    value={form.tournamentExperience}
                    onChange={(e) => setForm({ ...form, tournamentExperience: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                  >
                    <option value="">Select...</option>
                    {experienceOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Primary Goal */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  What is your primary goal for joining the Cape Ann Nor'easters?
                </label>
                <textarea
                  value={form.primaryGoal}
                  onChange={(e) => setForm({ ...form, primaryGoal: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors resize-none"
                  placeholder="Tell us about your goals..."
                />
              </div>

              {/* Coaching Interest */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Are you interested in coaching or volunteering?
                </label>
                <select
                  value={form.coachingInterest}
                  onChange={(e) => setForm({ ...form, coachingInterest: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Maybe">Maybe</option>
                </select>
              </div>

              {/* Additional Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Additional Questions or Comments
                </label>
                <textarea
                  value={form.additionalComments}
                  onChange={(e) => setForm({ ...form, additionalComments: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#0a0f14] border border-[#007ba7]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]/50 transition-colors resize-none"
                  placeholder="Any additional information you'd like to share..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#007ba7] text-white font-bold rounded-lg hover:bg-[#00a3d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#007ba7]/30"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Complete Sign Up
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

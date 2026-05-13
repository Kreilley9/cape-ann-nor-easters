import { PublicLayout } from "@/react-app/components/layout";
import { ExternalLink, CreditCard, Repeat, Briefcase, Ticket, Loader2, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router";

interface Raffle {
  id: number;
  title: string;
  description: string | null;
  status: string;
  tickets_for_1: number | null;
  tickets_for_5: number | null;
  total_collected: number | null;
  sales_close_at: string | null;
}

interface CompletedRaffle {
  id: number;
  title: string;
  description: string | null;
  winning_ticket_number: string;
  winner_name: string;
  total_collected: number;
  created_at: string;
}

export default function Support() {
  const [donationType, setDonationType] = useState<"one-time" | "recurring">("one-time");
  const [amount, setAmount] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loadingRaffles, setLoadingRaffles] = useState(true);
  const [completedRaffles, setCompletedRaffles] = useState<CompletedRaffle[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(true);
  const [sponsorshipForm, setSponsorshipForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [submittingSponsor, setSubmittingSponsor] = useState(false);
  const [sponsorResult, setSponsorResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const loadRaffles = async () => {
      try {
        const res = await fetch("/api/public/raffles");
        if (res.ok) {
          const data = await res.json();
          setRaffles(data.filter((r: Raffle) => r.status === "open"));
        }
      } catch (error) {
        console.error("Error loading raffles:", error);
      } finally {
        setLoadingRaffles(false);
      }
    };
    loadRaffles();

    const loadCompletedRaffles = async () => {
      try {
        const res = await fetch("/api/public/raffles/completed");
        if (res.ok) {
          const data = await res.json();
          setCompletedRaffles(data);
        }
      } catch (error) {
        console.error("Error loading completed raffles:", error);
      } finally {
        setLoadingCompleted(false);
      }
    };
    loadCompletedRaffles();
  }, []);

  const presetAmounts = ["25", "50", "100", "250", "500"];

  const getVenmoUrl = (donationAmount: string, type: "one-time" | "recurring") => {
    const note = type === "one-time" 
      ? "Nor'easters Donation" 
      : "Nor'easters Monthly Donation";
    return `https://venmo.com/u/kevinreilley?txn=pay&amount=${donationAmount}&note=${encodeURIComponent(note)}`;
  };

  const handleDonateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = amount === "custom" ? customAmount : amount;
    window.open(getVenmoUrl(finalAmount, donationType), '_blank');
  };

  const handleSponsorshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSponsor(true);
    setSponsorResult(null);

    try {
      const response = await fetch("/api/public/sponsorship", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sponsorshipForm),
      });

      if (response.ok) {
        setSponsorResult({
          success: true,
          message: "Thank you for your interest! We'll be in touch soon to discuss partnership opportunities.",
        });
        setSponsorshipForm({
          companyName: "",
          contactName: "",
          email: "",
          phone: "",
          message: "",
        });
      } else {
        setSponsorResult({
          success: false,
          message: "Failed to submit inquiry. Please try again or contact us directly.",
        });
      }
    } catch (error) {
      console.error("Error submitting sponsorship form:", error);
      setSponsorResult({
        success: false,
        message: "Failed to submit inquiry. Please try again or contact us directly.",
      });
    } finally {
      setSubmittingSponsor(false);
    }
  };

  const handleSponsorshipChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSponsorshipForm({
      ...sponsorshipForm,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-black mb-6 font-[Oswald] tracking-wide">Support the Nor'easters</h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Help us provide quality flag football experiences to young athletes in Cape Ann
            </p>
          </div>
        </div>
      </section>

      {/* Upcoming Fundraisers */}
      <section className="py-16 bg-[rgba(18,26,36,0.8)]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-8 text-center tracking-wide">
            Upcoming Fundraisers
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="bg-[rgba(10,15,20,0.8)] rounded-2xl border border-[#00c4ff]/30 p-8 shadow-[0_0_30px_rgba(0,196,255,0.15)]">
              <div>
                <h3 className="text-2xl font-black text-white font-[Oswald] mb-3 tracking-wide">
                  Football Squares
                </h3>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Join our football squares pool! Pick your squares and support the team while having a chance to win prizes. 
                  It's a fun way to get involved and help raise funds for our program.
                </p>
                <a
                  href="/fundraising/squares"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#00c4ff] text-white font-semibold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-lg shadow-[#00c4ff]/20"
                >
                  View Football Squares
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 50/50 Raffles */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-8 text-center tracking-wide">
            50/50 Raffles
          </h2>
          <div className="max-w-4xl mx-auto">
            {loadingRaffles ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#00c4ff] animate-spin" />
              </div>
            ) : raffles.length > 0 ? (
              <div className="grid gap-6">
                {raffles.map((raffle) => (
                  <div 
                    key={raffle.id}
                    className="bg-[rgba(18,26,36,0.8)] rounded-2xl border border-[#00c4ff]/30 p-8 shadow-[0_0_30px_rgba(0,196,255,0.15)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-white font-[Oswald] mb-2 tracking-wide">
                          {raffle.title}
                        </h3>
                        {raffle.description && (
                          <p className="text-gray-300 leading-relaxed mb-4">
                            {raffle.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                          {raffle.total_collected && raffle.total_collected > 0 && (
                            <span className="text-green-400 font-semibold">
                              Current Pot: ${raffle.total_collected}
                            </span>
                          )}
                          {raffle.tickets_for_1 && (
                            <span className="text-gray-400">
                              $1 = {raffle.tickets_for_1} ticket{raffle.tickets_for_1 > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <Link
                          to={`/raffle/${raffle.id}`}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-[#00c4ff] text-white font-semibold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-lg shadow-[#00c4ff]/20"
                        >
                          Buy Tickets
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[rgba(18,26,36,0.8)] rounded-2xl border border-[#00c4ff]/30 p-8 text-center">
                <Ticket className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No active raffles at the moment</p>
                <p className="text-gray-500 mt-2">Check back soon for upcoming 50/50 raffles!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Previous Winners */}
      {!loadingCompleted && completedRaffles.length > 0 && (
        <section className="py-16 bg-[rgba(18,26,36,0.8)]">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-8 text-center tracking-wide">
              Previous Winners
            </h2>
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-4">
                {completedRaffles.map((raffle) => {
                  const prizeAmount = raffle.total_collected ? (raffle.total_collected / 2).toFixed(2) : "0.00";
                  return (
                    <div 
                      key={raffle.id}
                      className="bg-[rgba(10,15,20,0.8)] rounded-xl border border-emerald-500/30 p-6 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0">
                          <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-black text-white font-[Oswald] mb-2 tracking-wide">
                            {raffle.title}
                          </h3>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <span className="font-semibold">Winner:</span>
                              <span className="text-white">{raffle.winner_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <span className="font-semibold">Winning Ticket:</span>
                              <span className="font-mono text-cyan-400">#{raffle.winning_ticket_number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <span className="font-semibold">Prize Won:</span>
                              <span className="text-green-400 font-bold text-lg">${prizeAmount}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Donations */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4 tracking-wide">
              Make a Donation
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Support our athletes with a one-time or recurring donation
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-[rgba(18,26,36,0.8)] rounded-2xl p-8 shadow-lg border border-[#00c4ff]/30">
              <form onSubmit={handleDonateSubmit} className="space-y-8">
                {/* Donation Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">Donation Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setDonationType("one-time")}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        donationType === "one-time"
                          ? "border-[#00c4ff] bg-[#00c4ff]/10"
                          : "border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] hover:border-[#00c4ff]/50"
                      }`}
                    >
                      <CreditCard className={`w-6 h-6 mx-auto mb-2 ${
                        donationType === "one-time" ? "text-[#00c4ff]" : "text-gray-400"
                      }`} />
                      <div className={`font-semibold ${
                        donationType === "one-time" ? "text-[#00c4ff]" : "text-gray-400"
                      }`}>
                        One-Time
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonationType("recurring")}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        donationType === "recurring"
                          ? "border-[#00c4ff] bg-[#00c4ff]/10"
                          : "border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] hover:border-[#00c4ff]/50"
                      }`}
                    >
                      <Repeat className={`w-6 h-6 mx-auto mb-2 ${
                        donationType === "recurring" ? "text-[#00c4ff]" : "text-gray-400"
                      }`} />
                      <div className={`font-semibold ${
                        donationType === "recurring" ? "text-[#00c4ff]" : "text-gray-400"
                      }`}>
                        Monthly
                      </div>
                    </button>
                  </div>
                </div>

                {/* Amount Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Donation Amount {donationType === "recurring" && <span className="text-[#00c4ff]">(per month)</span>}
                  </label>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {presetAmounts.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                          amount === preset
                            ? "border-[#00c4ff] bg-[#00c4ff]/10 text-[#00c4ff]"
                            : "border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] hover:border-[#00c4ff]/50 text-gray-400"
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAmount("custom")}
                      className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                        amount === "custom"
                          ? "border-[#00c4ff] bg-[#00c4ff]/10 text-[#00c4ff]"
                          : "border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] hover:border-[#00c4ff]/50 text-gray-400"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {amount === "custom" && (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                      <input
                        type="number"
                        min="1"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full pl-8 pr-4 py-3 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:outline-none"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Venmo Button */}
                <button
                  type="submit"
                  disabled={!amount || (amount === "custom" && !customAmount)}
                  className="w-full py-4 bg-[#008CFF] text-white font-semibold rounded-lg hover:bg-[#0070CC] shadow-lg shadow-[#008CFF]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.27 3c.8 1.32 1.16 2.68 1.16 4.4 0 5.48-4.68 12.6-8.48 17.6H5.04L2 3.76 8.12 3.2l1.6 12.84c1.48-2.4 3.32-6.16 3.32-8.76 0-1.64-.28-2.76-.68-3.68L19.27 3z"/>
                  </svg>
                  Pay with Venmo
                </button>
                <p className="text-center text-sm text-gray-400 mt-3">
                  Opens Venmo with payment details pre-filled
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsorship Interest */}
      <section className="py-16 bg-[rgba(18,26,36,0.8)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4 tracking-wide">
              Sponsorship Opportunities
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Partner with us to support youth athletics while gaining valuable exposure for your business
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-[rgba(10,15,20,0.8)] rounded-2xl p-8 shadow-lg border border-[#00c4ff]/30">
              <form onSubmit={handleSponsorshipSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-400 mb-2">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      required
                      value={sponsorshipForm.companyName}
                      onChange={handleSponsorshipChange}
                      className="w-full px-4 py-3 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:outline-none focus:ring-2 focus:ring-[#00c4ff]"
                    />
                  </div>
                  <div>
                    <label htmlFor="contactName" className="block text-sm font-medium text-gray-400 mb-2">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      id="contactName"
                      name="contactName"
                      required
                      value={sponsorshipForm.contactName}
                      onChange={handleSponsorshipChange}
                      className="w-full px-4 py-3 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:outline-none focus:ring-2 focus:ring-[#00c4ff]"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={sponsorshipForm.email}
                      onChange={handleSponsorshipChange}
                      className="w-full px-4 py-3 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:outline-none focus:ring-2 focus:ring-[#00c4ff]"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      value={sponsorshipForm.phone}
                      onChange={handleSponsorshipChange}
                      className="w-full px-4 py-3 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:outline-none focus:ring-2 focus:ring-[#00c4ff]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-2">
                    Tell Us About Your Interest
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={sponsorshipForm.message}
                    onChange={handleSponsorshipChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:outline-none focus:ring-2 focus:ring-[#00c4ff] resize-none"
                    placeholder="Tell us about your sponsorship goals and interests..."
                  />
                </div>

                {sponsorResult && (
                  <div
                    className={`p-4 rounded-lg ${
                      sponsorResult.success
                        ? "bg-green-500/10 border border-green-500/30 text-green-400"
                        : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}
                  >
                    {sponsorResult.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingSponsor}
                  className="w-full py-4 bg-[#00c4ff] text-white font-semibold rounded-lg hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Briefcase className="w-5 h-5" />
                  {submittingSponsor ? "Submitting..." : "Submit Sponsorship Inquiry"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

import { PublicLayout } from "@/react-app/components/layout";
import { DollarSign, Heart, HandHeart, TrendingUp } from "lucide-react";
import { useState } from "react";

const sponsorshipTiers = [
  {
    name: "Gold Sponsor",
    amount: "$5,000+",
    benefits: [
      "Company logo on all team jerseys",
      "Banner at all home games",
      "Logo on website homepage",
      "Social media recognition",
      "Recognition at end-of-season banquet",
      "4 complimentary season passes",
    ],
    color: "from-yellow-400 to-yellow-600",
  },
  {
    name: "Silver Sponsor",
    amount: "$2,500 - $4,999",
    benefits: [
      "Logo on team banner",
      "Logo on website sponsors page",
      "Social media recognition",
      "Recognition at end-of-season banquet",
      "2 complimentary season passes",
    ],
    color: "from-gray-300 to-gray-500",
  },
  {
    name: "Bronze Sponsor",
    amount: "$1,000 - $2,499",
    benefits: [
      "Name on team banner",
      "Name on website sponsors page",
      "Social media recognition",
      "1 complimentary season pass",
    ],
    color: "from-orange-400 to-orange-600",
  },
  {
    name: "Team Supporter",
    amount: "$500 - $999",
    benefits: [
      "Name on website sponsors page",
      "Social media recognition",
      "Team appreciation certificate",
    ],
    color: "from-blue-400 to-blue-600",
  },
];

export default function Sponsorship() {
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    tier: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch("/api/public/sponsorship", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitResult({
          success: true,
          message: "Thank you for your interest! We'll be in touch soon to discuss partnership opportunities.",
        });
        setFormData({
          companyName: "",
          contactName: "",
          email: "",
          phone: "",
          tier: "",
          message: "",
        });
      } else {
        setSubmitResult({
          success: false,
          message: "Failed to submit inquiry. Please try again or contact us directly.",
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitResult({
        success: false,
        message: "Failed to submit inquiry. Please try again or contact us directly.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0a0f14]/10 backdrop-blur rounded-full text-sm font-medium mb-6">
              <HandHeart className="w-4 h-4" />
              <span>Partner With Us</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-6">Become a Sponsor</h1>
            <p className="text-xl text-[#00c4ff]/70 leading-relaxed">
              Support youth athletics in Cape Ann while gaining valuable exposure for your business. 
              Your sponsorship helps us provide quality equipment, facilities, and coaching to hundreds of young athletes.
            </p>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="py-12 bg-[#0a0f14] border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-black text-[#00c4ff] mb-2">200+</div>
              <div className="text-gray-300">Players Served</div>
            </div>
            <div>
              <div className="text-4xl font-black text-[#00c4ff] mb-2">50+</div>
              <div className="text-gray-300">Families Supported</div>
            </div>
            <div>
              <div className="text-4xl font-black text-[#00c4ff] mb-2">100%</div>
              <div className="text-gray-300">Non-Profit</div>
            </div>
            <div>
              <div className="text-4xl font-black text-[#00c4ff] mb-2">10+</div>
              <div className="text-gray-300">Years Serving</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Sponsor */}
      <section className="py-16 bg-[rgba(18,26,36,0.8)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4">Why Sponsor Us?</h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Partnering with the Nor'easters is an investment in our community and your business
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0a0f14] rounded-xl p-6 shadow-sm border border-[#00c4ff]/20">
              <div className="w-12 h-12 bg-[#00c4ff]/20 rounded-xl flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-[#00c4ff]" />
              </div>
              <h3 className="text-xl font-bold text-white font-[Oswald] mb-3">Community Impact</h3>
              <p className="text-gray-300">
                Directly support youth development in Cape Ann. Your sponsorship helps kids learn teamwork, 
                discipline, and healthy competition.
              </p>
            </div>
            <div className="bg-[#0a0f14] rounded-xl p-6 shadow-sm border border-[#00c4ff]/20">
              <div className="w-12 h-12 bg-[#00c4ff]/20 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-[#00c4ff]" />
              </div>
              <h3 className="text-xl font-bold text-white font-[Oswald] mb-3">Brand Visibility</h3>
              <p className="text-gray-300">
                Reach hundreds of local families throughout the season. Your brand will be seen at games, 
                on our website, and across social media.
              </p>
            </div>
            <div className="bg-[#0a0f14] rounded-xl p-6 shadow-sm border border-[#00c4ff]/20">
              <div className="w-12 h-12 bg-[#00c4ff]/20 rounded-xl flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-[#00c4ff]" />
              </div>
              <h3 className="text-xl font-bold text-white font-[Oswald] mb-3">Tax Deductible</h3>
              <p className="text-gray-300">
                As a 501(c)(3) non-profit organization, your sponsorship is tax-deductible. 
                Do good while supporting your bottom line.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsorship Tiers */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4">Sponsorship Levels</h2>
            <p className="text-lg text-gray-300">Choose the level that's right for your business</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sponsorshipTiers.map((tier) => (
              <div
                key={tier.name}
                className="bg-[#0a0f14] rounded-xl border-2 border-gray-200 overflow-hidden hover:border-blue-400 hover:shadow-lg transition-all"
              >
                <div className={`bg-gradient-to-r ${tier.color} text-white p-6 text-center`}>
                  <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                  <div className="text-2xl font-black">{tier.amount}</div>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {tier.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section className="py-16 bg-[rgba(18,26,36,0.8)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-[#0a0f14] rounded-xl p-8 shadow-sm border border-[#00c4ff]/20">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-white font-[Oswald] mb-4">Become a Sponsor</h2>
              <p className="text-gray-300">Fill out the form below and we'll be in touch to discuss partnership opportunities</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={formData.contactName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tier" className="block text-sm font-medium text-gray-400 mb-2">
                  Interested Sponsorship Level
                </label>
                <select
                  id="tier"
                  name="tier"
                  value={formData.tier}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a level</option>
                  <option value="gold">Gold Sponsor ($5,000+)</option>
                  <option value="silver">Silver Sponsor ($2,500 - $4,999)</option>
                  <option value="bronze">Bronze Sponsor ($1,000 - $2,499)</option>
                  <option value="supporter">Team Supporter ($500 - $999)</option>
                  <option value="custom">Custom Package</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-2">
                  Additional Information
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 bg-[rgba(10,15,20,0.5)] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Tell us about your sponsorship goals..."
                />
              </div>

              {submitResult && (
                <div
                  className={`p-4 rounded-lg ${
                    submitResult.success
                      ? "bg-green-500/10 border border-green-500/30 text-green-400"
                      : "bg-red-500/10 border border-red-500/30 text-red-400"
                  }`}
                >
                  {submitResult.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full md:w-auto px-8 py-3 bg-[#00c4ff] text-white font-semibold rounded-lg hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Inquiry"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Current Sponsors */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black text-white font-[Oswald] mb-4">Our Current Sponsors</h2>
          <p className="text-gray-300 mb-12">Thank you to these wonderful businesses supporting our program</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
            <div className="text-2xl font-bold text-gray-400">Cape Ann Savings Bank</div>
            <div className="text-2xl font-bold text-gray-400">Gloucester Auto</div>
            <div className="text-2xl font-bold text-gray-400">North Shore Pizza</div>
            <div className="text-2xl font-bold text-gray-400">Your Business Here</div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

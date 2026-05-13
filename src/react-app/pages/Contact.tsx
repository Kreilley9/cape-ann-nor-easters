import { PublicLayout } from "@/react-app/components/layout";
import { Send } from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    preferredContact: "",
    subject: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitResult({
          success: true,
          message: "Thank you for your message! We'll be in touch soon.",
        });
        setFormData({
          name: "",
          email: "",
          phone: "",
          preferredContact: "",
          subject: "",
          message: "",
        });
      } else {
        setSubmitResult({
          success: false,
          message: "Failed to send message. Please try again or contact us directly.",
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitResult({
        success: false,
        message: "Failed to send message. Please try again or contact us directly.",
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
      <section className="relative bg-gradient-to-br from-[#050a0f] via-[#0a1018] to-[#101820] text-white py-16 overflow-hidden">
        {/* Atmospheric background effects */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 50% 50%, rgba(0, 196, 255, 0.1) 0%, transparent 50%)",
          }} />
        </div>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='15' y='40' font-size='30' fill='%23ffffff' opacity='0.5'%3E❄%3C/text%3E%3C/svg%3E")`,
            backgroundSize: '120px 120px',
          }} />
        </div>
        {/* Glow border effect */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#00c4ff] to-transparent opacity-50" 
             style={{ boxShadow: '0 0 20px rgba(0, 196, 255, 0.5)' }} />
        
        <div className="relative max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-black mb-4 font-[Oswald] text-white" 
              style={{ textShadow: '0 0 30px rgba(0, 196, 255, 0.3)' }}>
            Get in Touch
          </h1>
          <p className="text-xl text-[#00c4ff]">Have questions? We'd love to hear from you.</p>
        </div>
      </section>

      <section className="py-16 bg-[rgba(18,26,36,0.8)]">
        <div className="max-w-4xl mx-auto px-4">
          <div>
            {/* Contact Form */}
            <div>
              <div className="bg-[#0a0f14] rounded-xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-6">Send us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        placeholder="John Smith"
                      />
                    </div>
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
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
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
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        placeholder="(978) 555-1234"
                      />
                    </div>
                    <div>
                      <label htmlFor="preferredContact" className="block text-sm font-medium text-gray-400 mb-2">
                        Preferred Contact Method *
                      </label>
                      <select
                        id="preferredContact"
                        name="preferredContact"
                        required
                        value={formData.preferredContact}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      >
                        <option value="">Select preferred method</option>
                        <option value="email">Email</option>
                        <option value="call">Call</option>
                        <option value="text">Text</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-400 mb-2">
                        Subject *
                      </label>
                      <select
                        id="subject"
                        name="subject"
                        required
                        value={formData.subject}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      >
                        <option value="">Select a subject</option>
                        <option value="playing">Information on Playing</option>
                        <option value="coaching">Information on Coaching</option>
                        <option value="supporting">Information on Supporting / Sponsoring</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      rows={6}
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff] resize-none"
                      placeholder="Tell us how we can help..."
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
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                    {submitting ? "Sending..." : "Send Message"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Media */}
      <section className="py-12 bg-[#0a0f14]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">Connect With Us</h2>
          <p className="text-gray-300 mb-6">Follow us on social media for updates, photos, and news</p>
          <div className="flex justify-center gap-4">
            <a
              href="https://www.facebook.com/CapeAnnNoreasters/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </a>
            <a
              href="https://www.instagram.com/capeannnoreasters/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

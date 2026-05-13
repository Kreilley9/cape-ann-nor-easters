import PublicLayout from "@/react-app/components/layout/PublicLayout";

export default function PrivacyPolicy() {
  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[rgba(18,26,36,0.9)] border border-[#00c4ff]/30 rounded-xl shadow-xl p-8 md:p-12">
            <h1 className="text-4xl font-bold text-white font-[Oswald] mb-2">Privacy Policy</h1>
            <p className="text-gray-400 text-sm mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

            <div className="space-y-8 text-gray-300">
              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">1. Introduction</h2>
                <p className="leading-relaxed">
                  Cape Ann Nor'easters ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or participate in our programs.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">2. Information We Collect</h2>
                <p className="leading-relaxed mb-4">We may collect the following types of information:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-white">Personal Information:</strong> Name, email address, phone number, mailing address, and emergency contact information for players and parents/guardians.</li>
                  <li><strong className="text-white">Player Information:</strong> Birth date, grade level, jersey number, uniform size, team assignment, and ZORTS registration information.</li>
                  <li><strong className="text-white">Payment Information:</strong> Billing information for program fees, uniform orders, and donations (processed securely through third-party payment processors).</li>
                  <li><strong className="text-white">Photos and Media:</strong> Photos and videos taken during practices, games, and team events.</li>
                  <li><strong className="text-white">Usage Data:</strong> Information about how you access and use our website, including IP address, browser type, and pages visited.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">3. How We Use Your Information</h2>
                <p className="leading-relaxed mb-4">We use the information we collect to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Manage player registrations and team rosters</li>
                  <li>Communicate program schedules, game times, and organizational updates</li>
                  <li>Process payments for program fees, uniforms, and fundraising</li>
                  <li>Ensure player safety and emergency contact availability</li>
                  <li>Comply with youth sports league requirements and regulations</li>
                  <li>Share team photos and highlights with families and on our website/social media</li>
                  <li>Improve our programs and website experience</li>
                  <li>Send newsletters and updates about our organization</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">4. Information Sharing and Disclosure</h2>
                <p className="leading-relaxed mb-4">We do not sell or rent your personal information to third parties. We may share your information in the following circumstances:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-white">League and Tournament Officials:</strong> Player information required for league registration and tournament participation.</li>
                  <li><strong className="text-white">Coaches and Team Volunteers:</strong> Contact information and player details necessary for team management and communication.</li>
                  <li><strong className="text-white">Service Providers:</strong> Third-party vendors who assist with payment processing, email communications, website hosting, and uniform orders.</li>
                  <li><strong className="text-white">Legal Requirements:</strong> When required by law or to protect the safety and rights of our organization, players, and families.</li>
                  <li><strong className="text-white">With Your Consent:</strong> Any other sharing of information will be done with your explicit permission.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">5. Photos and Media</h2>
                <p className="leading-relaxed">
                  We may take photos and videos during practices, games, and team events. These may be shared on our website, social media channels, and in promotional materials. If you do not wish for your child to be photographed or for their images to be shared publicly, please <a href="/contact" className="text-[#00c4ff] hover:underline">contact us</a> to submit your opt-out request in writing.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">6. Data Security</h2>
                <p className="leading-relaxed">
                  We implement reasonable security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">7. Children's Privacy</h2>
                <p className="leading-relaxed">
                  Our programs are designed for youth participants. We collect personal information about children only with parental consent and for the purposes of program administration, safety, and communication. Parents and guardians have the right to review, update, or request deletion of their child's information by contacting us.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">8. Your Rights and Choices</h2>
                <p className="leading-relaxed mb-4">You have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Access and review the personal information we have collected about you or your child</li>
                  <li>Request corrections to inaccurate or incomplete information</li>
                  <li>Request deletion of personal information (subject to legal and operational requirements)</li>
                  <li>Opt out of non-essential communications, such as newsletters</li>
                  <li>Withdraw consent for photos and media sharing</li>
                </ul>
                <p className="leading-relaxed mt-4">
                  To exercise these rights, please visit our <a href="/contact" className="text-[#00c4ff] hover:underline">Contact page</a>.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">9. Third-Party Links</h2>
                <p className="leading-relaxed">
                  Our website may contain links to third-party websites (such as league websites, payment processors, or social media platforms). We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies before providing any personal information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">10. Changes to This Privacy Policy</h2>
                <p className="leading-relaxed">
                  We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last Updated" date. We encourage you to review this policy periodically to stay informed about how we protect your information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">11. Contact Us</h2>
                <p className="leading-relaxed">
                  If you have questions or concerns about this Privacy Policy or our data practices, please visit our <a href="/contact" className="text-[#00c4ff] hover:underline">Contact page</a>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

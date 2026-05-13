import PublicLayout from "@/react-app/components/layout/PublicLayout";

export default function Terms() {
  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[rgba(18,26,36,0.9)] border border-[#00c4ff]/30 rounded-xl shadow-xl p-8 md:p-12">
            <h1 className="text-4xl font-bold text-white font-[Oswald] mb-2">Terms of Service</h1>
            <p className="text-gray-400 text-sm mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

            <div className="space-y-8 text-gray-300">
              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">1. Acceptance of Terms</h2>
                <p className="leading-relaxed">
                  By registering a player, participating in programs, or using the Cape Ann Nor'easters website, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not participate in our programs or use our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">2. Program Registration and Eligibility</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Players must meet the age and grade requirements for their assigned age group (5U through 18U).</li>
                  <li>All registrations are subject to acceptance by Cape Ann Nor'easters and league approval.</li>
                  <li>Parents/guardians must provide accurate and complete information during registration.</li>
                  <li>All players must have valid ZORTS registration and insurance coverage as required by league regulations.</li>
                  <li>We reserve the right to refuse or terminate registration for any reason, including but not limited to incomplete information, violation of our Code of Conduct, or non-payment of fees.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">3. Fees and Payments</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-white">Registration Fees:</strong> All program fees must be paid in full by the specified deadline unless a payment plan has been arranged in writing.</li>
                  <li><strong className="text-white">Uniform Costs:</strong> Uniform orders are separate from program fees and must be paid when ordered.</li>
                  <li><strong className="text-white">Refund Policy:</strong> Refund policies are determined by the specific league or tournament in which we are participating. We do not control refund terms and will follow the policies set by each league or tournament organizer. Please <a href="/contact" className="text-[#00c4ff] hover:underline">contact us</a> for specific refund information for your program.</li>
                  <li><strong className="text-white">Late Payments:</strong> Late payment may result in suspension from practices and games until the account is current.</li>
                  <li><strong className="text-white">Financial Assistance:</strong> Families experiencing financial hardship should contact us to discuss scholarship or payment plan options.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">4. Code of Conduct</h2>
                <p className="leading-relaxed mb-4">All participants, parents/guardians, coaches, and spectators are expected to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Demonstrate good sportsmanship and respect for players, coaches, officials, and opponents</li>
                  <li>Refrain from abusive language, violence, or threatening behavior</li>
                  <li>Follow all league rules and regulations</li>
                  <li>Respect the decisions of coaches and officials</li>
                  <li>Support a positive and inclusive team environment</li>
                </ul>
                <p className="leading-relaxed mt-4">
                  Violation of the Code of Conduct may result in suspension or permanent removal from the program without refund.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">5. Attendance and Participation</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Players are expected to attend all scheduled practices and games unless excused for illness, injury, or emergency.</li>
                  <li>Coaches reserve the right to determine playing time based on attendance, effort, attitude, and skill development.</li>
                  <li>Excessive absences may result in reduced playing time or removal from the roster.</li>
                  <li>Parents/guardians must notify coaches of planned absences in advance when possible.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">6. Health and Safety</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-white">Medical Information:</strong> Parents/guardians must disclose any medical conditions, allergies, or medications that could affect participation.</li>
                  <li><strong className="text-white">Injury Risk:</strong> Football carries inherent risks of injury. By participating, you acknowledge and accept these risks.</li>
                  <li><strong className="text-white">Insurance:</strong> All players must have adequate health insurance coverage. Cape Ann Nor'easters is not responsible for medical expenses resulting from injuries.</li>
                  <li><strong className="text-white">Emergency Care:</strong> In case of emergency, we will attempt to contact parents/guardians immediately. If unreachable, we are authorized to seek emergency medical treatment.</li>
                  <li><strong className="text-white">Concussion Protocol:</strong> We follow strict concussion protocols. Players suspected of concussion will be removed from play and require medical clearance before returning.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">7. Liability Waiver and Release</h2>
                <p className="leading-relaxed mb-4">
                  By registering a player, parents/guardians agree to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Release and hold harmless Cape Ann Nor'easters, its directors, coaches, volunteers, and affiliates from any and all claims, demands, or causes of action arising from participation in programs or activities.</li>
                  <li>Acknowledge that football involves physical contact and carries risk of injury, including serious injury or death.</li>
                  <li>Assume all risks associated with participation, including but not limited to injuries from contact, falls, equipment, and field conditions.</li>
                  <li>Waive any right to sue Cape Ann Nor'easters for injuries or damages except in cases of gross negligence or willful misconduct.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">8. Photo and Media Release</h2>
                <p className="leading-relaxed">
                  By participating, you grant Cape Ann Nor'easters permission to photograph and video record players during practices, games, and events, and to use such images and videos in promotional materials, on our website, and on social media. If you do not wish to grant this permission, please <a href="/contact" className="text-[#00c4ff] hover:underline">contact us</a> to submit your opt-out request in writing.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">9. Volunteer Requirements</h2>
                <p className="leading-relaxed">
                  We encourage family participation in team activities. Volunteer opportunities include coaching, team management, fundraising support, and event assistance. All volunteers working directly with players must complete background checks as required by our youth protection policies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">10. Weather and Cancellations</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Games and practices may be cancelled due to inclement weather, field conditions, or other safety concerns.</li>
                  <li>Cancellation notifications will be sent via email and posted on our website and social media.</li>
                  <li>Refund or credit policies for weather-related cancellations are determined by the specific league or tournament in which we are participating.</li>
                  <li>We will make reasonable efforts to reschedule cancelled games when possible.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">11. Intellectual Property</h2>
                <p className="leading-relaxed">
                  The Cape Ann Nor'easters name, logo, team colors, and all related branding are the property of the organization. Unauthorized use of our intellectual property for commercial purposes is prohibited without written permission.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">12. Website Use</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Our website is provided for informational purposes and program management.</li>
                  <li>You agree not to misuse our website or attempt to gain unauthorized access to systems or data.</li>
                  <li>We reserve the right to suspend or terminate access to our website at any time.</li>
                  <li>Content on our website is subject to change without notice.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">13. Privacy</h2>
                <p className="leading-relaxed">
                  Your privacy is important to us. Please review our <a href="/privacy" className="text-[#00c4ff] hover:underline">Privacy Policy</a> to understand how we collect, use, and protect your personal information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">14. Modifications to Terms</h2>
                <p className="leading-relaxed">
                  We reserve the right to modify these Terms of Service at any time. Changes will be posted on this page with an updated "Last Updated" date. Continued participation after changes are posted constitutes acceptance of the modified terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">15. Governing Law</h2>
                <p className="leading-relaxed">
                  These Terms of Service are governed by the laws of the Commonwealth of Massachusetts. Any disputes arising from these terms or participation in our programs shall be resolved in the courts of Massachusetts.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white font-[Oswald] mb-4">16. Contact Information</h2>
                <p className="leading-relaxed">
                  If you have questions about these Terms of Service, please visit our <a href="/contact" className="text-[#00c4ff] hover:underline">Contact page</a>.
                </p>
              </section>

              <section className="mt-8 p-6 bg-[rgba(0,196,255,0.1)] border border-[#00c4ff]/30 rounded-lg">
                <p className="text-white font-semibold mb-2">Acknowledgment</p>
                <p className="text-sm leading-relaxed">
                  By registering a player or participating in Cape Ann Nor'easters programs, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service, including the liability waiver and release of claims.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

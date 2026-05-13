import { PublicLayout } from "@/react-app/components/layout";
import { Users, Trophy, Heart, Shield, Target, Star } from "lucide-react";

const values = [
  {
    icon: Trophy,
    title: "Excellence",
    description: "We pursue excellence in everything we do, on and off the field."
  },
  {
    icon: Users,
    title: "Teamwork",
    description: "We build bonds that last a lifetime through shared effort and goals."
  },
  {
    icon: Heart,
    title: "Character",
    description: "We develop young athletes who lead with integrity and respect."
  },
  {
    icon: Shield,
    title: "Safety First",
    description: "Player safety and well-being is our top priority in every practice and game."
  },
  {
    icon: Target,
    title: "Skill Development",
    description: "Age-appropriate training focused on fundamentals, technique, and football IQ."
  },
  {
    icon: Star,
    title: "Community",
    description: "The Nor'easters family extends beyond the field. We foster a supportive community."
  },
];

export default function About() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-black mb-6 font-[Oswald] tracking-wide">About Cape Ann Nor'easters</h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              The Cape Ann Nor'easters is a non-profit youth flag football club dedicated to developing 
              young athletes through the sport of flag football. We provide a safe, positive environment where 
              children learn the fundamentals of the game and compete in elite level competitions while building character, teamwork, and lifelong friendships.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4">Our Mission</h2>
            <div className="w-24 h-1 bg-[#00c4ff] mx-auto mb-6"></div>
          </div>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg text-gray-300 text-center leading-relaxed">
              To provide youth in the North Shore with an opportunity to learn and compete in competitive flag football 
              in a safe, structured environment that emphasizes skill development, sportsmanship, teamwork, and 
              character building. We strive to create positive experiences that will benefit our players throughout 
              their lives, whether they continue in football or pursue other interests.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 bg-[rgba(18,26,36,0.8)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4">Our Core Values</h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Everything we do is guided by these fundamental principles
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value) => (
              <div key={value.title} className="bg-[#0a0f14] rounded-xl p-6 shadow-lg border border-[#00c4ff]/20 hover:border-[#00c4ff]/40 transition-all hover:shadow-[0_0_20px_rgba(0,196,255,0.1)]">
                <div className="w-12 h-12 bg-[#00c4ff]/20 rounded-xl flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-[#00c4ff]" />
                </div>
                <h3 className="text-xl font-bold text-white font-[Oswald] mb-3">{value.title}</h3>
                <p className="text-gray-300 leading-relaxed text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4">What We Offer</h2>
            <div className="w-24 h-1 bg-[#00c4ff] mx-auto mb-6"></div>
          </div>
          <div className="bg-[rgba(18,26,36,0.8)] rounded-xl p-8 shadow-lg border border-[#00c4ff]/20">
            <h3 className="text-2xl font-bold text-white font-[Oswald] mb-6 text-center">Year Round Flag Football</h3>
            <ul className="space-y-4 text-gray-300 max-w-2xl mx-auto">
              <li className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#00c4ff] rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-lg">Our teams compete in up to 5 leagues a year (Spring, Summer, Fall and two indoor Winter seasons) along with several tournaments</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#00c4ff] rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-lg">Experienced coaching</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#00c4ff] rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-lg">Age-appropriate skill development curriculum</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#00c4ff] rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-lg">League and tournament competition</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-gradient-to-br from-[#121a24] via-[#0a0f14] to-[#121a24] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-6 font-[Oswald] tracking-wide">Join Our Family</h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Whether you're interested in registering your child, volunteering, or supporting our program, 
            we'd love to hear from you.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#00c4ff] text-white font-bold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-[0_0_20px_rgba(0,196,255,0.3)] hover:shadow-[0_0_30px_rgba(0,196,255,0.5)]"
            >
              Contact Us
            </a>
            <a
              href="/support"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#00c4ff] text-[#00c4ff] font-bold rounded-lg hover:bg-[#00c4ff]/10 transition-colors"
            >
              Support Our Program
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

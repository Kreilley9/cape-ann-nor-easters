import { PublicLayout } from "@/react-app/components/layout";

export default function FAQ() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-black mb-6 font-[Oswald] tracking-wide">Frequently Asked Questions</h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Find answers to common questions about our club
            </p>
          </div>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="py-32 bg-[#0a0f14]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-[rgba(18,26,36,0.8)] rounded-2xl border border-[#00c4ff]/30 p-12 shadow-[0_0_30px_rgba(0,196,255,0.15)]">
            <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4 tracking-wide">
              Coming Soon
            </h2>
            <p className="text-xl text-gray-400 leading-relaxed">
              We're working on compiling answers to frequently asked questions. Check back soon!
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

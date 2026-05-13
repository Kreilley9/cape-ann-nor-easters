import { PublicLayout } from "@/react-app/components/layout";
import { useState, useEffect } from "react";

interface Coach {
  id: number;
  name: string;
  role: string | null;
  photo_key: string | null;
  team_name: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
}

export default function Coaches() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCoaches = async () => {
      try {
        const response = await fetch("/api/public/coaches/public");
        if (response.ok) {
          const data = await response.json();
          setCoaches(data);
        }
      } catch (error) {
        console.error("Error loading coaches:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCoaches();
  }, []);
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-black mb-6 font-[Oswald] tracking-wide">Our Coaches</h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Meet the dedicated coaches leading our teams to excellence
            </p>
          </div>
        </div>
      </section>

      {/* Coaches Grid */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="text-center text-white">Loading coaches...</div>
          ) : coaches.length === 0 ? (
            <div className="bg-[rgba(18,26,36,0.8)] rounded-2xl border border-[#00c4ff]/30 p-12 shadow-[0_0_30px_rgba(0,196,255,0.15)] text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4 tracking-wide">
                Coming Soon
              </h2>
              <p className="text-xl text-gray-400 leading-relaxed">
                We're working on bringing you coach bios and profiles. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {coaches.map((coach) => (
                <div
                  key={coach.id}
                  className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/30 shadow-[0_0_20px_rgba(0,196,255,0.15)] overflow-hidden hover:border-[#00c4ff]/60 transition-all"
                >
                  {coach.photo_key ? (
                    <img
                      src={`/api/public/coaches/photos/${coach.photo_key.replace("coach-photos/", "")}`}
                      alt={coach.name}
                      className="w-full h-64 object-cover"
                    />
                  ) : (
                    <div className="w-full h-64 bg-gradient-to-br from-[#0a0f14] to-[#121a24] flex items-center justify-center">
                      <span className="text-4xl font-bold text-[#00c4ff]/30">{coach.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-white font-[Oswald] mb-2">{coach.name}</h3>
                    {coach.role && (
                      <p className="text-[#00c4ff] font-semibold mb-2">{coach.role}</p>
                    )}
                    {coach.team_name && (
                      <p className="text-gray-400 text-sm mb-4">{coach.team_name}</p>
                    )}
                    {coach.bio && (
                      <p className="text-gray-300 leading-relaxed mb-4">{coach.bio}</p>
                    )}
                    {(coach.email || coach.phone) && (
                      <div className="border-t border-[#00c4ff]/20 pt-4 space-y-2">
                        {coach.email && (
                          <p className="text-sm text-gray-400">
                            <a href={`mailto:${coach.email}`} className="text-[#00c4ff] hover:underline">
                              {coach.email}
                            </a>
                          </p>
                        )}
                        {coach.phone && (
                          <p className="text-sm text-gray-400">
                            <a href={`tel:${coach.phone}`} className="text-[#00c4ff] hover:underline">
                              {coach.phone}
                            </a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

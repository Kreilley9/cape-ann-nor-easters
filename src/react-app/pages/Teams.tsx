import { PublicLayout } from "@/react-app/components/layout";
import { useState, useEffect } from "react";

interface Team {
  id: number;
  name: string;
  photo_key: string | null;
  season_name: string | null;
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const response = await fetch("/api/public/teams/");
        if (response.ok) {
          const data = await response.json();
          setTeams(data);
        }
      } catch (error) {
        console.error("Error loading teams:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTeams();
  }, []);
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-black mb-6 font-[Oswald] tracking-wide">Our Teams</h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Explore our competitive flag football teams across all age groups
            </p>
          </div>
        </div>
      </section>

      {/* Teams Grid */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="text-center text-white">Loading teams...</div>
          ) : teams.length === 0 ? (
            <div className="bg-[rgba(18,26,36,0.8)] rounded-2xl border border-[#00c4ff]/30 p-12 shadow-[0_0_30px_rgba(0,196,255,0.15)] text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4 tracking-wide">
                Coming Soon
              </h2>
              <p className="text-xl text-gray-400 leading-relaxed">
                We're working on bringing you team rosters and season information. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/30 shadow-[0_0_20px_rgba(0,196,255,0.15)] overflow-hidden hover:border-[#00c4ff]/60 transition-all"
                >
                  {team.photo_key ? (
                    <img
                      src={`/api/public/teams/photos/${team.photo_key.replace("team-photos/", "")}`}
                      alt={team.name}
                      className="w-full h-64 object-cover"
                    />
                  ) : (
                    <div className="w-full h-64 bg-gradient-to-br from-[#0a0f14] to-[#121a24] flex items-center justify-center">
                      <span className="text-6xl font-bold text-[#00c4ff]/30 font-[Oswald]">{team.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-white font-[Oswald] mb-2">{team.name}</h3>
                    {team.season_name && (
                      <p className="text-gray-400 text-sm">{team.season_name}</p>
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

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Ticket, DollarSign, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface MyRaffle {
  id: number;
  title: string;
  description: string | null;
  status: string;
  total_tickets: number;
  total_collected: number;
  unpaid_count: number;
}

export default function PortalMySales() {
  const [raffles, setRaffles] = useState<MyRaffle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRaffles();
  }, []);

  const loadRaffles = async () => {
    try {
      const res = await apiFetch("/api/portal/my-raffles", { });
      if (res.ok) {
        const data = await res.json();
        setRaffles(data);
      }
    } catch (err) {
      console.error("Failed to load raffles:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white font-[Oswald] tracking-wide">
              My Sales
            </h1>
            <p className="text-gray-400 mt-1">
              Manage raffle ticket sales for your assigned raffles
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[#00c4ff] border-t-transparent rounded-full" />
          </div>
        )}

        {/* Empty State */}
        {!loading && raffles.length === 0 && (
          <div className="text-center py-12 bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20">
            <Ticket className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Raffles Assigned</h2>
            <p className="text-gray-400">
              You haven't been assigned to sell tickets for any raffles yet.
            </p>
          </div>
        )}

        {/* Raffle List */}
        {!loading && raffles.length > 0 && (
          <div className="grid gap-4">
            {raffles.map((raffle) => (
              <div
                key={raffle.id}
                className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20 p-6 hover:border-[#00c4ff]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{raffle.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          raffle.status === "open"
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : raffle.status === "closed"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                        }`}
                      >
                        {raffle.status}
                      </span>
                    </div>
                    {raffle.description && (
                      <p className="text-gray-400 text-sm mb-4">{raffle.description}</p>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-[#00c4ff]" />
                        <span className="text-white font-medium">{raffle.total_tickets}</span>
                        <span className="text-gray-400 text-sm">tickets sold</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 font-medium">${raffle.total_collected}</span>
                        <span className="text-gray-400 text-sm">collected</span>
                      </div>
                      {raffle.unpaid_count > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-400 font-medium">{raffle.unpaid_count}</span>
                          <span className="text-gray-400 text-sm">unpaid</span>
                        </div>
                      )}
                      {raffle.unpaid_count === 0 && raffle.total_tickets > 0 && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 text-sm">All paid</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link
                    to={`/raffle/${raffle.id}/seller`}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all whitespace-nowrap"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Sell Tickets
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

import { useState, useEffect } from "react";
import PublicLayout from "@/react-app/components/layout/PublicLayout";
import { Calendar, MapPin, Clock, DollarSign } from "lucide-react";

interface Event {
  id: number;
  team_id: number;
  team_name: string;
  event_type: string;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  is_cancelled: number;
  cost: number;
}

export default function Schedule() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await fetch("/api/public/events");
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };



  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f14] via-[#121a24] to-[#0a0f14] py-20">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-[Oswald] font-bold text-white mb-4">
              Tournament Schedule
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              View upcoming tournaments for all Nor'easters teams
            </p>
          </div>

          {/* Events List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#00c4ff] border-t-transparent"></div>
              <p className="text-gray-400 mt-4">Loading tournaments...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-[#007ba7]/30">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No tournaments scheduled</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`bg-white/5 backdrop-blur-sm border rounded-xl p-6 transition-all hover:bg-white/10 hover:shadow-xl hover:shadow-[#00c4ff]/10 ${
                    event.is_cancelled
                      ? "border-red-500/50 opacity-60"
                      : "border-[#007ba7]/30"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Date Column */}
                    <div className="flex-shrink-0 text-center md:text-left">
                      <div className="bg-[#00c4ff]/20 border border-[#00c4ff]/30 rounded-lg p-4 inline-block">
                        <div className="text-sm text-[#00c4ff] font-semibold">
                          {formatDate(event.start_at).split(",")[0]}
                        </div>
                        <div className="text-2xl font-[Oswald] font-bold text-white">
                          {new Date(event.start_at).getDate()}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(event.start_at).toLocaleDateString("en-US", { month: "short" })}
                        </div>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold border capitalize bg-purple-500/20 text-purple-300 border-purple-500/30">
                          Tournament
                        </span>
                        <span className="text-sm text-gray-400">
                          {event.team_name}
                        </span>
                        {event.is_cancelled === 1 && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                            CANCELLED
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl font-[Oswald] font-bold text-white mb-2">
                        {event.title}
                      </h3>

                      {event.description && (
                        <p className="text-gray-400 mb-3">{event.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-4 h-4 text-[#00c4ff]" />
                          <span>
                            {formatTime(event.start_at)}
                            {event.end_at && ` - ${formatTime(event.end_at)}`}
                          </span>
                        </div>

                        {event.location && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <MapPin className="w-4 h-4 text-[#00c4ff]" />
                            <span>{event.location}</span>
                          </div>
                        )}

                        {event.cost && event.cost > 0 && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <DollarSign className="w-4 h-4 text-[#00c4ff]" />
                            <span>${event.cost}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

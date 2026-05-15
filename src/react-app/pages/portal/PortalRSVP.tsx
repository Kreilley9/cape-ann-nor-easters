import { useState, useEffect } from "react";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Loader2, Calendar, MapPin, Clock, DollarSign, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { formatTime as formatTimeET, formatDateCustom } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface Player {
  id: number;
  first_name: string;
  last_name: string;
}

interface Event {
  id: number;
  title: string;
  event_type: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  cost: number | null;
  team_name: string;
  rsvps: { [playerId: number]: string };
}

export default function PortalRSVP() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [eventsRes, playersRes] = await Promise.all([
        apiFetch("/api/portal/my-events", { }),
        apiFetch("/api/portal/my-players", { }),
      ]);

      if (!eventsRes.ok) {
        console.error("Events request failed:", eventsRes.status, await eventsRes.text());
      }
      if (!playersRes.ok) {
        console.error("Players request failed:", playersRes.status, await playersRes.text());
      }

      if (eventsRes.ok && playersRes.ok) {
        const eventsData = await eventsRes.json();
        const playersData = await playersRes.json();
        setEvents(eventsData);
        setPlayers(playersData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (eventId: number, playerId: number, status: string) => {
    const key = `${eventId}-${playerId}`;
    setSubmitting({ ...submitting, [key]: true });

    try {
      const response = await apiFetch(`/api/portal/events/${eventId}/rsvp/${playerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Update local state
        setEvents(events.map(event => {
          if (event.id === eventId) {
            return {
              ...event,
              rsvps: { ...event.rsvps, [playerId]: status },
            };
          }
          return event;
        }));
      }
    } catch (error) {
      console.error("Error submitting RSVP:", error);
    } finally {
      setSubmitting({ ...submitting, [key]: false });
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateCustom(dateStr, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return formatTimeET(dateStr, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "absent":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "maybe":
        return <HelpCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isPending || !user || loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-96">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white font-[Oswald]">Upcoming Events</h1>
          <p className="text-gray-500 mt-1">
            Respond to event invitations for your players
          </p>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-sm border border-[#00c4ff]/20 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {event.event_type}
                        </span>
                        {event.team_name && (
                          <span className="text-sm text-gray-500">
                            {event.team_name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white font-[Oswald]">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="text-gray-500 text-sm mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                    {event.cost && event.cost > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg ml-4">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold">{event.cost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {formatDate(event.start_at)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {formatTime(event.start_at)}
                      {event.end_at && ` - ${formatTime(event.end_at)}`}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </div>
                    )}
                  </div>

                  {players.length > 0 && (
                    <div className="border-t border-[#00c4ff]/20 pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        RSVP for your players:
                      </h4>
                      <div className="space-y-3">
                        {players.map((player) => {
                          const key = `${event.id}-${player.id}`;
                          const currentStatus = event.rsvps[player.id] || "unknown";
                          const isSubmitting = submitting[key];

                          return (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                {getStatusIcon(currentStatus)}
                                <span className="font-medium text-gray-900 font-[Oswald]">
                                  {player.first_name} {player.last_name}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleRSVP(event.id, player.id, "present")}
                                  disabled={isSubmitting}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    currentStatus === "present"
                                      ? "bg-green-600 text-white"
                                      : "bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300"
                                  } disabled:opacity-50`}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => handleRSVP(event.id, player.id, "maybe")}
                                  disabled={isSubmitting}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    currentStatus === "maybe"
                                      ? "bg-yellow-500 text-white"
                                      : "bg-white border border-gray-300 text-gray-700 hover:bg-yellow-50 hover:border-yellow-300"
                                  } disabled:opacity-50`}
                                >
                                  Maybe
                                </button>
                                <button
                                  onClick={() => handleRSVP(event.id, player.id, "absent")}
                                  disabled={isSubmitting}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    currentStatus === "absent"
                                      ? "bg-red-600 text-white"
                                      : "bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"
                                  } disabled:opacity-50`}
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

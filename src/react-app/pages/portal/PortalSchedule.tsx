import { useState, useEffect } from "react";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import {
  Loader2,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Users,
  X,
  Edit2,
  Trash2,
  CalendarDays,
  List,
  DollarSign,
  CheckCircle,
  XCircle,
  HelpCircle,
  Download,
} from "lucide-react";
import { formatTime as formatTimeET, formatDateCustom, formatDate as formatDateET } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface Team {
  id: number;
  name: string;
  age_group: string;
}

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  family_name: string | null;
}

interface Event {
  id: number;
  team_id: number | null;
  team_name: string | null;
  event_type: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  is_cancelled: number;
  cost: number | null;
  rsvp_yes: number;
  rsvp_no: number;
  rsvp_maybe: number;
  total_invited: number;
  rsvp_no_response: number;
}

interface RSVPDetail {
  id: number;
  status: string | null;
  responded_at: string | null;
  player_id: number;
  first_name: string;
  last_name: string;
  family_name: string;
}

const EVENT_TYPES = [
  { value: "practice", label: "Practice", color: "bg-blue-500" },
  { value: "game", label: "Game", color: "bg-green-500" },
  { value: "tournament", label: "Tournament", color: "bg-red-500" },
  { value: "event", label: "Other Event", color: "bg-orange-500" },
];

const getEventColor = (type: string) => {
  return EVENT_TYPES.find((t) => t.value === type)?.color || "bg-gray-500";
};

export default function PortalSchedule() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const { isAdmin: isAdminRole, isCoach, isParent } = useRoles();
  const canManageEvents = isAdminRole || isCoach;
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [rsvpDetails, setRSVPDetails] = useState<RSVPDetail[]>([]);
  const [loadingRSVPs, setLoadingRSVPs] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscription, setSubscription] = useState<{ token: string; subscription_url: string; team_ids: string | null } | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  const BLANK_EVENT_FORM = {
    team_id: "",
    event_type: "practice",
    title: "",
    description: "",
    location: "",
    start_at: "",
    end_at: "",
    cost: "",
    player_ids: [] as number[],
  };
  const [eventForm, setEventForm] = useState(BLANK_EVENT_FORM);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminAndLoad();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [currentDate, selectedTeamIds, viewMode]);

  const checkAdminAndLoad = async () => {
    try {
      const response = await apiFetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin);
      }
      await loadTeams();
      await loadEvents();
      await loadSubscription();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      const response = await apiFetch("/api/portal/teams/all");
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Error loading teams:", error);
    }
  };

  const loadPlayers = async (teamId?: number) => {
    try {
      const url = teamId ? `/api/portal/teams/${teamId}/roster` : "/api/portal/players";
      const response = await apiFetch(url, {
      });
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
      }
    } catch (error) {
      console.error("Error loading players:", error);
    }
  };

  const loadEvents = async () => {
    try {
      let url: string;
      
      if (viewMode === 'list') {
        // List view: show all upcoming events from today onwards
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        url = `/api/portal/events?start=${today.toISOString()}`;
      } else {
        // Calendar view: show events for the current month
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        url = `/api/portal/events?start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}`;
      }
      
      const response = await apiFetch(url);
      if (response.ok) {
        let data = await response.json();
        
        // Filter by selected teams if any are selected
        if (selectedTeamIds.length > 0) {
          data = data.filter((event: Event) => 
            event.team_id === null || selectedTeamIds.includes(event.team_id)
          );
        }
        
        setEvents(data);
      }
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setEventForm(BLANK_EVENT_FORM);
    setPlayers([]);
    setShowEventModal(true);
  };

  const openEditModal = async (event: Event) => {
    setEditingEvent(event);
    setEventForm({
      team_id: event.team_id?.toString() || "",
      event_type: event.event_type,
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      start_at: event.start_at.slice(0, 16),
      end_at: event.end_at?.slice(0, 16) || "",
      cost: event.cost?.toString() || "",
      player_ids: [],
    });
    
    // Load invited players for this event
    try {
      const response = await apiFetch(`/api/portal/events/${event.id}/invites`);
      if (response.ok) {
        const invites = await response.json();
        setEventForm(prev => ({
          ...prev,
          player_ids: invites.map((inv: any) => inv.player_id)
        }));
      }
    } catch (error) {
      console.error("Error loading invites:", error);
    }
    
    // Load players from team if team is selected
    if (event.team_id) {
      await loadPlayers(event.team_id);
    }
    
    setShowEventModal(true);
  };

  const handleTeamChange = async (teamId: string) => {
    setEventForm({ ...eventForm, team_id: teamId, player_ids: [] });
    if (teamId) {
      await loadPlayers(parseInt(teamId));
    } else {
      await loadPlayers(); // Load all players when "All Teams" is selected
    }
  };

  const togglePlayerSelection = (playerId: number) => {
    setEventForm(prev => ({
      ...prev,
      player_ids: prev.player_ids.includes(playerId)
        ? prev.player_ids.filter(id => id !== playerId)
        : [...prev.player_ids, playerId]
    }));
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEvent(true);
    try {
      const payload = {
        ...eventForm,
        team_id: eventForm.team_id ? parseInt(eventForm.team_id) : null,
        cost: eventForm.cost ? parseFloat(eventForm.cost) : null,
        player_ids: eventForm.player_ids,
      };

      if (editingEvent) {
        await apiFetch(`/api/portal/events/${editingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/portal/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowEventModal(false);
      setEventForm(BLANK_EVENT_FORM);
      setEditingEvent(null);
      loadEvents();
    } catch (error) {
      console.error("Error saving event:", error);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await apiFetch(`/api/portal/events/${eventId}`, { method: "DELETE" });
      loadEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const loadRSVPDetails = async (event: Event) => {
    setSelectedEvent(event);
    setShowRSVPModal(true);
    setLoadingRSVPs(true);
    
    try {
      const response = await apiFetch(`/api/portal/events/${event.id}/rsvps`, {
      });
      if (response.ok) {
        const data = await response.json();
        setRSVPDetails(data);
      }
    } catch (error) {
      console.error("Failed to load RSVP details:", error);
    } finally {
      setLoadingRSVPs(false);
    }
  };

  const handleUpdateRSVP = async (playerId: number, status: string) => {
    if (!selectedEvent) return;
    
    try {
      const response = await apiFetch(`/api/portal/events/${selectedEvent.id}/rsvp/${playerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        // Reload RSVP details and events list
        await loadRSVPDetails(selectedEvent);
        await loadEvents();
      }
    } catch (error) {
      console.error("Failed to update RSVP:", error);
    }
  };

  const handleCancelEvent = async (eventId: number, cancelled: boolean) => {
    try {
      await apiFetch(`/api/portal/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_cancelled: cancelled }),
      });
      loadEvents();
    } catch (error) {
      console.error("Error updating event:", error);
    }
  };

  // Calendar helpers
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDay = (day: number) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_at);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  const formatTime = (dateStr: string) => {
    return formatTimeET(dateStr, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return formatDateCustom(dateStr, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleExportCalendar = () => {
    let url = "/api/portal/events/export/icalendar";
    if (selectedTeamIds.length > 0) {
      url += `?team_ids=${selectedTeamIds.join(',')}`;
    }
    window.location.href = url;
  };

  const loadSubscription = async () => {
    try {
      const response = await apiFetch("/api/portal/calendar-subscription", {
      });
      if (response.ok) {
        const data = await response.json();
        if (data.subscription_url) {
          setSubscription(data);
        }
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
    }
  };

  const handleCreateSubscription = async () => {
    setSubscriptionLoading(true);
    try {
      const response = await apiFetch("/api/portal/calendar-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Team Calendar",
          team_ids: selectedTeamIds.length > 0 ? selectedTeamIds.join(',') : null,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
        setShowSubscriptionModal(true);
      }
    } catch (error) {
      console.error("Error creating subscription:", error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleCopySubscriptionUrl = () => {
    if (subscription) {
      const fullUrl = `${window.location.origin}${subscription.subscription_url}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!confirm("Are you sure you want to delete your calendar subscription? This will break any calendar apps currently syncing with this link.")) {
      return;
    }
    
    try {
      await apiFetch("/api/portal/calendar-subscription", {
        method: "DELETE",
      });
      setSubscription(null);
      setShowSubscriptionModal(false);
    } catch (error) {
      console.error("Error deleting subscription:", error);
    }
  };

  const upcomingEvents = events
    .filter((e) => new Date(e.start_at) >= new Date())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 10);

  if (isPending || !user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="w-10 h-10 text-[#00c4ff] animate-spin" />
      </div>
    );
  }

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const days = getDaysInMonth();

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-[Oswald]">Schedule</h1>
            <p className="text-gray-500 mt-1">
              {isParent 
                ? "View and manage team events, practices, and games."
                : "View and manage team events, practices, and games."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCalendar}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              title="Export to Calendar"
            >
              <Download className="w-4 h-4" />
              Export Calendar
            </button>
            <button
              onClick={() => subscription ? setShowSubscriptionModal(true) : handleCreateSubscription()}
              disabled={subscriptionLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Subscribe to auto-updating calendar feed"
            >
              {subscriptionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              {subscription ? "Manage Subscription" : "Subscribe"}
            </button>
            {(isAdmin || canManageEvents) && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Event
              </button>
            )}
          </div>
        </div>

        {/* Filters and View Toggle */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            {!isParent && (
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm font-medium text-gray-400">Teams:</label>
                  <button
                    onClick={() => setSelectedTeamIds([])}
                    className="text-xs text-[#00c4ff] hover:text-[#00a3d9] font-medium"
                  >
                    {selectedTeamIds.length > 0 ? "Clear Selection" : "All Teams"}
                  </button>
                  {selectedTeamIds.length > 0 && (
                    <span className="text-xs text-gray-400">
                      ({selectedTeamIds.length} selected)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedTeamIds.includes(team.id)
                          ? "bg-[rgba(0,196,255,0.2)] border-[#00c4ff] text-[#00c4ff]"
                          : "bg-[rgba(18,26,36,0.8)] border-gray-600 text-gray-400 hover:bg-[rgba(0,196,255,0.1)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeamIds([...selectedTeamIds, team.id]);
                          } else {
                            setSelectedTeamIds(selectedTeamIds.filter(id => id !== team.id));
                          }
                        }}
                        className="w-4 h-4 text-[#00c4ff] rounded focus:ring-2 focus:ring-[#00c4ff]"
                      />
                      <span className="text-sm font-medium">
                        {team.name} {team.age_group && `(${team.age_group})`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("calendar")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "calendar" ? "bg-[rgba(0,196,255,0.2)] text-[#00c4ff]" : "text-gray-400 hover:bg-[rgba(0,196,255,0.1)]"
                }`}
              >
                <CalendarDays className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list" ? "bg-[rgba(0,196,255,0.2)] text-[#00c4ff]" : "text-gray-400 hover:bg-[rgba(0,196,255,0.1)]"
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl overflow-hidden">
            {/* Calendar Header */}
            <div className="px-4 py-3 border-b border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] flex items-center justify-between">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-[rgba(0,196,255,0.2)] rounded-lg transition-colors text-gray-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-white font-[Oswald]">{monthName}</h2>
                <button
                  onClick={handleToday}
                  className="px-3 py-1 text-sm bg-[rgba(0,196,255,0.2)] border border-[#00c4ff] text-[#00c4ff] rounded-lg hover:bg-[rgba(0,196,255,0.3)] transition-colors"
                >
                  Today
                </button>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-[rgba(0,196,255,0.2)] rounded-lg transition-colors text-gray-300"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[rgba(18,26,36,0.9)] border-b border-[#00c4ff]/50"
                >
                  {day}
                </div>
              ))}
              {days.map((day, index) => {
                const dayEvents = day ? getEventsForDay(day) : [];
                const isToday =
                  day === new Date().getDate() &&
                  currentDate.getMonth() === new Date().getMonth() &&
                  currentDate.getFullYear() === new Date().getFullYear();

                return (
                  <div
                    key={index}
                    className={`min-h-[100px] border-b border-r border-[#00c4ff]/30 p-1 ${
                      day ? "bg-[rgba(18,26,36,0.8)]" : "bg-[rgba(18,26,36,0.5)]"
                    }`}
                  >
                    {day && (
                      <>
                        <div
                          className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                            isToday ? "bg-[#00c4ff] text-white" : "text-gray-300"
                          }`}
                        >
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <button
                              key={event.id}
                              onClick={() => (isAdmin || canManageEvents) && openEditModal(event)}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate ${
                                event.is_cancelled
                                  ? "bg-gray-600 text-gray-400 line-through"
                                  : `${getEventColor(event.event_type)} text-white`
                              } ${(isAdmin || canManageEvents) ? "hover:opacity-80 cursor-pointer" : ""}`}
                              title={`${event.title} - ${formatTime(event.start_at)}`}
                            >
                              {event.title}
                            </button>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-gray-400 px-1">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)]">
              <h2 className="font-semibold text-white font-[Oswald]">Upcoming Events</h2>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Calendar className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <p className="text-lg font-medium">No upcoming events</p>
                <p className="text-sm mt-1">Events will appear here once scheduled.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#00c4ff]/30">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-4 hover:bg-[rgba(0,196,255,0.1)] transition-colors cursor-pointer ${
                      event.is_cancelled ? "opacity-60" : ""
                    }`}
                    onClick={() => loadRSVPDetails(event)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded-full ${getEventColor(event.event_type)}`}
                          />
                          <h3
                            className={`font-medium text-white font-[Oswald] ${
                              event.is_cancelled ? "line-through" : ""
                            }`}
                          >
                            {event.title}
                          </h3>
                          {event.is_cancelled && (
                            <span className="px-2 py-0.5 bg-red-900 border border-red-500 text-red-400 text-xs rounded font-medium">
                              Cancelled
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(event.start_at)} at {formatTime(event.start_at)}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {event.location}
                            </span>
                          )}
                          {event.team_name && (
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {event.team_name}
                            </span>
                          )}
                          {event.cost !== null && event.cost > 0 && (
                            <span className="flex items-center gap-1 text-green-400 font-medium">
                              <DollarSign className="w-4 h-4" />
                              ${event.cost.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {/* RSVP Summary */}
                        {event.total_invited > 0 && (
                          <div className="mt-2 flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-4 h-4" />
                              {event.rsvp_yes} yes
                            </span>
                            <span className="flex items-center gap-1 text-red-400">
                              <XCircle className="w-4 h-4" />
                              {event.rsvp_no} no
                            </span>
                            <span className="flex items-center gap-1 text-yellow-400">
                              <HelpCircle className="w-4 h-4" />
                              {event.rsvp_maybe} maybe
                            </span>
                            <span className="flex items-center gap-1 text-gray-400">
                              <HelpCircle className="w-4 h-4" />
                              {event.rsvp_no_response} no response
                            </span>
                          </div>
                        )}
                        {event.description && (
                          <p className="mt-2 text-sm text-gray-400">{event.description}</p>
                        )}
                      </div>
                      {(isAdmin || canManageEvents) && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditModal(event)}
                            className="p-2 text-gray-400 hover:text-[#00c4ff] transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancelEvent(event.id, !event.is_cancelled)}
                            className="p-2 text-gray-400 hover:text-orange-400 transition-colors"
                            title={event.is_cancelled ? "Restore" : "Cancel"}
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Event Type Legend */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-400">Legend:</span>
            {EVENT_TYPES.map((type) => (
              <div key={type.value} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${type.color}`} />
                <span className="text-sm text-gray-400">{type.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white font-[Oswald]">
                {editingEvent ? "Edit Event" : "Create Event"}
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Event Type</label>
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="e.g., U10 Practice, Game vs Eagles"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Team (optional)</label>
                <select
                  value={eventForm.team_id}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Teams / Organization-wide</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.age_group && `(${team.age_group})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={eventForm.start_at}
                    onChange={(e) => setEventForm({ ...eventForm, start_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">End (optional)</label>
                  <input
                    type="datetime-local"
                    value={eventForm.end_at}
                    onChange={(e) => setEventForm({ ...eventForm, end_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Location</label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="e.g., Memorial Field, Gym B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Cost (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={eventForm.cost}
                    onChange={(e) => setEventForm({ ...eventForm, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave blank if no cost associated</p>
              </div>
              {players.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Invite Players (optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (eventForm.player_ids.length === players.length) {
                          setEventForm(prev => ({ ...prev, player_ids: [] }));
                        } else {
                          setEventForm(prev => ({ ...prev, player_ids: players.map(p => p.id) }));
                        }
                      }}
                      className="text-xs text-[#00c4ff] hover:text-[#00a3d9] font-medium"
                    >
                      {eventForm.player_ids.length === players.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                      {players.map((player) => (
                        <label
                          key={player.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={eventForm.player_ids.includes(player.id)}
                            onChange={() => togglePlayerSelection(player.id)}
                            className="w-4 h-4 text-[#00c4ff] rounded focus:ring-2 focus:ring-blue-600"
                          />
                          <span className="text-sm text-white font-[Oswald]">
                            {player.first_name} {player.last_name}
                            {player.family_name && (
                              <span className="text-gray-500 ml-1">({player.family_name})</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {eventForm.player_ids.length === 0
                      ? "No players selected - event will be visible to all"
                      : `${eventForm.player_ids.length} player${eventForm.player_ids.length !== 1 ? "s" : ""} selected`}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={3}
                  placeholder="Additional details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEventModal(false); setEventForm(BLANK_EVENT_FORM); setEditingEvent(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEvent}
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEvent ? "Saving..." : editingEvent ? "Save Changes" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RSVP Details Modal */}
      {showRSVPModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-[Oswald]">{selectedEvent.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(selectedEvent.start_at)} at {formatTime(selectedEvent.start_at)}
                </p>
              </div>
              <button
                onClick={() => setShowRSVPModal(false)}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingRSVPs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#00c4ff] animate-spin" />
              </div>
            ) : rsvpDetails.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No players invited to this event</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-700">
                      {rsvpDetails.filter((r) => r.status === "present").length}
                    </div>
                    <div className="text-xs text-green-600 font-medium mt-1">Yes</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-700">
                      {rsvpDetails.filter((r) => r.status === "absent").length}
                    </div>
                    <div className="text-xs text-red-600 font-medium mt-1">No</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-700">
                      {rsvpDetails.filter((r) => r.status === "maybe").length}
                    </div>
                    <div className="text-xs text-yellow-600 font-medium mt-1">Maybe</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-700">
                      {rsvpDetails.filter((r) => !r.status).length}
                    </div>
                    <div className="text-xs text-gray-500 font-medium mt-1">No Response</div>
                  </div>
                </div>

                {/* Player List */}
                <div>
                  <h4 className="font-medium text-white font-[Oswald] mb-3">Player Responses</h4>
                  <div className="divide-y divide-gray-100 border border-[#00c4ff]/20 rounded-lg overflow-hidden">
                    {rsvpDetails.map((rsvp) => (
                      <div key={rsvp.id} className="p-3 hover:bg-white/5 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-white font-[Oswald]">
                              {rsvp.first_name} {rsvp.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{rsvp.family_name}</p>
                          </div>
                          {(isAdmin || canManageEvents) ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateRSVP(rsvp.player_id, "present")}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                  rsvp.status === "present"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"
                                }`}
                              >
                                <CheckCircle className="w-4 h-4" />
                                Yes
                              </button>
                              <button
                                onClick={() => handleUpdateRSVP(rsvp.player_id, "maybe")}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                  rsvp.status === "maybe"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600"
                                }`}
                              >
                                <HelpCircle className="w-4 h-4" />
                                Maybe
                              </button>
                              <button
                                onClick={() => handleUpdateRSVP(rsvp.player_id, "absent")}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                  rsvp.status === "absent"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"
                                }`}
                              >
                                <XCircle className="w-4 h-4" />
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {rsvp.status === "present" && (
                                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                  <CheckCircle className="w-4 h-4" />
                                  Yes
                                </span>
                              )}
                              {rsvp.status === "absent" && (
                                <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                  <XCircle className="w-4 h-4" />
                                  No
                                </span>
                              )}
                              {rsvp.status === "maybe" && (
                                <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                                  <HelpCircle className="w-4 h-4" />
                                  Maybe
                                </span>
                              )}
                              {!rsvp.status && (
                                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                  <HelpCircle className="w-4 h-4" />
                                  No Response
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {rsvp.responded_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Responded {formatDateET(rsvp.responded_at)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && subscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white font-[Oswald]">Calendar Subscription</h3>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#00c4ff] mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900 mb-1">Auto-updating Calendar Feed</h4>
                    <p className="text-sm text-blue-700">
                      This link stays up-to-date automatically. When events are added, changed, or cancelled, your calendar app will sync the changes.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}${subscription.subscription_url}`}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm font-mono"
                  />
                  <button
                    onClick={handleCopySubscriptionUrl}
                    className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                  >
                    {copiedUrl ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-white font-[Oswald] mb-2">How to use:</h4>
                <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                  <li>Copy the subscription URL above</li>
                  <li>Open your calendar app (Google Calendar, Apple Calendar, Outlook, etc.)</li>
                  <li>Look for "Subscribe to calendar" or "Add calendar from URL"</li>
                  <li>Paste the URL and save</li>
                </ol>
              </div>

              {subscription.team_ids && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">Filtered to teams:</span> {subscription.team_ids.split(',').map(id => teams.find(t => t.id === parseInt(id))?.name).filter(Boolean).join(', ')}
                </div>
              )}

              <div className="pt-2 border-t border-[#00c4ff]/20">
                <button
                  onClick={handleDeleteSubscription}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Delete subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

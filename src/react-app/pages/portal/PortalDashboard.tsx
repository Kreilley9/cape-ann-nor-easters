import { useState, useEffect } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate, Link } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { formatDate, formatDateTime } from "@/react-app/utils/dateFormat";
import { 
  Loader2, Users, Calendar, DollarSign, TrendingUp, ChevronRight, 
  UserPlus, ShoppingBag, FileText, MessageSquare, ClipboardList,
  AlertCircle, Clock, MapPin, User, CheckCircle, CreditCard
} from "lucide-react";

interface DashboardStats {
  totalTeams: number;
  totalPlayers: number;
  upcomingEvents: number;
  pendingPayments: number;
  totalRecruits: number;
  pendingUniformOrders: number;
  activeSurveys: number;
  totalDocuments: number;
  unreadMessages: number;
}

interface ActivityLog {
  id: number;
  user_name: string;
  action: string;
  entity_type: string;
  entity_name: string;
  details: string | null;
  created_at: string;
}

interface FamilyDashboardData {
  family: { id: number; family_name: string; parent1_first_name: string; parent1_last_name: string } | null;
  children: Array<{ id: number; first_name: string; last_name: string; birth_date: string; jersey_number: number | null; photo_key: string | null; team_names: string | null }>;
  pendingPayments: Array<{ id: number; amount: number; status: string; due_date: string; description: string; first_name: string; last_name: string; player_id: number; team_name: string | null }>;
  pendingRsvps: Array<{ id: number; title: string; event_type: string; start_at: string; location: string | null; team_name: string | null; first_name: string; last_name: string; player_id: number }>;
  upcomingEvents: Array<{ id: number; title: string; event_type: string; start_at: string; end_at: string | null; location: string | null; team_name: string | null; invited_children: string | null }>;
  activeSurveys: Array<{ id: number; title: string; description: string | null; expires_at: string | null }>;
  recentDocuments: Array<{ id: number; title: string; file_key: string; created_at: string; team_name: string | null }>;
}

export default function PortalDashboard() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isCoach, isParent } = useRoles();
  const [stats, setStats] = useState<DashboardStats>({
    totalTeams: 0,
    totalPlayers: 0,
    upcomingEvents: 0,
    pendingPayments: 0,
    totalRecruits: 0,
    pendingUniformOrders: 0,
    activeSurveys: 0,
    totalDocuments: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [familyData, setFamilyData] = useState<FamilyDashboardData | null>(null);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      if (isParent && !isAdmin && !isCoach) {
        loadFamilyDashboard();
      } else {
        loadStats();
        loadActivity();
      }
    }
  }, [user, isParent, isAdmin, isCoach]);

  const loadFamilyDashboard = async () => {
    try {
      const response = await fetch("/api/portal/family-dashboard", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setFamilyData(data);
      }
    } catch (error) {
      console.error("Error loading family dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch("/api/portal/stats", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    try {
      const response = await fetch("/api/portal/activity", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.slice(0, 10));
      }
    } catch (error) {
      console.error("Error loading activity:", error);
    }
  };

  if (isPending || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f14 0%, #121a24 50%, #1a2a3a 100%)" }}>
        <Loader2 className="w-10 h-10 text-[#00c4ff] animate-spin" />
      </div>
    );
  }

  // Family Dashboard View
  if (isParent && !isAdmin && !isCoach && familyData) {
    const totalDue = familyData.pendingPayments.reduce((sum, p) => sum + p.amount, 0);
    
    return (
      <PortalLayout>
        <div className="space-y-6">
          {/* Welcome header */}
          <div>
            <h1 className="text-2xl font-bold text-white font-[Oswald] tracking-wide">
              Welcome, {familyData.family?.parent1_first_name || user.google_user_data?.given_name || "Family"}!
            </h1>
            <p className="text-gray-400 mt-1">
              Here's what needs your attention.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#00c4ff] animate-spin" />
            </div>
          ) : (
            <>
              {/* Action Items Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl p-5 border border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500 p-3 rounded-lg">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-200">Outstanding Dues</p>
                      <p className="text-2xl font-bold text-white">${totalDue.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl p-5 border border-rose-500/30 bg-rose-500/10">
                  <div className="flex items-center gap-3">
                    <div className="bg-rose-500 p-3 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-rose-200">RSVPs Needed</p>
                      <p className="text-2xl font-bold text-white">{familyData.pendingRsvps.length}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl p-5 border border-violet-500/30 bg-violet-500/10">
                  <div className="flex items-center gap-3">
                    <div className="bg-violet-500 p-3 rounded-lg">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-violet-200">This Week</p>
                      <p className="text-2xl font-bold text-white">{familyData.upcomingEvents.length} Events</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Items - Center Stage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Payments */}
                <div className="rounded-xl border border-amber-500/20 overflow-hidden" style={{ background: "rgba(18, 26, 36, 0.9)" }}>
                  <div className="p-4 border-b border-amber-500/20 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                      Outstanding Dues
                    </h2>
                    <Link to="/portal/payments" className="text-sm text-[#00c4ff] hover:underline">
                      View All
                    </Link>
                  </div>
                  <div className="p-4">
                    {familyData.pendingPayments.length === 0 ? (
                      <div className="text-center py-6">
                        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                        <p className="text-gray-400">All caught up! No outstanding dues.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {familyData.pendingPayments.slice(0, 4).map((payment) => (
                          <div key={payment.id} className="p-3 rounded-lg bg-white/5 border border-amber-500/10">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-white">{payment.description}</p>
                                <p className="text-sm text-gray-400">
                                  {payment.first_name} {payment.last_name}
                                  {payment.team_name && ` • ${payment.team_name}`}
                                </p>
                                {payment.due_date && (
                                  <p className="text-xs text-amber-400 mt-1">
                                    Due: {formatDate(payment.due_date)}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-amber-400">${payment.amount.toFixed(2)}</p>
                                <a
                                  href={`https://venmo.com/u/kevinreilley?txn=pay&amount=${payment.amount.toFixed(2)}&note=${encodeURIComponent(`Nor'easters - ${payment.description} - ${payment.first_name} ${payment.last_name}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-1 px-2 py-1 text-xs bg-[#008CFF] text-white rounded hover:bg-[#0074D9] transition-colors"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  Pay
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pending RSVPs */}
                <div className="rounded-xl border border-rose-500/20 overflow-hidden" style={{ background: "rgba(18, 26, 36, 0.9)" }}>
                  <div className="p-4 border-b border-rose-500/20 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                      RSVPs Needed
                    </h2>
                    <Link to="/portal/schedule" className="text-sm text-[#00c4ff] hover:underline">
                      View Schedule
                    </Link>
                  </div>
                  <div className="p-4">
                    {familyData.pendingRsvps.length === 0 ? (
                      <div className="text-center py-6">
                        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                        <p className="text-gray-400">All RSVPs submitted!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {familyData.pendingRsvps.slice(0, 4).map((rsvp) => (
                          <Link
                            key={`${rsvp.id}-${rsvp.player_id}`}
                            to="/portal/schedule"
                            className="block p-3 rounded-lg bg-white/5 border border-rose-500/10 hover:border-rose-500/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-white">{rsvp.title}</p>
                                <p className="text-sm text-gray-400">
                                  {rsvp.first_name} {rsvp.last_name}
                                  {rsvp.team_name && ` • ${rsvp.team_name}`}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDateTime(rsvp.start_at)}
                                  </span>
                                  {rsvp.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {rsvp.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="px-2 py-1 text-xs bg-rose-500/20 text-rose-300 rounded">
                                RSVP
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Upcoming Events */}
              <div className="rounded-xl border border-violet-500/20 overflow-hidden" style={{ background: "rgba(18, 26, 36, 0.9)" }}>
                <div className="p-4 border-b border-violet-500/20 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-violet-400" />
                    Upcoming Events (Next 7 Days)
                  </h2>
                  <Link to="/portal/schedule" className="text-sm text-[#00c4ff] hover:underline">
                    Full Schedule
                  </Link>
                </div>
                <div className="p-4">
                  {familyData.upcomingEvents.length === 0 ? (
                    <div className="text-center py-6">
                      <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400">No events scheduled this week.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {familyData.upcomingEvents.map((event) => (
                        <div key={event.id} className="p-3 rounded-lg bg-white/5 border border-violet-500/10">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">{event.title}</p>
                                <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded capitalize">
                                  {event.event_type}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400 mt-1">
                                {event.team_name && `${event.team_name} • `}
                                {event.invited_children && `${event.invited_children}`}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {formatDateTime(event.start_at)}
                                </span>
                                {event.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {event.location}
                                  </span>
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

              {/* Quick Access Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* My Children */}
                <div className="rounded-xl p-4 border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    My Children
                  </h3>
                  <div className="space-y-2">
                    {familyData.children.map((child) => (
                      <Link
                        key={child.id}
                        to={`/portal/players/${child.id}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#00c4ff]/20 flex items-center justify-center text-[#00c4ff] text-sm font-bold">
                          {child.first_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm truncate">{child.first_name} {child.last_name}</p>
                          <p className="text-xs text-gray-500 truncate">{child.team_names || "No team"}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Surveys */}
                <div className="rounded-xl p-4 border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Surveys
                  </h3>
                  {familyData.activeSurveys.length === 0 ? (
                    <p className="text-sm text-gray-500">No surveys to complete</p>
                  ) : (
                    <div className="space-y-2">
                      {familyData.activeSurveys.slice(0, 3).map((survey) => (
                        <Link
                          key={survey.id}
                          to={`/portal/surveys/${survey.id}/take`}
                          className="block p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
                        >
                          <p className="font-medium text-white text-sm">{survey.title}</p>
                          {survey.expires_at && (
                            <p className="text-xs text-blue-400 mt-1">
                              Expires: {formatDate(survey.expires_at)}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div className="rounded-xl p-4 border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Recent Documents
                  </h3>
                  {familyData.recentDocuments.length === 0 ? (
                    <p className="text-sm text-gray-500">No documents</p>
                  ) : (
                    <div className="space-y-2">
                      {familyData.recentDocuments.map((doc) => (
                        <Link
                          key={doc.id}
                          to="/portal/documents"
                          className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <p className="font-medium text-white text-sm truncate">{doc.title}</p>
                          <p className="text-xs text-gray-500">{formatDate(doc.created_at)}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Links */}
                <div className="rounded-xl p-4 border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Links</h3>
                  <div className="space-y-2">
                    <Link
                      to="/portal/schedule"
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-300"
                    >
                      <Calendar className="w-4 h-4 text-violet-400" />
                      <span className="text-sm">Full Schedule</span>
                    </Link>
                    <Link
                      to="/portal/payments"
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-300"
                    >
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      <span className="text-sm">Payment History</span>
                    </Link>
                    <Link
                      to="/portal/uniforms"
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-300"
                    >
                      <ShoppingBag className="w-4 h-4 text-rose-400" />
                      <span className="text-sm">Order Uniforms</span>
                    </Link>
                    <Link
                      to="/portal/documents"
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-300"
                    >
                      <FileText className="w-4 h-4 text-orange-400" />
                      <span className="text-sm">All Documents</span>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </PortalLayout>
    );
  }

  // Admin/Coach Dashboard View (existing)
  const statCards = [
    {
      label: "Teams",
      value: stats.totalTeams,
      icon: Users,
      color: "bg-[#00c4ff]",
      href: "/portal/teams",
      visible: isAdmin || isCoach,
    },
    {
      label: isParent ? "Children" : "Players",
      value: stats.totalPlayers,
      icon: TrendingUp,
      color: "bg-emerald-500",
      href: "/portal/players",
      visible: true,
    },
    {
      label: "Upcoming Events",
      value: stats.upcomingEvents,
      icon: Calendar,
      color: "bg-violet-500",
      href: "/portal/schedule",
      visible: true,
    },
    {
      label: isParent ? "Outstanding Dues" : "Pending Payments",
      value: stats.pendingPayments,
      icon: DollarSign,
      color: "bg-amber-500",
      href: "/portal/payments",
      visible: true,
    },
    {
      label: "Recruits",
      value: stats.totalRecruits,
      icon: UserPlus,
      color: "bg-indigo-500",
      href: "/portal/recruiting",
      visible: isAdmin,
    },
    {
      label: "Uniform Orders",
      value: stats.pendingUniformOrders,
      icon: ShoppingBag,
      color: "bg-rose-500",
      href: "/portal/uniforms/orders",
      visible: isAdmin || isCoach,
    },
    {
      label: "Active Surveys",
      value: stats.activeSurveys,
      icon: ClipboardList,
      color: "bg-blue-500",
      href: "/portal/surveys",
      visible: true,
    },
    {
      label: "Documents",
      value: stats.totalDocuments,
      icon: FileText,
      color: "bg-orange-500",
      href: "/portal/documents",
      visible: true,
    },
    {
      label: "Unread Messages",
      value: stats.unreadMessages,
      icon: MessageSquare,
      color: "bg-pink-500",
      href: "/portal/messages",
      visible: true,
    },
  ].filter(card => card.visible);

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Welcome header */}
        <div>
          <h1 className="text-2xl font-bold text-white font-[Oswald] tracking-wide">
            Welcome back, {user.google_user_data?.given_name || "Coach"}!
          </h1>
          <p className="text-gray-400 mt-1">
            Here's what's happening with your teams.
          </p>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#00c4ff] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((stat) => (
              <Link
                key={stat.label}
                to={stat.href}
                className="rounded-xl p-5 border border-[#00c4ff]/20 hover:border-[#00c4ff]/40 transition-all hover:shadow-[0_0_20px_rgba(0,196,255,0.1)]"
                style={{ background: "rgba(18, 26, 36, 0.8)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">{stat.label}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg shadow-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl p-6 border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
            <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to="/portal/teams"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#00c4ff]" />
                  <span className="font-medium text-gray-300">View Team Rosters</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </Link>
              <Link
                to="/portal/schedule"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-violet-400" />
                  <span className="font-medium text-gray-300">Check Schedule</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </Link>
              <Link
                to="/portal/payments"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span className="font-medium text-gray-300">Payment Status</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </Link>
            </div>
          </div>

          <div className="rounded-xl p-6 border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
            <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400">No recent activity yet.</p>
                <p className="text-sm mt-1 text-gray-500">Activity will appear here as you use the portal.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recentActivity.map((activity) => (
                  <div 
                    key={activity.id}
                    className="p-3 rounded-lg border border-[#00c4ff]/10 hover:border-[#00c4ff]/20 transition-colors"
                    style={{ background: "rgba(0, 196, 255, 0.02)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-[#00c4ff]">{activity.user_name}</span>
                          {' '}<span className="text-gray-400">{activity.action}</span>
                          {' '}<span className="text-gray-300">{activity.entity_type}</span>
                          {' '}<span className="font-medium text-white">"{activity.entity_name}"</span>
                        </p>
                        {activity.details && (
                          <p className="text-xs text-gray-500 mt-1">{activity.details}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(activity.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

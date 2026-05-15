import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { useRoles } from "@/react-app/contexts/RoleContext";
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
  Settings,
  Database,
  LogOut,
  Menu,
  X,
  Shield,
  Home,
  CheckSquare,
  TrendingUp,
  UserPlus,
  ShoppingBag,
  ClipboardList,
  MailPlus,
  BookOpen,
  Send,
  Contact,
  Bell,
  Ticket,
  Image,
  UserCog,
} from "lucide-react";

interface PortalLayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ("admin" | "coach" | "parent")[];
};

export function PortalLayout({ children }: PortalLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAdmin, isCoach, isParent } = useRoles();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      const handleScroll = () => {
        sessionStorage.setItem("portalSidebarScroll", nav.scrollTop.toString());
      };
      nav.addEventListener("scroll", handleScroll);
      return () => nav.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      const savedScroll = sessionStorage.getItem("portalSidebarScroll");
      if (savedScroll) {
        requestAnimationFrame(() => {
          nav.scrollTop = parseInt(savedScroll, 10);
        });
      }
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const navigation: NavItem[] = [
    { name: "Dashboard", href: "/portal", icon: LayoutDashboard },
    { name: "My Events", href: "/portal/rsvp", icon: CheckSquare },
    { name: "Teams & Rosters", href: "/portal/teams", icon: Users, roles: ["admin", "coach"] },
    { name: "All Players", href: "/portal/players", icon: TrendingUp, roles: ["admin", "coach"] },
    { name: "Schedule", href: "/portal/schedule", icon: Calendar },
    { name: "Payments", href: "/portal/payments", icon: DollarSign },
    { name: "Uniforms", href: "/portal/uniforms", icon: ShoppingBag },
    { name: "Surveys", href: "/portal/surveys", icon: ClipboardList },
    { name: "Documents", href: "/portal/documents", icon: FileText },
    { name: "My Sales", href: "/portal/my-sales", icon: Ticket },
  ];

  const coachesNavigation: NavItem[] = [
    { name: "Recruiting", href: "/portal/recruiting", icon: UserPlus, roles: ["admin", "coach"] },
    { name: "Contacts", href: "/portal/contacts", icon: Contact },
    { name: "Coaches Documents", href: "/portal/coaches/documents", icon: BookOpen },
    { name: "Coaches Messages", href: "/portal/coaches/messages", icon: MessageSquare },
  ];

  const adminNavigation: NavItem[] = [
    { name: "Group Message", href: "/portal/group-message", icon: Send },
    { name: "Uniform Orders", href: "/portal/uniforms/orders", icon: ShoppingBag },
    { name: "Raffles", href: "/portal/raffles", icon: Ticket },
    { name: "User Invites", href: "/portal/invites", icon: MailPlus },
    { name: "User Roles", href: "/portal/user-roles", icon: Shield },
    { name: "News Posts", href: "/portal/news", icon: FileText },
    { name: "Photo Gallery", href: "/portal/gallery", icon: Image },
    { name: "Coaches", href: "/portal/coaches-management", icon: UserCog },
    { name: "Team Photos", href: "/portal/teams-photos", icon: Users },
    { name: "Admin Tools", href: "/portal/settings", icon: Settings },
    { name: "Notification Test", href: "/portal/notification-test", icon: Bell },
    { name: "Database Admin", href: "/portal/database", icon: Database },
    { name: "Squares Admin", href: "/admin", icon: Users },
  ];

  const canSeeNavItem = (item: NavItem): boolean => {
    if (!item.roles) return true;
    if (isAdmin && item.roles.includes("admin")) return true;
    if (isCoach && item.roles.includes("coach")) return true;
    if (isParent && item.roles.includes("parent")) return true;
    return false;
  };

  const filteredNavigation = navigation.filter(canSeeNavItem);

  const getRoleBadge = () => {
    if (isAdmin) return { text: "Admin", color: "text-blue-600" };
    if (isCoach) return { text: "Coach", color: "text-green-600" };
    if (isParent) return { text: "Parent", color: "text-purple-600" };
    return null;
  };
  const roleBadge = getRoleBadge();

  const isActive = (href: string) => {
    if (href === "/portal") return location.pathname === "/portal";
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f14 0%, #121a24 50%, #1a2a3a 100%)" }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "linear-gradient(180deg, #0a0f14 0%, #121a24 100%)" }}
      >
        <div className="flex flex-col h-full border-r border-[#00c4ff]/20">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#00c4ff]/20">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="https://019b7617-c3ef-76fd-99cc-e86fca2684d0.mochausercontent.com/Noreasters-Snow-Logo-No-Background.png"
                alt="Cape Ann Nor'easters"
                className="h-12 w-12 rounded-lg object-contain"
              />
              <div>
                <div className="font-bold text-white text-sm font-[Oswald] tracking-wide">NOR'EASTERS</div>
                <div className="text-xs text-[#00c4ff]">Team Portal</div>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-[#00c4ff] hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav ref={navRef} className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-[#00c4ff]/20 text-[#00c4ff] border border-[#00c4ff]/30 shadow-[0_0_10px_rgba(0,196,255,0.15)]"
                      : "text-gray-300 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${active ? "text-[#00c4ff]" : ""}`} />
                  {item.name}
                </Link>
              );
            })}

            {(isAdmin || isCoach) && (
              <>
                <div className="pt-4 pb-2">
                  <div className="px-3 text-xs font-semibold text-[#00c4ff]/70 uppercase tracking-wider">
                    Coaches Portal
                  </div>
                </div>
                {coachesNavigation.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        active
                          ? "bg-[#00c4ff]/20 text-[#00c4ff] border border-[#00c4ff]/30 shadow-[0_0_10px_rgba(0,196,255,0.15)]"
                          : "text-gray-300 hover:bg-white/5 hover:text-white border border-transparent"
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${active ? "text-[#00c4ff]" : ""}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <div className="px-3 text-xs font-semibold text-[#00c4ff]/70 uppercase tracking-wider">
                    Admin
                  </div>
                </div>
                {adminNavigation.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        active
                          ? "bg-[#00c4ff]/20 text-[#00c4ff] border border-[#00c4ff]/30 shadow-[0_0_10px_rgba(0,196,255,0.15)]"
                          : "text-gray-300 hover:bg-white/5 hover:text-white border border-transparent"
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${active ? "text-[#00c4ff]" : ""}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          <div className="px-2 py-4 border-t border-[#00c4ff]/20">
            <Link
              to="/portal/notifications"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mb-1 ${
                isActive("/portal/notifications")
                  ? "bg-[#00c4ff]/20 text-[#00c4ff] border border-[#00c4ff]/30 shadow-[0_0_10px_rgba(0,196,255,0.15)]"
                  : "text-gray-300 hover:bg-white/5 hover:text-white border border-transparent"
              }`}
            >
              <Bell className="w-5 h-5" />
              Notification Settings
            </Link>
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors mb-1"
            >
              <Home className="w-5 h-5" />
              Back to Website
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#00c4ff]/20 backdrop-blur-md" style={{ background: "rgba(10, 15, 20, 0.8)" }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-300 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              {user?.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full ring-2 ring-[#00c4ff]/30"
                />
              )}
              <div className="text-sm">
                <div className="font-medium text-white">
                  {user?.user_metadata?.full_name || user?.email}
                </div>
                {roleBadge && (
                  <div className="text-xs font-medium text-[#00c4ff]">{roleBadge.text}</div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

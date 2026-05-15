import { Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { PublicLayout } from "@/react-app/components/layout";
import { formatDate, formatDateTime } from "@/react-app/utils/dateFormat";
import { 
  ArrowRight, 
  Users, 
  Trophy, 
  Heart, 
  Star,
  Calendar,
  ChevronRight,
  Shield,
  Target,
  Info,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  X
} from "lucide-react";
import type { Board } from "@/shared/types";

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
    title: "Safety",
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

interface TryoutConfig {
  id: number;
  is_enabled: number;
  tryout_date: string | null;
  title: string | null;
  description: string | null;
}

interface BannerConfig {
  text: string;
  link: string;
  type: "info" | "warning" | "success" | "alert";
}

export default function HomePage() {
  const navigate = useNavigate();
  const [activeBoards, setActiveBoards] = useState<Board[]>([]);
  const [tryoutConfig, setTryoutConfig] = useState<TryoutConfig | null>(null);
  const [banner, setBanner] = useState<BannerConfig | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    loadActiveBoards();
    loadTryoutConfig();
    loadBanner();
  }, []);

  const loadActiveBoards = async () => {
    try {
      const response = await fetch("/api/boards");
      if (response.ok) {
        const data = await response.json();
        setActiveBoards(data.filter((b: Board) => !b.scores && b.is_open).slice(0, 2));
      }
    } catch (error) {
      console.error("Error loading boards:", error);
    }
  };

  const loadTryoutConfig = async () => {
    try {
      const response = await fetch("/api/public/tryout-config");
      if (response.ok) {
        const data = await response.json();
        setTryoutConfig(data);
      }
    } catch (error) {
      console.error("Error loading tryout config:", error);
    }
  };

  const loadBanner = async () => {
    try {
      const response = await fetch("/api/public/site-config/banner");
      if (response.ok) {
        const data = await response.json();
        setBanner(data);
      }
    } catch (error) {
      console.error("Error loading banner:", error);
    }
  };

  const getBannerStyles = () => {
    if (!banner) return {};
    switch (banner.type) {
      case "warning":
        return { 
          borderColor: "border-yellow-400", 
          shadowColor: "shadow-yellow-400/40", 
          iconColor: "text-yellow-400",
          icon: AlertTriangle 
        };
      case "success":
        return { 
          borderColor: "border-green-400", 
          shadowColor: "shadow-green-400/40", 
          iconColor: "text-green-400",
          icon: CheckCircle 
        };
      case "alert":
        return { 
          borderColor: "border-red-400", 
          shadowColor: "shadow-red-400/40", 
          iconColor: "text-red-400",
          icon: AlertCircle 
        };
      default:
        return { 
          borderColor: "border-[#00c4ff]", 
          shadowColor: "shadow-[#00c4ff]/40", 
          iconColor: "text-[#00c4ff]",
          icon: Info 
        };
    }
  };

  const bannerStyles = getBannerStyles();
  const BannerIcon = bannerStyles.icon || Info;

  return (
    <PublicLayout>
      {/* Announcement Banner */}
      {banner && banner.text && !bannerDismissed && (
        <div className="relative overflow-hidden border-b-2 border-[#007ba7]/50"
          style={{
            background: `linear-gradient(135deg, 
              ${banner.type === 'warning' ? 'rgba(251,191,36,0.15)' : banner.type === 'success' ? 'rgba(74,222,128,0.15)' : banner.type === 'alert' ? 'rgba(248,113,113,0.15)' : 'rgba(0,123,167,0.3)'} 0%, 
              rgba(10,16,24,0.95) 20%, 
              rgba(18,26,36,0.95) 80%, 
              ${banner.type === 'warning' ? 'rgba(251,191,36,0.15)' : banner.type === 'success' ? 'rgba(74,222,128,0.15)' : banner.type === 'alert' ? 'rgba(248,113,113,0.15)' : 'rgba(0,196,255,0.3)'} 100%)`,
            boxShadow: `
              0 0 40px ${banner.type === 'warning' ? 'rgba(251,191,36,0.3)' : banner.type === 'success' ? 'rgba(74,222,128,0.3)' : banner.type === 'alert' ? 'rgba(248,113,113,0.3)' : 'rgba(0,196,255,0.4)'} inset,
              0 4px 20px rgba(0,0,0,0.5),
              0 -1px 0 rgba(255,255,255,0.1) inset
            `
          }}
        >
          {/* Animated shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" 
            style={{ 
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s infinite'
            }}
          ></div>
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-5" 
            style={{ 
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 0v40M0 20h40' stroke='%2300c4ff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E\")"
            }}
          ></div>
          
          {banner.link ? (
            <a
              href={banner.link}
              target={banner.link.startsWith("http") ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="relative flex items-center justify-center gap-4 px-6 py-5 hover:bg-white/5 transition-all group"
            >
              <BannerIcon className={`w-7 h-7 flex-shrink-0 ${bannerStyles.iconColor} group-hover:scale-125 transition-all duration-300`}
                style={{ 
                  filter: `drop-shadow(0 0 12px ${banner.type === 'warning' ? 'rgba(251,191,36,0.8)' : banner.type === 'success' ? 'rgba(74,222,128,0.8)' : banner.type === 'alert' ? 'rgba(248,113,113,0.8)' : 'rgba(0,196,255,0.9)'})` 
                }}
              />
              <span className="font-black text-white text-xl tracking-wider text-center" 
                style={{ 
                  fontFamily: 'Oswald, sans-serif', 
                  letterSpacing: '0.08em',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,196,255,0.3)'
                }}
              >
                {banner.text}
              </span>
              <ArrowRight className={`w-6 h-6 flex-shrink-0 ${bannerStyles.iconColor} group-hover:translate-x-2 transition-all duration-300`}
                style={{ 
                  filter: `drop-shadow(0 0 12px ${banner.type === 'warning' ? 'rgba(251,191,36,0.8)' : banner.type === 'success' ? 'rgba(74,222,128,0.8)' : banner.type === 'alert' ? 'rgba(248,113,113,0.8)' : 'rgba(0,196,255,0.9)'})` 
                }}
              />
            </a>
          ) : (
            <div className="relative flex items-center justify-center gap-4 px-6 py-5">
              <BannerIcon className={`w-7 h-7 flex-shrink-0 ${bannerStyles.iconColor}`}
                style={{ 
                  filter: `drop-shadow(0 0 12px ${banner.type === 'warning' ? 'rgba(251,191,36,0.8)' : banner.type === 'success' ? 'rgba(74,222,128,0.8)' : banner.type === 'alert' ? 'rgba(248,113,113,0.8)' : 'rgba(0,196,255,0.9)'})` 
                }}
              />
              <span className="font-black text-white text-xl tracking-wider text-center" 
                style={{ 
                  fontFamily: 'Oswald, sans-serif', 
                  letterSpacing: '0.08em',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,196,255,0.3)'
                }}
              >
                {banner.text}
              </span>
            </div>
          )}
          <button
            onClick={() => setBannerDismissed(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-lg hover:bg-white/10 transition-all text-gray-400 hover:text-white hover:scale-110 border border-[#007ba7]/40 hover:border-[#00c4ff] backdrop-blur-sm"
            style={{
              boxShadow: '0 0 10px rgba(0,123,167,0.3)'
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
              <div className="mb-6">
                <img
                  src="https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Cape%20Ann%20Logo%20Written.png"
                  alt="Cape Ann Nor'easters"
                  className="w-64 md:w-80 h-auto"
                />
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 text-white" style={{ fontFamily: 'Oswald, sans-serif' }}>
                BUILT FOR THE<br />
                <span className="text-[#00c4ff]">STORM</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl">
                Cape Ann Nor'easters is the premier youth flag football club on the North Shore. 
                We develop skilled athletes with strong character, teamwork, and a love for the game and compete in elite level competition.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                {tryoutConfig ? (
                  <Link
                    to="/tryout-signup"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#007ba7] text-white font-bold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-lg shadow-[#007ba7]/30"
                  >
                    {tryoutConfig.title || 'Sign Up for Tryouts'}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                ) : (
                  <Link
                    to="/tryout"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#007ba7] text-white font-bold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-lg shadow-[#007ba7]/30"
                  >
                    Request Tryout
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                )}
                <Link
                  to="/support"
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#00c4ff] text-[#00c4ff] font-bold rounded-lg hover:bg-[#00c4ff]/10 transition-colors"
                >
                  Support Us
                  <Heart className="w-5 h-5" />
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative">
                <div className="absolute -inset-8 bg-[#007ba7]/20 rounded-full blur-3xl animate-pulse"></div>
                <img
                  src="https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Noreasters%20Snow%20Logo%20No%20Background.png"
                  alt="Cape Ann Nor'easters"
                  className="relative w-96 h-96 object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4" style={{ fontFamily: 'Oswald, sans-serif' }}>
              OUR MISSION
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              We're committed to developing well-rounded young athletes who excel in competition 
              and carry the values of teamwork and integrity into every aspect of their lives.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value) => (
              <div key={value.title} className="bg-[#121a24]/80 backdrop-blur rounded-xl p-6 border border-[#007ba7]/30 hover:border-[#00c4ff]/50 transition-all group">
                <div className="w-12 h-12 bg-[#007ba7]/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#007ba7]/50 transition-colors">
                  <value.icon className="w-6 h-6 text-[#00c4ff]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{value.title}</h3>
                <p className="text-white/60 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Active Fundraisers */}
      {activeBoards.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#007ba7]/30 text-[#00c4ff] rounded-full text-sm font-semibold mb-4 border border-[#007ba7]/50">
                  <Target className="w-4 h-4" />
                  Active Fundraiser
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  SUPPORT THE TEAM
                </h2>
                <p className="text-white/70">
                  Play football squares and help us raise funds for equipment and travel.
                </p>
              </div>
              <Link
                to="/fundraising/squares"
                className="inline-flex items-center gap-2 text-[#00c4ff] font-semibold hover:text-white transition-colors"
              >
                All fundraising
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {activeBoards.map((board) => (
                <button
                  key={board.id}
                  onClick={() => navigate(`/fundraising/squares?board=${board.slug}`)}
                  className="bg-[#121a24]/80 border-2 border-[#007ba7]/50 rounded-xl p-6 text-left hover:border-[#00c4ff] hover:shadow-lg hover:shadow-[#007ba7]/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{board.title}</h3>
                      <div className="flex items-center gap-2 text-white/60 mb-1">
                        <Users className="w-4 h-4" />
                        <span>{board.team_top} vs {board.team_side}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/60">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(board.game_date)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-[#00c4ff]">${board.cost_per_square}</div>
                      <div className="text-sm text-white/50">per square</div>
                    </div>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-[#00c4ff] font-semibold">
                    Play Now
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 md:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#007ba7]/10 to-transparent"></div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-white" style={{ fontFamily: 'Oswald, sans-serif' }}>
            READY TO JOIN THE NOR'EASTERS FAMILY?
          </h2>
          {tryoutConfig ? (
            <>
              <p className="text-lg text-white/70 mb-2 max-w-2xl mx-auto">
                {tryoutConfig.description || 'Sign up for our upcoming tryouts!'}
              </p>
              {tryoutConfig.tryout_date && (
                <p className="text-xl font-bold text-[#00c4ff] mb-8">
                  {formatDateTime(tryoutConfig.tryout_date)}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
              Tryouts are coming soon for the upcoming season. Give your child the opportunity to grow, compete, and make lifelong friends.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-4">
            {tryoutConfig ? (
              <Link
                to="/tryout-signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#007ba7] text-white font-bold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-lg shadow-[#007ba7]/30"
              >
                {tryoutConfig.title || 'Sign Up for Tryouts'}
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                to="/tryout"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#007ba7] text-white font-bold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-lg shadow-[#007ba7]/30"
              >
                Request Tryout
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/30 text-white font-bold rounded-lg hover:bg-white/10 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

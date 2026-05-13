import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X, ChevronDown } from "lucide-react";
import { useAuth } from "@getmocha/users-service/react";

const navItems = [
  { label: "Home", href: "/" },
  { 
    label: "About", 
    href: "/about",
    children: [
      { label: "About Us", href: "/about" },
      { label: "Photos", href: "/photos" },
      { label: "Schedule", href: "/about/schedule" },
      { label: "Coaches", href: "/about/coaches" },
      { label: "Teams", href: "/about/teams" },
      { label: "FAQ", href: "/about/faq" },
    ]
  },
  { label: "Shop", href: "https://teamlocker.squadlocker.com/stores/noreasters-team-store", external: true },
  { label: "News", href: "/news" },
  { label: "Support Us", href: "/support" },
  { label: "Contact", href: "/contact" },
  { label: "Instagram", href: "https://www.instagram.com/capeannnoreasters/", external: true, mobileOnly: true },
  { label: "Facebook", href: "https://www.facebook.com/CapeAnnNoreasters/", external: true, mobileOnly: true },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<string | null>(null);
  const location = useLocation();
  const { user, redirectToLogin } = useAuth();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <header className="bg-[#0a0f14]/95 backdrop-blur-md border-b border-[#007ba7]/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img
              src="https://019b7617-c3ef-76fd-99cc-e86fca2684d0.mochausercontent.com/Noreasters-Snow-Logo-No-Background.png"
              alt="Cape Ann Nor'easters"
              className="h-16 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.filter(item => !item.mobileOnly).map((item) => (
              <div key={item.label} className="relative">
                {item.children ? (
                  <div
                    className="relative"
                    onMouseEnter={() => setOpenDropdown(item.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <button
                      className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors ${
                        isActive(item.href)
                          ? "text-[#00c4ff] bg-[#007ba7]/20"
                          : "text-white/90 hover:text-[#00c4ff] hover:bg-white/5"
                      }`}
                    >
                      {item.label}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {openDropdown === item.label && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-[#121a24] border border-[#007ba7]/30 rounded-lg shadow-xl shadow-black/50 py-2">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className="block px-4 py-2 text-sm text-white/80 hover:bg-[#007ba7]/20 hover:text-[#00c4ff]"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-white/90 hover:text-[#00c4ff] hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    to={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive(item.href)
                        ? "text-[#00c4ff] bg-[#007ba7]/20"
                        : "text-white/90 hover:text-[#00c4ff] hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Right side buttons */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.instagram.com/capeannnoreasters/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex p-2 text-white/60 hover:text-[#00c4ff] transition-colors"
              title="Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a
              href="https://www.facebook.com/CapeAnnNoreasters/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex p-2 text-white/60 hover:text-[#00c4ff] transition-colors"
              title="Facebook"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            {user ? (
              <Link
                to="/portal"
                className="hidden sm:inline-flex px-4 py-2 bg-[#007ba7] text-white text-sm font-semibold rounded-lg hover:bg-[#00a3d9] transition-colors shadow-lg shadow-[#007ba7]/30"
              >
                Portal
              </Link>
            ) : (
              <button
                onClick={() => redirectToLogin()}
                className="hidden sm:inline-flex px-4 py-2 border border-[#007ba7] text-[#00c4ff] text-sm font-semibold rounded-lg hover:bg-[#007ba7]/20 transition-colors"
              >
                Log In
              </button>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#007ba7]/30 py-4">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <div key={item.label}>
                  {item.children ? (
                    <div>
                      <button
                        onClick={() => setMobileDropdownOpen(mobileDropdownOpen === item.label ? null : item.label)}
                        className="w-full px-3 py-2 text-sm font-semibold text-[#00c4ff] flex items-center justify-between hover:bg-white/5 rounded-lg"
                      >
                        {item.label}
                        <ChevronDown className={`w-4 h-4 transition-transform ${mobileDropdownOpen === item.label ? 'rotate-180' : ''}`} />
                      </button>
                      {mobileDropdownOpen === item.label && (
                        <div className="ml-4">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              to={child.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="block px-3 py-2 text-sm text-white/70 hover:text-[#00c4ff]"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-[#00c4ff]"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                        isActive(item.href)
                          ? "text-[#00c4ff] bg-[#007ba7]/20"
                          : "text-white/90 hover:text-[#00c4ff]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
              <div className="flex flex-col gap-2 mt-4 px-3">
                {user ? (
                  <Link
                    to="/portal"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full px-4 py-2 bg-[#007ba7] text-white text-sm font-semibold rounded-lg text-center"
                  >
                    Portal
                  </Link>
                ) : (
                  <button
                    onClick={() => redirectToLogin()}
                    className="w-full px-4 py-2 border border-[#007ba7] text-[#00c4ff] text-sm font-semibold rounded-lg"
                  >
                    Log In
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

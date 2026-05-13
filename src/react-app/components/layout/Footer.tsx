import { Link } from "react-router";
import { Facebook, Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="https://019b7617-c3ef-76fd-99cc-e86fca2684d0.mochausercontent.com/Nor'easters.jpg"
                alt="Cape Ann Nor'easters"
                className="h-12 w-auto"
              />
              <div>
                <div className="font-bold text-white leading-tight">Cape Ann</div>
                <div className="text-sm text-blue-400 font-semibold leading-tight">Nor'easters</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Building champions on and off the field.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="https://www.facebook.com/CapeAnnNoreasters/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 hover:bg-blue-700 rounded-lg transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/capeannnoreasters/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 hover:bg-blue-700 rounded-lg transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-gray-400 hover:text-white text-sm transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/about/teams" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Teams
                </Link>
              </li>
              <li>
                <Link to="/about/coaches" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Coaches
                </Link>
              </li>
              <li>
                <Link to="/about/schedule" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Schedule
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Support Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Cape Ann Nor'easters. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/about/faq" className="text-gray-500 hover:text-white text-sm transition-colors">
              FAQ
            </Link>
            <Link to="/privacy" className="text-gray-500 hover:text-white text-sm transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-gray-500 hover:text-white text-sm transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

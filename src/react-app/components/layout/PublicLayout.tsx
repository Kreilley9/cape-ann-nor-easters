import Header from "./Header";
import Footer from "./Footer";
import Snowstorm from "../Snowstorm";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f14] relative overflow-x-hidden">
      {/* Storm background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top, #1a2a3a 0%, #121a24 40%, #0a0f14 100%)",
        }}
      />
      
      {/* Snowstorm effect */}
      <Snowstorm intensity="heavy" />
      
      {/* Content */}
      <div className="relative z-10">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

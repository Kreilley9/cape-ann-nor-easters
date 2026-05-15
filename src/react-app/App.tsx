import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router";
import { AuthProvider } from "@/react-app/contexts/AuthContext";
import { RoleProvider } from "@/react-app/contexts/RoleContext";
import { useState, useEffect } from "react";
import BlizzardIntro from "@/react-app/components/BlizzardIntro";
import HomePage from "@/react-app/pages/HomePage";
import About from "@/react-app/pages/About";
import News from "@/react-app/pages/News";
import Contact from "@/react-app/pages/Contact";
import Sponsorship from "@/react-app/pages/Sponsorship";
import Support from "@/react-app/pages/Support";
import Schedule from "@/react-app/pages/Schedule";
import AuthCallback from "@/react-app/pages/AuthCallback";
import Admin from "@/react-app/pages/Admin";
import PublicBoard from "@/react-app/pages/PublicBoard";
import FundraisingSquares from "@/react-app/pages/FundraisingSquares";
import PortalDashboard from "@/react-app/pages/portal/PortalDashboard";
import PortalTeams from "@/react-app/pages/portal/PortalTeams";
import PortalPlayers from "@/react-app/pages/portal/PortalPlayers";
import PortalPlayerDetail from "@/react-app/pages/portal/PortalPlayerDetail";
import PortalSchedule from "@/react-app/pages/portal/PortalSchedule";
import PortalRSVP from "@/react-app/pages/portal/PortalRSVP";
import PortalPayments from "@/react-app/pages/portal/PortalPayments";
import PortalOutstandingDues from "@/react-app/pages/portal/PortalOutstandingDues";
import PortalAccountingReport from "@/react-app/pages/portal/PortalAccountingReport";
import PortalRecruiting from "@/react-app/pages/portal/PortalRecruiting";
import PortalProspectDetail from "@/react-app/pages/portal/PortalProspectDetail";
import PortalUniformOrder from "@/react-app/pages/portal/PortalUniformOrder";
import PortalUniformOrders from "@/react-app/pages/portal/PortalUniformOrders";
import PortalSurveys from "@/react-app/pages/portal/PortalSurveys";
import PortalSurveyCreate from "@/react-app/pages/portal/PortalSurveyCreate";
import PortalSurveyResults from "@/react-app/pages/portal/PortalSurveyResults";
import PortalSurveyTake from "@/react-app/pages/portal/PortalSurveyTake";
import PortalUserRoles from "@/react-app/pages/portal/PortalUserRoles";
import PortalInvites from "@/react-app/pages/portal/PortalInvites";
import PortalDocuments from "@/react-app/pages/portal/PortalDocuments";
import InviteAccept from "@/react-app/pages/InviteAccept";
import Onboarding from "@/react-app/pages/Onboarding";
import RequestTryout from "@/react-app/pages/RequestTryout";
import TryoutSignup from "@/react-app/pages/TryoutSignup";
import Photos from "@/react-app/pages/Photos";
import Coaches from "@/react-app/pages/Coaches";
import Teams from "@/react-app/pages/Teams";
import FAQ from "@/react-app/pages/FAQ";
import PrivacyPolicy from "@/react-app/pages/PrivacyPolicy";
import Terms from "@/react-app/pages/Terms";
import PortalTryoutConfig from "@/react-app/pages/portal/PortalTryoutConfig";
import PortalSettings from "@/react-app/pages/PortalSettings";
import PortalDatabaseAdmin from "@/react-app/pages/PortalDatabaseAdmin";
import PortalNews from "@/react-app/pages/PortalNews";
import { PortalNotificationTest } from "@/react-app/pages/PortalNotificationTest";
import PortalGalleryManagement from "@/react-app/pages/PortalGalleryManagement";
import PortalCoachesManagement from "@/react-app/pages/PortalCoachesManagement";
import PortalTeamsPhotoManagement from "@/react-app/pages/PortalTeamsPhotoManagement";
import PortalGroupMessage from "@/react-app/pages/portal/PortalGroupMessage";
import PortalContacts from "@/react-app/pages/portal/PortalContacts";
import PortalNotificationSettings from "@/react-app/pages/portal/PortalNotificationSettings";
import PortalRaffles from "@/react-app/pages/portal/PortalRaffles";
import PortalMySales from "@/react-app/pages/PortalMySales";
import PublicRaffle from "@/react-app/pages/PublicRaffle";
import RaffleSeller from "@/react-app/pages/RaffleSeller";
import { PortalCoachesDocuments } from "@/react-app/pages/PortalCoachesDocuments";
import { PortalCoachesMessages } from "@/react-app/pages/PortalCoachesMessages";
import { PortalCoachesMessageDetail } from "@/react-app/pages/PortalCoachesMessageDetail";
import SignIn from "@/react-app/pages/SignIn";
import ScrollToTop from "@/react-app/components/ScrollToTop";

function AppContent() {
  const location = useLocation();
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);

  useEffect(() => {
    // Only show intro on homepage and if not already shown this session
    const hasSeenIntro = sessionStorage.getItem("noreasters-intro-seen");
    if (location.pathname === "/" && !hasSeenIntro) {
      setShowIntro(true);
    } else {
      setIntroComplete(true);
    }
  }, []);

  const handleIntroComplete = () => {
    sessionStorage.setItem("noreasters-intro-seen", "true");
    setShowIntro(false);
    setIntroComplete(true);
  };

  return (
    <>
      {showIntro && <BlizzardIntro onComplete={handleIntroComplete} />}
      <ScrollToTop />
      <div className={introComplete ? "opacity-100" : "opacity-0"}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<About />} />
          <Route path="/about/schedule" element={<Schedule />} />
          <Route path="/about/coaches" element={<Coaches />} />
          <Route path="/about/teams" element={<Teams />} />
          <Route path="/about/faq" element={<FAQ />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/news" element={<News />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/tryout" element={<RequestTryout />} />
          <Route path="/tryout-signup" element={<TryoutSignup />} />
          <Route path="/support" element={<Support />} />
          <Route path="/support/sponsorship" element={<Sponsorship />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/invite/:code" element={<InviteAccept />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/admin" element={<Admin />} />
          {/* Legacy route for backwards compatibility */}
          <Route path="/board" element={<PublicBoard />} />
          {/* New fundraising routes */}
          <Route path="/fundraising/squares" element={<FundraisingSquares />} />
          {/* Portal routes */}
          <Route path="/portal" element={<PortalDashboard />} />
          <Route path="/portal/teams" element={<PortalTeams />} />
          <Route path="/portal/players" element={<PortalPlayers />} />
          <Route path="/portal/players/:id" element={<PortalPlayerDetail />} />
          <Route path="/portal/schedule" element={<PortalSchedule />} />
          <Route path="/portal/rsvp" element={<PortalRSVP />} />
          <Route path="/portal/payments" element={<PortalPayments />} />
          <Route path="/portal/outstanding-dues" element={<PortalOutstandingDues />} />
          <Route path="/portal/accounting" element={<PortalAccountingReport />} />
          <Route path="/portal/recruiting" element={<PortalRecruiting />} />
          <Route path="/portal/prospects/:id" element={<PortalProspectDetail />} />
          <Route path="/portal/uniforms" element={<PortalUniformOrder />} />
          <Route path="/portal/uniforms/orders" element={<PortalUniformOrders />} />
          <Route path="/portal/surveys" element={<PortalSurveys />} />
          <Route path="/portal/surveys/new" element={<PortalSurveyCreate />} />
          <Route path="/portal/surveys/:id" element={<PortalSurveyTake />} />
          <Route path="/portal/surveys/:id/results" element={<PortalSurveyResults />} />
          <Route path="/portal/user-roles" element={<PortalUserRoles />} />
          <Route path="/portal/invites" element={<PortalInvites />} />
          <Route path="/portal/documents" element={<PortalDocuments />} />
          <Route path="/portal/tryout-config" element={<PortalTryoutConfig />} />
          <Route path="/portal/settings" element={<PortalSettings />} />
          <Route path="/portal/database" element={<PortalDatabaseAdmin />} />
          <Route path="/portal/news" element={<PortalNews />} />
          <Route path="/portal/gallery" element={<PortalGalleryManagement />} />
          <Route path="/portal/coaches-management" element={<PortalCoachesManagement />} />
          <Route path="/portal/teams-photos" element={<PortalTeamsPhotoManagement />} />
          <Route path="/portal/group-message" element={<PortalGroupMessage />} />
          <Route path="/portal/contacts" element={<PortalContacts />} />
          <Route path="/portal/notifications" element={<PortalNotificationSettings />} />
          <Route path="/portal/notification-test" element={<PortalNotificationTest />} />
          <Route path="/portal/coaches/documents" element={<PortalCoachesDocuments />} />
          <Route path="/portal/coaches/messages" element={<PortalCoachesMessages />} />
          <Route path="/portal/coaches/messages/:id" element={<PortalCoachesMessageDetail />} />
          <Route path="/portal/raffles" element={<PortalRaffles />} />
          <Route path="/portal/my-sales" element={<PortalMySales />} />
          {/* Public raffle pages */}
          <Route path="/raffle/:id" element={<PublicRaffle />} />
          <Route path="/raffle/:id/seller" element={<RaffleSeller />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RoleProvider>
        <Router>
          <AppContent />
        </Router>
      </RoleProvider>
    </AuthProvider>
  );
}

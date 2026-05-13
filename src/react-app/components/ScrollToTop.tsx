import { useEffect } from "react";
import { useLocation } from "react-router";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Don't scroll to top on portal navigation - let the sidebar maintain its position
    if (!pathname.startsWith("/portal")) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

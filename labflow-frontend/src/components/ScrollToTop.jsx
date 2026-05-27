import { useEffect } from "react";
import { useLocation } from "react-router";

// Scrolls to the top whenever the route path changes.
// This prevents detail pages from opening halfway down the page.
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;

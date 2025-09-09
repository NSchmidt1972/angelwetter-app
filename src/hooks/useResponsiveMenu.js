import { useEffect, useState } from "react";

export function useResponsiveMenu() {
  const [showHamburger, setShowHamburger] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const portrait = h > w;
      const isMobile = w < 768;
      const isTabletPortrait = !isMobile && w <= 1024 && portrait;
      setShowHamburger(isMobile || isTabletPortrait);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  return showHamburger;
}

// src/components/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import { supabase } from "@/supabaseClient";

import { useDarkMode } from "@/hooks/useDarkMode";
import { useResponsiveMenu } from "@/hooks/useResponsiveMenu";
import { useAnchoredPosition } from "@/hooks/useAnchoredPosition";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";

import { navItemsFor } from "@/config/navItems";
import DesktopNav from "@/components/navbar/DesktopNav";
import MobileMenu from "@/components/navbar/MobileMenu";
import UserMenu from "@/components/navbar/UserMenu";

export default function Navbar({ name, isAdmin, canAccessBoard }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ⛔️ WICHTIG: Hooks IMMER zuerst – ohne Bedingungen/Returns
  const { dark, toggle } = useDarkMode();
  const showHamburger = useResponsiveMenu();
  const {
    updateReady,
    updating,
    applyUpdateNow,
  } = useServiceWorkerUpdate();

  // Lokaler UI-State
  const [open, setOpen] = useState(false);                 // Mobile-Overlay
  const [openDropdown, setOpenDropdown] = useState(false); // Statistik-Dropdown (Desktop & Mobile, durch Outside-Click geschützt)
  const [showMenu, setShowMenu] = useState(false);         // Profil-Menü
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(64);

  const profileRef = useRef(null);
  const statsBtnRef = useRef(null);
  const statsMenuRef = useRef(null); // ⬅️ NEU: gemeinsames Ref auf das geöffnete Statistik-Menü (Desktop & Mobile)

  // Dropdown-Position (Desktop)
  const menuPos = useAnchoredPosition(openDropdown, statsBtnRef);

  // Header-Spacer aktualisieren
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight || 64));
    ro.observe(el);
    setHeaderH(el.offsetHeight || 64);
    return () => ro.disconnect();
  }, []);

  // Body-Scroll sperren, wenn Mobile-Overlay offen
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Outside-Click: Profil + Statistik schließen
  useEffect(() => {
    function handleClickOutside(e) {
      // Profil-Menü schließen
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowMenu(false);
      }

      // 🟢 Outside-Click für Statistik NUR auf Desktop aktiv (Mobile-Overlay offen? dann ignorieren)
      const mobileOverlayOpen = showHamburger && open;
      if (mobileOverlayOpen) return;

      const clickedStatsBtn = statsBtnRef.current?.contains(e.target);
      const insideStatsMenu = statsMenuRef.current?.contains(e.target);

      if (!clickedStatsBtn && !insideStatsMenu) {
        setOpenDropdown(false);
      }
    }

    // 'click' statt 'mousedown' reduziert Touch-Race-Conditions
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showHamburger, open]);

  useEffect(() => {
    if (!showMenu) {
      setSettingsExpanded(false);
    }
  }, [showMenu]);

  const shouldShowUpdateBanner = updateReady && !updating;


  // ✅ EARLY RETURN ERST NACH ALLEN HOOKS
  if (!user) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("anglerName");
    localStorage.removeItem("shortAnglerName");
    setUser(null);
    navigate("/");
  };

  const navItems = navItemsFor({ isAdmin: !!isAdmin, canAccessBoard: !!canAccessBoard, anglerName: name });
  const currentPath = location.pathname;

  const handleToggleDropdown = (next) => {
    setOpenDropdown((prev) => (typeof next === "boolean" ? next : !prev));
  };

  const handleNavigateSettings = () => {
    setShowMenu(false);
    setSettingsExpanded(false);
    navigate("/settings");
  };

  const handleCloseMobileMenu = () => {
    setOpen(false);
    setOpenDropdown(false);
  };

  const displayName = (() => {
    const [first] = (name || "").split(" ");
    const shortName = localStorage.getItem("shortAnglerName");
    return shortName || first || "Profil";
  })();

  return (
    <>
      <header
        ref={headerRef}
        className="bg-white dark:bg-gray-900 shadow-md fixed top-0 left-0 right-0 z-[1200] text-black dark:text-white"
        style={{ paddingTop: "env(safe-area-inset-top)", overflow: "visible" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          {/* Links: Navigation */}
          <div className="flex items-center gap-4">
            {showHamburger && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-3xl p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Menü öffnen"
              >
                ☰
              </button>
            )}

            {/* Desktop-Navigation */}
            {!showHamburger && (
              <DesktopNav
                navItems={navItems}
                currentPath={currentPath}
                openDropdown={openDropdown}
                onToggleDropdown={handleToggleDropdown}
                statsBtnRef={statsBtnRef}
                statsMenuRef={statsMenuRef}
                menuPos={menuPos}
              />
            )}
          </div>

          {/* Rechts: Profil / Push / Version */}
          <UserMenu
            ref={profileRef}
            dark={dark}
            onToggleDark={toggle}
            displayName={displayName}
            showMenu={showMenu}
            onToggleMenu={() => setShowMenu((v) => !v)}
            settingsExpanded={settingsExpanded}
            onToggleSettings={() => setSettingsExpanded((v) => !v)}
            onNavigateSettings={handleNavigateSettings}
            onLogout={handleLogout}
            shouldShowUpdateBanner={shouldShowUpdateBanner}
            onApplyUpdate={applyUpdateNow}
            updating={updating}
          />
        </div>

        {showHamburger && (
          <MobileMenu
            navItems={navItems}
            currentPath={currentPath}
            open={open}
            onClose={handleCloseMobileMenu}
            openDropdown={openDropdown}
            onToggleDropdown={handleToggleDropdown}
            statsMenuRef={statsMenuRef}
          />
        )}
      </header>

      {/* Spacer unter fixem Header */}
      <div aria-hidden="true" style={{ height: headerH }} />
    </>
  );
}

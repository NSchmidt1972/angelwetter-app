// src/components/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import { supabase } from "@/supabaseClient";

import { useDarkMode } from "@/hooks/useDarkMode";
import { useResponsiveMenu } from "@/hooks/useResponsiveMenu";
import { useAnchoredPosition } from "@/hooks/useAnchoredPosition";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { APP_VERSION, BUILD_DATE, GIT_COMMIT } from "@/utils/buildInfo";

import { navItemsFor } from "@/config/navItems";
import DesktopNav from "@/components/navbar/DesktopNav";
import MobileMenu from "@/components/navbar/MobileMenu";
import UserMenu from "@/components/navbar/UserMenu";

export default function Navbar({ name, isAdmin, canAccessBoard }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { clubSlug } = useParams();

  // ⛔️ WICHTIG: Hooks IMMER zuerst – ohne Bedingungen/Returns
  const { dark, toggle } = useDarkMode();
  const showHamburger = useResponsiveMenu();
  const {
    updateReady,
    updating,
    updateStatusText,
    applyUpdateNow,
    restartApp,
    waitingBuild,
    waitingBuildResolved,
  } = useServiceWorkerUpdate();

  // Lokaler UI-State
  const [open, setOpen] = useState(false);                 // Mobile-Overlay
  const [openDropdown, setOpenDropdown] = useState(false); // Statistik-Dropdown (Desktop & Mobile, durch Outside-Click geschützt)
  const [showMenu, setShowMenu] = useState(false);         // Profil-Menü
  const [dataFilter, setDataFilter] = useState('recent');  // Nur für Nicol

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

  // Datenfilter (Nicol): aktuelles Setting laden
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const storedFilter = localStorage.getItem("dataFilter") || "recent";
    setDataFilter(storedFilter);
  }, []);

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

  const currentBuildInfo = {
    version: (APP_VERSION || "").trim(),
    date: (BUILD_DATE || "").trim(),
    commit: (GIT_COMMIT || "").trim(),
  };

  const waitingBuildInfo = waitingBuild && typeof waitingBuild === "object"
    ? {
        version: String(waitingBuild.version || "").trim(),
        date: String(waitingBuild.date || "").trim(),
        commit: String(waitingBuild.commit || "").trim(),
      }
    : null;

  const hasDifferentWaitingBuild = (() => {
    if (!updateReady || !waitingBuildResolved || !waitingBuildInfo) return false;

    if (currentBuildInfo.commit && waitingBuildInfo.commit) {
      return currentBuildInfo.commit !== waitingBuildInfo.commit;
    }

    if (currentBuildInfo.version && waitingBuildInfo.version) {
      return currentBuildInfo.version !== waitingBuildInfo.version;
    }

    if (currentBuildInfo.date && waitingBuildInfo.date) {
      return currentBuildInfo.date !== waitingBuildInfo.date;
    }

    return false;
  })();

  const shouldShowUpdateBanner = hasDifferentWaitingBuild && !updating;

  const prefixWithClub = (path) => {
    if (!clubSlug) return path;
    if (!path || path === "/") return `/${clubSlug}`;
    return `/${clubSlug}${path.startsWith("/") ? path : `/${path}`}`;
  };


  // ✅ EARLY RETURN ERST NACH ALLEN HOOKS
  if (!user) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    localStorage.removeItem("anglerName");
    localStorage.removeItem("shortAnglerName");
    localStorage.removeItem("angelwetter_profile_cache_v2");
    localStorage.removeItem("activeClubId");
    setUser(null);
    navigate(prefixWithClub("/auth"));
  };

  const navItems = navItemsFor({ isAdmin: !!isAdmin, canAccessBoard: !!canAccessBoard, anglerName: name }).map((item) => (
    item.children
      ? {
          ...item,
          path: item.path ? prefixWithClub(item.path) : undefined,
          children: item.children.map((child) => ({ ...child, path: prefixWithClub(child.path) })),
        }
      : { ...item, path: prefixWithClub(item.path) }
  ));
  const currentPath = location.pathname;

  const handleToggleDropdown = (next) => {
    setOpenDropdown((prev) => (typeof next === "boolean" ? next : !prev));
  };

  const handleNavigateAdmin = () => {
    setShowMenu(false);
    navigate(prefixWithClub("/admin2"));
  };

  const handleToggleDataFilter = () => {
    if (typeof localStorage === "undefined") return;
    const newValue = dataFilter === "recent" ? "all" : "recent";
    setDataFilter(newValue);
    localStorage.setItem("dataFilter", newValue);
    alert(
      newValue === "recent"
        ? "Nur Daten ab 01.06.2025 werden verwendet."
        : "Alle Daten werden verwendet."
    );
    window.location.reload();
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

  const showAdminLink = isAdmin && canAccessBoard;
  const showDataFilter = (name || "").trim().toLowerCase() === "nicol schmidt";

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
          onNavigateAdmin={handleNavigateAdmin}
          showAdminLink={showAdminLink}
          showDataFilter={showDataFilter}
          dataFilterValue={dataFilter}
          onToggleDataFilter={handleToggleDataFilter}
          onLogout={handleLogout}
          shouldShowUpdateBanner={shouldShowUpdateBanner}
          onApplyUpdate={applyUpdateNow}
          onRestartApp={restartApp}
          updating={updating}
          updateStatusText={updateStatusText}
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

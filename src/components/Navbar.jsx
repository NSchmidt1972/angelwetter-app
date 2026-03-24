// src/components/Navbar.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import { supabase } from "@/supabaseClient";
import { clearActiveClubId } from "@/utils/clubId";
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES } from '@/permissions/features';
import { ROLES } from '@/permissions/roles';

import { useDarkMode } from "@/hooks/useDarkMode";
import { useResponsiveMenu } from "@/hooks/useResponsiveMenu";
import { useAnchoredPosition } from "@/hooks/useAnchoredPosition";

import { navItemsFor } from "@/config/navItems";
import DesktopNav from "@/components/navbar/DesktopNav";
import MobileMenu from "@/components/navbar/MobileMenu";
import UserMenu from "@/components/navbar/UserMenu";

export default function Navbar({ name }) {
  const { user, setUser } = useAuth();
  const { hasAtLeastRole, hasFeatureForRole, currentClub } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const { clubSlug } = useParams();

  const { dark, toggle } = useDarkMode();
  const showHamburger = useResponsiveMenu();

  // Lokaler UI-State
  const [open, setOpen] = useState(false);                 // Mobile-Overlay
  const [openDropdown, setOpenDropdown] = useState(false); // Statistik-Dropdown (Desktop & Mobile, durch Outside-Click geschützt)
  const [showMenu, setShowMenu] = useState(false);         // Profil-Menü
  const [dataFilter, setDataFilter] = useState('recent');

  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(64);

  const profileRef = useRef(null);
  const statsBtnRef = useRef(null);
  const statsMenuRef = useRef(null);
  const mobileMenuId = 'main-navigation-mobile-menu';

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

  // Datenfilter: aktuelles Setting laden
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

  const prefixWithClub = useCallback((path) => {
    if (!clubSlug) return path;
    if (!path || path === "/") return `/${clubSlug}`;
    return `/${clubSlug}${path.startsWith("/") ? path : `/${path}`}`;
  }, [clubSlug]);

  if (!user) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    localStorage.removeItem("anglerName");
    localStorage.removeItem("shortAnglerName");
    localStorage.removeItem("angelwetter_profile_cache_v2");
    clearActiveClubId();
    setUser(null);
    navigate(prefixWithClub("/auth"));
  };

  const navItems = navItemsFor({ hasFeatureForRole, hasAtLeastRole }).map((item) =>
    item.children
      ? {
          ...item,
          path: item.path ? prefixWithClub(item.path) : undefined,
          children: item.children.map((child) => ({ ...child, path: prefixWithClub(child.path) })),
        }
      : { ...item, path: prefixWithClub(item.path) }
  );
  const currentPath = location.pathname;

  const handleToggleDropdown = (next) => {
    setOpenDropdown((prev) => (typeof next === "boolean" ? next : !prev));
  };

  const handleToggleDataFilter = () => {
    if (typeof localStorage === "undefined") return;
    const newValue = dataFilter === "recent" ? "all" : "recent";
    setDataFilter(newValue);
    localStorage.setItem("dataFilter", newValue);
    window.dispatchEvent(new Event('angelwetter:storage-sync'));
    alert(
      newValue === "recent"
        ? "Nur Daten ab 01.06.2025 werden verwendet."
        : "Alle Daten werden verwendet."
    );
  };

  const handleCloseMobileMenu = () => {
    setOpen(false);
    setOpenDropdown(false);
  };

  const displayName = (() => {
    const [first] = (name || "").split(" ");
    if (typeof localStorage === "undefined") {
      return first || "Profil";
    }
    const shortName = localStorage.getItem("shortAnglerName");
    return shortName || first || "Profil";
  })();

  const showDataFilter =
    hasFeatureForRole(FEATURES.ADMIN_TOOLS) &&
    hasAtLeastRole(ROLES.BOARD);
  const clubLogoSrc = String(currentClub?.logoUrl || '').trim();

  return (
    <>
      <header
        ref={headerRef}
        className="bg-white dark:bg-gray-900 shadow-md fixed top-0 left-0 right-0 z-[1200] text-black dark:text-white"
        style={{ paddingTop: "env(safe-area-inset-top)", overflow: "visible" }}
      >
        <div
          className={`max-w-7xl mx-auto px-4 py-4 items-center ${
            showHamburger
              ? "grid grid-cols-[1fr_auto_1fr]"
              : "flex justify-between"
          }`}
        >
          {/* Links: Navigation */}
          <div className="flex items-center gap-4">
            {showHamburger && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-3xl p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label={open ? "Menü schließen" : "Menü öffnen"}
                aria-expanded={open}
                aria-controls={mobileMenuId}
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

          {showHamburger && (
            <button
              type="button"
              onClick={toggle}
              className="justify-self-center px-3 py-2 rounded hover:text-blue-600 dark:hover:text-blue-300 text-xl leading-none"
            >
              {dark ? "☀️ Tageslicht" : "🌙 Nachtangeln"}
            </button>
          )}

          {/* Rechts: Profil / Push / Version */}
          <div className={showHamburger ? "justify-self-end" : ""}>
            <UserMenu
              ref={profileRef}
              dark={dark}
              onToggleDark={toggle}
              showThemeToggle={!showHamburger}
              displayName={displayName}
              clubLogoSrc={clubLogoSrc}
              showMenu={showMenu}
              onToggleMenu={() => setShowMenu((v) => !v)}
              showDataFilter={showDataFilter}
              dataFilterValue={dataFilter}
              onToggleDataFilter={handleToggleDataFilter}
              onLogout={handleLogout}
            />
          </div>
        </div>

        {showHamburger && (
          <MobileMenu
            navItems={navItems}
            currentPath={currentPath}
            open={open}
            menuId={mobileMenuId}
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

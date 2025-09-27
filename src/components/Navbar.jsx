// src/components/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import { supabase } from "@/supabaseClient";

import { useDarkMode } from "@/hooks/useDarkMode";
import { useResponsiveMenu } from "@/hooks/useResponsiveMenu";
import { useAnchoredPosition } from "@/hooks/useAnchoredPosition";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import usePushStatus from "@/hooks/usePushStatus";

import { navItemsFor } from "@/config/navItems";
import NavLink from "@/components/NavLink";
import VersionInfo from "@/components/VersionInfo";


function SettingsMenuToggle({ open, onToggle, onNavigate }) {
  const statusLabel = open ? "Fanglisten" : "Fanglisten";

  const handleToggleClick = () => {
    if (onToggle) {
      onToggle();
    }

    if (!open && onNavigate) {
      onNavigate();
    }
  };


  return (
    <div className="w-full">
      <div
        className={`flex items-start gap-4 rounded-3xl border px-4 py-3 transition ${
          open
            ? "border-blue-300 bg-blue-100 text-blue-900 shadow-sm dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
            : "border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        <div className="flex-1 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span role="img" aria-hidden="true">
              ⚙️
            </span>
            Download
          </div>
          <div className="mt-1 text-xs opacity-80">{statusLabel}</div>
        </div>
        <button
          type="button"
          onClick={handleToggleClick}
          role="switch"
          aria-checked={open}
          aria-label="Schnellzugriff für Einstellungen umschalten"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
            open
              ? "bg-blue-500"
              : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
          }`}
        >
          <span
            className={`absolute inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
              open ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="mt-2 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
          <div className="font-semibold">Downloads &amp; Exporte</div>
          <p className="mt-1">
            CSV- und PDF-Dateien findest du gesammelt auf der Einstellungsseite.
          </p>
          <button
            type="button"
            onClick={onNavigate}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 transition hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
          >
            <span aria-hidden="true">📂</span>
            Seite öffnen
          </button>
        </div>
      )}
    </div>
  );
}


function PushMenuButton() {
  const {
    sdk,
    supported,
    blocked,
    optedIn,
    subId,
    loading,
    subscribe,
    unsubscribe,
  } = usePushStatus();


  const ready = Boolean(sdk);
  const supportUnavailable = supported === false;
  const enabled = ready && !!(optedIn && subId);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(subId || "");
    } catch (error) {
      console.warn('Subscription-ID konnte nicht kopiert werden:', error);
    }
  };

  const handleToggle = () => {
    if (loading || supportUnavailable) return;
    if (enabled) {
      unsubscribe();
      return;
    }

    if (!blocked) {
      subscribe();
    }
  };

  const statusLabel = (() => {
    if (supportUnavailable) return "Nicht unterstützt";
    if (!ready || loading) return "Status wird aktualisiert...";
    if (blocked) return "Im Browser blockiert";
    return enabled ? "aktiviert" : "deaktiviert";
  })();

  const disabled = loading || (!enabled && (blocked || supportUnavailable));

  const containerClass = supportUnavailable
    ? "border-yellow-300 bg-yellow-100 text-yellow-900 shadow-sm dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-100"
    : enabled
      ? "border-green-300 bg-green-100 text-green-900 shadow-sm dark:border-green-700 dark:bg-green-900/40 dark:text-green-100"
      : "border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="w-full">
      <div
        className={`flex items-start gap-4 rounded-3xl border px-4 py-3 transition ${containerClass}`}
      >
        <div className="flex-1 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span role="img" aria-hidden="true">🔔</span>
            Push
          </div>
          <div className="mt-1 text-xs opacity-80">
            {statusLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          role="switch"
          aria-checked={enabled}
          aria-label="Push-Benachrichtigungen umschalten"
          title={
            supportUnavailable
              ? "Push-Benachrichtigungen werden in diesem Browser nicht unterstützt"
              : blocked
                ? "Benachrichtigungen im Browser freigeben"
                : "Push-Benachrichtigungen umschalten"
          }
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 ${
            enabled
              ? "bg-green-500"
            : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
          } ${disabled ? "opacity-60" : ""}`}
        >
          <span
            className={`absolute inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
              enabled ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-2 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
        <div className="font-semibold">Subscription-ID:</div>
        <div className="font-mono break-all select-all">{subId || "— keine ID —"}</div>
        <div className="mt-1">
          <button
            type="button"
            onClick={copyId}
            disabled={!subId}
            className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            ID kopieren
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Navbar({ name, isAdmin }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ⛔️ WICHTIG: Hooks IMMER zuerst – ohne Bedingungen/Returns
  const { dark, toggle } = useDarkMode();
  const showHamburger = useResponsiveMenu();
  const { updateReady, updating, applyUpdateNow } = useServiceWorkerUpdate();

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


  // ✅ EARLY RETURN ERST NACH ALLEN HOOKS
  if (!user) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("anglerName");
    localStorage.removeItem("shortAnglerName");
    setUser(null);
    navigate("/");
  };

  const navItems = navItemsFor(!!isAdmin);

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
              <nav className="flex flex-row gap-2 items-center" role="navigation">
                {navItems.map((item) =>
                  item.children ? (
                    <div key={item.label} className="relative inline-block">
                      <button
                        type="button"
                        ref={statsBtnRef}
                        onClick={() => setOpenDropdown((p) => !p)}
                        className="block px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                      >
                        {item.label} <span className="pointer-events-none select-none">▾</span>
                      </button>

                      {openDropdown && (
                        <div
                          ref={statsMenuRef}
                          className="stats-dropdown fixed w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-[4000] text-base max-h-[60vh] overflow-y-auto overscroll-contain"
                          style={{ left: menuPos.left, top: menuPos.top }}
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              className={`block px-5 py-3 hover:bg-blue-100 dark:hover:bg-gray-700 rounded ${
                                location.pathname === child.path
                                  ? "font-bold text-blue-700 dark:text-blue-300"
                                  : "text-gray-800 dark:text-gray-100"
                              }`}
                              onClick={() => setOpenDropdown(false)}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <NavLink key={item.path} item={item} />
                  )
                )}
              </nav>
            )}
          </div>

          {/* Rechts: Profil / Push / Version */}
          <div className="flex items-center gap-3 text-base relative" ref={profileRef}>
            <button
              type="button"
              onClick={toggle}
              className="px-3 py-2 rounded hover:text-blue-600 dark:hover:text-blue-300"
            >
              {dark ? "☀️ Tageslicht" : "🌙 Nachtangeln"}
            </button>

            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="px-3 py-2 rounded"
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              👤 {displayName}
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg z-[1400] text-base"
                role="menu"
              >
                               <div className="px-4 pt-3 pb-2">
                  <SettingsMenuToggle
                    open={settingsExpanded}
                    onToggle={() => setSettingsExpanded((v) => !v)}
                    onNavigate={() => {
                      setShowMenu(false);
                      setSettingsExpanded(false);
                      navigate("/settings");
                    }}
                  />
                </div>

                {/* 🔔 Push */}
                <div className="px-4 py-2">
                  <PushMenuButton />
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
                >
                  Abmelden
                </button>

                

                {/* ⭐ Build/Commit + Update */}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-1 px-4 py-2">
                  <VersionInfo />

                  {updateReady ? (
                    <button
                      type="button"
                      onClick={applyUpdateNow}
                      disabled={updating}
                      className="mt-2 w-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 px-3 py-2 rounded disabled:opacity-60"
                      title="Neue Version verfügbar – jetzt anwenden"
                    >
                      {updating ? "⏳ Aktualisiere…" : "⤴️ App aktualisieren"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="mt-2 w-full text-xs text-blue-600 dark:text-blue-400"
                    >
                      🔄 App neu starten
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 📱 Mobile Overlay */}
        {showHamburger && open && (
          <div
            className="fixed inset-0 z-[1300] bg-white/95 dark:bg-gray-900/95 pt-20 overflow-hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-3xl p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Menü schließen"
            >
              ✖️
            </button>

            <nav
              className="h-full overflow-y-auto overscroll-contain flex flex-col items-center justify-center text-center gap-4 px-2 pb-6 pb-[env(safe-area-inset-bottom)]"
              role="navigation"
            >
              {navItems.map((item) =>
                item.children ? (
                  <div key={item.label} className="w-full max-w-sm relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((p) => !p)}
                      className="w-full px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                    >
                      {item.label} <span className="pointer-events-none select-none">▾</span>
                    </button>

                    {openDropdown && (
                      <div
                        ref={statsMenuRef}
                        className="mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 text-base max-h-[60vh] overflow-y-auto overscroll-contain"
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`block px-5 py-3 text-center hover:bg-blue-100 dark:hover:bg-gray-900 rounded ${
                              location.pathname === child.path
                                ? "font-bold text-blue-700 dark:text-blue-300"
                                : "text-gray-800 dark:text-gray-100"
                            }`}
                            onClick={() => {
                              setOpen(false);
                              setOpenDropdown(false);
                            }}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div key={item.path} className="w-full max-w-sm">
                    <Link
                      to={item.path}
                      className="block px-4 py-3 rounded text-lg hover:bg-blue-100 dark:hover:bg-gray-700"
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </div>
                )
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Spacer unter fixem Header */}
      <div aria-hidden="true" style={{ height: headerH }} />
    </>
  );
}

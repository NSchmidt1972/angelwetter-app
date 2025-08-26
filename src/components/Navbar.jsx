// src/components/Navbar.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';

/* ===== Build-Info robust ermitteln (unterstützt mehrere Varianten) ===== */
const BUILD_INFO =
  (typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__) || null;

const FALLBACKS = {
  version:
    (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) ||
    import.meta.env?.VITE_APP_VERSION ||
    'dev',
  date:
    (typeof __BUILD_DATE__ !== 'undefined' && __BUILD_DATE__) ||
    import.meta.env?.VITE_BUILD_DATE ||
    '',
  commit:
    (typeof __GIT_COMMIT__ !== 'undefined' && __GIT_COMMIT__) ||
    import.meta.env?.VITE_GIT_COMMIT ||
    '',
};

const APP_VERSION = BUILD_INFO?.version || FALLBACKS.version;
const BUILD_DATE  = BUILD_INFO?.date    || FALLBACKS.date;
const GIT_COMMIT  = BUILD_INFO?.commit  || FALLBACKS.commit;



/* 🔔 Kleiner v16-kompatibler Push-Button (CTA) */
function PushToggleButton() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [supported, setSupported] = useState(null);
  const [permission, setPermission] = useState(null);
  const [optedIn, setOptedIn] = useState(null);
  const [subId, setSubId] = useState(null);
  const [busy, setBusy] = useState(false);
  const enabled = !!(permission && optedIn && subId);

  useEffect(() => {
    let cleanup;

    const init = async (OS) => {
      setSdkLoaded(true);
      setSupported(OS.Notifications.isPushSupported());
      setPermission(!!OS.Notifications.permission);
      setOptedIn(!!OS.User?.PushSubscription?.optedIn);
      setSubId(OS.User?.PushSubscription?.id ?? null);

      const onPerm = (perm) => setPermission(!!perm);
      const onSubChange = (ev) => {
        const cur = ev?.current || {};
        if (Object.prototype.hasOwnProperty.call(cur, 'optedIn')) setOptedIn(!!cur.optedIn);
        if (Object.prototype.hasOwnProperty.call(cur, 'id')) setSubId(cur.id ?? null);
      };

      OS.Notifications.addEventListener('permissionChange', onPerm);
      OS.User.PushSubscription.addEventListener('change', onSubChange);

      cleanup = () => {
        OS.Notifications.removeEventListener('permissionChange', onPerm);
        OS.User.PushSubscription.removeEventListener('change', onSubChange);
      };
    };

    if (window.OneSignal && window.OneSignal.Notifications) {
      init(window.OneSignal);
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(init);
    }
    return () => { if (cleanup) cleanup(); };
  }, []);

  const subscribe = () => {
    if (busy) return;
    setBusy(true);
    window.OneSignalDeferred.push(async (OS) => {
      try {
        if (!OS.Notifications.permission) {
          const ok = await OS.Notifications.requestPermission();
          if (!ok) { setBusy(false); return; }
        }
        await navigator.serviceWorker.ready;
        await OS.User.PushSubscription.optIn();
        if (typeof OS.Notifications.subscribe === 'function') {
          await OS.Notifications.subscribe();
        }
        for (let i = 0; i < 10; i++) {
          if (OS.User?.PushSubscription?.id) break;
          await new Promise(r => setTimeout(r, 200));
        }
        setOptedIn(!!OS.User?.PushSubscription?.optedIn);
        setSubId(OS.User?.PushSubscription?.id ?? null);
      } finally {
        setBusy(false);
      }
    });
  };

  const unsubscribe = () => {
    if (busy) return;
    setBusy(true);
    window.OneSignalDeferred.push(async (OS) => {
      try {
        await OS.User.PushSubscription.optOut();
        setOptedIn(false);
        setSubId(null);
      } finally {
        setBusy(false);
      }
    });
  };

  if (!sdkLoaded || supported === false) return null;

  if (enabled) {
    return (
      <button
        onClick={unsubscribe}
        disabled={busy}
        className="px-3 py-2 rounded-2xl bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60 w-full text-left"
        title="Benachrichtigungen deaktivieren"
      >
        🔔 Push-Aktiv
      </button>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={busy || permission === false}
      className="px-3 py-2 rounded-2xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60 w-full text-left"
      title={permission === false ? 'Benachrichtigungen im Browser blockiert' : 'Benachrichtigungen aktivieren'}
    >
      🔔 Push-Aktivieren
    </button>
  );
}

export default function Navbar({ name, isAdmin }) {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showHamburger, setShowHamburger] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef();
  const statsRef = useRef();

  useEffect(() => {
    const stored = localStorage.getItem('darkMode') === 'true';
    setDarkMode(stored);
    document.documentElement.classList.toggle('dark', stored);
  }, []);

  // Outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowMenu(false);
      if (statsRef.current && !statsRef.current.contains(e.target)) setOpenDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Responsive: wann Hamburger anzeigen
  useEffect(() => {
    function checkDevice() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const portrait = height > width;
      const isMobile = width < 768;
      const isTabletPortrait = !isMobile && width <= 1024 && portrait;
      setShowHamburger(isMobile || isTabletPortrait);
    }
    checkDevice();
    window.addEventListener("resize", checkDevice);
    window.addEventListener("orientationchange", checkDevice);
    return () => {
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("orientationchange", checkDevice);
    };
  }, []);

  // Body-Scroll sperren, wenn Overlay offen
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const toggleDark = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('darkMode', newValue);
    document.documentElement.classList.toggle('dark', newValue);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('anglerName');
    localStorage.removeItem('shortAnglerName');
    setUser(null);
    navigate('/');
  };

  const navItems = [
    { label: 'Wetter', path: '/' },
    { label: '➕ 🎣', path: '/new-catch' },
    { label: 'Fangliste', path: '/catches' },
    { label: 'Rangliste', path: '/leaderboard' },
    {
      label: 'Statistik',
      children: [
        { label: 'Analyse', path: '/analysis' },
        { label: 'Top 10', path: '/top-fishes' },
        { label: 'Fun-Facts', path: '/fun' },
        { label: 'Prognose', path: '/forecast' },
        { label: 'Kalender', path: '/calendar' },
        { label: 'Karte', path: '/map' }
      ]
    },
    ...(isAdmin ? [{ label: '🔧 Admin', path: '/admin' }] : [])
  ];

  if (!user) return null;

  const displayName = (() => {
    const [first] = name.split(' ');
    const shortName = localStorage.getItem('shortAnglerName');
    return shortName || first;
  })();

  // Hilfs-Komponente für einen einzelnen Link (mit Spezialfall „➕ 🎣“)
  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.path;

    // Spezialbehandlung nur für /new-catch
    if (item.path === '/new-catch') {
      return (
        <Link
          to={item.path}
          className={`block rounded text-lg px-4 py-3
            font-bold
            hover:bg-blue-100 dark:hover:bg-gray-700
            ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-200'}
          `}
          onClick={() => setOpen(false)}
        >
          <span className="inline-flex items-center gap-2">
            {/* Plus im Darkmode weiß */}
            <span className="text-green-700 dark:text-white">➕</span>
            <span>🎣</span>
          </span>
        </Link>
      );
    }

    // Standardlinks
    return (
      <Link
        to={item.path}
        className={`block px-4 py-3 rounded text-lg hover:bg-blue-100 dark:hover:bg-gray-700 ${
          isActive ? 'font-bold text-blue-700 dark:text-blue-300' : ''
        }`}
        onClick={() => setOpen(false)}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md sticky top-0 z-50 text-black dark:text-white">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {showHamburger && (
            <button
              onClick={() => setOpen(!open)}
              className="text-3xl p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Menü öffnen"
            >
              ☰
            </button>
          )}

          {/* NAV */}
          {showHamburger ? (
  open ? (
    // Mobile Overlay mit Scroll + Safe-Area-Padding
    <div
      className="fixed inset-0 z-50 bg-white/95 dark:bg-gray-900/95 pt-20 overflow-hidden"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <button
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
            <div key={item.label} className="w-full max-w-sm relative" ref={statsRef}>
              <button
                onClick={() => setOpenDropdown(prev => !prev)}
                className="w-full px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
              >
                {item.label} ▾
              </button>

              {openDropdown && (
                <div
                  className="mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 text-base max-h-[60vh] overflow-y-auto overscroll-contain"
                >
                  {item.children.map((child) => (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={`block px-5 py-3 text-center hover:bg-blue-100 dark:hover:bg-gray-900 rounded ${
                        location.pathname === child.path
                          ? 'font-bold text-blue-700 dark:text-blue-300'
                          : 'text-gray-800 dark:text-gray-100'
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
              <NavLink item={item} />
            </div>
          )
        )}
      </nav>  
    </div>
  ) : null
) : (
            // Desktop-Navigation
            <nav className="flex flex-row gap-2 items-center" role="navigation">
              {navItems.map((item) =>
                item.children ? (
                  <div key={item.label} className="relative inline-block" ref={statsRef}>
                    <button
                      onClick={() => setOpenDropdown(prev => !prev)}
                      className="block px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                    >
                      {item.label} ▾
                    </button>

                    {openDropdown && (
                      <div
                        className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 text-base max-h-[60vh] overflow-y-auto overscroll-contain"
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`block px-5 py-3 hover:bg-blue-100 dark:hover:bg-gray-700 rounded ${
                              location.pathname === child.path
                                ? 'font-bold text-blue-700 dark:text-blue-300'
                                : 'text-gray-800 dark:text-gray-100'
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
                  <NavLink key={item.path} item={item} />
                )
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3 text-base relative" ref={profileRef}>
          <button
            onClick={toggleDark}
            className="px-3 py-2 rounded hover:text-blue-600 dark:hover:text-blue-300"
          >
            {darkMode ? '☀️ Tageslicht' : '🌙 Nachtangeln'}
          </button>

          <button
            onClick={() => setShowMenu(prev => !prev)}
            className="px-3 py-2 rounded"
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            👤 {displayName}
          </button>

          {showMenu && (
            <div className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg z-50 text-base" role="menu">
              <Link
                to="/settings"
                className="block w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700"
                onClick={() => setShowMenu(false)}
              >
                ⚙️ Einstellungen
              </Link>

              {/* 🔔 Push CTA */}
              <div className="px-4 py-2">
                <PushToggleButton />
              </div>

              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
              >
                Abmelden
              </button>

              {/* ⭐ Versionsangabe */}
              <div className="border-t border-gray-200 dark:border-gray-700 mt-1 px-4 py-2">
                <div className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                  
                  {BUILD_DATE && (
                    <div>
                      <span className="font-semibold">Build:</span>{' '}
                      <span className="font-mono">{BUILD_DATE}</span>
                    </div>
                  )}
                  {GIT_COMMIT && (
                    <div className="truncate">
                      <span className="font-semibold">Commit:</span>{' '}
                      <span className="font-mono">{GIT_COMMIT.slice(0, 7)}</span>
                    </div>
                  )}
                </div>
                {/* 🔄 Update-Button */}
  {/* 🔄 Einfacher Reload-Button */}
  <button
    onClick={() => window.location.reload()}
    className="mt-2 w-full text-xs text-blue-600 dark:text-blue-400"
  >
    🔄 App neu starten
  </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

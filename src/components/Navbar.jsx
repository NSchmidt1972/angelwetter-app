import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';

/* 🔔 Kleiner v16-kompatibler Push-Button (CTA) */
function PushToggleButton() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [supported, setSupported] = useState(null);
  const [permission, setPermission] = useState(null); // boolean
  const [optedIn, setOptedIn] = useState(null);       // boolean
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
        if (cur.hasOwnProperty('optedIn')) setOptedIn(!!cur.optedIn);
        if (cur.hasOwnProperty('id')) setSubId(cur.id ?? null);
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
        // kleine Wartezeit, bis die ID gesetzt ist
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

  // nichts anzeigen, wenn SDK noch nicht da oder Browser kein Push kann
  if (!sdkLoaded || supported === false) return null;

  // Wenn bereits aktiv: kleines grünes Badge + Möglichkeit zum Deaktivieren per Klick
  if (enabled) {
    return (
      <button
        onClick={unsubscribe}
        disabled={busy}
        className="px-3 py-2 rounded-2xl bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60"
        title="Benachrichtigungen deaktivieren"
      >
        🔔 Push-Aktiv
      </button>
    );
  }

  // Sonst: CTA zum Aktivieren
  return (
    <button
      onClick={subscribe}
      disabled={busy || permission === false}
      className="px-3 py-2 rounded-2xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
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

  // Geräteerkennung
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

          <nav
            className={
              showHamburger
                ? open
                  ? 'fixed inset-0 bg-white/95 dark:bg-gray-900/95 flex flex-col items-center justify-center gap-6 z-50'
                  : 'hidden'
                : 'flex flex-row gap-6 items-center'
            }
          >
            {/* Close-Button */}
            {showHamburger && open && (
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 text-3xl p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Menü schließen"
              >
                ✖️
              </button>
            )}

            {navItems.map((item) =>
              item.children ? (
                <div key={item.label} className="relative" ref={statsRef}>
                  <button
                    onClick={() => setOpenDropdown(prev => !prev)}
                    className="block px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                  >
                    {item.label} ▾
                  </button>
                  {openDropdown && (
                    <div className="mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 text-base">
                      {item.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`block px-5 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 rounded ${
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
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-4 py-3 rounded text-lg hover:bg-blue-100 dark:hover:bg-gray-700 ${
                    location.pathname === item.path ? 'font-bold text-blue-700 dark:text-blue-300' : ''
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
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
            className="px-3 py-2 rounded hover:underline"
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            👤 {displayName}
          </button>

          {showMenu && (
            <div className="absolute right-0 top-12 w-44 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg z-50 text-base" role="menu">
              <Link
                to="/settings"
                className="block w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700"
                onClick={() => setShowMenu(false)}
              >
                ⚙️ Einstellungen
              </Link>

              {/* 🔔 Push CTA direkt in der Navbar */}
          <PushToggleButton />

              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
              >
                Abmelden
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

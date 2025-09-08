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
const BUILD_DATE = BUILD_INFO?.date || FALLBACKS.date;
const GIT_COMMIT = BUILD_INFO?.commit || FALLBACKS.commit;

/* 🔔 OneSignal v16-kompatibler Push-Button – nur UI-Steuerung (kein Supabase) */
function PushToggleButton() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [supported, setSupported] = useState(null);
  const [permission, setPermission] = useState(null);
  const [optedIn, setOptedIn] = useState(null);
  const [subscriptionId, setSubscriptionId] = useState(null);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Aktiv, sobald Permission + Opt-in + Subscription-ID vorhanden
  const enabled = !!(permission && optedIn && subscriptionId);

  async function getSubscriptionId(OS) {
    return (
      OS.User?.PushSubscription?.id ??
      (await OS.User?.PushSubscription?.getId?.()) ??
      null
    );
  }

  useEffect(() => {
    let cleanup;

    const init = async (OS) => {
      setSdkLoaded(true);
      setSupported(!!OS.Notifications.isPushSupported());
      setPermission(!!OS.Notifications.permission);
      setOptedIn(!!OS.User?.PushSubscription?.optedIn);

      const sid = await getSubscriptionId(OS);
      setSubscriptionId(sid ?? null);

      const onPerm = (perm) => setPermission(!!perm);
      const onSubChange = async (ev) => {
        const cur = ev?.current || {};
        if ('optedIn' in cur) setOptedIn(!!cur.optedIn);
        if ('id' in cur) {
          setSubscriptionId(cur.id ?? null);
        } else {
          const sid2 = await getSubscriptionId(OS);
          setSubscriptionId(sid2 ?? null);
        }
      };

      OS.Notifications.addEventListener('permissionChange', onPerm);
      OS.User.PushSubscription.addEventListener('change', onSubChange);

      cleanup = () => {
        OS.Notifications.removeEventListener('permissionChange', onPerm);
        OS.User.PushSubscription.removeEventListener('change', onSubChange);
      };
    };

    if (window.OneSignal?.Notifications) {
      init(window.OneSignal);
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(init);
    }

    return () => cleanup?.();
  }, []);

  const subscribe = () => {
    if (busy) return;
    setBusy(true);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OS) => {
      try {
        if (!OS.Notifications.permission) {
          const ok = await OS.Notifications.requestPermission();
          if (!ok) return;
        }
        await navigator.serviceWorker.ready;

        await OS.User.PushSubscription.optIn();
        if (typeof OS.Notifications.subscribe === 'function') {
          await OS.Notifications.subscribe();
        }

        // ID „nachlaufen“
        for (let i = 0; i < 10; i++) {
          const sid = await getSubscriptionId(OS);
          if (sid) {
            setSubscriptionId(sid);
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        setOptedIn(!!OS.User?.PushSubscription?.optedIn);
      } finally {
        setBusy(false);
      }
    });
  };

  const unsubscribe = () => {
    if (busy) return;
    setBusy(true);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OS) => {
      try {
        await OS.User.PushSubscription.optOut();
        setOptedIn(false);
        setSubscriptionId(null);
      } finally {
        setBusy(false);
      }
    });
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(subscriptionId || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  if (!sdkLoaded || supported === false) return null;

  return (
    <div className="w-full">
      {enabled ? (
        <button
          onClick={unsubscribe}
          disabled={busy}
          className="px-3 py-2 rounded-2xl bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60 w-full text-left"
          title="Benachrichtigungen deaktivieren"
        >
          🔔 Push-Aktiv
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={busy || permission === false}
          className="px-3 py-2 rounded-2xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60 w-full text-left"
          title={
            permission === false
              ? 'Benachrichtigungen im Browser blockiert'
              : 'Benachrichtigungen aktivieren'
          }
        >
          🔔 Push-Aktivieren
        </button>
      )}

      {/* Subscription-ID anzeigen */}
      <div className="mt-2 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
        <div className="font-semibold">Subscription-ID:</div>
        <div className="font-mono break-all select-all">
          {subscriptionId || '— keine ID —'}
        </div>
        <div className="mt-1">
          <button
            onClick={copyId}
            disabled={!subscriptionId}
            className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {copied ? '✓ Kopiert' : 'ID kopieren'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ⏳ Hilfs-Promise: auf controllerchange warten (mit Timeout) */
function waitForControllerChange(timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const onChange = () => {
      if (done) return;
      done = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    setTimeout(() => {
      if (done) return;
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      reject(new Error('controllerchange timeout'));
    }, timeoutMs);
  });
}

export default function Navbar({ name, isAdmin }) {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showHamburger, setShowHamburger] = useState(false);

  // 🔄 Update-Handling
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const swRegRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Profile/Stats Refs
  const profileRef = useRef();
  const statsRef = useRef();

  // 🔧 Fix „Navbar verschwindet beim Scrollen“: Header ist FIXED + Spacer
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(64);

  // ❗ Desktop-„Statistik“-Dropdown als FIXED element, an Button ausgerichtet
  const statsBtnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeaderH(el.offsetHeight || 64);
    });
    ro.observe(el);
    const onResize = () => setHeaderH(el.offsetHeight || 64);
    const onOrient = () => setHeaderH(el.offsetHeight || 64);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrient);
    setHeaderH(el.offsetHeight || 64);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrient);
    };
  }, []);

  // Position des Statistik-Dropdowns aktualisieren, wenn geöffnet / bei Scroll/Resize
  useEffect(() => {
    if (!openDropdown) return;
    const update = () => {
      const btn = statsBtnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setMenuPos({ left: r.left, top: r.bottom + 8 });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [openDropdown]);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode') === 'true';
    setDarkMode(stored);
    document.documentElement.classList.toggle('dark', stored);
  }, []);

  // Outside click (Profil + Statistik inkl. Dropdown)
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setShowMenu(false);
      const clickedStatsArea =
        statsRef.current && statsRef.current.contains(e.target);
      const clickedDropdown =
        dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!clickedStatsArea && !clickedDropdown) setOpenDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);
    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  // Body-Scroll sperren, wenn Mobile-Overlay offen
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
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

  /* 🔎 Service-Worker-Update-Flow */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let offControllerChange;

    const wireUp = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        swRegRef.current = reg;

        if (reg.waiting) setUpdateReady(true);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && reg.waiting) {
              setUpdateReady(true);
            }
          });
        });

        const onControllerChange = () => {
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          onControllerChange
        );
        offControllerChange = () =>
          navigator.serviceWorker.removeEventListener(
            'controllerchange',
            onControllerChange
          );

        const onVis = async () => {
          if (document.visibilityState === 'visible') await reg.update();
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
      } catch {
        /* noop */
      }
    };
    wireUp();
    return () => {
      if (offControllerChange) offControllerChange();
    };
  }, []);

  // 🚀 Sofort aktualisieren – robuster Dreistufenplan
  const applyUpdateNow = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      const reg =
        swRegRef.current || (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        window.location.reload();
        return;
      }

      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch (_) {}
        try {
          await waitForControllerChange(3000);
          return;
        } catch (_) {}
      }

      try {
        await reg.update();
        if (reg.waiting) {
          try {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          } catch (_) {}
          try {
            await waitForControllerChange(3000);
            return;
          } catch (_) {}
        }
      } catch (_) {}

      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.unregister()));
      } catch (_) {}
      try {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
      } catch (e) {}

      window.location.reload();
    } finally {
      setUpdating(false);
    }
  };

  const navItems = [
    { label: 'Wetter', path: '/' },
    { label: '+   🐠', path: '/new-catch' },
    { label: 'Fangliste', path: '/catches' },
    { label: 'Rangliste', path: '/leaderboard' },
    { label: 'Regeln', path: '/regeln' }, // ✅ neuer Menüpunkt
    {
      label: 'Statistik',
      children: [
        { label: 'Analyse', path: '/analysis' },
        { label: 'Top 10', path: '/top-fishes' },
        { label: 'Fun-Facts', path: '/fun' },
        { label: 'Prognose', path: '/forecast' },
        { label: 'Kalender', path: '/calendar' },
        { label: 'Karte', path: '/map' },
      ],
    },
    ...(isAdmin ? [{ label: '🔧 Admin', path: '/admin' }] : []),
  ];

  if (!user) return null;

  const displayName = (() => {
    const [first] = name.split(' ');
    const shortName = localStorage.getItem('shortAnglerName');
    return shortName || first;
  })();

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.path;
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
    <>
      {/* FIXED Navbar + Safe-Area; Overflow sichtbar damit Dropdowns nicht geclippt werden */}
      <header
        ref={headerRef}
        className="bg-white dark:bg-gray-900 shadow-md fixed top-0 left-0 right-0 z-[1200] text-black dark:text-white"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          overflow: 'visible',
        }}
      >
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
                  className="fixed inset-0 z-[1300] bg-white/95 dark:bg-gray-900/95 pt-20 overflow-hidden"
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
                        <div
                          key={item.label}
                          className="w-full max-w-sm relative"
                          ref={statsRef}
                        >
                          <button
                            onClick={() => setOpenDropdown((prev) => !prev)}
                            className="w-full px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                          >
                            {item.label} ▾
                          </button>

                          {openDropdown && (
                            <div className="mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 text-base max-h-[60vh] overflow-y-auto overscroll-contain">
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
                        ref={statsBtnRef}
                        onClick={() => setOpenDropdown((prev) => !prev)}
                        className="block px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                      >
                        {item.label} ▾
                      </button>

                      {openDropdown && (
                        <div
                          ref={dropdownRef}
                          className="fixed w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-[4000] text-base max-h-[60vh] overflow-y-auto overscroll-contain"
                          style={{ left: menuPos.left, top: menuPos.top }}
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
              onClick={() => setShowMenu((prev) => !prev)}
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

                {/* ⭐ Versionsangabe + Update-Button */}
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

                  {/* 🔄 Intelligenter Update-Button */}
                  {updateReady ? (
                    <button
                      onClick={applyUpdateNow}
                      disabled={updating}
                      className="mt-2 w-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 px-3 py-2 rounded disabled:opacity-60"
                      title="Neue Version verfügbar – jetzt anwenden"
                    >
                      {updating ? '⏳ Aktualisiere…' : '⤴️ App aktualisieren'}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          setUpdating(true);
                          const reg =
                            swRegRef.current ||
                            (await navigator.serviceWorker.getRegistration());
                          await reg?.update();
                          if (reg?.waiting) setUpdateReady(true);
                          else window.location.reload(); // Fallback: klassischer Reload
                        } catch {
                          window.location.reload();
                        } finally {
                          setUpdating(false);
                        }
                      }}
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
      </header>

      {/* Spacer reserviert Platz unter FIXED-Header (robust gegen Toolbar-Jitter) */}
      <div aria-hidden="true" style={{ height: headerH }} />
    </>
  );
}

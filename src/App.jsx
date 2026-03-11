// src/App.jsx
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';
import AppRoutes from '@/AppRoutes';
import { WeatherProvider } from '@/hooks/useWeatherCache';
import { useAppResumeSync, useAppResumeTick } from '@/hooks/useAppResumeSync';
import { getActiveClubId, rememberClubSlugId, setActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import { debugLog } from '@/utils/runtimeDebug';
import { shouldAutoInitOneSignalRuntime } from '@/onesignal/onesignalService';
import '@/index.css';

const PROFILE_CACHE_KEY = 'angelwetter_profile_cache_v2';
const UX_TEST_MODE_ENABLED = import.meta.env.VITE_UX_TEST_MODE === '1';
const PUSH_DISABLED = import.meta.env.VITE_DISABLE_PUSH === '1';
const SPLASH_HARD_TIMEOUT_MS = 12000;
const PushInit = lazy(() => import('@/components/PushInit'));
const AnalyticsInit = lazy(() => import('@/components/AnalyticsInit'));
const PageViewTracker = lazy(() => import('@/components/PageViewTracker'));
const SessionActivityPing = lazy(() => import('@/components/SessionActivityPing'));
const STATIC_PUBLIC_PATHS = new Set([
  '/auth',
  '/update-password',
  '/reset-done',
  '/auth-verified',
  '/forgot-password',
]);

function isClubAuthPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 2 && segments[1].toLowerCase() === 'auth';
}

function isPublicRoutePath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  if (STATIC_PUBLIC_PATHS.has(pathname)) return true;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) return true; // /:clubSlug
  return isClubAuthPath(pathname);
}

function isPushExcludedPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return STATIC_PUBLIC_PATHS.has(pathname) || isClubAuthPath(pathname);
}

function readProfileCache() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeProfileCache(cache) {
  if (typeof window === 'undefined') return;
  const payload = {
    userId: cache?.userId ?? null,
    name: cache?.name ?? null,
    shortName: cache?.shortName ?? null,
    role: cache?.role ?? null,
  };
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota issues */
  }

  if (payload.name) {
    window.localStorage.setItem('anglerName', payload.name);
  } else {
    window.localStorage.removeItem('anglerName');
  }

  if (payload.shortName) {
    window.localStorage.setItem('shortAnglerName', payload.shortName);
  } else {
    window.localStorage.removeItem('shortAnglerName');
  }

  window.dispatchEvent(new Event('angelwetter:storage-sync'));
}

function clearProfileCache() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROFILE_CACHE_KEY);
  window.localStorage.removeItem('anglerName');
  window.localStorage.removeItem('shortAnglerName');
  window.dispatchEvent(new Event('angelwetter:storage-sync'));
}

function scheduleLater(callback, delay = 400) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }
  const id = window.setTimeout(callback, delay);
  return () => window.clearTimeout(id);
}

function AppContent() {
  const { user, loading: authLoading, profile, profileLoading } = useAuth();
  const location = useLocation();
  const resumeTick = useAppResumeTick({ enabled: Boolean(user) });
  const [anglerName, setAnglerName] = useState(() => readProfileCache()?.name ?? null);
  const [profileRole, setProfileRole] = useState(() => readProfileCache()?.role ?? null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminLoading, setSuperAdminLoading] = useState(true);
  const [nameLoading, setNameLoading] = useState(() => {
    const cached = readProfileCache();
    return !(cached && cached.name);
  });
  const [imageLoaded, setImageLoaded] = useState(true);
  const [initialBootDone, setInitialBootDone] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [splashTimeoutDone, setSplashTimeoutDone] = useState(false);
  const splashDebugRef = useRef({
    authLoading: true,
    nameLoading: true,
    userState: 'unknown',
    superAdminLoading: true,
  });
  const isRecoveryHash = location.hash.includes('type=recovery');
  const isPasswordResetFlow = location.pathname === '/update-password' || isRecoveryHash;
  const isLoggedIn = Boolean(user) && !isPasswordResetFlow;
  const isPublicLightweightRoute = !isLoggedIn && isPublicRoutePath(location.pathname);

  // Splash kurz anzeigen
  useEffect(() => {
    const cancel = scheduleLater(() => setMinSplashDone(true), 350);
    return cancel;
  }, []);

  useEffect(() => {
    splashDebugRef.current = {
      authLoading,
      nameLoading,
      userState: user === undefined ? 'unknown' : user ? 'authenticated' : 'anonymous',
      superAdminLoading,
    };
  }, [authLoading, nameLoading, user, superAdminLoading]);

  // Fallback: Splash darf nicht unbegrenzt blockieren, wenn Auth/Profile in Dev hängen.
  useEffect(() => {
    if (initialBootDone) return undefined;
    const cancel = scheduleLater(() => {
      const snapshot = splashDebugRef.current;
      setSplashTimeoutDone(true);
      debugLog('app:splash-hard-timeout', {
        authLoading: snapshot.authLoading,
        nameLoading: snapshot.nameLoading,
        userState: snapshot.userState,
        superAdminLoading: snapshot.superAdminLoading,
        timeoutMs: SPLASH_HARD_TIMEOUT_MS,
      });
    }, SPLASH_HARD_TIMEOUT_MS);
    return cancel;
  }, [initialBootDone]);

  // Splash nur beim initialen Boot anzeigen, nicht bei späteren Resume-Syncs.
  useEffect(() => {
    if (initialBootDone) return;
    const bootReady =
      !authLoading &&
      !nameLoading &&
      user !== undefined &&
      minSplashDone &&
      (!user || !superAdminLoading);
    if (bootReady || splashTimeoutDone) {
      setInitialBootDone(true);
    }
  }, [
    authLoading,
    nameLoading,
    user,
    minSplashDone,
    superAdminLoading,
    initialBootDone,
    splashTimeoutDone,
  ]);

  // Profilname laden
  useEffect(() => {
    if (user === undefined) return;
    let isActive = true;
    let cancelShortNameCheck;

    if (user === null) {
      setAnglerName(null);
      setProfileRole(null);
      clearProfileCache();
      setNameLoading(false);
      return;
    }

    // Profil aus globalem Context bevorzugen
    const resolvedName = profile?.name || profile?.angler_name || null;
    if (!profileLoading && resolvedName) {
      const fullName = (resolvedName || '').trim();
      setAnglerName(fullName);
      const rawRole = profile?.role ? String(profile.role).trim() : null;
      setProfileRole(rawRole || null);

      const [first] = fullName.split(' ');
      const fallbackShort = first || 'Profil';
      writeProfileCache({ userId: user.id, name: fullName, shortName: fallbackShort, role: rawRole || null });

      if (first) {
        const clubId = getActiveClubId();
        cancelShortNameCheck = scheduleLater(async () => {
          try {
            if (!isActive) return;
            const { count } = await withTimeout(
              supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .ilike('name', `${first} %`)
                .eq('club_id', clubId),
              8000,
              'ShortName-Count timeout'
            );

            if (!isActive) return;
            const parts = fullName.split(' ');
            const last = parts[1] || '';
            const shortName =
              (count ?? 0) > 1 && last ? `${first} ${last[0]}.` : fallbackShort;
            writeProfileCache({ userId: user.id, name: fullName, shortName, role: rawRole || null });
          } catch (cntErr) {
            console.warn('⚠️ ShortName-Zählung fehlgeschlagen:', cntErr?.message);
          }
        }, 200);
      }

      setNameLoading(false);
      return () => {
        isActive = false;
        cancelShortNameCheck?.();
      };
    }

    const cached = readProfileCache();
    const hasValidCache = cached && cached.userId === user.id && cached.name;
    if (!hasValidCache) {
      setNameLoading(true);
      setAnglerName(null);
      setProfileRole(null);
    } else {
      setAnglerName(cached.name);
      setProfileRole(cached.role ?? null);
      setNameLoading(false);
    }

    if (!profileLoading) {
      setNameLoading(false);
    }

    return () => {
      isActive = false;
      cancelShortNameCheck?.();
    };
  }, [user, profile, profileLoading, resumeTick]);

  useEffect(() => {
    let active = true;

    if (user === undefined) {
      setSuperAdminLoading(true);
      return () => {
        active = false;
      };
    }

    if (!user) {
      setIsSuperAdmin(false);
      setSuperAdminLoading(false);
      return () => {
        active = false;
      };
    }

    setSuperAdminLoading(true);
    withTimeout(
      supabase.rpc('is_superadmin'),
      10000,
      'Superadmin-Status timeout'
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('⚠️ Superadmin-Status konnte nicht geladen werden:', error.message || error);
          setIsSuperAdmin(false);
          return;
        }
        setIsSuperAdmin(Boolean(data));
      })
      .catch((err) => {
        if (!active) return;
        console.warn('⚠️ Superadmin-Status-Request fehlgeschlagen:', err?.message || err);
        setIsSuperAdmin(false);
      })
      .finally(() => {
        if (active) setSuperAdminLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  // Club aus Profil in den aktiven Kontext übernehmen
  useEffect(() => {
    if (profile?.club_id) {
      setActiveClubId(profile.club_id);
      const slugFromPath = location.pathname.split('/').filter(Boolean)[0] || null;
      if (slugFromPath) {
        rememberClubSlugId(slugFromPath, profile.club_id);
      }
    }
  }, [profile, location.pathname]);

  const shouldShowSplash =
    !UX_TEST_MODE_ENABLED &&
    !isPublicLightweightRoute &&
    !initialBootDone;

  if (shouldShowSplash) {
    return (
      <>
        <div className="flex flex-col justify-center items-center h-screen bg-white relative">
          <img
            src="/logo.png"
            alt="Lade Angelwetter..."
            className={`w-32 h-32 mb-4 transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
          />
          <p className="text-blue-600 text-lg mb-4">Angelwetter wird geladen...</p>
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full"></div>
          </div>
        </div>
      </>
    );
  }

  const cachedRole = profileRole ? profileRole.toLowerCase() : null;
  const isAdmin = isSuperAdmin || cachedRole === 'admin';
  const canAccessBoard = isSuperAdmin || isAdmin || cachedRole === 'vorstand';
  const shouldTrackPageViews = isLoggedIn;
  const pageViewTracker = shouldTrackPageViews ? (
    <Suspense fallback={null}>
      <PageViewTracker
        enabled
        clubId={profile?.club_id || getActiveClubId()}
        anglerName={profile?.name || profile?.angler_name || anglerName || null}
      />
    </Suspense>
  ) : null;
  const routes = (
    <AppRoutes
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      canAccessBoard={canAccessBoard}
      isSuperAdmin={isSuperAdmin}
      anglerName={anglerName}
    />
  );

  return (
    <>
      {pageViewTracker}
      <Suspense fallback={<div className="p-6 text-center">⏳ Lädt...</div>}>
        {isPublicLightweightRoute ? routes : <WeatherProvider>{routes}</WeatherProvider>}
      </Suspense>
    </>
  );
}

function AppShell() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const isRecoveryHash = location.hash.includes('type=recovery');
  const isPasswordResetFlow = location.pathname === '/update-password' || isRecoveryHash;
  const isLoggedIn = Boolean(user) && !isPasswordResetFlow;
  const shouldInitProtectedRuntime =
    !UX_TEST_MODE_ENABLED &&
    isLoggedIn;
  const shouldInitPush =
    shouldInitProtectedRuntime &&
    !PUSH_DISABLED &&
    shouldAutoInitOneSignalRuntime() &&
    !isPushExcludedPath(location.pathname);
  const shouldInitAnalytics = shouldInitProtectedRuntime;
  const shouldPingUserActivity = shouldInitProtectedRuntime;
  useAppResumeSync({ enabled: shouldInitProtectedRuntime });

  useEffect(() => {
    debugLog('app:route-context', {
      path: location.pathname,
      hash: location.hash || null,
      userId: user?.id || null,
      profileClubId: profile?.club_id || null,
      activeClubId: getActiveClubId(),
      visibility: typeof document !== 'undefined' ? document.visibilityState : null,
    });
  }, [location.pathname, location.hash, user?.id, profile?.club_id]);

  return (
    <>
      {shouldPingUserActivity ? (
        <Suspense fallback={null}>
          <SessionActivityPing
            userId={user?.id || null}
            profileClubId={profile?.club_id || null}
            anglerName={user?.email || null}
          />
        </Suspense>
      ) : null}
      {shouldInitAnalytics ? (
        <Suspense fallback={null}>
          <AnalyticsInit />
        </Suspense>
      ) : null}
      {shouldInitPush ? (
        <Suspense fallback={null}>
          <PushInit />
        </Suspense>
      ) : null}
      <AppContent />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

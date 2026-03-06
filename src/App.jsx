// src/App.jsx
import { BrowserRouter as Router } from 'react-router-dom';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';
import PushInit from '@/components/PushInit';
import AppRoutes from '@/AppRoutes';
import { WeatherProvider } from '@/hooks/useWeatherCache';
import { getActiveClubId, setActiveClubId } from '@/utils/clubId';
import { usePageViewTracker } from '@/hooks/usePageViewTracker';
import '@/index.css';

const PROFILE_CACHE_KEY = 'angelwetter_profile_cache_v2';
const NULL_CLUB_ID = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UX_TEST_MODE_ENABLED = import.meta.env.VITE_UX_TEST_MODE === '1';

function isValidClubId(clubId) {
  return (
    typeof clubId === 'string' &&
    UUID_RE.test(clubId) &&
    clubId !== NULL_CLUB_ID
  );
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
}

function clearProfileCache() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROFILE_CACHE_KEY);
  window.localStorage.removeItem('anglerName');
  window.localStorage.removeItem('shortAnglerName');
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
  const [anglerName, setAnglerName] = useState(() => readProfileCache()?.name ?? null);
  const [profileRole, setProfileRole] = useState(() => readProfileCache()?.role ?? null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminLoading, setSuperAdminLoading] = useState(true);
  const [nameLoading, setNameLoading] = useState(() => {
    const cached = readProfileCache();
    return !(cached && cached.name);
  });
  const [imageLoaded, setImageLoaded] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [minSplashDone, setMinSplashDone] = useState(false);

  usePageViewTracker({
    enabled: Boolean(user),
    clubId: profile?.club_id || getActiveClubId(),
    anglerName: profile?.name || profile?.angler_name || anglerName || null,
  });

  // Splash kurz anzeigen
  useEffect(() => {
    const cancel = scheduleLater(() => setMinSplashDone(true), 350);
    return cancel;
  }, []);

  // Wenn alles bereit ist (Auth + Name + Mindestdauer), Splash ausblenden
  useEffect(() => {
    if (!showSplash) return;
    if (!authLoading && !nameLoading && user !== undefined && minSplashDone) {
      setShowSplash(false);
    }
  }, [authLoading, nameLoading, user, minSplashDone, showSplash]);

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
    }

    const loadProfile = async () => {
      try {
        const clubId = getActiveClubId();
        const { data, error } = await supabase
          .from('profiles')
          .select('name, role')
          .eq('id', user.id)
          .eq('club_id', clubId)
          .single();

        if (!isActive) return;

        if (error) {
          console.warn('⚠️ Profil konnte nicht geladen werden:', error?.message);
        }

        if (data?.name) {
          const fullName = (data.name || '').trim();
          setAnglerName(fullName);
          const rawRole = data?.role ? String(data.role).trim() : null;
          setProfileRole(rawRole || null);

          const [first, last] = fullName.split(' ');
          const fallbackShort = first || 'Profil';
          writeProfileCache({ userId: user.id, name: fullName, shortName: fallbackShort, role: rawRole || null });

          if (first) {
            cancelShortNameCheck = scheduleLater(async () => {
              try {
                if (!isActive) return;
                const { count } = await supabase
                  .from('profiles')
                  .select('id', { count: 'exact', head: true })
                  .ilike('name', `${first} %`)
                  .eq('club_id', clubId);

                if (!isActive) return;
                const shortName =
                  (count ?? 0) > 1 && last ? `${first} ${last[0]}.` : fallbackShort;
                writeProfileCache({ userId: user.id, name: fullName, shortName, role: rawRole || null });
              } catch (cntErr) {
                console.warn('⚠️ ShortName-Zählung fehlgeschlagen:', cntErr?.message);
              }
            }, 200);
          }
        } else {
          console.warn('⚠️ Kein Name im Profil gefunden.');
          setAnglerName(null);
          setProfileRole(null);
          clearProfileCache();
        }
      } finally {
        if (isActive) {
          setNameLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isActive = false;
      cancelShortNameCheck?.();
    };
  }, [user, profile, profileLoading]);

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
    supabase
      .rpc('is_superadmin')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('⚠️ Superadmin-Status konnte nicht geladen werden:', error.message || error);
          setIsSuperAdmin(false);
          return;
        }
        setIsSuperAdmin(Boolean(data));
      })
      .finally(() => {
        if (active) setSuperAdminLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  // Aktivität pingen
  useEffect(() => {
    if (!user) return;
    let disposed = false;

    const updateActivity = async () => {
      const profileClubId = profile?.club_id;
      const activeClubId = getActiveClubId();
      const clubId = profileClubId || activeClubId;

      if (!isValidClubId(clubId)) {
        console.warn('⚠️ user_activity übersprungen: ungültige club_id', {
          profileClubId,
          activeClubId,
        });
        return;
      }

      const payload = {
        user_id: user.id,
        angler_name: user.email,
        last_active: new Date().toISOString(),
        club_id: clubId,
      };

      try {
        let updateQuery = supabase
          .from('user_activity')
          .update({
            angler_name: payload.angler_name,
            last_active: payload.last_active,
          })
          .eq('user_id', user.id)
          .eq('club_id', clubId);

        const { data: updatedRows, error: updateError } = await updateQuery
          .select('user_id')
          .limit(1);

        if (updateError) throw updateError;
        if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
          const { error: insertError } = await supabase.from('user_activity').insert(payload);
          if (insertError) throw insertError;
        }
      } catch (err) {
        console.warn('⚠️ user_activity konnte nicht aktualisiert werden:', err?.message || err);
      }
    };

    const cancelInitial = scheduleLater(() => {
      if (!disposed) updateActivity();
    }, 500);
    const interval = setInterval(updateActivity, 3 * 60 * 1000);
    return () => {
      disposed = true;
      cancelInitial?.();
      clearInterval(interval);
    };
  }, [user, profile?.club_id]);

  // Club aus Profil in den aktiven Kontext übernehmen
  useEffect(() => {
    if (profile?.club_id) {
      setActiveClubId(profile.club_id);
    }
  }, [profile]);

  if (!UX_TEST_MODE_ENABLED && (authLoading || nameLoading || user === undefined || showSplash || (user && superAdminLoading))) {
    return (
      <>
        <div className="flex flex-col justify-center items-center h-screen bg-white relative">
          <img
            src="logo.png"
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

  const isRecoveryHash = window.location.hash.includes('type=recovery');
  const isPasswordResetFlow = window.location.pathname === '/update-password' || isRecoveryHash;

  const isLoggedIn = user && !isPasswordResetFlow;
  const cachedRole = profileRole ? profileRole.toLowerCase() : null;
  const isAdmin = isSuperAdmin || cachedRole === 'admin';
  const canAccessBoard = isSuperAdmin || isAdmin || cachedRole === 'vorstand';

  return (
    <>
      <Suspense fallback={<div className="p-6 text-center">⏳ Lädt...</div>}>
        <WeatherProvider>
          <AppRoutes
            isLoggedIn={isLoggedIn}
            isAdmin={isAdmin}
            canAccessBoard={canAccessBoard}
            isSuperAdmin={isSuperAdmin}
            anglerName={anglerName}
          />
        </WeatherProvider>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <Router>
      {/* UX-Testmodus soll ohne externe Push-Init laufen (stabilere CI-Audits). */}
      {!UX_TEST_MODE_ENABLED && <PushInit />}
      <AppContent />
    </Router>
  );
}

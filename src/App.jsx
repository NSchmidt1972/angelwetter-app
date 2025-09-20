// src/App.jsx
import { BrowserRouter as Router } from 'react-router-dom';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';
import PushInit from '@/components/PushInit';
import AppRoutes from '@/AppRoutes';
import '@/index.css';

const PROFILE_CACHE_KEY = 'angelwetter_profile_cache_v1';

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
  const { user, loading: authLoading } = useAuth();
  const [anglerName, setAnglerName] = useState(() => readProfileCache()?.name ?? null);
  const [userEmail, setUserEmail] = useState(null);
  const [nameLoading, setNameLoading] = useState(() => {
    const cached = readProfileCache();
    return !(cached && cached.name);
  });
  const [weatherData, setWeatherData] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [minSplashDone, setMinSplashDone] = useState(false);

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
      setUserEmail(null);
      clearProfileCache();
      setNameLoading(false);
      return;
    }

    setUserEmail(user.email);

    const cached = readProfileCache();
    const hasValidCache = cached && cached.userId === user.id && cached.name;
    if (!hasValidCache) {
      setNameLoading(true);
      setAnglerName(null);
    } else {
      setAnglerName(cached.name);
    }

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        if (!isActive) return;

        if (error) {
          console.warn('⚠️ Profil konnte nicht geladen werden:', error?.message);
        }

        if (data?.name) {
          const fullName = (data.name || '').trim();
          setAnglerName(fullName);

          const [first, last] = fullName.split(' ');
          const fallbackShort = first || 'Profil';
          writeProfileCache({ userId: user.id, name: fullName, shortName: fallbackShort });

          if (first) {
            cancelShortNameCheck = scheduleLater(async () => {
              try {
                if (!isActive) return;
                const { count } = await supabase
                  .from('profiles')
                  .select('id', { count: 'exact', head: true })
                  .ilike('name', `${first} %`);

                if (!isActive) return;
                const shortName =
                  (count ?? 0) > 1 && last ? `${first} ${last[0]}.` : fallbackShort;
                writeProfileCache({ userId: user.id, name: fullName, shortName });
              } catch (cntErr) {
                console.warn('⚠️ ShortName-Zählung fehlgeschlagen:', cntErr?.message);
              }
            }, 200);
          }
        } else {
          console.warn('⚠️ Kein Name im Profil gefunden.');
          setAnglerName(null);
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
  }, [user]);

  // Aktivität pingen
  useEffect(() => {
    if (!user) return;
    let disposed = false;

    const updateActivity = async () => {
      try {
        await supabase.from('user_activity').upsert(
          {
            user_id: user.id,
            angler_name: user.email,
            last_active: new Date().toISOString(),
          },
          { onConflict: 'user_id' } // vermeidet Duplikate
        );
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
  }, [user]);

  // Wetter aus Supabase Cache
  useEffect(() => {
    let cancelled = false;

    const fetchWeatherFromSupabase = async () => {
      const { data, error } = await supabase
        .from('weather_cache')
        .select('data, updated_at')
        .eq('id', 'latest')
        .single();

      if (error) {
        console.warn('⚠️ Wetter konnte nicht aus Supabase geladen werden:', error.message);
        return;
      }

      if (!cancelled) {
        setWeatherData({
          data: data.data,
          savedAt: new Date(data.updated_at).getTime(),
        });
      }
    };

    const cancelInitial = scheduleLater(() => {
      if (!cancelled) fetchWeatherFromSupabase();
    }, 400);
    const interval = setInterval(fetchWeatherFromSupabase, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      cancelInitial?.();
      clearInterval(interval);
    };
  }, []);

  if (authLoading || nameLoading || user === undefined || showSplash) {
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
  const isAdmin = userEmail === 'nicol@schmidt-2006.de';

  return (
    <>
      <Suspense fallback={<div className="p-6 text-center">⏳ Lädt...</div>}>
        <AppRoutes
          isLoggedIn={isLoggedIn}
          isAdmin={isAdmin}
          anglerName={anglerName}
          weatherData={weatherData}
          setWeatherData={setWeatherData}
        />
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <Router>
      {/* PushInit global genau 1× mounten */}
      <PushInit />
      <AppContent />
    </Router>
  );
}

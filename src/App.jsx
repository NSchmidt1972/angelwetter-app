// src/App.jsx
import { BrowserRouter as Router } from 'react-router-dom';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';
import PushInit from '@/components/PushInit';
import AppRoutes from '@/AppRoutes';
import '@/index.css';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [anglerName, setAnglerName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [nameLoading, setNameLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  // Splash kurz anzeigen
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Profilname laden
  useEffect(() => {
    if (user === undefined) return;

    if (user === null) {
      setAnglerName(null);
      setUserEmail(null);
      localStorage.removeItem('anglerName');
      localStorage.removeItem('shortAnglerName');
      setNameLoading(false);
      return;
    }

    (async () => {
      try {
        setNameLoading(true);
        setUserEmail(user.email);

        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('⚠️ Profil konnte nicht geladen werden:', error.message);
        }

        if (data?.name) {
          const fullName = (data.name || '').trim();
          setAnglerName(fullName);
          localStorage.setItem('anglerName', fullName);

          // Kurzname ermitteln (ohne alle Profile zu laden)
          const [first, last] = fullName.split(' ');
          try {
            const { count } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .ilike('name', `${first} %`);

            const shortName =
              (count ?? 0) > 1 && last ? `${first} ${last[0]}.` : first || 'Profil';

            localStorage.setItem('shortAnglerName', shortName);
          } catch (cntErr) {
            console.warn('⚠️ ShortName-Zählung fehlgeschlagen:', cntErr?.message);
            localStorage.setItem('shortAnglerName', first || 'Profil');
          }
        } else {
          console.warn('⚠️ Kein Name im Profil gefunden.');
          setAnglerName(null);
          localStorage.removeItem('anglerName');
          localStorage.removeItem('shortAnglerName');
        }
      } finally {
        setNameLoading(false);
      }
    })();
  }, [user]);

  // Aktivität pingen
  useEffect(() => {
    if (!user) return;

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

    updateActivity();
    const interval = setInterval(updateActivity, 3 * 60 * 1000);
    return () => clearInterval(interval);
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

    fetchWeatherFromSupabase();
    const interval = setInterval(fetchWeatherFromSupabase, 5 * 60 * 1000);
    return () => {
      cancelled = true;
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

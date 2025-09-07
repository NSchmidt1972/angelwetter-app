// src/App.jsx
import { BrowserRouter as Router } from 'react-router-dom';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import PushInit from './components/PushInit';
import AppRoutes from './AppRoutes';
import AchievementLayer from './achievements/AchievementLayer'; // ✅ NEU
import './index.css';

function AppContentInner({ showEffect }) {
  const { user, loading: authLoading } = useAuth();
  const [anglerName, setAnglerName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [nameLoading, setNameLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  // ⏳ Splash (optional: 1000ms statt 3000ms)
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // 👤 Profilname laden + Kurzname in localStorage
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

    setNameLoading(true);
    setUserEmail(user.email);

    supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
      .then(async ({ data, error }) => {
        if (data?.name) {
          const fullName = data.name.trim();
          setAnglerName(fullName);
          localStorage.setItem('anglerName', fullName);

          const [first, last] = fullName.split(' ');
          const { data: allProfiles } = await supabase.from('profiles').select('name');
          const firstNameCount = (allProfiles || []).filter(p => p.name?.startsWith(first + ' ')).length;
          const shortName = firstNameCount > 1 && last ? `${first} ${last[0]}.` : first;
          localStorage.setItem('shortAnglerName', shortName);
        } else {
          console.warn('⚠️ Kein Name im Profil gefunden oder Fehler:', error);
          setAnglerName(null);
          localStorage.removeItem('anglerName');
          localStorage.removeItem('shortAnglerName');
        }
        setNameLoading(false);
      });
  }, [user]);

  // 🟢 Aktivität pingen
  useEffect(() => {
    if (!user) return;
    const updateActivity = async () => {
      try {
        await supabase.from('user_activity').upsert({
          user_id: user.id,
          angler_name: user.email,
          last_active: new Date().toISOString()
        });
      } catch (err) {
        console.warn('⚠️ user_activity konnte nicht aktualisiert werden:', err.message);
      }
    };
    updateActivity();
    const interval = setInterval(updateActivity, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ☁️ Wetter aus Supabase Cache
  useEffect(() => {
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

      setWeatherData({
        data: data.data,
        savedAt: new Date(data.updated_at).getTime()
      });
    };

    fetchWeatherFromSupabase();
    const interval = setInterval(fetchWeatherFromSupabase, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Ladezustände + Splash
  if (authLoading || nameLoading || user === undefined || showSplash) {
    return (
      <>
        <PushInit /> {/* ✅ OneSignal früh hochziehen, auch während Splash */}
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

  // Recovery-Flow
  const isRecoveryHash = window.location.hash.includes('type=recovery');
  const isPasswordResetFlow = window.location.pathname === '/update-password' || isRecoveryHash;

  const isLoggedIn = user && !isPasswordResetFlow;
  const isAdmin = userEmail === 'nicol@schmidt-2006.de';

  return (
    <>
      <PushInit />
      <Suspense fallback={<div className="p-6 text-center">⏳ Lädt...</div>}>
        <AppRoutes
          isLoggedIn={isLoggedIn}
          isAdmin={isAdmin}
          anglerName={anglerName}
          weatherData={weatherData}
          setWeatherData={setWeatherData}
          showEffect={showEffect}          // ✅ NEU: weiterreichen
        />
      </Suspense>
    </>
  );
}

function AppContent() {
  // ⬅️ Hier wird der Layer einmal ganz oben eingeclipst.
  return (
    <AchievementLayer>
      {(showEffect) => <AppContentInner showEffect={showEffect} />}
    </AchievementLayer>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

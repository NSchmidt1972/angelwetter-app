import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, Suspense, lazy } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import PushInit from './components/PushInit';
import Navbar from './components/Navbar';
import MapView from './pages/MapView';

import './index.css';

// Lazy-loaded Seiten und Komponenten
const Home = lazy(() => import('./pages/Home'));
const Catches = lazy(() => import('./pages/Catches'));
const NewCatch = lazy(() => import('./pages/NewCatch'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const TopFishes = lazy(() => import('./pages/TopFishes'));
const Forecast = lazy(() => import('./pages/Forecast'));
const AdminOverview = lazy(() => import('./pages/AdminOverview'));
const Calendar = lazy(() => import('./pages/Calendar'));
const AuthForm = lazy(() => import('./components/AuthForm'));

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [anglerName, setAnglerName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [nameLoading, setNameLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

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
      .then(({ data, error }) => {
        if (data?.name) {
          const fullName = data.name.trim();
          setAnglerName(fullName);
          localStorage.setItem('anglerName', fullName);

          const [first, last] = fullName.split(' ');
          supabase
            .from('profiles')
            .select('name')
            .then(({ data: allProfiles }) => {
              const firstNameCount = allProfiles.filter(p => p.name.startsWith(first + ' ')).length;
              const shortName = firstNameCount > 1 && last ? `${first} ${last[0]}.` : first;
              localStorage.setItem('shortAnglerName', shortName);
            });
        } else {
          console.warn('⚠️ Kein Name im Profil gefunden oder Fehler:', error);
          setAnglerName(null);
          localStorage.removeItem('anglerName');
          localStorage.removeItem('shortAnglerName');
        }
        setNameLoading(false);
      });
  }, [user]);

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

  useEffect(() => {
    const fetchWeatherFromSupabase = async () => {
      const { data, error } = await supabase
        .from('weather_cache')
        .select('data, updated_at')
        .eq('id', 'latest')
        .single();

      if (error) {
        console.warn("⚠️ Wetter konnte nicht aus Supabase geladen werden:", error.message);
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

  if (authLoading || nameLoading || user === undefined || showSplash) {
    return (
      <>
        <PushInit />
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

  const isLoggedIn = user && anglerName;
  const isAdmin = userEmail === 'nicol@schmidt-2006.de';

  return (
    <>
      <PushInit />
      {isLoggedIn ? (
        <>
          <Navbar name={anglerName} isAdmin={isAdmin} />
          <Suspense fallback={<div className="p-6 text-center">⏳ Lädt...</div>}>
            <Routes>
              <Route path="/" element={<Home weatherData={weatherData} />} />
              <Route path="/new-catch" element={<NewCatch anglerName={anglerName} weatherData={weatherData} setWeatherData={setWeatherData} />} />
              <Route path="/catches" element={<Catches name={anglerName} />} />
              <Route path="/analysis" element={<Analysis anglerName={anglerName} />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/top-fishes" element={<TopFishes />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/forecast" element={<Forecast weatherData={weatherData} />} />
              <Route path="/admin" element={isAdmin ? <AdminOverview /> : <div className="p-6 text-center text-red-600">🚫 Kein Zugriff – Adminbereich</div>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </>
      ) : (
        <Suspense fallback={<div className="p-6 text-center">🔐 Anmeldung wird geladen...</div>}>
          <Routes>
            <Route path="*" element={<AuthForm />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <Router basename="/">
      <AppContent />
    </Router>
  );
}

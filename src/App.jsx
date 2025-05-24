// ✅ App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { fetchWeather } from './api/weather';

import Home from './pages/Home';
import Catches from './pages/Catches';
import NewCatch from './pages/NewCatch';
import Analysis from './pages/Analysis';
import Leaderboard from './pages/Leaderboard';
import Forecast from './pages/Forecast';
import Navbar from './components/Navbar';
import AuthForm from './components/AuthForm';

import './index.css';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [anglerName, setAnglerName] = useState(null);
  const [nameLoading, setNameLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (imageLoaded) {
      const timer = setTimeout(() => setShowSplash(false), 3000); // Logo bleibt 3 Sekunden sichtbar
      return () => clearTimeout(timer);
    }
  }, [imageLoaded]);

  useEffect(() => {
    if (user === undefined) return;

    if (user === null) {
      setAnglerName(null);
      setNameLoading(false);
      return;
    }

    setNameLoading(true);
    supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (data?.name) {
          setAnglerName(data.name);
        } else {
          console.warn('⚠️ Kein Name im Profil gefunden oder Fehler:', error);
          setAnglerName(null);
        }
        setNameLoading(false);
      });
  }, [user]);

  useEffect(() => {
    fetchWeather()
      .then(setWeatherData)
      .catch(err => {
        console.warn("⚠️ Wetter konnte nicht geladen werden:", err.message);
      });
  }, []);

  if (authLoading || nameLoading || user === undefined || showSplash) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white animate-fadeIn">
        <img
          src={`${import.meta.env.BASE_URL}icons/logo.png`}
          alt="Lade Angelwetter..."
          className="w-32 h-32 mb-4 animate-pulse"
          onLoad={() => setImageLoaded(true)}
        />
        <p className="text-blue-600 text-lg">Angelwetter wird geladen...</p>
      </div>
    );
  }

  const isLoggedIn = user && anglerName;

  return isLoggedIn ? (
    <>
      <Navbar name={anglerName} />
      <Routes>
        <Route path="/" element={<Home weatherData={weatherData} />} />
        <Route path="/new-catch" element={<NewCatch anglerName={anglerName} weatherData={weatherData} setWeatherData={setWeatherData} />} />
        <Route path="/catches" element={<Catches name={anglerName} />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/forecast" element={<Forecast weatherData={weatherData} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  ) : (
    <Routes>
      <Route path="*" element={<AuthForm />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router basename="/angelwetter-app">
      <AppContent />
    </Router>
  );
}

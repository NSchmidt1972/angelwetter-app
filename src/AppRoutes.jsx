// src/AppRoutes.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import UpdatePassword from './pages/UpdatePassword';
import ResetDone from './pages/ResetDone';
import AuthVerified from './pages/AuthVerified';
import ForgotPassword from './pages/ForgotPassword';
import { lazy } from 'react';

// 🔐 Sicherer Lazy-Helper (Fallback-Komponente falls Modul fehlt)
function safeLazy(importer, FallbackName) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (e) {
      console.warn(`⚠️ Konnte ${FallbackName} nicht laden:`, e);
      return {
        default: () => (
          <div className="p-6 text-center text-red-600">
            {FallbackName} ist (noch) nicht verfügbar.
          </div>
        ),
      };
    }
  });
}

// Pages, die weiterhin existieren
const Home = lazy(() => import('./pages/Home'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const TopFishes = lazy(() => import('./pages/TopFishes'));
const Forecast = lazy(() => import('./pages/Forecast'));
const AdminOverview = lazy(() => import('./pages/AdminOverview'));
const Calendar = lazy(() => import('./pages/Calendar'));
const AuthForm = lazy(() => import('./components/AuthForm'));
const MapView = lazy(() => import('./pages/MapView'));
const Regulations = lazy(() => import('./pages/Regulations'));

// ⚠️ Optional/experimentell
const SpotAdmin = safeLazy(() => import('./components/SpotAdmin'), 'SpotAdmin');
const SettingsPage = safeLazy(() => import('./pages/SettingsPage'), 'SettingsPage');
const FunFacts = safeLazy(() => import('./pages/FunFacts'), 'FunFacts');

// ✅ Direkt die neuen Komponenten laden (statt pages/Catches & pages/NewCatch)
const CatchList = lazy(() => import('./components/catchlist/CatchList'));
const FishCatchForm = lazy(() => import('./components/FishCatchForm'));

export default function AppRoutes({
  isLoggedIn,
  isAdmin,
  anglerName,
  weatherData,
  setWeatherData,
  showEffect,
}) {
  const isRecoveryLink = window.location.hash.includes('type=recovery');

  return (
    <Routes>
      {/* Öffentliche Routen */}
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/reset-done" element={<ResetDone />} />
      <Route path="/auth-verified" element={<AuthVerified />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {isLoggedIn ? (
        <>
          <Route
            path="/"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <Home weatherData={weatherData} />
              </>
            }
          />

          {/* ✅ Neuer Fang (direkt die Form) */}
          <Route
            path="/new-catch"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <FishCatchForm
                  anglerName={anglerName}
                  weatherData={weatherData}
                  setWeatherData={setWeatherData}
                  showEffect={showEffect}
                />
              </>
            }
          />

          {/* ✅ Fangliste (direkt CatchList) */}
          <Route
            path="/catches"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <CatchList anglerName={anglerName} />
              </>
            }
          />

          <Route
            path="/analysis"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <Analysis anglerName={anglerName} />
              </>
            }
          />

          <Route
            path="/leaderboard"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <Leaderboard />
              </>
            }
          />

          <Route
            path="/top-fishes"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <TopFishes />
              </>
            }
          />

          <Route
            path="/calendar"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <Calendar />
              </>
            }
          />

          <Route
            path="/map"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <MapView />
              </>
            }
          />

          <Route
            path="/forecast"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <Forecast weatherData={weatherData} />
              </>
            }
          />

          {/* Regeln */}
          <Route
            path="/regeln"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <Regulations />
              </>
            }
          />

          {/* Optionale Seiten via safeLazy */}
          <Route
            path="/fun"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <FunFacts />
              </>
            }
          />

          <Route
            path="/admin"
            element={
              isAdmin ? (
                <>
                  <Navbar name={anglerName} isAdmin={isAdmin} />
                  <AdminOverview />
                </>
              ) : (
                <div className="p-6 text-center text-red-600">
                  🚫 Kein Zugriff – Adminbereich
                </div>
              )
            }
          />

          <Route
            path="/spots"
            element={
              isAdmin ? (
                <>
                  <Navbar name={anglerName} isAdmin={isAdmin} />
                  <SpotAdmin />
                </>
              ) : (
                <div className="p-6 text-center text-red-600">
                  🚫 Kein Zugriff – Nur für Admins
                </div>
              )
            }
          />

          <Route
            path="/settings"
            element={
              <>
                <Navbar name={anglerName} isAdmin={isAdmin} />
                <SettingsPage />
              </>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <>
          <Route path="/auth" element={<AuthForm />} />
          <Route
            path="*"
            element={
              isRecoveryLink ? (
                <Navigate to="/update-password" />
              ) : (
                <Navigate to="/auth" />
              )
            }
          />
        </>
      )}
    </Routes>
  );
}

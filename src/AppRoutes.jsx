import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import MapView from './pages/MapView';
import UpdatePassword from './pages/UpdatePassword';
import ResetDone from './pages/ResetDone';
import AuthVerified from './pages/AuthVerified';
import ForgotPassword from './pages/ForgotPassword';

import { lazy } from 'react';

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
const SpotAdmin = lazy(() => import('./components/SpotAdmin')); // ✅ NEU
const SettingsPage = lazy(() => import('./pages/SettingsPage')); // ✅ SETTINGS

export default function AppRoutes({ isLoggedIn, isAdmin, anglerName, weatherData, setWeatherData }) {
  const isRecoveryLink = window.location.hash.includes('type=recovery');

  return (
    <Routes>
      {/* Immer erreichbare Seiten */}
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/reset-done" element={<ResetDone />} />
      <Route path="/auth-verified" element={<AuthVerified />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {isLoggedIn ? (
        <>
          <Route path="/" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><Home weatherData={weatherData} /></>} />
          <Route path="/new-catch" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><NewCatch anglerName={anglerName} weatherData={weatherData} setWeatherData={setWeatherData} /></>} />
          <Route path="/catches" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><Catches name={anglerName} /></>} />
          <Route path="/analysis" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><Analysis anglerName={anglerName} /></>} />
          <Route path="/leaderboard" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><Leaderboard /></>} />
          <Route path="/top-fishes" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><TopFishes /></>} />
          <Route path="/calendar" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><Calendar /></>} />
          <Route path="/map" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><MapView /></>} />
          <Route path="/forecast" element={<><Navbar name={anglerName} isAdmin={isAdmin} /><Forecast weatherData={weatherData} /></>} />

          <Route path="/admin" element={
            isAdmin
              ? <><Navbar name={anglerName} isAdmin={isAdmin} /><AdminOverview /></>
              : <div className="p-6 text-center text-red-600">🚫 Kein Zugriff – Adminbereich</div>
          } />

          <Route path="/spots" element={
            isAdmin
              ? <><Navbar name={anglerName} isAdmin={isAdmin} /><SpotAdmin /></>
              : <div className="p-6 text-center text-red-600">🚫 Kein Zugriff – Nur für Admins</div>
          } />

          <Route path="/settings" element={
            <><Navbar name={anglerName} isAdmin={isAdmin} /><SettingsPage /></>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <>
          <Route path="/auth" element={<AuthForm />} />
          <Route path="*" element={
            isRecoveryLink
              ? <Navigate to="/update-password" />
              : <Navigate to="/auth" />
          } />
        </>
      )}
    </Routes>
  );
}

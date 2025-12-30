// src/AppRoutes.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import AppLayout from '@/AppLayout';
import AdminLayout from '@/AdminLayout';

// 🔐 Sicherer Lazy-Helper
function safeLazy(importer, FallbackName) {
  return lazy(async () => {
    try { return await importer(); }
    catch (e) {
      console.warn(`⚠️ Konnte ${FallbackName} nicht laden:`, e);
      return { default: () => (
        <div className="p-6 text-center text-red-600">
          {FallbackName} ist (noch) nicht verfügbar.
        </div>
      )};
    }
  });
}

// Public/Static
const UpdatePassword = lazy(() => import('@/pages/UpdatePassword'));
const ResetDone      = lazy(() => import('@/pages/ResetDone'));
const AuthVerified   = lazy(() => import('@/pages/AuthVerified'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const AuthForm       = lazy(() => import('@/components/AuthForm'));

// App Pages
const Home          = lazy(() => import('@/pages/Home'));
const Analysis      = lazy(() => import('@/pages/Analysis'));
const Leaderboard   = lazy(() => import('@/pages/Leaderboard'));
const TopFishes     = lazy(() => import('@/pages/TopFishes'));
const Forecast      = lazy(() => import('@/pages/Forecast'));
const CrayfishForm  = lazy(() => import('@/pages/CrayfishForm'));
const AdminOverview      = lazy(() => import('@/pages/AdminOverview'));
const AdminMembers       = lazy(() => import('@/pages/Admin'));
const AdminMembersManage = lazy(() => import('@/pages/AdminMembersManage'));
const AdminVereinManage  = lazy(() => import('@/pages/AdminVereinManage'));
const Calendar      = lazy(() => import('@/pages/Calendar'));
const MapView       = lazy(() => import('@/pages/MapView'));
const Regulations   = lazy(() => import('@/pages/Regulations'));
const BoardOverview = lazy(() => import('@/pages/BoardOverview'));
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage'));
const SuperAdmin    = safeLazy(() => import('@/pages/SuperAdmin'), 'SuperAdmin');

// Optional
const SettingsPage  = safeLazy(() => import('@/pages/SettingsPage'), 'SettingsPage');
const FunFacts      = safeLazy(() => import('@/pages/FunFacts'), 'FunFacts');

// Neue Komponenten
const CatchList     = lazy(() => import('@/components/catchlist/CatchList'));
const FishCatchForm = lazy(() => import('@/components/FishCatchForm'));

function RequireManagement({ canAccessBoard, children }) {
  if (!canAccessBoard) {
    return <div className="p-6 text-center text-red-600">🚫 Kein Zugriff – Nur für Vorstand/Admin</div>;
  }
  return children;
}

function RequireSuperAdmin({ isSuperAdmin, children }) {
  if (!isSuperAdmin) {
    return <div className="p-6 text-center text-red-600">🚫 Kein Zugriff – Nur für Superadmins</div>;
  }
  return children;
}

export default function AppRoutes({
  isLoggedIn,
  isAdmin,
  canAccessBoard,
  isSuperAdmin,
  anglerName,
}) {
  const isRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

  return (
    <Routes>
      {/* Öffentliche Routen */}
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/reset-done"      element={<ResetDone />} />
      <Route path="/auth-verified"   element={<AuthVerified />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {isLoggedIn ? (
        // Eingeloggt
        <>
          {/* Admin-Bereich mit eigenem Layout */}
          <Route element={<AdminLayout />}>
            <Route path="admin" element={<AdminMembers />} />
            <Route path="admin/members" element={<AdminMembersManage />} />
            <Route path="admin/verein" element={<AdminVereinManage />} />
          </Route>

          {/* App-Bereich mit Standard-Navigation */}
          <Route element={<AppLayout name={anglerName} isAdmin={isAdmin} canAccessBoard={canAccessBoard} />}>
            <Route index element={<Home />} />

            <Route
              path="new-catch"
              element={
                <FishCatchForm
                  anglerName={anglerName}
                />
              }
            />
            <Route
              path="crayfish"
              element={<CrayfishForm anglerName={anglerName} />}
            />
            <Route path="catches"      element={<CatchList anglerName={anglerName} />} />
            <Route path="analysis"     element={<Analysis anglerName={anglerName} />} />
            <Route path="leaderboard"  element={<Leaderboard />} />
            <Route path="top-fishes"   element={<TopFishes />} />
            <Route path="calendar"     element={<Calendar />} />
            <Route path="map"          element={<MapView />} />
            <Route path="forecast"     element={<Forecast />} />
            <Route path="regeln"       element={<Regulations />} />
            <Route path="downloads"    element={<DownloadsPage />} />
            <Route path="fun"          element={<FunFacts />} />
            <Route
              path="vorstand"
              element={
                <RequireManagement canAccessBoard={canAccessBoard}>
                  <BoardOverview />
                </RequireManagement>
              }
            />
            <Route
              path="admin2"
              element={
                <RequireManagement canAccessBoard={canAccessBoard}>
                  <AdminOverview isAdmin={isAdmin} canAccessBoard={canAccessBoard} />
                </RequireManagement>
              }
            />
            <Route
              path="superadmin"
              element={
                <RequireSuperAdmin isSuperAdmin={isSuperAdmin}>
                  <SuperAdmin />
                </RequireSuperAdmin>
              }
            />
            <Route path="settings" element={<SettingsPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </>
      ) : (
        // Nicht eingeloggt
        <>
          <Route path="/auth" element={<AuthForm />} />
          <Route
            path="*"
            element={isRecoveryLink ? <Navigate to="/update-password" replace /> : <Navigate to="/auth" replace />}
          />
        </>
      )}
    </Routes>
  );
}

// src/AppRoutes.jsx
import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { lazy, useEffect, useState } from 'react';
import AppLayout from '@/AppLayout';
import AdminLayout from '@/AdminLayout';
import { supabase } from '@/supabaseClient';
import { setActiveClubId } from '@/utils/clubId';

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
const UX_TEST_MODE_ENABLED = import.meta.env.VITE_UX_TEST_MODE === '1';

function ClubNotFound() {
  return <div className="p-6 text-center text-red-600">Club not found</div>;
}

function PageNotFound() {
  return <div className="p-6 text-center">Seite nicht gefunden</div>;
}

function NotLoggedRedirect() {
  const { clubSlug } = useParams();
  const target = clubSlug ? `/${clubSlug}/auth` : '/auth';
  return <Navigate to={target} replace />;
}

function ClubGuard() {
  const { clubSlug } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ok | notfound

  useEffect(() => {
    let active = true;
    const isValid = typeof clubSlug === 'string' && /^[a-z0-9-]+$/i.test(clubSlug);
    if (!isValid) {
      setStatus('notfound');
      return () => { active = false; };
    }

    setStatus('loading');
    supabase
      .from('clubs')
      .select('id, slug')
      .eq('slug', clubSlug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('⚠️ Club-Check fehlgeschlagen:', error?.message || error);
          // Wenn Policies den Zugriff verweigern (z. B. 406), trotzdem weiter rendern
          if (error.status === 406 || error.status === 403) {
            setStatus('ok');
            return;
          }
          setStatus('notfound');
          return;
        }
        if (data?.id) {
          setActiveClubId(data.id);
          setStatus('ok');
        } else {
          setStatus('notfound');
        }
      });

    return () => { active = false; };
  }, [clubSlug]);

  if (status === 'loading') {
    return <div className="p-6 text-center">Lädt Verein...</div>;
  }
  if (status === 'notfound') return <ClubNotFound />;
  return <Outlet />;
}

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
      {UX_TEST_MODE_ENABLED && (
        <Route path="/__ux/fish-form" element={<FishCatchForm anglerName="UX Test" />} />
      )}
      <Route path="/" element={<Navigate to="/asv-rotauge" replace />} />

      {/* Öffentliche Routen */}
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/reset-done"      element={<ResetDone />} />
      <Route path="/auth-verified"   element={<AuthVerified />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/:clubSlug/*" element={<ClubGuard />}>
        {isLoggedIn ? (
          // Eingeloggt
          <>
            {/* Admin-Bereich mit eigenem Layout */}
            <Route
              element={
                <RequireManagement canAccessBoard={canAccessBoard}>
                  <AdminLayout />
                </RequireManagement>
              }
            >
              <Route path="admin" element={<AdminMembers />} />
              <Route path="admin/members" element={<AdminMembersManage />} />
              <Route path="admin/verein" element={<AdminVereinManage />} />
            </Route>

            {/* App-Bereich mit Standard-Navigation */}
            <Route element={<AppLayout name={anglerName} isAdmin={isAdmin} canAccessBoard={canAccessBoard} />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Home />} />

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
              <Route path="statistik"    element={<Analysis anglerName={anglerName} />} />
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
              <Route path="*" element={<PageNotFound />} />
            </Route>
          </>
        ) : (
          // Nicht eingeloggt
          <>
            <Route index element={<AuthForm />} />
            <Route path="auth" element={<AuthForm />} />
            <Route path="*" element={isRecoveryLink ? <Navigate to="/update-password" replace /> : <NotLoggedRedirect />} />
          </>
        )}
      </Route>

      <Route path="*" element={<ClubNotFound />} />
    </Routes>
  );
}

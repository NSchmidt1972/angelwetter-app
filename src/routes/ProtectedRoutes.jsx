import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { lazy, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getClubIdForSlug, rememberClubSlugId, setActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import { debugLog } from '@/utils/runtimeDebug';

function safeLazy(importer, fallbackName) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      console.warn(`⚠️ Konnte ${fallbackName} nicht laden:`, error);
      return {
        default: () => (
          <div className="p-6 text-center text-red-600">
            {fallbackName} ist (noch) nicht verfügbar.
          </div>
        ),
      };
    }
  });
}

const AppLayout = lazy(() => import('@/AppLayout'));
const AdminLayout = lazy(() => import('@/AdminLayout'));
const UpdatePassword = lazy(() => import('@/pages/UpdatePassword'));
const ResetDone = lazy(() => import('@/pages/ResetDone'));
const AuthVerified = lazy(() => import('@/pages/AuthVerified'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));

const Home = lazy(() => import('@/pages/Home'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const TopFishes = lazy(() => import('@/pages/TopFishes'));
const Forecast = lazy(() => import('@/pages/Forecast'));
const CrayfishForm = lazy(() => import('@/pages/CrayfishForm'));
const AdminOverview = lazy(() => import('@/pages/AdminOverview'));
const AdminMembers = lazy(() => import('@/pages/Admin'));
const AdminMembersManage = lazy(() => import('@/pages/AdminMembersManage'));
const AdminVereinManage = lazy(() => import('@/pages/AdminVereinManage'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const MapView = lazy(() => import('@/pages/MapView'));
const Regulations = lazy(() => import('@/pages/Regulations'));
const BoardOverview = lazy(() => import('@/pages/BoardOverview'));
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage'));
const SuperAdmin = safeLazy(() => import('@/pages/SuperAdmin'), 'SuperAdmin');

const SettingsPage = safeLazy(() => import('@/pages/SettingsPage'), 'SettingsPage');
const FunFacts = safeLazy(() => import('@/pages/FunFacts'), 'FunFacts');

const CatchList = lazy(() => import('@/components/catchlist/CatchList'));
const FishCatchForm = lazy(() => import('@/components/FishCatchForm'));
const UX_TEST_MODE_ENABLED = import.meta.env.VITE_UX_TEST_MODE === '1';

function ClubNotFound() {
  return <div className="p-6 text-center text-red-600">Club not found</div>;
}

function PageNotFound() {
  return <div className="p-6 text-center">Seite nicht gefunden</div>;
}

function LoggedInClubAuthRedirect() {
  const { clubSlug } = useParams();
  return <Navigate to={`/${clubSlug}/dashboard`} replace />;
}

function ClubGuard() {
  const { clubSlug } = useParams();
  const [status, setStatus] = useState('loading');

  const resolveLocalClubFallback = useCallback(() => {
    const bySlug = getClubIdForSlug(clubSlug);
    if (bySlug) return bySlug;
    if ((clubSlug || '').toLowerCase() === 'asv-rotauge') {
      return getClubIdForSlug('asv-rotauge');
    }
    return null;
  }, [clubSlug]);

  useEffect(() => {
    let active = true;
    let fallbackTimerId = null;
    const isValid = typeof clubSlug === 'string' && /^[a-z0-9-]+$/i.test(clubSlug);
    if (!isValid) {
      setStatus('notfound');
      return () => {
        active = false;
      };
    }

    setStatus('loading');
    const cachedClubId = resolveLocalClubFallback();
    if (cachedClubId) {
      setActiveClubId(cachedClubId);
    }
    debugLog('clubguard:start', {
      clubSlug,
      cachedClubId: cachedClubId || null,
    });

    if (typeof window !== 'undefined') {
      fallbackTimerId = window.setTimeout(() => {
        if (!active) return;
        const fallbackClubId = resolveLocalClubFallback();
        if (fallbackClubId) {
          setActiveClubId(fallbackClubId);
          debugLog('clubguard:timeout-fallback-ok', { clubSlug, clubId: fallbackClubId });
          console.warn('⚠️ Club-Check Timeout-Fallback aktiv, Route wird mit lokalem Club-Kontext freigegeben.');
          setStatus('ok');
          return;
        }
        debugLog('clubguard:timeout-fallback-miss', { clubSlug });
        console.warn('⚠️ Club-Check Timeout ohne Club-Kontext, Route wird nicht freigegeben.');
        setStatus('notfound');
      }, 12000);
    }

    const runClubCheck = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('clubs')
            .select('id, slug')
            .eq('slug', clubSlug)
            .maybeSingle(),
          8000,
          'Club-Check timeout'
        );

        if (!active) return;
        if (error) {
          console.warn('⚠️ Club-Check fehlgeschlagen:', error?.message || error);
          debugLog('clubguard:check-error', {
            clubSlug,
            status: error?.status || null,
            message: error?.message || String(error || ''),
          });
          if (error.status === 406 || error.status === 403 || error.status >= 500) {
            const fallbackClubId = resolveLocalClubFallback();
            if (!fallbackClubId) {
              debugLog('clubguard:fallback-unavailable', { clubSlug });
              setStatus('notfound');
              return;
            }
            setActiveClubId(fallbackClubId);
            debugLog('clubguard:fallback-ok-after-error', { clubSlug, clubId: fallbackClubId });
            setStatus('ok');
            return;
          }
          setStatus('notfound');
          return;
        }

        if (data?.id) {
          setActiveClubId(data.id);
          rememberClubSlugId(clubSlug, data.id);
          debugLog('clubguard:check-ok', {
            clubSlug,
            clubId: data.id,
            slugFromDb: data.slug || null,
          });
          setStatus('ok');
        } else {
          debugLog('clubguard:check-notfound', { clubSlug });
          setStatus('notfound');
        }
      } catch (error) {
        if (!active) return;
        console.warn('⚠️ Club-Check abgebrochen/fehlgeschlagen:', error?.message || error);
        debugLog('clubguard:check-exception', {
          clubSlug,
          message: error?.message || String(error || ''),
        });
        const fallbackClubId = resolveLocalClubFallback();
        if (fallbackClubId) {
          setActiveClubId(fallbackClubId);
          debugLog('clubguard:exception-fallback-ok', { clubSlug, clubId: fallbackClubId });
          setStatus('ok');
        } else {
          debugLog('clubguard:exception-fallback-miss', { clubSlug });
          setStatus('notfound');
        }
      } finally {
        if (fallbackTimerId != null && typeof window !== 'undefined') {
          window.clearTimeout(fallbackTimerId);
        }
      }
    };

    void runClubCheck();

    return () => {
      active = false;
      if (fallbackTimerId != null && typeof window !== 'undefined') {
        window.clearTimeout(fallbackTimerId);
      }
    };
  }, [clubSlug, resolveLocalClubFallback]);

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

export default function ProtectedRoutes({ isAdmin, canAccessBoard, isSuperAdmin, anglerName }) {
  return (
    <Routes>
      {UX_TEST_MODE_ENABLED && (
        <>
          <Route path="/__ux/fish-form" element={<FishCatchForm anglerName="UX Test" />} />
          <Route path="/__ux/menu/dashboard" element={<Home />} />
          <Route path="/__ux/menu/new-catch" element={<FishCatchForm anglerName="UX Test" />} />
          <Route path="/__ux/menu/crayfish" element={<CrayfishForm anglerName="UX Test" />} />
          <Route path="/__ux/menu/catches" element={<CatchList anglerName="UX Test" />} />
          <Route path="/__ux/menu/leaderboard" element={<Leaderboard />} />
          <Route path="/__ux/menu/regeln" element={<Regulations />} />
          <Route path="/__ux/menu/analysis" element={<Analysis anglerName="UX Test" />} />
          <Route path="/__ux/menu/top-fishes" element={<TopFishes />} />
          <Route path="/__ux/menu/fun" element={<FunFacts />} />
          <Route path="/__ux/menu/forecast" element={<Forecast />} />
          <Route path="/__ux/menu/calendar" element={<Calendar />} />
          <Route path="/__ux/menu/map" element={<MapView />} />
          <Route path="/__ux/menu/downloads" element={<DownloadsPage />} />
          <Route path="/__ux/menu/vorstand" element={<BoardOverview />} />
        </>
      )}
      <Route path="/" element={<Navigate to="/asv-rotauge" replace />} />
      <Route path="/auth" element={<Navigate to="/asv-rotauge/auth" replace />} />

      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/reset-done" element={<ResetDone />} />
      <Route path="/auth-verified" element={<AuthVerified />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/:clubSlug/*" element={<ClubGuard />}>
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

        <Route element={<AppLayout name={anglerName} isAdmin={isAdmin} canAccessBoard={canAccessBoard} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="auth" element={<LoggedInClubAuthRedirect />} />
          <Route path="dashboard" element={<Home />} />
          <Route path="new-catch" element={<FishCatchForm anglerName={anglerName} />} />
          <Route path="crayfish" element={<CrayfishForm anglerName={anglerName} />} />
          <Route path="catches" element={<CatchList anglerName={anglerName} />} />
          <Route path="analysis" element={<Analysis anglerName={anglerName} />} />
          <Route path="statistik" element={<Analysis anglerName={anglerName} />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="top-fishes" element={<TopFishes />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="map" element={<MapView />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="regeln" element={<Regulations />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="fun" element={<FunFacts />} />
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
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Route>

      <Route path="*" element={<ClubNotFound />} />
    </Routes>
  );
}

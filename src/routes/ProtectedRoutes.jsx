import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { lazy, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getClubIdForSlug, getPreferredClubSlug, rememberClubSlugId, setActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import { debugLog } from '@/utils/runtimeDebug';
import RequireRole from '@/components/guards/RequireRole';
import RequireFeature from '@/components/guards/RequireFeature';
import RequireClubAccess from '@/components/guards/RequireClubAccess';
import { FEATURES } from '@/permissions/features';
import { ROLES } from '@/permissions/roles';
import { usePermissions } from '@/permissions/usePermissions';

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
const Calendar = lazy(() => import('@/pages/Calendar'));
const MapView = lazy(() => import('@/pages/MapView'));
const Regulations = lazy(() => import('@/pages/Regulations'));
const BoardOverview = lazy(() => import('@/pages/BoardOverview'));
const BoardSettings = lazy(() => import('@/pages/BoardSettings'));
const BoardRules = lazy(() => import('@/pages/BoardRules'));
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage'));

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

function TenantBoardRedirect() {
  const { clubSlug } = useParams();
  return <Navigate to={`/${clubSlug}/vorstand`} replace />;
}

function LegacyTenantRedirect({ to }) {
  const { currentClub, membership } = usePermissions();
  const resolvedSlug = currentClub?.slug || membership?.clubs?.slug || 'asv-rotauge';
  return <Navigate to={`/${resolvedSlug}${to}`} replace />;
}

function RootClubRedirect() {
  const { loading, currentClub, membership } = usePermissions();
  if (loading) {
    return <div className="p-6 text-center">Lädt Verein...</div>;
  }
  const slug = currentClub?.slug || membership?.clubs?.slug || getPreferredClubSlug();
  return <Navigate to={`/${slug}`} replace />;
}

function RootAuthRedirect() {
  const { loading, currentClub, membership } = usePermissions();
  if (loading) {
    return <div className="p-6 text-center">Lädt Verein...</div>;
  }
  const slug = currentClub?.slug || membership?.clubs?.slug || getPreferredClubSlug();
  return <Navigate to={`/${slug}/auth`} replace />;
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
          'Club-Check timeout',
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

function ManagementGate({ children }) {
  return (
    <RequireFeature feature={FEATURES.ADMIN_TOOLS}>
      <RequireRole role={ROLES.BOARD}>{children}</RequireRole>
    </RequireFeature>
  );
}

export default function ProtectedRoutes({ anglerName }) {
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

      <Route path="/" element={<RootClubRedirect />} />
      <Route path="/auth" element={<RootAuthRedirect />} />
      <Route path="/admin" element={<LegacyTenantRedirect to="/vorstand" />} />
      <Route path="/admin/members" element={<LegacyTenantRedirect to="/vorstand" />} />
      <Route path="/admin/verein" element={<LegacyTenantRedirect to="/vorstand" />} />
      <Route path="/admin/permissions" element={<LegacyTenantRedirect to="/vorstand" />} />
      <Route path="/admin2" element={<LegacyTenantRedirect to="/admin2" />} />
      <Route path="/vorstand" element={<LegacyTenantRedirect to="/vorstand" />} />
      <Route path="/vorstand/einstellungen" element={<LegacyTenantRedirect to="/vorstand/einstellungen" />} />
      <Route path="/vorstand/regeln" element={<LegacyTenantRedirect to="/vorstand/regeln" />} />
      <Route path="/catches" element={<LegacyTenantRedirect to="/catches" />} />

      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/reset-done" element={<ResetDone />} />
      <Route path="/auth-verified" element={<AuthVerified />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/:clubSlug/forgot-password" element={<ForgotPassword />} />

      <Route path="/:clubSlug/*" element={<ClubGuard />}>
        <Route element={<RequireClubAccess />}>
          <Route element={<AppLayout name={anglerName} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="auth" element={<LoggedInClubAuthRedirect />} />
            <Route path="admin" element={<TenantBoardRedirect />} />
            <Route path="admin/members" element={<TenantBoardRedirect />} />
            <Route path="admin/verein" element={<TenantBoardRedirect />} />
            <Route path="admin/permissions" element={<TenantBoardRedirect />} />
            <Route
              path="dashboard"
              element={
                <RequireFeature feature={FEATURES.WEATHER}>
                  <Home />
                </RequireFeature>
              }
            />
            <Route
              path="new-catch"
              element={
                <RequireFeature feature={FEATURES.CATCH_LOGGING} minRole={ROLES.MEMBER}>
                  <FishCatchForm anglerName={anglerName} />
                </RequireFeature>
              }
            />
            <Route
              path="crayfish"
              element={
                <RequireFeature feature={FEATURES.CATCH_LOGGING} minRole={ROLES.MEMBER}>
                  <CrayfishForm anglerName={anglerName} />
                </RequireFeature>
              }
            />
            <Route
              path="catches"
              element={
                <RequireFeature feature={FEATURES.CATCH_LOGGING}>
                  <CatchList anglerName={anglerName} />
                </RequireFeature>
              }
            />
            <Route
              path="analysis"
              element={
                <RequireFeature feature={FEATURES.ANALYSIS}>
                  <Analysis anglerName={anglerName} />
                </RequireFeature>
              }
            />
            <Route
              path="statistik"
              element={
                <RequireFeature feature={FEATURES.ANALYSIS}>
                  <Analysis anglerName={anglerName} />
                </RequireFeature>
              }
            />
            <Route
              path="leaderboard"
              element={
                <RequireFeature feature={FEATURES.LEADERBOARD}>
                  <Leaderboard />
                </RequireFeature>
              }
            />
            <Route
              path="top-fishes"
              element={
                <RequireFeature feature={FEATURES.ANALYSIS}>
                  <TopFishes />
                </RequireFeature>
              }
            />
            <Route
              path="calendar"
              element={
                <RequireFeature feature={FEATURES.CATCH_LOGGING}>
                  <Calendar />
                </RequireFeature>
              }
            />
            <Route
              path="map"
              element={
                <RequireFeature feature={FEATURES.MAP}>
                  <MapView />
                </RequireFeature>
              }
            />
            <Route
              path="forecast"
              element={
                <RequireFeature feature={FEATURES.FORECAST}>
                  <Forecast />
                </RequireFeature>
              }
            />
            <Route path="regeln" element={<Regulations />} />
            <Route path="downloads" element={<DownloadsPage />} />
            <Route
              path="fun"
              element={
                <RequireFeature feature={FEATURES.ANALYSIS}>
                  <FunFacts />
                </RequireFeature>
              }
            />
            <Route
              path="vorstand"
              element={
                <ManagementGate>
                  <BoardOverview />
                </ManagementGate>
              }
            />
            <Route
              path="vorstand/einstellungen"
              element={
                <ManagementGate>
                  <BoardSettings />
                </ManagementGate>
              }
            />
            <Route
              path="vorstand/regeln"
              element={
                <ManagementGate>
                  <BoardRules />
                </ManagementGate>
              }
            />
            <Route
              path="admin2"
              element={
                <ManagementGate>
                  <AdminOverview />
                </ManagementGate>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<PageNotFound />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<ClubNotFound />} />
    </Routes>
  );
}

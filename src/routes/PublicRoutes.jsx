import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { lazy } from 'react';

const UpdatePassword = lazy(() => import('@/pages/UpdatePassword'));
const ResetDone = lazy(() => import('@/pages/ResetDone'));
const AuthVerified = lazy(() => import('@/pages/AuthVerified'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const AuthForm = lazy(() => import('@/components/AuthForm'));

const Home = lazy(() => import('@/pages/Home'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const TopFishes = lazy(() => import('@/pages/TopFishes'));
const Forecast = lazy(() => import('@/pages/Forecast'));
const CrayfishForm = lazy(() => import('@/pages/CrayfishForm'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const MapView = lazy(() => import('@/pages/MapView'));
const Regulations = lazy(() => import('@/pages/Regulations'));
const BoardOverview = lazy(() => import('@/pages/BoardOverview'));
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage'));
const FunFacts = lazy(() => import('@/pages/FunFacts'));
const CatchList = lazy(() => import('@/components/catchlist/CatchList'));
const FishCatchForm = lazy(() => import('@/components/FishCatchForm'));

const UX_TEST_MODE_ENABLED = import.meta.env.VITE_UX_TEST_MODE === '1';

function ClubNotFound() {
  return <div className="p-6 text-center text-red-600">Club not found</div>;
}

function NotLoggedRedirect() {
  const { clubSlug } = useParams();
  const target = clubSlug ? `/${clubSlug}/auth` : '/asv-rotauge/auth';
  return <Navigate to={target} replace />;
}

function ClubAuthEntryRedirect() {
  const { clubSlug } = useParams();
  return <Navigate to={`/${clubSlug}/auth`} replace />;
}

export default function PublicRoutes() {
  const isRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

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
      <Route path="/catches" element={<Navigate to="/asv-rotauge/auth" replace />} />

      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/reset-done" element={<ResetDone />} />
      <Route path="/auth-verified" element={<AuthVerified />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/:clubSlug/forgot-password" element={<ForgotPassword />} />

      <Route path="/:clubSlug" element={<ClubAuthEntryRedirect />} />
      <Route path="/:clubSlug/auth" element={<AuthForm />} />
      <Route
        path="/:clubSlug/*"
        element={isRecoveryLink ? <Navigate to="/update-password" replace /> : <NotLoggedRedirect />}
      />

      <Route path="*" element={<ClubNotFound />} />
    </Routes>
  );
}

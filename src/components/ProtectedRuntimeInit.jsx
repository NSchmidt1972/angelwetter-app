import { useEffect, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { useAppResumeSync } from '@/hooks/useAppResumeSync';
import { getActiveClubId } from '@/utils/clubId';
import { debugLog } from '@/utils/runtimeDebug';
import { shouldAutoInitOneSignalRuntime } from '@/onesignal/onesignalService';

const UX_TEST_MODE_ENABLED = import.meta.env.VITE_UX_TEST_MODE === '1';
const PUSH_DISABLED = import.meta.env.VITE_DISABLE_PUSH === '1';
const PushInit = lazy(() => import('@/components/PushInit'));
const AnalyticsInit = lazy(() => import('@/components/AnalyticsInit'));
const SessionActivityPing = lazy(() => import('@/components/SessionActivityPing'));

const STATIC_PUBLIC_PATHS = new Set([
  '/auth',
  '/update-password',
  '/reset-done',
  '/auth-verified',
  '/forgot-password',
]);

function isClubAuthPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 2 && segments[1].toLowerCase() === 'auth';
}

function isPushExcludedPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return STATIC_PUBLIC_PATHS.has(pathname) || isClubAuthPath(pathname);
}

export default function ProtectedRuntimeInit() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const isRecoveryHash = location.hash.includes('type=recovery');
  const isPasswordResetFlow = location.pathname === '/update-password' || isRecoveryHash;
  const isLoggedIn = Boolean(user) && !isPasswordResetFlow;

  const shouldInitProtectedRuntime =
    !UX_TEST_MODE_ENABLED &&
    isLoggedIn;
  const shouldInitPush =
    shouldInitProtectedRuntime &&
    !PUSH_DISABLED &&
    shouldAutoInitOneSignalRuntime() &&
    !isPushExcludedPath(location.pathname);
  const shouldInitAnalytics = shouldInitProtectedRuntime;
  const shouldPingUserActivity = shouldInitProtectedRuntime;

  useAppResumeSync({ enabled: shouldInitProtectedRuntime });

  useEffect(() => {
    debugLog('app:route-context', {
      path: location.pathname,
      hash: location.hash || null,
      userId: user?.id || null,
      profileClubId: profile?.club_id || null,
      activeClubId: getActiveClubId(),
      visibility: typeof document !== 'undefined' ? document.visibilityState : null,
    });
  }, [location.pathname, location.hash, user?.id, profile?.club_id]);

  return (
    <>
      {shouldPingUserActivity ? (
        <Suspense fallback={null}>
          <SessionActivityPing
            userId={user?.id || null}
            profileClubId={profile?.club_id || null}
            anglerName={user?.email || null}
          />
        </Suspense>
      ) : null}
      {shouldInitAnalytics ? (
        <Suspense fallback={null}>
          <AnalyticsInit />
        </Suspense>
      ) : null}
      {shouldInitPush ? (
        <Suspense fallback={null}>
          <PushInit />
        </Suspense>
      ) : null}
    </>
  );
}

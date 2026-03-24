import { useEffect } from 'react';
import {
  ensureOneSignalInitialized,
  getPushStatusSnapshot,
  getSubscriptionId,
  isOneSignalEnabledForRuntime,
  requestPushPermission,
  withOneSignal,
} from '@/onesignal/onesignalService';
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES } from '@/permissions/features';

export default function useOneSignal() {
  const { loading: permissionsLoading, hasFeatureForRole } = usePermissions();
  const pushFeatureEnabled = !permissionsLoading && hasFeatureForRole(FEATURES.PUSH);
  const pushRuntimeEnabled = pushFeatureEnabled && isOneSignalEnabledForRuntime();

  useEffect(() => {
    if (!pushRuntimeEnabled) return;
    ensureOneSignalInitialized().catch((err) => {
      console.warn('[useOneSignal] Initialisierung fehlgeschlagen:', err);
    });
  }, [pushRuntimeEnabled]);

  const runWithOneSignal = async (runner, fallbackValue) => {
    if (!pushRuntimeEnabled) return fallbackValue;
    try {
      return await withOneSignal(runner);
    } catch (err) {
      console.warn('[useOneSignal] Aufruf fehlgeschlagen:', err);
      return fallbackValue;
    }
  };

  return {
    isPushEnabled: () => runWithOneSignal(async (OneSignal) => {
      const snapshot = await getPushStatusSnapshot(OneSignal);
      return !!(snapshot.supported && snapshot.granted && snapshot.optedIn && snapshot.subId);
    }, false),
    getUserId: () => runWithOneSignal((OneSignal) => getSubscriptionId(OneSignal), null),
    showPrompt: () => runWithOneSignal(async (OneSignal) => {
      const permissionState = await requestPushPermission(OneSignal);
      return permissionState === 'granted';
    }, false),
  };
}

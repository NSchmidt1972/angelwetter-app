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

  useEffect(() => {
    if (!pushFeatureEnabled) return;
    if (!isOneSignalEnabledForRuntime()) return;
    ensureOneSignalInitialized().catch((err) => {
      console.warn('[useOneSignal] Initialisierung fehlgeschlagen:', err);
    });
  }, [pushFeatureEnabled]);

  return {
    isPushEnabled: () =>
      (pushFeatureEnabled
        ? withOneSignal(async (OneSignal) => {
            const snapshot = await getPushStatusSnapshot(OneSignal);
            return !!(snapshot.supported && snapshot.granted && snapshot.optedIn && snapshot.subId);
          })
        : Promise.resolve(false)),
    getUserId: () => (pushFeatureEnabled ? withOneSignal((OneSignal) => getSubscriptionId(OneSignal)) : Promise.resolve(null)),
    showPrompt: () =>
      (pushFeatureEnabled
        ? withOneSignal(async (OneSignal) => {
            const permissionState = await requestPushPermission(OneSignal);
            return permissionState === 'granted';
          })
        : Promise.resolve(false)),
  };
}

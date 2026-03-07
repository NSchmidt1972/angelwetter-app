import { useEffect } from 'react';
import {
  ensureOneSignalInitialized,
  getPushStatusSnapshot,
  getSubscriptionId,
  requestPushPermission,
  withOneSignal,
} from '@/onesignal/onesignalService';

export default function useOneSignal() {
  useEffect(() => {
    ensureOneSignalInitialized().catch((err) => {
      console.warn('[useOneSignal] Initialisierung fehlgeschlagen:', err);
    });
  }, []);

  return {
    isPushEnabled: () =>
      withOneSignal(async (OneSignal) => {
        const snapshot = await getPushStatusSnapshot(OneSignal);
        return !!(snapshot.supported && snapshot.granted && snapshot.optedIn && snapshot.subId);
      }),
    getUserId: () => withOneSignal((OneSignal) => getSubscriptionId(OneSignal)),
    showPrompt: () =>
      withOneSignal(async (OneSignal) => {
        const permissionState = await requestPushPermission(OneSignal);
        return permissionState === 'granted';
      }),
  };
}

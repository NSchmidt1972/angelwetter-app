import {
  ensureOneSignalInitialized,
  getPushStatusSnapshot,
  syncCurrentSubscription,
} from '@/onesignal/onesignalService';

export const runOneSignalHealthCheck = async () => {
  try {
    const OneSignal = await ensureOneSignalInitialized();
    const snapshot = await getPushStatusSnapshot(OneSignal);

    if (!snapshot.supported || snapshot.permissionState !== 'granted' || !snapshot.subId) {
      console.warn('[OneSignalSync] Push nicht bereit, Sync wird übersprungen.', snapshot);
      return { ok: false, ...snapshot };
    }

    await syncCurrentSubscription({
      OneSignal,
      subscriptionId: snapshot.subId,
      optedIn: snapshot.optedIn,
      revokedAt: null,
    });

    return { ok: true, ...snapshot };
  } catch (err) {
    console.error('[OneSignalSync] Health-Check fehlgeschlagen:', err);
    return { ok: false, error: err?.message || String(err) };
  }
};

export default runOneSignalHealthCheck;

// src/components/PushInit.jsx
import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { runWhenOneSignalReady } from '@/onesignal/deferred';
import {
  ensureServiceWorkerRegistration,
  waitForServiceWorkerRegistration,
  SERVICE_WORKER_INFO,
} from '@/onesignal/swHelpers';
import { getActiveClubId } from '@/utils/clubId';
import {
  revokePushSubscriptionRecord,
  upsertPushSubscriptionRecord,
} from '@/onesignal/pushSubscriptionStore';

const ONESIGNAL_APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID?.trim() ||
  'b05a44e8-bea5-4941-8972-5194254aadad';

export default function PushInit() {
  useEffect(() => {
    // nur einmal initialisieren
    if (window.__osInitialized) return;
    window.__osInitialized = true;
    let initCompleted = false;

    /** Liefert die aktuelle Subscription-ID (oder null) */
    async function getSubId(OS) {
      try {
        const sub = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
        if (sub?.id) return sub.id;
        if (typeof sub?.getId === 'function') {
          const id = await sub.getId();
          if (id) return id;
        }
        if (typeof OS?.User?.getId === 'function') {
          const uid = await OS.User.getId();
          return uid || null;
        }
        return null;
      } catch {
        return null;
      }
    }

    async function upsertSubscription(subscriptionId, reason = '') {
      if (!subscriptionId) return;

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          console.warn('[PushInit] getUser error:', userErr);
        }
        const uid = userRes?.user?.id;
        if (!uid) return;
        const clubId = getActiveClubId();

        const reg = await ensureServiceWorkerRegistration();
        const scope = reg?.scope || SERVICE_WORKER_INFO.scope || null;
        const device = navigator.userAgentData?.platform || navigator.platform || null;
        const ua = navigator.userAgent || null;

        let anglerName = null;
        try {
          anglerName = localStorage.getItem('anglerName') || null;
        } catch {
          anglerName = null;
        }

        const payload = {
          subscriptionId,
          userId: uid,
          clubId,
          scope,
          deviceLabel: device,
          userAgent: ua,
          optedIn: true,
          revokedAt: null,
          anglerName,
        };
        await upsertPushSubscriptionRecord(payload);
      } catch (error) {
        console.warn('[PushInit] upsert push_subscriptions failed:', error, reason);
      }
    }

    // OneSignal v16 Deferred-Init
    const cleanupFns = [];

    const { cancel, promise } = runWhenOneSignalReady(async (OneSignal) => {
      try {
        // Service Worker bevorzugt nutzen, aber nicht auf Erstbesuch blockieren
        const registration = await waitForServiceWorkerRegistration();

        // OneSignal initialisieren (nicht UI-blockierend)
        const initOptions = {
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true, // nur DEV
          serviceWorkerPath: SERVICE_WORKER_INFO.path,
          serviceWorkerParam: { scope: SERVICE_WORKER_INFO.scope },
          // kein Auto-Prompt hier – Steuerung über deine UI
        };

        if (registration) {
          initOptions.serviceWorkerRegistration = registration;
        }

        await OneSignal.init(initOptions);
        initCompleted = true;

        // 0) Falls bereits "granted" aber (noch) nicht subscribed → nachziehen
        try {
          const isSup = typeof OneSignal?.Notifications?.isPushSupported === 'function'
            ? !!OneSignal.Notifications.isPushSupported()
            : !!OneSignal?.Notifications?.isPushSupported;

          const perm = OneSignal.Notifications.permission; // 'granted' | 'denied' | 'default'
          if (isSup && perm === 'granted') {
            const sub = OneSignal.User?.pushSubscription || OneSignal.User?.PushSubscription;
            if (sub && sub.optedIn === false) {
              // aktiv abonnieren (kein Browser-Prompt, da schon granted)
              if (typeof OneSignal.Notifications.subscribe === 'function') {
                await OneSignal.Notifications.subscribe();
              }
            }
          }
        } catch (error) {
          console.warn('[PushInit] Prüfen bestehender Subscription fehlgeschlagen:', error);
        }

        // 1) Beim Start (falls bereits subscribed & eingeloggt)
        getSubId(OneSignal).then((sid) => upsertSubscription(sid, 'initial'));

        // 2a) Abo-Änderungen (opt-in/out, ID-Wechsel) – User Model Listener
        try {
          const subModel = OneSignal.User?.pushSubscription || OneSignal.User?.PushSubscription;
          const onSubChange = async (ev) => {
            const cur = ev?.current || {};
            let sid = cur?.id ?? (await getSubId(OneSignal));

            if (cur?.optedIn === false && sid) {
              // Opt-out → Abo als widerrufen markieren (falls Zeile existiert)
              const { data: u } = await supabase.auth.getUser();
              if (u?.user?.id) {
                revokePushSubscriptionRecord({
                  subscriptionId: sid,
                  userId: u.user.id,
                  clubId: getActiveClubId(),
                }).catch((e) => console.warn('[PushInit] revoke failed:', e));
              }
            } else {
              // Opt-in oder ID-Refresh → speichern/claimen
              upsertSubscription(sid, 'push-change');
            }
          };

          subModel?.addEventListener('change', onSubChange);
          cleanupFns.push(() => subModel?.removeEventListener('change', onSubChange));
        } catch (e) {
          console.warn('[PushInit] pushSubscription.change listener failed', e);
        }

        // 2b) Fallback: Notifications-Event (manche Integrationen feuern hier)
        try {
          const onNotifChange = async () => {
            const sid = await getSubId(OneSignal);
            upsertSubscription(sid, 'subscriptionChange');
          };

          OneSignal.Notifications.addEventListener('subscriptionChange', onNotifChange);
          cleanupFns.push(() => OneSignal.Notifications.removeEventListener('subscriptionChange', onNotifChange));
        } catch (e) {
          console.warn('[PushInit] notifications.subscriptionChange listener failed', e);
        }

        // 3) Login/Logout → erneut versuchen (falls beim Start kein uid da war)
        const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, session) => {
          const sid = await getSubId(OneSignal);
          if (sid && session?.user?.id) upsertSubscription(sid, 'auth-change');
        });
        cleanupFns.push(() => authSub?.subscription?.unsubscribe?.());
      } catch (e) {
        console.warn('[PushInit] OneSignal init error:', e);
        window.__osInitialized = false;
      }
    });

    promise.catch((err) => {
      console.warn('[PushInit] runWhenOneSignalReady error:', err);
    });

    return () => {
      cancel();
      cleanupFns.forEach((fn) => {
        try {
          fn?.();
        } catch (err) {
          console.warn('[PushInit] cleanup failed:', err);
        }
      });

      // React.StrictMode (Dev) mountet Effekte absichtlich doppelt.
      // Wenn die erste Init vorzeitig gecancelt wurde, darf der zweite Mount erneut initialisieren.
      if (!initCompleted) {
        window.__osInitialized = false;
      }
    };
  }, []);

  return null;
}

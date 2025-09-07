// src/components/PushInit.jsx
import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';

const THROTTLE_MS = 10_000; // mind. 10s zwischen zwei Schreibvorgängen

export default function PushInit() {
  useEffect(() => {
    // Nur einmal initialisieren
    if (window.__osInitialized) return;
    window.__osInitialized = true;

    // Throttle/Lock im Window halten
    window.__psUpsertInFlight = false;
    window.__psLastWriteAt = 0;

    async function getSubscriptionId(OS) {
      return (
        OS.User?.PushSubscription?.id ??
        (await OS.User?.PushSubscription?.getId?.()) ??
        null
      );
    }

    async function upsertSubscription(subscriptionId, reason = '') {
      try {
        if (!subscriptionId) return;

        // Throttle
        const now = Date.now();
        if (window.__psUpsertInFlight) return;
        if (now - (window.__psLastWriteAt || 0) < THROTTLE_MS) return;
        window.__psUpsertInFlight = true;
        window.__psLastWriteAt = now;

        // User muss eingeloggt sein
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (!uid) return;

        // Gerätemetadaten
        const reg = await navigator.serviceWorker.getRegistration();
        const scope = reg?.scope || null;
        const device =
          navigator.userAgentData?.platform || navigator.platform || null;
        const ua = navigator.userAgent || null;

        const row = {
          subscription_id: subscriptionId,
          user_id: uid,
          device_label: device,
          user_agent: ua,
          scope,
          opted_in: true,
          last_seen_at: new Date().toISOString(),
          // created_at via DEFAULT
        };

        // Idempotent: onConflict = subscription_id
        supabase
          .from('push_subscriptions')
          .upsert(row, { onConflict: 'subscription_id' })
          .then(({ error }) => {
            if (error) {
              console.warn('[PushInit] upsert push_subscriptions error:', error, reason);
            }
          })
          .catch((e) => {
            console.warn('[PushInit] upsert push_subscriptions failed:', e, reason);
          })
          .finally(() => {
            window.__psUpsertInFlight = false;
          });
      } catch (e) {
        window.__psUpsertInFlight = false;
        console.warn('[PushInit] upsertSubscription exception:', e, reason);
      }
    }

    // OneSignal v16 Deferred-Init
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        // Sicherstellen, dass ein Service Worker im richtigen Scope aktiv ist
        const registration = await navigator.serviceWorker.ready;

        // OneSignal initialisieren (nicht UI-blockierend)
        await OneSignal.init({
          appId: 'b05a44e8-bea5-4941-8972-5194254aadad',
          serviceWorkerRegistration: registration,
          allowLocalhostAsSecureOrigin: true,
        });

        // 1) Beim Start (falls bereits subscribed & eingeloggt)
        getSubscriptionId(OneSignal)
          .then((sid) => upsertSubscription(sid, 'initial'))
          .catch(() => {});

        // 2) Abo-Änderungen (opt-in/out, ID-Wechsel)
        OneSignal.User.PushSubscription.addEventListener('change', async (ev) => {
          const cur = ev?.current || {};
          let sid = cur?.id ?? null;
          if (!sid) sid = await getSubscriptionId(OneSignal);

          if (cur?.optedIn === false && sid) {
            // Opt-out → Abo als widerrufen markieren
            const { data: u } = await supabase.auth.getUser();
            if (u?.user?.id) {
              supabase
                .from('push_subscriptions')
                .update({
                  opted_in: false,
                  revoked_at: new Date().toISOString(),
                  last_seen_at: new Date().toISOString(),
                })
                .eq('subscription_id', sid)
                .eq('user_id', u.user.id)
                .catch((e) => console.warn('[PushInit] revoke failed:', e));
            }
          } else {
            // Opt-in oder ID-Refresh → speichern
            upsertSubscription(sid, 'push-change');
          }
        });

        // 3) Login/Logout → erneut versuchen (falls beim Start kein uid da war)
        supabase.auth.onAuthStateChange(async (_event, session) => {
          const sid = await getSubscriptionId(OneSignal);
          if (sid && session?.user?.id) {
            upsertSubscription(sid, 'auth-change');
          }
        });
      } catch (e) {
        console.warn('[PushInit] OneSignal init error:', e);
      }
    });
  }, []);

  return null;
}

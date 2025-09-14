// src/components/PushInit.jsx
import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';

const THROTTLE_MS = 10_000; // mind. 10s zwischen zwei Writes

export default function PushInit() {
  useEffect(() => {
    // nur einmal initialisieren
    if (window.__osInitialized) return;
    window.__osInitialized = true;

    // Throttle/Lock im Window halten
    window.__psUpsertInFlight = false;
    window.__psLastWriteAt = 0;

    /** Liefert die aktuelle Subscription-ID (oder null) */
    async function getSubId(OS) {
      try {
        const sub = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
        const id = sub?.id ?? (await sub?.getId?.());
        return id ?? null;
      } catch {
        return null;
      }
    }

    /** Supabase-Write via RPC (Owner-Claim) – mit robustem Lock/Throttle */
    async function claimSubscription(subscriptionId, reason = '') {
      try {
        if (!subscriptionId) return;

        // 1) User MUSS eingeloggt sein – ohne Lock vorzeitig abbrechen
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) console.warn('[PushInit] getUser error:', userErr);
        const uid = userRes?.user?.id;
        if (!uid) return;

        // 2) Throttle prüfen – noch ohne Lock abbrechen
        const now = Date.now();
        if (now - (window.__psLastWriteAt || 0) < THROTTLE_MS) return;

        // 3) Wenn bereits ein Upsert läuft, abbrechen
        if (window.__psUpsertInFlight) return;

        // 4) Jetzt erst Lock & Timestamp setzen
        window.__psUpsertInFlight = true;
        window.__psLastWriteAt = now;

        // Gerätemetadaten
        const reg = await navigator.serviceWorker.getRegistration();
        const scope = reg?.scope || null;
        const device =
          navigator.userAgentData?.platform || navigator.platform || null;
        const ua = navigator.userAgent || null;

        // 5) Schreiben – await, damit Lock sicher gelöst wird
        const { error } = await supabase.rpc('claim_push_subscription', {
          p_subscription_id: subscriptionId,
          p_device_label: device,
          p_user_agent: ua,
          p_scope: scope,
        });

        if (error) {
          console.warn('[PushInit] claim_push_subscription RPC error:', error, reason);
        } else {
          // optionales Log
          // console.info('[PushInit] claim ok:', subscriptionId, reason);
        }
      } catch (e) {
        console.warn('[PushInit] claim exception:', e, reason);
      } finally {
        // 6) Lock immer lösen
        window.__psUpsertInFlight = false;
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
          allowLocalhostAsSecureOrigin: true, // nur DEV
          // kein Auto-Prompt hier – Steuerung über deine UI
        });

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
        } catch (_) {
          /* noop */
        }

        // 1) Beim Start (falls bereits subscribed & eingeloggt)
        getSubId(OneSignal).then((sid) => claimSubscription(sid, 'initial'));

        // 2a) Abo-Änderungen (opt-in/out, ID-Wechsel) – User Model Listener
        try {
          (OneSignal.User?.pushSubscription || OneSignal.User?.PushSubscription)
            ?.addEventListener('change', async (ev) => {
              const cur = ev?.current || {};
              let sid = cur?.id ?? (await getSubId(OneSignal));

              if (cur?.optedIn === false && sid) {
                // Opt-out → Abo als widerrufen markieren (falls Zeile existiert)
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
                // Opt-in oder ID-Refresh → speichern/claimen
                claimSubscription(sid, 'push-change');
              }
            });
        } catch (e) {
          console.warn('[PushInit] pushSubscription.change listener failed', e);
        }

        // 2b) Fallback: Notifications-Event (manche Integrationen feuern hier)
        try {
          OneSignal.Notifications.addEventListener('subscriptionChange', async () => {
            const sid = await getSubId(OneSignal);
            claimSubscription(sid, 'subscriptionChange');
          });
        } catch (e) {
          console.warn('[PushInit] notifications.subscriptionChange listener failed', e);
        }

        // 3) Login/Logout → erneut versuchen (falls beim Start kein uid da war)
        supabase.auth.onAuthStateChange(async (_event, session) => {
          const sid = await getSubId(OneSignal);
          if (sid && session?.user?.id) claimSubscription(sid, 'auth-change');
        });
      } catch (e) {
        console.warn('[PushInit] OneSignal init error:', e);
      }
    });
  }, []);

  return null;
}

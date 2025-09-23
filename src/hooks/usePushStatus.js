// src/hooks/usePushStatus.js
import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { runWhenOneSignalReady, enqueueOneSignal } from '@/onesignal/deferred';

function isSupported(OS) {
  if (!OS?.Notifications) return false;
  const v = OS.Notifications.isPushSupported;
  return typeof v === 'function' ? !!v() : !!v;
}

export default function usePushStatus() {
  const [state, setState] = useState({
    sdk: null,
    supported: null,            // boolean | null
    permissionState: 'default', // 'granted' | 'denied' | 'default'
    granted: false,
    blocked: false,
    optedIn: false,
    subId: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cleanupFn;
    let cancelled = false;

    const init = async (OS) => {
      try {
        const perm = OS?.Notifications?.permission ?? 'default';
        const granted = perm === 'granted';
        const blocked = perm === 'denied';

        const subModel = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
        const id = subModel?.id ?? (await subModel?.getId?.()) ?? null;

        if (cancelled) return;

        setState((s) => ({
          ...s,
          sdk: OS,
          supported: isSupported(OS),
          permissionState: perm,
          granted,
          blocked,
          optedIn: !!subModel?.optedIn,
          subId: id,
          loading: false,
          error: null,
        }));

        const onPerm = (p) => {
          const ps = typeof p === 'string' ? p : (p ? 'granted' : 'denied');
          setState((prev) => ({
            ...prev,
            permissionState: ps,
            granted: ps === 'granted',
            blocked: ps === 'denied',
          }));
        };

        const onSubChange = async (ev) => {
          try {
            const cur = ev?.current || {};
            const model = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
            const id2 = cur?.id ?? model?.id ?? (await model?.getId?.()) ?? null;
            const opted2 =
              typeof cur?.optedIn === 'boolean' ? cur.optedIn : !!model?.optedIn;
            setState((prev) => ({ ...prev, subId: id2, optedIn: opted2 }));
          } catch (e) {
            console.warn('[usePushStatus] onSubChange error', e);
          }
        };

        OS?.Notifications?.addEventListener?.('permissionChange', onPerm);
        (OS?.User?.pushSubscription || OS?.User?.PushSubscription)
          ?.addEventListener?.('change', onSubChange);

        return () => {
          OS?.Notifications?.removeEventListener?.('permissionChange', onPerm);
          (OS?.User?.pushSubscription || OS?.User?.PushSubscription)
            ?.removeEventListener?.('change', onSubChange);
        };
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e?.message || String(e),
          }));
        }
      }
      return undefined;
    };

    const { cancel, promise } = runWhenOneSignalReady(async (OS) => {
      if (cancelled) return;
      const maybeCleanup = await init(OS);
      if (cancelled && typeof maybeCleanup === 'function') {
        maybeCleanup();
        return;
      }
      cleanupFn = typeof maybeCleanup === 'function' ? maybeCleanup : undefined;
    });

    promise.catch((err) => {
      if (!cancelled) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || String(err),
        }));
      }
    });

    return () => {
      cancelled = true;
      cancel();
      if (typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, []);

  const subscribe = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const exec = async (OS) => {
      try {
        if (!isSupported(OS)) {
          throw new Error('Push wird auf diesem Gerät/Browser nicht unterstützt.');
        }

        // Permission anfragen (falls nötig)
        let perm = OS.Notifications.permission;
        if (perm !== 'granted') {
          const res = await OS.Notifications.requestPermission();
          perm = typeof res === 'string' ? res : res ? 'granted' : 'denied';
          if (perm !== 'granted') {
            setState((s) => ({
              ...s,
              loading: false,
              permissionState: perm,
              granted: false,
              blocked: perm === 'denied',
              error:
                perm === 'denied'
                  ? 'Benachrichtigungen im Browser blockiert.'
                  : 'Berechtigung nicht erteilt.',
            }));
            return;
          }
        }

        // SW bereit?
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.ready;
        }

        // Abonnieren (SDK-kompatibel: optIn + subscribe)
        const model = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
        if (typeof model?.optIn === 'function') {
          await model.optIn();
        }
        if (typeof OS?.Notifications?.subscribe === 'function') {
          await OS.Notifications.subscribe();
        }

        // ID holen
        const sid = model?.id ?? (await model?.getId?.()) ?? null;

        // DB: RPC (Owner-Claim) inkl. Metadaten
        if (sid) {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            const scope = reg?.scope || null;
            const device =
              navigator.userAgentData?.platform || navigator.platform || null;
            const ua = navigator.userAgent || null;
            let anglerName = null;
            try {
              anglerName = localStorage.getItem('anglerName') || null;
            } catch {
              anglerName = null;
            }

            await supabase.rpc('claim_push_subscription', {
              p_subscription_id: sid,
              p_device_label: device,
              p_user_agent: ua,
              p_scope: scope,
              p_angler_name: anglerName,
            });

            if (anglerName) {
              try {
                const { data: userRes } = await supabase.auth.getUser();
                const uid = userRes?.user?.id;
                if (uid) {
                  await supabase
                    .from('push_subscriptions')
                    .update({ angler_name: anglerName })
                    .eq('subscription_id', sid)
                    .eq('user_id', uid);
                }
              } catch (updateErr) {
                console.warn('[usePushStatus] backfill angler_name failed:', updateErr);
              }
            }
          } catch (rpcErr) {
            console.warn(
              '[usePushStatus] RPC claim_push_subscription error:',
              rpcErr?.message || rpcErr
            );
          }
        }

        setState((s) => ({
          ...s,
          permissionState: 'granted',
          granted: true,
          blocked: false,
          optedIn: true,
          subId: sid,
          loading: false,
          error: null,
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message || String(e),
        }));
      }
    };

    enqueueOneSignal(exec);
  };

  const unsubscribe = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const exec = async (OS) => {
      try {
        const model = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
        if (typeof model?.optOut === 'function') {
          await model.optOut();
        }
        // DB-Status (opted_in=false) setzt dein PushInit über den change-Listener
        setState((s) => ({
          ...s,
          optedIn: false,
          subId: null,
          loading: false,
          error: null,
        }));
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: e?.message || String(e) }));
      }
    };

    enqueueOneSignal(exec);
  };

  // alias für Altcode (permission als boolean)
  return { ...state, permission: state.granted, subscribe, unsubscribe };
}

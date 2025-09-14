// src/hooks/usePushStatus.js
import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';

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
    const init = async (OS) => {
      try {
        const perm = OS?.Notifications?.permission ?? 'default';
        const granted = perm === 'granted';
        const blocked = perm === 'denied';

        const subModel = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
        const id = subModel?.id ?? (await subModel?.getId?.()) ?? null;

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
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message || String(e),
        }));
      }
    };

    if (window.OneSignal?.Notifications) {
      const cleanup = init(window.OneSignal);
      return typeof cleanup === 'function' ? cleanup : undefined;
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(init);
    }
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

            await supabase.rpc('claim_push_subscription', {
              p_subscription_id: sid,
              p_device_label: device,
              p_user_agent: ua,
              p_scope: scope,
            });
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

    if (window.OneSignal?.Notifications) {
      exec(window.OneSignal);
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(exec);
    }
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

    if (window.OneSignal?.Notifications) {
      exec(window.OneSignal);
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(exec);
    }
  };

  // alias für Altcode (permission als boolean)
  return { ...state, permission: state.granted, subscribe, unsubscribe };
}

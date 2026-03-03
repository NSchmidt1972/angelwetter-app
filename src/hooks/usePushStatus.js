// src/hooks/usePushStatus.js
import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { runWhenOneSignalReady, enqueueOneSignal } from '@/onesignal/deferred';
import {
  ensureServiceWorkerRegistration,
  waitForServiceWorkerRegistration,
  SERVICE_WORKER_INFO,
} from '@/onesignal/swHelpers';
import { upsertPushSubscriptionRecord } from '@/onesignal/pushSubscriptionStore';

function isSupported(OS) {
  if (!OS?.Notifications) return false;
  const v = OS.Notifications.isPushSupported;
  try {
    return typeof v === 'function' ? !!v() : !!v;
  } catch (err) {
    console.warn('[usePushStatus] isPushSupported() Fehler:', err);
    return false;
  }
}

async function resolveSubscriptionId(OS) {
  if (!OS) return null;
  const model = OS.User?.pushSubscription || OS.User?.PushSubscription;
  if (model?.id) return model.id;

  if (typeof model?.getId === 'function') {
    try {
      const id = await model.getId();
      if (id) return id;
    } catch (err) {
      console.warn('[usePushStatus] pushSubscription.getId() fehlgeschlagen:', err);
    }
  }

  if (typeof OS?.User?.getId === 'function') {
    try {
      const uid = await OS.User.getId();
      return uid || null;
    } catch (err) {
      console.warn('[usePushStatus] OneSignal.User.getId() fehlgeschlagen:', err);
    }
  }

  return null;
}

async function waitForSubscriptionId(
  OS,
  { attempts = 20, delayMs = 500, timeoutMs } = {}
) {
  const tryResolve = async () => {
    try {
      return await resolveSubscriptionId(OS);
    } catch (err) {
      console.warn('[usePushStatus] resolveSubscriptionId Fehler:', err);
      return null;
    }
  };

  const immediate = await tryResolve();
  if (immediate) return immediate;

  return new Promise((resolve) => {
    const model = OS?.User?.pushSubscription || OS?.User?.PushSubscription;
    let finished = false;
    let pollTimer;
    let timeoutTimer;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      model?.removeEventListener?.('change', handler);
    };

    const done = (val) => {
      if (finished) return;
      cleanup();
      resolve(val ?? null);
    };

    const handler = async (ev) => {
      const candidate = ev?.current?.id ?? (await tryResolve());
      if (candidate) done(candidate);
    };

    model?.addEventListener?.('change', handler);

    const poll = async (attempt = 0) => {
      const candidate = await tryResolve();
      if (candidate) {
        done(candidate);
        return;
      }
      if (attempt >= attempts) {
        done(null);
        return;
      }
      pollTimer = window.setTimeout(() => poll(attempt + 1), delayMs);
    };

    poll();

    const totalTimeout = timeoutMs ?? attempts * delayMs + 5000;
    timeoutTimer = window.setTimeout(() => done(null), totalTimeout);
  });
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
        const id = await resolveSubscriptionId(OS);

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
            const id2 = cur?.id ?? (await resolveSubscriptionId(OS));
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
            sdk: null,
            supported: false,
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
    }, { requireUser: true });

    promise.catch((err) => {
      if (!cancelled) {
        setState((s) => ({
          ...s,
          sdk: null,
          supported: false,
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

        const model = OS?.User?.pushSubscription || OS?.User?.PushSubscription;

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

        if ('serviceWorker' in navigator) {
          const registration = await waitForServiceWorkerRegistration();
          if (!registration) {
            console.warn('[usePushStatus] keine Service-Worker-Registration verfügbar');
          }
        }

        // Abonnieren (SDK-kompatibel: optIn + subscribe)
        if (typeof model?.optIn === 'function') {
          await model.optIn();
        }
        if (typeof OS?.Notifications?.subscribe === 'function') {
          await OS.Notifications.subscribe();
        }

        // ID holen (mit Retry, damit neue Abos sicher eine ID erhalten)
        const sid = await waitForSubscriptionId(OS, { attempts: 15, delayMs: 400 });

        if (!sid) {
          setState((s) => ({
            ...s,
            permissionState: 'granted',
            granted: true,
            blocked: false,
            optedIn: false,
            subId: null,
            loading: false,
            error: 'OneSignal hat keine Subscription-ID zurückgegeben. Bitte erneut versuchen.',
          }));
          return;
        }

        if (sid) {
          const reg = await ensureServiceWorkerRegistration();
          const scope = reg?.scope || SERVICE_WORKER_INFO.scope || null;
          const device =
            navigator.userAgentData?.platform || navigator.platform || null;
          const ua = navigator.userAgent || null;
          let anglerName = null;
          try {
            anglerName = localStorage.getItem('anglerName') || null;
          } catch {
            anglerName = null;
          }

          const { data: userRes, error: userErr } = await supabase.auth.getUser();
          if (userErr) {
            throw userErr;
          }
          const uid = userRes?.user?.id;
          if (!uid) {
            throw new Error('Kein eingeloggter Nutzer für Push vorhanden.');
          }

          await upsertPushSubscriptionRecord({
            subscriptionId: sid,
            userId: uid,
            clubId: getActiveClubId(),
            scope,
            deviceLabel: device,
            userAgent: ua,
            optedIn: true,
            revokedAt: null,
            anglerName,
          });
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

    enqueueOneSignal(exec, { requireUser: true }).catch((err) => {
      setState((s) => ({
        ...s,
        loading: false,
        error: err?.message || String(err),
      }));
    });
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

    enqueueOneSignal(exec, { requireUser: true }).catch((err) => {
      setState((s) => ({ ...s, loading: false, error: err?.message || String(err) }));
    });
  };

  // alias für Altcode (permission als boolean)
  return { ...state, permission: state.granted, subscribe, unsubscribe };
}

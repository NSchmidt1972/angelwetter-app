import { useEffect, useState } from 'react';
import { runWhenOneSignalReady, enqueueOneSignal } from '@/onesignal/deferred';

export default function OneSignalHealthCheck() {
  const [state, setState] = useState({
    sdkLoaded: false,
    isSupported: null,
    permission: null,   // boolean
    optedIn: null,      // boolean
    isPushEnabled: null,
    subId: null,
    error: null,
  });

  useEffect(() => {
    const initCheck = async (OneSignal) => {
      try {
        const isSupported = OneSignal.Notifications.isPushSupported();
        const permission = !!OneSignal.Notifications.permission;
        const sub = OneSignal.User?.PushSubscription;
        const subId = sub?.id ?? null;
        const optedIn = !!sub?.optedIn;

        setState({
          sdkLoaded: true,
          isSupported,
          permission,
          optedIn,
          isPushEnabled: !!(isSupported && permission && optedIn && subId),
          subId,
          error: null,
        });

        // Handlers einmalig definieren, damit remove funktioniert
        const onPerm = (perm) => {
          const granted = typeof perm === 'boolean' ? perm : !!perm; // robust
          setState((s) => {
            const enabled = !!(s.isSupported && granted && s.optedIn && s.subId);
            return { ...s, permission: granted, isPushEnabled: enabled };
          });
        };

        const onSubChange = (ev) => {
          const cur = ev?.current || {};
          setState((s) => {
            const subId2 = cur.id ?? s.subId;
            const optedIn2 = typeof cur.optedIn === 'boolean' ? cur.optedIn : s.optedIn;
            const enabled = !!(s.isSupported && s.permission && optedIn2 && subId2);
            return { ...s, subId: subId2, optedIn: optedIn2, isPushEnabled: enabled };
          });
        };

        // Listener registrieren
        OneSignal.Notifications.addEventListener('permissionChange', onPerm);
        OneSignal.User.PushSubscription.addEventListener('change', onSubChange);

        // Cleanup bei Unmount
        return () => {
          OneSignal.Notifications.removeEventListener('permissionChange', onPerm);
          OneSignal.User.PushSubscription.removeEventListener('change', onSubChange);
        };
      } catch (e) {
        setState((s) => ({ ...s, sdkLoaded: true, error: e?.message || String(e) }));
      }
    };

    let cleanup;
    let cancelled = false;

    const { cancel, promise } = runWhenOneSignalReady(async (OneSignal) => {
      if (cancelled) return;
      const maybeCleanup = await initCheck(OneSignal);
      if (cancelled && typeof maybeCleanup === 'function') {
        maybeCleanup();
        return;
      }
      cleanup = typeof maybeCleanup === 'function' ? maybeCleanup : undefined;
    });

    promise.catch((err) => {
      if (!cancelled) {
        setState((s) => ({ ...s, sdkLoaded: true, error: err?.message || String(err) }));
      }
    });

    return () => {
      cancelled = true;
      cancel();
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  // ---- Helpers / Actions ----
  const refresh = (OneSignal) => {
    const isSupported = OneSignal.Notifications.isPushSupported();
    const permission = !!OneSignal.Notifications.permission;
    const sub = OneSignal.User?.PushSubscription;
    setState((s) => ({
      ...s,
      isSupported,
      permission,
      optedIn: !!sub?.optedIn,
      subId: sub?.id ?? null,
      isPushEnabled: !!(isSupported && permission && sub?.optedIn && sub?.id),
      error: null,
    }));
  };

  const subscribe = () => {
    enqueueOneSignal(async (OneSignal) => {
      try {
        // Permission anfragen, bei Ablehnung abbrechen
        if (!OneSignal.Notifications.permission) {
          const granted = await OneSignal.Notifications.requestPermission();
          if (!granted) {
            setState((s) => ({ ...s, error: 'Benachrichtigungen wurden abgelehnt.' }));
            return;
          }
        }

        // Warten bis SW Seite kontrolliert
        if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;

        // Opt-In (v16)
        await OneSignal.User.PushSubscription.optIn();

        // Falls vorhanden zusätzlich subscribe() (manche Umgebungen brauchen es)
        if (typeof OneSignal.Notifications.subscribe === 'function') {
          await OneSignal.Notifications.subscribe();
        }

        // kurz pollen, bis ID da ist
        for (let i = 0; i < 10; i++) {
          if (OneSignal.User?.PushSubscription?.id) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        refresh(OneSignal);
      } catch (e) {
        setState((s) => ({ ...s, error: e?.message || String(e) }));
      }
    });
  };

  const unsubscribe = () => {
    enqueueOneSignal(async (OneSignal) => {
      try {
        await OneSignal.User.PushSubscription.optOut();
        refresh(OneSignal);
      } catch (e) {
        setState((s) => ({ ...s, error: e?.message || String(e) }));
      }
    });
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow max-w-xl mx-auto mt-6 text-gray-800 dark:text-gray-100">
      <h2 className="text-lg font-bold mb-3 text-blue-700 dark:text-blue-400">🔎 OneSignal Health Check</h2>
      <ul className="space-y-1 text-sm">
        <li>📦 SDK geladen: <b>{state.sdkLoaded ? '✅' : '❌'}</b></li>
        <li>🧭 Browser unterstützt Push: <b>{state.isSupported == null ? '…' : state.isSupported ? '✅' : '❌'}</b></li>
        <li>🔐 Permission: <b>{state.permission == null ? '…' : state.permission ? 'granted' : 'default/denied'}</b></li>
        <li>📬 Opt-in (Abo-Status): <b>{state.optedIn == null ? '…' : state.optedIn ? '✅' : '❌'}</b></li>
        <li>🆔 Subscription-ID: <b className="break-all">{state.subId || '—'}</b></li>
        <li>🔔 Push aktiviert (gesamt): <b>{state.isPushEnabled == null ? '…' : state.isPushEnabled ? '✅' : '❌'}</b></li>
      </ul>

      {state.error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">❌ {state.error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button onClick={subscribe} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded">
          Abo anfragen (Subscribe)
        </button>
        <button onClick={unsubscribe} className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">
          Abo beenden (Unsubscribe)
        </button>
      </div>
    </div>
  );
}

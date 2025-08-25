// src/hooks/usePushStatus.js
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/supabaseClient';

export default function usePushStatus(currentUser) {
  const [status, setStatus] = useState({
    sdk: false,
    supported: null,
    permission: null,
    optedIn: null,
    subId: null,
    loading: true,
    error: null,
  });

  // Status aus OneSignal lesen
  const read = useCallback((OS) => {
    const supported = OS.Notifications.isPushSupported();
    const permission = !!OS.Notifications.permission;
    const sub = OS.User?.PushSubscription;
    const subId = sub?.id ?? null;
    const optedIn = !!sub?.optedIn;
    setStatus({
      sdk: true,
      supported,
      permission,
      optedIn,
      subId,
      loading: false,
      error: null,
    });
    return { supported, permission, optedIn, subId };
  }, []);

  // Sub-ID in Supabase mappen (optional)
  const saveToSupabase = useCallback(async (subId) => {
    try {
      if (!currentUser || !subId) return;
      await supabase.from('push_subscriptions').upsert({
        user_id: currentUser.id,
        email: currentUser.email,
        subscription_id: subId,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      // still fine if this fails
      console.warn('[push] save subId failed:', e?.message);
    }
  }, [currentUser]);

  useEffect(() => {
    let cleanup;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const init = async (OS) => {
      const initial = read(OS);
      if (initial.subId) saveToSupabase(initial.subId);

      const onPerm = (perm) => {
        const granted = !!perm;
        setStatus(s => {
          const enabled = !!(s.supported && granted && s.optedIn && s.subId);
          return { ...s, permission: granted, sdk: true, loading: false, error: null, isEnabled: enabled };
        });
      };
      const onSubChange = (ev) => {
        const cur = ev?.current || {};
        setStatus(s => {
          const subId = cur.id ?? s.subId;
          const optedIn = typeof cur.optedIn === 'boolean' ? cur.optedIn : s.optedIn;
          const enabled = !!(s.supported && s.permission && optedIn && subId);
          if (subId && subId !== s.subId) saveToSupabase(subId);
          return { ...s, subId, optedIn, sdk: true, loading: false, error: null, isEnabled: enabled };
        });
      };
      OS.Notifications.addEventListener('permissionChange', onPerm);
      OS.User.PushSubscription.addEventListener('change', onSubChange);

      cleanup = () => {
        OS.Notifications.removeEventListener('permissionChange', onPerm);
        OS.User.PushSubscription.removeEventListener('change', onSubChange);
      };
    };

    if (window.OneSignal && window.OneSignal.Notifications) {
      init(window.OneSignal);
    } else {
      window.OneSignalDeferred.push(init);
    }
    return () => { if (cleanup) cleanup(); };
  }, [read, saveToSupabase]);

  // Aktionen
  const subscribe = useCallback(() => {
    window.OneSignalDeferred.push(async (OS) => {
      try {
        if (!OS.Notifications.permission) {
          const granted = await OS.Notifications.requestPermission();
          if (!granted) return setStatus(s => ({ ...s, error: 'Benachrichtigungen abgelehnt' }));
        }
        await navigator.serviceWorker.ready;
        await OS.User.PushSubscription.optIn();
        if (typeof OS.Notifications.subscribe === 'function') {
          await OS.Notifications.subscribe();
        }
      } catch (e) {
        setStatus(s => ({ ...s, error: e?.message || String(e) }));
      }
    });
  }, []);

  const unsubscribe = useCallback(() => {
    window.OneSignalDeferred.push(async (OS) => {
      try {
        await OS.User.PushSubscription.optOut();
      } catch (e) {
        setStatus(s => ({ ...s, error: e?.message || String(e) }));
      }
    });
  }, []);

  return { ...status, subscribe, unsubscribe };
}

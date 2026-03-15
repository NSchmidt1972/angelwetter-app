import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import {
  attachPushStatusListeners,
  ensureOneSignalInitialized,
  getOneSignalRuntimeBlockReason,
  getSubscriptionId,
  isOneSignalDisabledError,
  shouldAutoInitOneSignalRuntime,
  revokeCurrentSubscription,
  setOneSignalSafariBackoff,
  syncCurrentSubscription,
} from '@/onesignal/onesignalService';
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES } from '@/permissions/features';

export default function PushInit() {
  const { loading: permissionsLoading, hasFeatureForRole } = usePermissions();

  useEffect(() => {
    if (permissionsLoading) return undefined;
    if (!hasFeatureForRole(FEATURES.PUSH)) return undefined;

    let disposed = false;
    const cleanupFns = [];

    const registerCleanup = (cleanup) => {
      if (typeof cleanup === 'function') {
        cleanupFns.push(cleanup);
      }
    };

    const start = async () => {
      try {
        const blockReason = getOneSignalRuntimeBlockReason();
        if (!shouldAutoInitOneSignalRuntime()) {
          if (blockReason === 'safari-backoff') {
            console.warn('[PushInit] Safari OneSignal-Init im Backoff, wird übersprungen.');
          }
          return;
        }

        const OneSignal = await ensureOneSignalInitialized();
        if (disposed) return;

        await syncCurrentSubscription({ OneSignal });

        registerCleanup(
          attachPushStatusListeners(OneSignal, {
            onSubscriptionChange: async (event) => {
              const current = event?.current || {};
              const subscriptionId = current?.id ?? (await getSubscriptionId(OneSignal));
              if (!subscriptionId) return;

              try {
                if (current?.optedIn === false) {
                  await revokeCurrentSubscription({
                    OneSignal,
                    subscriptionId,
                  });
                  return;
                }
                await syncCurrentSubscription({
                  OneSignal,
                  subscriptionId,
                  optedIn: typeof current?.optedIn === 'boolean' ? current.optedIn : true,
                  revokedAt: null,
                });
              } catch (err) {
                console.warn('[PushInit] Sync nach Subscription-Change fehlgeschlagen:', err);
              }
            },
          })
        );

        const onNotificationSubscriptionChange = async () => {
          try {
            await syncCurrentSubscription({ OneSignal });
          } catch (err) {
            console.warn('[PushInit] Sync nach Notifications-Event fehlgeschlagen:', err);
          }
        };

        OneSignal?.Notifications?.addEventListener?.('subscriptionChange', onNotificationSubscriptionChange);
        registerCleanup(() => {
          OneSignal?.Notifications?.removeEventListener?.('subscriptionChange', onNotificationSubscriptionChange);
        });

        const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (!session?.user?.id) return;
          try {
            await syncCurrentSubscription({ OneSignal });
          } catch (err) {
            console.warn('[PushInit] Sync nach Auth-State-Change fehlgeschlagen:', err);
          }
        });
        registerCleanup(() => authSub?.subscription?.unsubscribe?.());
      } catch (err) {
        if (isOneSignalDisabledError(err)) {
          return;
        }
        const message = String(err?.message || err || '').toLowerCase();
        if (message.includes('serviceworkerregistration') || message.includes('postmessage')) {
          setOneSignalSafariBackoff();
        }
        console.warn('[PushInit] OneSignal-Initialisierung fehlgeschlagen:', err);
      }
    };
    void start();

    return () => {
      disposed = true;
      cleanupFns.forEach((fn) => {
        try {
          fn?.();
        } catch (err) {
          console.warn('[PushInit] cleanup failed:', err);
        }
      });
    };
  }, [permissionsLoading, hasFeatureForRole]);

  return null;
}

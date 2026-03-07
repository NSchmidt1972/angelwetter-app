import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import {
  attachPushStatusListeners,
  ensureOneSignalInitialized,
  getSubscriptionId,
  revokeCurrentSubscription,
  syncCurrentSubscription,
} from '@/onesignal/onesignalService';

export default function PushInit() {
  useEffect(() => {
    let disposed = false;
    const cleanupFns = [];

    const registerCleanup = (cleanup) => {
      if (typeof cleanup === 'function') {
        cleanupFns.push(cleanup);
      }
    };

    const start = async () => {
      try {
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
  }, []);

  return null;
}

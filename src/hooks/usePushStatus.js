import { useEffect, useState } from 'react';
import {
  attachPushStatusListeners,
  clearOneSignalSafariBackoff,
  ensureOneSignalInitialized,
  getOneSignalRuntimeBlockReason,
  getPushStatusSnapshot,
  getSubscriptionId,
  isOneSignalEnabledForRuntime,
  isPushSupported,
  subscribeCurrentUser,
  unsubscribeCurrentUser,
} from '@/onesignal/onesignalService';
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES } from '@/permissions/features';

const INITIAL_STATE = {
  sdk: null,
  supported: null,
  permissionState: 'default',
  granted: false,
  blocked: false,
  optedIn: false,
  subId: null,
  loading: true,
  error: null,
};

export default function usePushStatus() {
  const { loading: permissionsLoading, hasFeatureForRole } = usePermissions();
  const pushFeatureEnabled = !permissionsLoading && hasFeatureForRole(FEATURES.PUSH);
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    if (permissionsLoading) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      return undefined;
    }

    if (!pushFeatureEnabled) {
      setState((prev) => ({
        ...prev,
        sdk: null,
        supported: false,
        loading: false,
        error: 'Push ist für deinen Verein oder deine Rolle deaktiviert.',
      }));
      return undefined;
    }

    let cancelled = false;
    let cleanup = null;

    const start = async () => {
      if (!isOneSignalEnabledForRuntime()) {
        if (!cancelled) {
          const reason = getOneSignalRuntimeBlockReason();
          setState((prev) => ({
            ...prev,
            sdk: null,
            supported: reason === 'safari-disabled-by-env' ? false : null,
            loading: false,
            error:
              reason === 'safari-backoff'
                ? 'Push wird gerade in Safari vorbereitet. Bitte kurz erneut versuchen.'
                : reason === 'safari-disabled-by-env'
                  ? 'Push ist in Safari derzeit deaktiviert.'
                  : null,
          }));
        }
        return;
      }

      try {
        const sdk = await ensureOneSignalInitialized();
        if (cancelled) return;

        const snapshot = await getPushStatusSnapshot(sdk);
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          ...snapshot,
          loading: false,
          error: null,
        }));

        cleanup = attachPushStatusListeners(sdk, {
          onPermissionChange: (permissionState) => {
            setState((prev) => ({
              ...prev,
              permissionState,
              granted: permissionState === 'granted',
              blocked: permissionState === 'denied',
            }));
          },
          onSubscriptionChange: async (event) => {
            const current = event?.current || {};
            const subId = current?.id ?? (await getSubscriptionId(sdk));
            setState((prev) => ({
              ...prev,
              subId,
              optedIn: typeof current?.optedIn === 'boolean' ? current.optedIn : prev.optedIn,
            }));
          },
        });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            sdk: null,
            supported: false,
            loading: false,
            error: err?.message || String(err),
          }));
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [permissionsLoading, pushFeatureEnabled]);

  const subscribe = async () => {
    if (!pushFeatureEnabled) {
      setState((prev) => ({
        ...prev,
        loading: false,
        supported: false,
        error: 'Push ist für deinen Verein oder deine Rolle deaktiviert.',
      }));
      return;
    }
    if (!isOneSignalEnabledForRuntime()) {
      const reason = getOneSignalRuntimeBlockReason();
      if (reason === 'safari-backoff') {
        // Expliziter User-Intent darf den temporären Backoff einmalig aufheben.
        clearOneSignalSafariBackoff();
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          supported: reason === 'safari-disabled-by-env' ? false : null,
          error: reason === 'safari-backoff'
            ? 'Push ist kurz pausiert (Safari-Backoff). Bitte in wenigen Minuten erneut versuchen.'
            : 'Push ist in Safari derzeit deaktiviert.',
        }));
        return;
      }

      if (!isOneSignalEnabledForRuntime()) {
        setState((prev) => ({
          ...prev,
          loading: false,
          supported: null,
          error: 'Push ist kurz pausiert (Safari-Backoff). Bitte erneut versuchen.',
        }));
        return;
      }
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const sdk = await ensureOneSignalInitialized();
      if (!isPushSupported(sdk)) {
        throw new Error('Push wird auf diesem Gerät/Browser nicht unterstützt.');
      }

      const subId = await subscribeCurrentUser(sdk);
      if (!subId) {
        setState((prev) => ({
          ...prev,
          loading: false,
          permissionState: 'granted',
          granted: true,
          blocked: false,
          optedIn: false,
          subId: null,
          error: 'OneSignal hat keine Subscription-ID zurückgegeben. Bitte erneut versuchen.',
        }));
        return;
      }

      const snapshot = await getPushStatusSnapshot(sdk);
      setState((prev) => ({
        ...prev,
        ...snapshot,
        optedIn: true,
        subId,
        loading: false,
        error: null,
      }));
    } catch (err) {
      const rawMessage = err?.message || String(err);
      const message = /blockiert/i.test(rawMessage)
        ? 'Benachrichtigungen im Browser blockiert. Bitte in den Browser-Einstellungen für diese Seite erlauben und erneut versuchen.'
        : rawMessage;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  };

  const unsubscribe = async () => {
    if (!pushFeatureEnabled) {
      setState((prev) => ({
        ...prev,
        loading: false,
        supported: false,
        error: null,
      }));
      return;
    }
    if (!isOneSignalEnabledForRuntime()) {
      const reason = getOneSignalRuntimeBlockReason();
      setState((prev) => ({
        ...prev,
        loading: false,
        supported: reason === 'safari-disabled-by-env' ? false : null,
        error: null,
      }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const sdk = await ensureOneSignalInitialized();
      await unsubscribeCurrentUser(sdk);
      const snapshot = await getPushStatusSnapshot(sdk);
      setState((prev) => ({
        ...prev,
        ...snapshot,
        optedIn: false,
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || String(err),
      }));
    }
  };

  return { ...state, permission: state.granted, subscribe, unsubscribe };
}

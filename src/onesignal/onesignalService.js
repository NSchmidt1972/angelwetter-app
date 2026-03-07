import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { getOneSignal } from '@/onesignal/sdkLoader';
import {
  ensureServiceWorkerRegistration,
  waitForServiceWorkerRegistration,
  SERVICE_WORKER_INFO,
} from '@/onesignal/swHelpers';
import {
  revokePushSubscriptionRecord,
  upsertPushSubscriptionRecord,
} from '@/onesignal/pushSubscriptionStore';

const ONESIGNAL_APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID?.trim() ||
  'b05a44e8-bea5-4941-8972-5194254aadad';

const GLOBAL_STATE_KEY = '__awOneSignalServiceState';

const localState = {
  initialized: false,
  initPromise: null,
};

function getServiceState() {
  if (typeof window === 'undefined') return localState;
  if (!window[GLOBAL_STATE_KEY]) {
    window[GLOBAL_STATE_KEY] = { initialized: false, initPromise: null };
  }
  return window[GLOBAL_STATE_KEY];
}

function normalizePermissionState(value) {
  if (value === 'granted' || value === 'denied' || value === 'default') {
    return value;
  }
  if (value === true) return 'granted';
  if (value === false) return 'denied';
  return 'default';
}

function getDeviceMetadata() {
  if (typeof navigator === 'undefined') {
    return { deviceLabel: null, userAgent: null };
  }
  return {
    deviceLabel: navigator.userAgentData?.platform || navigator.platform || null,
    userAgent: navigator.userAgent || null,
  };
}

function readLocalStorageValue(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

export function getPushSubscriptionModel(OneSignal) {
  return OneSignal?.User?.pushSubscription || OneSignal?.User?.PushSubscription || null;
}

export function getPermissionState(OneSignal) {
  return normalizePermissionState(OneSignal?.Notifications?.permission);
}

export function isPushSupported(OneSignal) {
  if (!OneSignal?.Notifications) return false;
  const supportedValue = OneSignal.Notifications.isPushSupported;
  try {
    return typeof supportedValue === 'function' ? !!supportedValue() : !!supportedValue;
  } catch (err) {
    console.warn('[onesignalService] isPushSupported() fehlgeschlagen:', err);
    return false;
  }
}

export async function getSubscriptionId(OneSignal) {
  if (!OneSignal) return null;
  const model = getPushSubscriptionModel(OneSignal);
  if (model?.id) return model.id;

  if (typeof model?.getId === 'function') {
    try {
      const id = await model.getId();
      if (id) return id;
    } catch (err) {
      console.warn('[onesignalService] pushSubscription.getId() fehlgeschlagen:', err);
    }
  }

  if (typeof OneSignal?.User?.getId === 'function') {
    try {
      const userId = await OneSignal.User.getId();
      return userId || null;
    } catch (err) {
      console.warn('[onesignalService] OneSignal.User.getId() fehlgeschlagen:', err);
    }
  }

  return null;
}

export async function waitForSubscriptionId(
  OneSignal,
  { attempts = 20, delayMs = 500, timeoutMs } = {}
) {
  const immediate = await getSubscriptionId(OneSignal);
  if (immediate) return immediate;

  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const model = getPushSubscriptionModel(OneSignal);
    let finished = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      if (pollTimer) window.clearTimeout(pollTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      model?.removeEventListener?.('change', onChange);
    };

    const done = (value) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(value ?? null);
    };

    const onChange = async (event) => {
      const candidate = event?.current?.id ?? (await getSubscriptionId(OneSignal));
      if (candidate) done(candidate);
    };

    model?.addEventListener?.('change', onChange);

    const poll = async (attempt = 0) => {
      const candidate = await getSubscriptionId(OneSignal);
      if (candidate) {
        done(candidate);
        return;
      }
      if (attempt >= attempts) {
        done(null);
        return;
      }
      pollTimer = window.setTimeout(() => {
        void poll(attempt + 1);
      }, delayMs);
    };

    void poll();

    const totalTimeout = timeoutMs ?? attempts * delayMs + 5000;
    timeoutTimer = window.setTimeout(() => done(null), totalTimeout);
  });
}

async function ensureSubscribedWhenPermissionGranted(OneSignal) {
  if (!isPushSupported(OneSignal)) return;
  if (getPermissionState(OneSignal) !== 'granted') return;

  const model = getPushSubscriptionModel(OneSignal);
  if (model?.optedIn !== false) return;

  if (typeof model?.optIn === 'function') {
    await model.optIn();
  }
  if (typeof OneSignal?.Notifications?.subscribe === 'function') {
    await OneSignal.Notifications.subscribe();
  }
}

function buildInitOptions(registration) {
  const options = {
    appId: ONESIGNAL_APP_ID,
    allowLocalhostAsSecureOrigin: true,
    serviceWorkerParam: { scope: SERVICE_WORKER_INFO.scope },
  };
  if (registration) {
    options.serviceWorkerRegistration = registration;
  } else {
    // Fallback: wenn noch keine eigene Registrierung vorhanden ist,
    // soll OneSignal den dedizierten Pfad selbst registrieren.
    options.serviceWorkerPath = SERVICE_WORKER_INFO.initPath;
  }
  return options;
}

export async function ensureOneSignalInitialized() {
  const state = getServiceState();
  if (state.initialized && typeof window !== 'undefined' && window.OneSignal?.Notifications) {
    return window.OneSignal;
  }
  if (state.initPromise) {
    return state.initPromise;
  }

  state.initPromise = (async () => {
    const OneSignal = await getOneSignal({ timeoutMs: 20_000 });
    const registration = await waitForServiceWorkerRegistration();
    try {
      await OneSignal.init(buildInitOptions(registration));
    } catch (err) {
      const message = String(err?.message || err || '');
      if (!/already.*init/i.test(message) && !/already initialized/i.test(message)) {
        throw err;
      }
    }

    await ensureSubscribedWhenPermissionGranted(OneSignal);
    state.initialized = true;
    return OneSignal;
  })().catch((err) => {
    state.initialized = false;
    state.initPromise = null;
    throw err;
  });

  return state.initPromise;
}

export async function getPushStatusSnapshot(OneSignal) {
  const sdk = OneSignal || (await ensureOneSignalInitialized());
  const permissionState = getPermissionState(sdk);
  const model = getPushSubscriptionModel(sdk);
  const subId = await getSubscriptionId(sdk);

  return {
    sdk,
    supported: isPushSupported(sdk),
    permissionState,
    granted: permissionState === 'granted',
    blocked: permissionState === 'denied',
    optedIn: !!model?.optedIn,
    subId,
  };
}

export function attachPushStatusListeners(
  OneSignal,
  { onPermissionChange, onSubscriptionChange } = {}
) {
  const model = getPushSubscriptionModel(OneSignal);

  const permissionHandler = (value) => {
    onPermissionChange?.(normalizePermissionState(value));
  };

  const subscriptionHandler = async (event) => {
    onSubscriptionChange?.(event);
  };

  OneSignal?.Notifications?.addEventListener?.('permissionChange', permissionHandler);
  model?.addEventListener?.('change', subscriptionHandler);

  return () => {
    OneSignal?.Notifications?.removeEventListener?.('permissionChange', permissionHandler);
    model?.removeEventListener?.('change', subscriptionHandler);
  };
}

export async function requestPushPermission(OneSignal) {
  const sdk = OneSignal || (await ensureOneSignalInitialized());
  const result = await sdk.Notifications.requestPermission();
  return normalizePermissionState(result);
}

export async function subscribeCurrentUser(OneSignal) {
  const sdk = OneSignal || (await ensureOneSignalInitialized());
  if (!isPushSupported(sdk)) {
    throw new Error('Push wird auf diesem Gerät/Browser nicht unterstützt.');
  }

  let permissionState = getPermissionState(sdk);
  if (permissionState !== 'granted') {
    permissionState = await requestPushPermission(sdk);
    if (permissionState !== 'granted') {
      throw new Error(
        permissionState === 'denied'
          ? 'Benachrichtigungen im Browser blockiert.'
          : 'Berechtigung nicht erteilt.'
      );
    }
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    await waitForServiceWorkerRegistration();
  }

  const model = getPushSubscriptionModel(sdk);
  if (typeof model?.optIn === 'function') {
    await model.optIn();
  }
  if (typeof sdk?.Notifications?.subscribe === 'function') {
    await sdk.Notifications.subscribe();
  }

  return waitForSubscriptionId(sdk, { attempts: 15, delayMs: 400 });
}

export async function unsubscribeCurrentUser(OneSignal) {
  const sdk = OneSignal || (await ensureOneSignalInitialized());
  const model = getPushSubscriptionModel(sdk);
  if (typeof model?.optOut === 'function') {
    await model.optOut();
  }
}

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('[onesignalService] getUser fehlgeschlagen:', error);
  }
  return data?.user?.id || null;
}

export async function syncCurrentSubscription({
  OneSignal,
  subscriptionId = null,
  optedIn = true,
  revokedAt = null,
} = {}) {
  const sdk = OneSignal || (await ensureOneSignalInitialized());
  const sid = subscriptionId || (await getSubscriptionId(sdk));
  if (!sid) return false;

  const userId = await getAuthenticatedUserId();
  if (!userId) return false;

  const registration = await ensureServiceWorkerRegistration();
  const { deviceLabel, userAgent } = getDeviceMetadata();
  const anglerName = readLocalStorageValue('anglerName');

  await upsertPushSubscriptionRecord({
    subscriptionId: sid,
    userId,
    clubId: getActiveClubId(),
    scope: registration?.scope || SERVICE_WORKER_INFO.scope || null,
    deviceLabel,
    userAgent,
    optedIn,
    revokedAt,
    anglerName,
  });

  return true;
}

export async function revokeCurrentSubscription({
  OneSignal,
  subscriptionId = null,
} = {}) {
  const sdk = OneSignal || (await ensureOneSignalInitialized());
  const sid = subscriptionId || (await getSubscriptionId(sdk));
  if (!sid) return false;

  const userId = await getAuthenticatedUserId();
  if (!userId) return false;

  await revokePushSubscriptionRecord({
    subscriptionId: sid,
    userId,
    clubId: getActiveClubId(),
  });

  return true;
}

export async function withOneSignal(callback) {
  const OneSignal = await ensureOneSignalInitialized();
  return callback(OneSignal);
}

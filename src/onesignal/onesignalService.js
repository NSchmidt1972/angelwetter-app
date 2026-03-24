import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { getOneSignal } from '@/onesignal/sdkLoader';
import {
  cleanupLegacyOneSignalRegistrations,
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
const DISABLE_PUSH_ON_SAFARI = import.meta.env.VITE_DISABLE_PUSH_ON_SAFARI === '1';
const PUSH_AUTO_INIT_MODE = String(import.meta.env.VITE_PUSH_AUTO_INIT || 'default').trim().toLowerCase();
const SAFARI_ONESIGNAL_BACKOFF_KEY = '__aw_safari_onesignal_backoff_until';
const SAFARI_ONESIGNAL_BACKOFF_MS = (() => {
  const parsed = Number.parseInt(import.meta.env.VITE_ONESIGNAL_SAFARI_BACKOFF_MS || '', 10);
  if (Number.isFinite(parsed) && parsed >= 1000) return parsed;
  return 5 * 60 * 1000;
})();

const GLOBAL_STATE_KEY = '__awOneSignalServiceState';

const localState = {
  initialized: false,
  initPromise: null,
};
const SAFARI_ONESIGNAL_INIT_DELAY_MS = 1200;
const SW_READY_TIMEOUT_MS = 8000;

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

function isLikelySafariWebKit() {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '').toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium') && !ua.includes('android');
}

function readSafariBackoffUntil() {
  if (typeof window === 'undefined') return 0;
  try {
    const parsed = Number.parseInt(window.sessionStorage.getItem(SAFARI_ONESIGNAL_BACKOFF_KEY) || '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeSafariBackoffUntil(until) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SAFARI_ONESIGNAL_BACKOFF_KEY, String(until));
  } catch {
    /* ignore */
  }
}

export function setOneSignalSafariBackoff(durationMs = SAFARI_ONESIGNAL_BACKOFF_MS) {
  if (!isLikelySafariWebKit()) return;
  writeSafariBackoffUntil(Date.now() + Math.max(1000, durationMs));
}

export function clearOneSignalSafariBackoff() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SAFARI_ONESIGNAL_BACKOFF_KEY);
  } catch {
    /* ignore */
  }
}

function shouldAutoInitByMode() {
  if (PUSH_AUTO_INIT_MODE === 'off') return false;
  if (PUSH_AUTO_INIT_MODE === 'on') return true;
  // default: Safari nur lazy/on-demand initialisieren, um Resume stabil zu halten.
  return !isLikelySafariWebKit();
}

export function getOneSignalRuntimeBlockReason() {
  if (DISABLE_PUSH_ON_SAFARI && isLikelySafariWebKit()) return 'safari-disabled-by-env';
  if (isLikelySafariWebKit() && readSafariBackoffUntil() > Date.now()) return 'safari-backoff';
  return null;
}

export function isOneSignalEnabledForRuntime() {
  return !getOneSignalRuntimeBlockReason();
}

export function shouldAutoInitOneSignalRuntime() {
  return isOneSignalEnabledForRuntime() && shouldAutoInitByMode();
}

export function isOneSignalDisabledError(error) {
  return String(error?.code || '') === 'ONE_SIGNAL_DISABLED_RUNTIME';
}

async function wait(ms) {
  if (typeof window === 'undefined') return;
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForVisible({ timeoutMs = 10_000 } = {}) {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') return;
  await new Promise((resolve) => {
    let done = false;
    let timeoutId = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resolve();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') finish();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    timeoutId = window.setTimeout(finish, timeoutMs);
  });
}

async function waitForServiceWorkerReady({ timeoutMs = SW_READY_TIMEOUT_MS } = {}) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  let timeoutId = null;
  const timeout = new Promise((resolve) => {
    timeoutId = window.setTimeout(resolve, timeoutMs);
  });
  try {
    await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId);
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
  return {
    appId: ONESIGNAL_APP_ID,
    allowLocalhostAsSecureOrigin: true,
    // Absolute SW-Pfade verwenden, damit Unterrouten/Slug-Routen die Registrierung nicht brechen.
    serviceWorkerPath: SERVICE_WORKER_INFO.registerPath,
    serviceWorkerUpdaterPath: SERVICE_WORKER_INFO.updaterPath,
    serviceWorkerRegistration: registration,
    serviceWorkerParam: { scope: SERVICE_WORKER_INFO.scope },
  };
}

export async function ensureOneSignalInitialized() {
  const runtimeBlockReason = getOneSignalRuntimeBlockReason();
  if (runtimeBlockReason) {
    const runtimeError = new Error(
      runtimeBlockReason === 'safari-backoff'
        ? 'Push ist in Safari vorübergehend pausiert.'
        : 'Push ist in Safari deaktiviert (ENV).'
    );
    runtimeError.code = 'ONE_SIGNAL_DISABLED_RUNTIME';
    runtimeError.blockReason = runtimeBlockReason;
    throw runtimeError;
  }

  const state = getServiceState();
  if (state.initialized && typeof window !== 'undefined' && window.OneSignal?.Notifications) {
    return window.OneSignal;
  }
  if (state.initPromise) {
    return state.initPromise;
  }

  state.initPromise = (async () => {
    const supportsServiceWorker =
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator;
    if (!supportsServiceWorker) {
      throw new Error('Service Worker wird in diesem Browser nicht unterstützt.');
    }

    if (isLikelySafariWebKit()) {
      await waitForVisible({ timeoutMs: 12_000 });
      await waitForServiceWorkerReady({ timeoutMs: SW_READY_TIMEOUT_MS });
      await wait(SAFARI_ONESIGNAL_INIT_DELAY_MS);
    }

    // Registrierung zuerst sichern, erst danach SDK laden/initen.
    // Sonst versucht das SDK teilweise zu früh "Page -> SW" postMessage.
    const registration = await waitForServiceWorkerRegistration({
      timeoutMs: 10_000,
      cleanupLegacy: true,
    });
    if (!registration) {
      throw new Error('OneSignal Service-Worker Registrierung nicht verfügbar.');
    }

    const OneSignal = await getOneSignal({ timeoutMs: 20_000 });
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
    const message = String(err?.message || err || '').toLowerCase();
    if (
      isLikelySafariWebKit() &&
      (message.includes('service-worker registrierung') ||
        message.includes('serviceworkerregistration') ||
        message.includes('postmessage'))
    ) {
      setOneSignalSafariBackoff();
    }
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
  const optedIn =
    typeof model?.optedIn === 'boolean'
      ? model.optedIn
      : Boolean(subId && permissionState === 'granted');

  return {
    sdk,
    supported: isPushSupported(sdk),
    permissionState,
    granted: permissionState === 'granted',
    blocked: permissionState === 'denied',
    optedIn,
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
    await waitForServiceWorkerRegistration({ timeoutMs: 10_000, cleanupLegacy: true });
  }

  const model = getPushSubscriptionModel(sdk);
  if (typeof model?.optIn === 'function') {
    await model.optIn();
  }
  if (typeof sdk?.Notifications?.subscribe === 'function') {
    await sdk.Notifications.subscribe();
  }

  let subscriptionId = await waitForSubscriptionId(sdk, { attempts: 30, delayMs: 500 });
  if (subscriptionId) return subscriptionId;

  // Zweiter Versuch: Manche Browser liefern die ID erst nach einem weiteren Subscribe-Pass.
  try {
    if (typeof model?.optIn === 'function') {
      await model.optIn();
    }
    if (typeof sdk?.Notifications?.subscribe === 'function') {
      await sdk.Notifications.subscribe();
    }
  } catch (err) {
    console.warn('[onesignalService] Zweiter Subscribe-Versuch fehlgeschlagen:', err);
  }

  subscriptionId = await waitForSubscriptionId(sdk, { attempts: 20, delayMs: 500, timeoutMs: 16_000 });
  return subscriptionId;
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

  // Legacy-Root-Registrierungen erst entfernen, wenn der neue Pfad stabil synchronisiert ist.
  void cleanupLegacyOneSignalRegistrations().catch((err) => {
    console.warn('[onesignalService] Legacy-OneSignal-Registrierungen konnten nicht bereinigt werden:', err);
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

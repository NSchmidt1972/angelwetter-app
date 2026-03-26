// src/onesignal/swHelpers.js

const ONESIGNAL_SW_SCOPE = '/push/onesignal/';
const ONESIGNAL_SW_REGISTER_PATH = '/push/onesignal/OneSignalSDKWorker.js';
const ONESIGNAL_SW_UPDATER_PATH = '/push/onesignal/OneSignalSDKUpdaterWorker.js';
// Fuer OneSignal.init immer absolute Pfade nutzen, damit Routing/Basenamen keinen Einfluss haben.
const ONESIGNAL_SW_INIT_PATH = ONESIGNAL_SW_REGISTER_PATH;
const ONESIGNAL_SW_INIT_UPDATER_PATH = ONESIGNAL_SW_UPDATER_PATH;

// Diese Pfade bleiben waehrend der Migration bestehen, damit Alt-Abos nicht brechen.
const LEGACY_ONESIGNAL_SW_PATHS = [
  '/OneSignalSDKWorker.js',
  '/OneSignalSDKUpdaterWorker.js',
  '/OneSignalSDK.sw.js',
];

function hasServiceWorkerSupport() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

async function probeServiceWorkerAsset(path) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return { path, ok: false, status: null, contentType: null, error: 'fetch-unavailable' };
  }

  try {
    const response = await fetch(path, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const hasExpectedType =
      !contentType ||
      contentType.includes('javascript') ||
      contentType.includes('ecmascript');
    const ok = response.ok && hasExpectedType;
    return {
      path,
      ok,
      status: response.status,
      contentType: contentType || null,
      error: ok ? null : hasExpectedType ? `http-${response.status}` : `unexpected-content-type:${contentType || 'unknown'}`,
    };
  } catch (error) {
    return {
      path,
      ok: false,
      status: null,
      contentType: null,
      error: error?.message || String(error || 'fetch-failed'),
    };
  }
}

function toAbsoluteUrl(path) {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).href;
}

function toPathname(url) {
  if (!url) return '';
  try {
    const base = typeof window === 'undefined' ? 'https://example.invalid' : window.location.origin;
    return new URL(url, base).pathname || '';
  } catch {
    return '';
  }
}

function getRegistrationScriptUrl(registration) {
  if (!registration) return '';
  return (
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    ''
  );
}

function isLegacyOneSignalScriptPath(pathname) {
  if (!pathname || pathname.startsWith(ONESIGNAL_SW_SCOPE)) return false;
  return LEGACY_ONESIGNAL_SW_PATHS.some((legacyPath) => pathname === legacyPath || pathname.endsWith(legacyPath));
}

function isOneSignalRegistration(registration) {
  if (!registration) return false;
  const expectedScope = toAbsoluteUrl(ONESIGNAL_SW_SCOPE);
  if (registration.scope === expectedScope) return true;

  const scriptUrl = getRegistrationScriptUrl(registration);

  return scriptUrl.includes(ONESIGNAL_SW_REGISTER_PATH);
}

function isLegacyOneSignalRegistration(registration) {
  if (!registration) return false;
  if (isOneSignalRegistration(registration)) return false;
  const scriptPath = toPathname(getRegistrationScriptUrl(registration));
  return isLegacyOneSignalScriptPath(scriptPath);
}

async function cleanupLegacyRegistrations() {
  if (!hasServiceWorkerSupport()) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!Array.isArray(registrations) || registrations.length === 0) return;

    await Promise.all(
      registrations
        .filter(isLegacyOneSignalRegistration)
        .map(async (registration) => {
          try {
            await registration.unregister();
          } catch (error) {
            console.warn('[swHelpers] Legacy-OneSignal-SW konnte nicht entfernt werden:', error);
          }
        })
    );
  } catch (error) {
    console.warn('[swHelpers] Legacy-OneSignal-Registrierungen konnten nicht geprüft werden:', error);
  }
}

async function getOneSignalRegistration() {
  if (!hasServiceWorkerSupport()) return null;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!Array.isArray(registrations)) return null;
    return registrations.find(isOneSignalRegistration) || null;
  } catch (err) {
    console.warn('[swHelpers] getRegistrations fehlgeschlagen:', err);
    return null;
  }
}

export async function ensureServiceWorkerRegistration({ cleanupLegacy = false } = {}) {
  if (!hasServiceWorkerSupport()) return null;

  if (cleanupLegacy) {
    await cleanupLegacyRegistrations();
  }

  const existing = await getOneSignalRegistration();
  if (existing) {
    try {
      await existing.update();
    } catch {
      /* ignore update errors */
    }
    return existing;
  }

  const [workerProbe, compatProbe] = await Promise.all([
    probeServiceWorkerAsset(ONESIGNAL_SW_REGISTER_PATH),
    probeServiceWorkerAsset('/push/onesignal/OneSignalSDK.sw.cdn.js'),
  ]);

  if (!workerProbe.ok || !compatProbe.ok) {
    console.warn('[swHelpers] OneSignal-SW-Assets nicht erreichbar:', {
      workerProbe,
      compatProbe,
    });
  }

  try {
    return await navigator.serviceWorker.register(ONESIGNAL_SW_REGISTER_PATH, {
      scope: ONESIGNAL_SW_SCOPE,
      updateViaCache: 'none',
    });
  } catch (registerErr) {
    console.warn('[swHelpers] OneSignal-SW-Registrierung fehlgeschlagen:', {
      error: registerErr?.message || String(registerErr || ''),
      workerProbe,
      compatProbe,
      scope: ONESIGNAL_SW_SCOPE,
      registerPath: ONESIGNAL_SW_REGISTER_PATH,
    });
    return null;
  }
}

function waitForActivation(registration, { timeoutMs = 8000 } = {}) {
  if (!registration) return Promise.resolve(null);

  if (registration.active) {
    return Promise.resolve(registration);
  }

  if (typeof window === 'undefined') return Promise.resolve(registration);

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    let pollId = null;
    let trackedWorker = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (pollId != null) window.clearInterval(pollId);
      registration.removeEventListener?.('updatefound', onUpdateFound);
      trackedWorker?.removeEventListener?.('statechange', onStateChange);
      resolve(registration.active ? registration : null);
    };

    const onStateChange = () => {
      if (registration.active || trackedWorker?.state === 'activated' || trackedWorker?.state === 'redundant') {
        finish();
      }
    };

    const attachWorker = (worker) => {
      if (!worker) return;
      if (trackedWorker && trackedWorker !== worker) {
        trackedWorker.removeEventListener?.('statechange', onStateChange);
      }
      trackedWorker = worker;
      trackedWorker.addEventListener?.('statechange', onStateChange);
    };

    const onUpdateFound = () => {
      attachWorker(registration.installing || registration.waiting);
    };

    attachWorker(registration.installing || registration.waiting);
    registration.addEventListener?.('updatefound', onUpdateFound);

    pollId = window.setInterval(() => {
      if (registration.active || trackedWorker?.state === 'redundant') {
        finish();
      }
    }, 200);
    timeoutId = window.setTimeout(finish, timeoutMs);
  });
}

export async function waitForServiceWorkerRegistration({ timeoutMs = 4000, cleanupLegacy = false } = {}) {
  if (!hasServiceWorkerSupport()) return null;

  const registration = await ensureServiceWorkerRegistration({ cleanupLegacy });
  if (!registration) return null;

  return waitForActivation(registration, { timeoutMs });
}

export async function cleanupLegacyOneSignalRegistrations() {
  await cleanupLegacyRegistrations();
}

export const SERVICE_WORKER_INFO = {
  scope: ONESIGNAL_SW_SCOPE,
  registerPath: ONESIGNAL_SW_REGISTER_PATH,
  updaterPath: ONESIGNAL_SW_UPDATER_PATH,
  initPath: ONESIGNAL_SW_INIT_PATH,
  initUpdaterPath: ONESIGNAL_SW_INIT_UPDATER_PATH,
  legacyPaths: LEGACY_ONESIGNAL_SW_PATHS,
};

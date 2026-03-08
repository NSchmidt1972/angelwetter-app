// src/onesignal/swHelpers.js

const ONESIGNAL_SW_SCOPE = '/push/onesignal/';
const ONESIGNAL_SW_REGISTER_PATH = '/push/onesignal/OneSignalSDKWorker.js';
const ONESIGNAL_SW_UPDATER_PATH = '/push/onesignal/OneSignalSDKUpdaterWorker.js';
// Fuer OneSignal.init bewusst ohne fuehrenden Slash, damit kein //push => https://push entsteht.
const ONESIGNAL_SW_INIT_PATH = 'push/onesignal/OneSignalSDKWorker.js';
const ONESIGNAL_SW_INIT_UPDATER_PATH = 'push/onesignal/OneSignalSDKUpdaterWorker.js';

// Diese Pfade bleiben waehrend der Migration bestehen, damit Alt-Abos nicht brechen.
const LEGACY_ONESIGNAL_SW_PATHS = [
  '/OneSignalSDKWorker.js',
  '/OneSignalSDKUpdaterWorker.js',
  '/OneSignalSDK.sw.js',
];

function hasServiceWorkerSupport() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

function toAbsoluteUrl(path) {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).href;
}

function isOneSignalRegistration(registration) {
  if (!registration) return false;
  const expectedScope = toAbsoluteUrl(ONESIGNAL_SW_SCOPE);
  if (registration.scope === expectedScope) return true;

  const scriptUrl =
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    '';

  return scriptUrl.includes(ONESIGNAL_SW_REGISTER_PATH);
}

function isLegacyRootOneSignalRegistration(registration) {
  if (!registration) return false;
  const rootScope = toAbsoluteUrl('/');
  if (registration.scope !== rootScope) return false;

  const scriptUrl =
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    '';

  return LEGACY_ONESIGNAL_SW_PATHS.some((path) => scriptUrl.includes(path));
}

async function cleanupLegacyRootRegistrations() {
  if (!hasServiceWorkerSupport()) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!Array.isArray(registrations) || registrations.length === 0) return;

    await Promise.all(
      registrations
        .filter(isLegacyRootOneSignalRegistration)
        .map(async (registration) => {
          try {
            await registration.unregister();
          } catch (error) {
            console.warn('[swHelpers] Legacy-OneSignal-Root-SW konnte nicht entfernt werden:', error);
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

export async function ensureServiceWorkerRegistration() {
  if (!hasServiceWorkerSupport()) return null;

  await cleanupLegacyRootRegistrations();

  const existing = await getOneSignalRegistration();
  if (existing) return existing;

  try {
    return await navigator.serviceWorker.register(ONESIGNAL_SW_REGISTER_PATH, {
      scope: ONESIGNAL_SW_SCOPE,
    });
  } catch (registerErr) {
    console.warn('[swHelpers] OneSignal-SW-Registrierung fehlgeschlagen:', registerErr);
    return null;
  }
}

function waitForActivation(registration) {
  if (!registration) return Promise.resolve(null);

  if (registration.active) {
    return Promise.resolve(registration);
  }

  const worker = registration.installing || registration.waiting;
  if (worker) {
    return new Promise((resolve) => {
      const handleStateChange = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', handleStateChange);
          resolve(registration);
        }
      };

      worker.addEventListener('statechange', handleStateChange);
      window.setTimeout(() => {
        worker.removeEventListener('statechange', handleStateChange);
        resolve(registration);
      }, 4000);
    });
  }

  return Promise.resolve(registration);
}

export async function waitForServiceWorkerRegistration({ timeoutMs = 4000 } = {}) {
  if (!hasServiceWorkerSupport()) return null;

  const registration = await ensureServiceWorkerRegistration();
  if (!registration) return null;

  const activation = waitForActivation(registration);
  if (typeof window === 'undefined') {
    return activation;
  }

  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(registration), timeoutMs);
  });

  return Promise.race([activation, timeout]);
}

export const SERVICE_WORKER_INFO = {
  scope: ONESIGNAL_SW_SCOPE,
  registerPath: ONESIGNAL_SW_REGISTER_PATH,
  updaterPath: ONESIGNAL_SW_UPDATER_PATH,
  initPath: ONESIGNAL_SW_INIT_PATH,
  initUpdaterPath: ONESIGNAL_SW_INIT_UPDATER_PATH,
  legacyPaths: LEGACY_ONESIGNAL_SW_PATHS,
};

// src/onesignal/swHelpers.js

const SW_SCOPE = '/';
const SW_PATH = import.meta.env?.DEV
  ? '/OneSignalSDKWorker.js'
  : '/sw.js';

function hasServiceWorkerSupport() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export async function ensureServiceWorkerRegistration() {
  if (!hasServiceWorkerSupport()) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (existing) return existing;
  } catch (err) {
    console.warn('[swHelpers] getRegistration fehlgeschlagen:', err);
  }

  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
  } catch (registerErr) {
    console.warn('[swHelpers] SW-Registrierung fehlgeschlagen:', registerErr);
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
      // Sicherheitsnetz: falls "activated" nie erreicht wird, nach kurzer Zeit trotzdem auflösen
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

  const immediate = await ensureServiceWorkerRegistration();
  if (immediate && (navigator.serviceWorker.controller || immediate.active)) {
    return waitForActivation(immediate);
  }

  try {
    const readyPromise = navigator.serviceWorker.ready
      .then((reg) => waitForActivation(reg))
      .catch(() => null);

    const timeoutPromise = new Promise((resolve) => {
      window.setTimeout(async () => {
        resolve(await ensureServiceWorkerRegistration());
      }, timeoutMs);
    });

    const registration = await Promise.race([readyPromise, timeoutPromise]);
    return registration ? waitForActivation(registration) : waitForActivation(await ensureServiceWorkerRegistration());
  } catch (err) {
    console.warn('[swHelpers] Warten auf Service Worker fehlgeschlagen:', err);
    return waitForActivation(immediate) || null;
  }
}

export const SERVICE_WORKER_INFO = {
  scope: SW_SCOPE,
  path: SW_PATH,
};

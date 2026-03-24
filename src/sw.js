// <reference lib="webworker" />
/* eslint-env serviceworker */
/* global __BUILD_INFO__ */

/* Legacy-Kompatibilitaet:
 * Root-/PWA-SW enthielt historisch OneSignal.
 * Beibehalten, bis Alt-Abos sicher auf den dedizierten /push/onesignal-SW migriert sind.
 */
/*importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

/* 2) Dein Workbox-Code */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { enable } from 'workbox-navigation-preload';

// Aktivierter SW uebernimmt geclaimte Clients
clientsClaim();
cleanupOutdatedCaches();

// Erste Navigation schneller
self.addEventListener('activate', (evt) => { evt.waitUntil(enable()); });

// Build-Assets
precacheAndRoute(self.__WB_MANIFEST || []);

// HTML frisch, offline-fähig + SPA-Fallback
const documentStrategy = new NetworkFirst({ cacheName: 'app-documents', networkTimeoutSeconds: 5 });
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async (options) => {
    try {
      const response = await documentStrategy.handle(options);
      if (response && response.status !== 404) return response;
    } catch { /* offline fallback below */ }

    return caches.match('/index.html');
  }
);

// JS/CSS schnell + Hintergrund-Update
function isOneSignalWorkerRequest(url) {
  if (!url || typeof url.pathname !== 'string') return false;
  if (url.pathname.startsWith('/push/onesignal/')) return true;
  return /^\/OneSignalSDK/i.test(url.pathname);
}

registerRoute(
  ({ request, url }) =>
    request.destination === 'script' &&
    url.origin === self.location.origin &&
    !isOneSignalWorkerRequest(url),
  new StaleWhileRevalidate({ cacheName: 'app-scripts' })
);
registerRoute(
  ({ request, url }) => request.destination === 'style' && url.origin === self.location.origin,
  new StaleWhileRevalidate({ cacheName: 'app-styles' })
);

// OWM-Icons
registerRoute(
  ({ url }) => /https:\/\/openweathermap\.org\/img\/wn\//.test(url.href),
  new CacheFirst({
    cacheName: 'owm-icons',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })]
  })
);

// Fangfotos (öff. Bucket, lange cachen)
registerRoute(
  ({ url }) => /\/storage\/v1\/object\/public\/fischfotos\//.test(url.href),
  new CacheFirst({
    cacheName: 'catch-photos',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 })]
  })
);

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type !== 'GET_BUILD_INFO') return;

  const payload = (typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__) || null;
  const [port] = event.ports || [];

  if (port) {
    port.postMessage({ type: 'BUILD_INFO', payload });
    return;
  }

  const source = event.source;
  if (source && typeof source.postMessage === 'function') {
    source.postMessage({ type: 'BUILD_INFO', payload });
  }
});

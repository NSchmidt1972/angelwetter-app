// <reference lib="webworker" />
/* eslint-env serviceworker */
/* global importScripts, __BUILD_INFO__ */

/* 👇 1) OneSignal SDK MUSS als erstes geladen werden */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

/* 2) Dein Workbox-Code */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { enable } from 'workbox-navigation-preload';

const SUPABASE_ORIGIN = (() => {
  try {
    const url = import.meta.env?.VITE_SUPABASE_URL;
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
})();

// Neuer SW übernimmt sofort
self.skipWaiting();
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
registerRoute(
  ({ request }) => request.destination === 'script',
  new StaleWhileRevalidate({ cacheName: 'app-scripts' })
);
registerRoute(
  ({ request }) => request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: 'app-styles' })
);

// Supabase-API (GET)
if (SUPABASE_ORIGIN) {
  registerRoute(
    ({ url, request }) =>
      request.method === 'GET' && url.origin === SUPABASE_ORIGIN,
    new NetworkFirst({ cacheName: 'supabase-data', networkTimeoutSeconds: 5 })
  );
}

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

// <reference lib="webworker" />
/* eslint-env serviceworker */
/* global importScripts */

/* 👇 1) OneSignal SDK MUSS als erstes geladen werden */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

/* 2) Dein Workbox-Code */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { enable } from 'workbox-navigation-preload';

// Neuer SW übernimmt sofort
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Erste Navigation schneller
self.addEventListener('activate', (evt) => { evt.waitUntil(enable()); });

// Build-Assets
precacheAndRoute(self.__WB_MANIFEST || []);

// HTML frisch, offline-fähig
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({ cacheName: 'app-documents', networkTimeoutSeconds: 5 })
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
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    /^https:\/\/kirevrwmmthqgceprbhl\.supabase\.co\/.*/i.test(url.href),
  new NetworkFirst({ cacheName: 'supabase-data', networkTimeoutSeconds: 5 })
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

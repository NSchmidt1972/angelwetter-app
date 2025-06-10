/* eslint-env worker */
/* global importScripts */

if (typeof self !== 'undefined' && typeof importScripts === 'function') {
  // importScripts is only available in Service Worker context
  importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');
}

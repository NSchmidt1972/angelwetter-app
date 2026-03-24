/* Legacy OneSignal updater path: keep for migration of existing subscribers. */
let legacyOneSignalUpdaterLoadError = null;
try {
  importScripts('/push/onesignal/OneSignalSDK.sw.cdn.js');
} catch (error) {
  legacyOneSignalUpdaterLoadError = error;
}

if (legacyOneSignalUpdaterLoadError) {
  try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
    legacyOneSignalUpdaterLoadError = null;
  } catch (fallbackError) {
    legacyOneSignalUpdaterLoadError = fallbackError;
  }
}

if (legacyOneSignalUpdaterLoadError) {
  throw legacyOneSignalUpdaterLoadError;
}
/* eslint-env serviceworker */
/* global importScripts */

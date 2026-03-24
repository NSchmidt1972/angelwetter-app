/* OneSignal updater worker (new path, migration-safe). */
let oneSignalUpdaterLoadError = null;
try {
  importScripts('/push/onesignal/OneSignalSDK.sw.cdn.js');
} catch (error) {
  oneSignalUpdaterLoadError = error;
}

if (oneSignalUpdaterLoadError) {
  try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
    oneSignalUpdaterLoadError = null;
  } catch (fallbackError) {
    oneSignalUpdaterLoadError = fallbackError;
  }
}

if (oneSignalUpdaterLoadError) {
  throw oneSignalUpdaterLoadError;
}
/* eslint-env serviceworker */
/* global importScripts */

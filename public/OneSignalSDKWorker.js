/* Legacy OneSignal worker path: keep for migration of existing subscribers. */
let legacyOneSignalWorkerLoadError = null;
try {
  importScripts('/push/onesignal/OneSignalSDK.sw.cdn.js');
} catch (error) {
  legacyOneSignalWorkerLoadError = error;
}

if (legacyOneSignalWorkerLoadError) {
  try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
    legacyOneSignalWorkerLoadError = null;
  } catch (fallbackError) {
    legacyOneSignalWorkerLoadError = fallbackError;
  }
}

if (legacyOneSignalWorkerLoadError) {
  throw legacyOneSignalWorkerLoadError;
}
/* eslint-env serviceworker */
/* global importScripts */

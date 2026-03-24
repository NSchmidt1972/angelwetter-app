/* Legacy compatibility shim: keep reachable while migrating old subscribers. */
let legacyOneSignalCompatLoadError = null;
try {
  importScripts('/push/onesignal/OneSignalSDK.sw.cdn.js');
} catch (error) {
  legacyOneSignalCompatLoadError = error;
}

if (legacyOneSignalCompatLoadError) {
  try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
    legacyOneSignalCompatLoadError = null;
  } catch (fallbackError) {
    legacyOneSignalCompatLoadError = fallbackError;
  }
}

if (legacyOneSignalCompatLoadError) {
  throw legacyOneSignalCompatLoadError;
}
/* eslint-env serviceworker */
/* global importScripts */

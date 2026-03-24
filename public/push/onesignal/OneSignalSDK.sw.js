let oneSignalCompatLoadError = null;
try {
  importScripts('/push/onesignal/OneSignalSDK.sw.cdn.js');
} catch (error) {
  oneSignalCompatLoadError = error;
}

if (oneSignalCompatLoadError) {
  try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
    oneSignalCompatLoadError = null;
  } catch (fallbackError) {
    oneSignalCompatLoadError = fallbackError;
  }
}

if (oneSignalCompatLoadError) {
  throw oneSignalCompatLoadError;
}

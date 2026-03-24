let oneSignalWorkerLoadError = null;
try {
  importScripts('/push/onesignal/OneSignalSDK.sw.cdn.js');
} catch (error) {
  oneSignalWorkerLoadError = error;
}

if (oneSignalWorkerLoadError) {
  try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
    oneSignalWorkerLoadError = null;
  } catch (fallbackError) {
    oneSignalWorkerLoadError = fallbackError;
  }
}

if (oneSignalWorkerLoadError) {
  throw oneSignalWorkerLoadError;
}

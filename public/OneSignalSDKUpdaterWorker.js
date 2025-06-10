/* eslint-env worker */
/* global importScripts */

if (typeof importScripts === 'function') {
  importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');
}
// Diese Datei wird von OneSignal benötigt, um Push-Benachrichtigungen zu empfangen
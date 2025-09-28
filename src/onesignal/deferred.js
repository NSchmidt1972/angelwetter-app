// src/onesignal/deferred.js
import { ensureOneSignalScript, waitForOneSignal } from './sdkLoader';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function runWhenOneSignalReady(callback, options = {}) {
  if (!isBrowser()) {
    return { cancel: () => {}, promise: Promise.resolve(undefined) };
  }

  ensureOneSignalScript();

  let cancelled = false;
  let finished = false;
  let callbackTriggered = false;
  let wrappedRef = null;

  let resolvePromise;
  let rejectPromise;

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const waitOptions = options || {};

  const meetsImmediate = () => {
    const OS = window.OneSignal;
    if (!OS || !OS.Notifications) return null;
    if (waitOptions.requireUser) {
      const model = OS.User?.pushSubscription || OS.User?.PushSubscription;
      if (!OS.User || !model) return null;
    }
    return OS;
  };

  const runCallback = async (OS) => {
    if (cancelled || finished || callbackTriggered || !OS) return false;

    let targetOS = OS;
    if (waitOptions.requireUser) {
      const ready = meetsImmediate();
      if (!ready) return false;
      targetOS = ready;
    }

    callbackTriggered = true;
    finished = true;
    try {
      const result = await callback(targetOS);
      resolvePromise?.(result);
    } catch (err) {
      rejectPromise?.(err);
    }
    return true;
  };

  const immediate = meetsImmediate();

  if (immediate) {
    runCallback(immediate);
  } else {
    const queue = window.OneSignalDeferred || (window.OneSignalDeferred = []);

    const wrapped = (OS) => {
      if (wrapped.cancelled || finished || callbackTriggered) return;
      runCallback(OS);
    };
    wrappedRef = wrapped;
    queue.push(wrapped);

    waitForOneSignal(waitOptions)
      .then((OS) => {
        if (cancelled || finished) return;
        if (!OS) {
          finished = true;
          rejectPromise?.(new Error('OneSignal SDK wurde nicht initialisiert (Timeout).'));
          return;
        }
        runCallback(OS);
      })
      .catch((err) => {
        if (cancelled || finished) return;
        finished = true;
        rejectPromise?.(err);
      });

    const timeoutMs = options?.timeoutMs ?? 15000;
    window.setTimeout(() => {
      if (cancelled || finished || callbackTriggered) return;
      finished = true;
      rejectPromise?.(new Error('OneSignal SDK wurde nicht initialisiert (Timeout).'));
    }, timeoutMs + 1000);
  }

  return {
    cancel: () => {
      cancelled = true;
      if (wrappedRef) {
        wrappedRef.cancelled = true;
      }
      if (!finished && !callbackTriggered) {
        finished = true;
        resolvePromise?.(undefined);
      }
    },
    promise,
  };
}

export function enqueueOneSignal(callback, options) {
  return runWhenOneSignalReady(callback, options).promise;
}

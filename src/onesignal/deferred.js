// src/onesignal/deferred.js

function isBrowser() {
  return typeof window !== 'undefined';
}

export function ensureOneSignalQueue() {
  if (!isBrowser()) return [];
  if (!window.OneSignalDeferred) {
    window.OneSignalDeferred = [];
  }
  return window.OneSignalDeferred;
}

export function runWhenOneSignalReady(callback) {
  if (!isBrowser()) {
    return { cancel: () => {}, promise: Promise.resolve(undefined) };
  }

  if (window.OneSignal?.Notifications) {
    return {
      cancel: () => {},
      promise: Promise.resolve(callback(window.OneSignal)),
    };
  }

  const queue = ensureOneSignalQueue();

  let resolvePromise;
  let rejectPromise;

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const wrapped = async (OneSignal) => {
    if (wrapped.cancelled) return;
    try {
      const result = await callback(OneSignal);
      resolvePromise?.(result);
    } catch (err) {
      rejectPromise?.(err);
    }
  };

  queue.push(wrapped);

  return {
    cancel: () => {
      wrapped.cancelled = true;
      resolvePromise?.(undefined);
    },
    promise,
  };
}

export function enqueueOneSignal(callback) {
  return runWhenOneSignalReady(callback).promise;
}

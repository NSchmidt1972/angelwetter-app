// src/onesignal/sdkLoader.js

const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const SCRIPT_SELECTOR = 'script[data-onesignal-v16], script[src*="OneSignalSDK.page.js"]';

function markScript(script) {
  if (!script) return;
  if (!script.dataset.onesignalV16) {
    script.dataset.onesignalV16 = 'true';
  }
}

export function ensureOneSignalScript() {
  if (typeof window === 'undefined') return Promise.resolve();

  if (!window.OneSignalDeferred) {
    window.OneSignalDeferred = [];
  }

  if (window.OneSignal?.Notifications) {
    window.__oneSignalScriptPromise = Promise.resolve();
    return window.__oneSignalScriptPromise;
  }

  if (window.__oneSignalScriptPromise) {
    return window.__oneSignalScriptPromise;
  }

  const existing = document.querySelector(SCRIPT_SELECTOR);
  if (existing) {
    markScript(existing);
    if (
      existing.dataset.loaded === 'true' ||
      existing.readyState === 'complete' ||
      window.OneSignal?.Notifications
    ) {
      window.__oneSignalScriptPromise = Promise.resolve();
      return window.__oneSignalScriptPromise;
    }

    window.__oneSignalScriptPromise = new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        existing.dataset.loaded = 'true';
        if (!window.OneSignalDeferred) {
          window.OneSignalDeferred = [];
        }
        resolve();
      }, { once: true });
      existing.addEventListener('error', () => {
        reject(new Error('OneSignal SDK konnte nicht geladen werden.'));
      }, { once: true });
    });

    return window.__oneSignalScriptPromise;
  }

  window.__oneSignalScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.defer = true;
    markScript(script);
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', (err) => {
      reject(new Error(`OneSignal SDK konnte nicht geladen werden: ${err?.message || ''}`));
    }, { once: true });
    document.head.appendChild(script);
  });

  return window.__oneSignalScriptPromise;
}

export function waitForOneSignal({ intervalMs = 250, timeoutMs = 15_000, requireUser = false } = {}) {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const lookup = () => {
    const OS = window.OneSignal;
    if (!OS || !OS.Notifications) return null;
    if (requireUser && !OS.User) return null;
    if (OS && OS.Notifications) {
      return OS;
    }
    return null;
  };

  const immediate = lookup();
  if (immediate) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    let finished = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const finish = (value) => {
      if (finished) return;
      finished = true;
      if (pollTimer) window.clearInterval(pollTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      resolve(value ?? null);
    };

    pollTimer = window.setInterval(() => {
      const found = lookup();
      if (found) {
        finish(found);
      }
    }, intervalMs);

    timeoutTimer = window.setTimeout(() => {
      finish(null);
    }, timeoutMs);
  });
}

export async function getOneSignal(options) {
  await ensureOneSignalScript();
  const OS = await waitForOneSignal(options);
  if (!OS) {
    throw new Error('OneSignal SDK nicht verfügbar (Timeout)');
  }
  return OS;
}

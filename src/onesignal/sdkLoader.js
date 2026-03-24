// src/onesignal/sdkLoader.js

const DEFAULT_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const SAME_ORIGIN_SDK_URL = '/push/onesignal/OneSignalSDK.page.js';
const SCRIPT_SELECTOR = 'script[data-onesignal-v16], script[src*="OneSignalSDK.page.js"]';
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;
const RUNTIME_READY_TIMEOUT_MS = 8_000;

function getSdkCandidateUrls() {
  const custom = String(import.meta.env.VITE_ONESIGNAL_SDK_URL || '').trim();
  const candidates = [
    custom || null,
    SAME_ORIGIN_SDK_URL,
    DEFAULT_SDK_URL,
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function toAbsoluteUrl(url) {
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).href;
}

function isLikelyJavaScriptContentType(contentType) {
  const normalized = String(contentType || '').toLowerCase();
  if (!normalized) return true;
  return normalized.includes('javascript') || normalized.includes('ecmascript');
}

async function probeSdkUrl(url) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return { ok: true, reason: null };
  }

  const absoluteUrl = toAbsoluteUrl(url);
  let parsed = null;

  try {
    parsed = new URL(absoluteUrl);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }

  if (parsed.origin !== window.location.origin) {
    return { ok: true, reason: null };
  }

  try {
    const response = await fetch(absoluteUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) {
      return { ok: false, reason: `http-${response.status}` };
    }

    const contentType = response.headers.get('content-type');
    if (!isLikelyJavaScriptContentType(contentType)) {
      return {
        ok: false,
        reason: `unexpected-content-type:${String(contentType || 'unknown').toLowerCase()}`,
      };
    }

    return { ok: true, reason: null };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || String(error || 'fetch-failed'),
    };
  }
}

function formatScriptLoadError({ url, reason }) {
  const onlineState =
    typeof navigator !== 'undefined'
      ? (navigator.onLine ? 'online' : 'offline')
      : 'unknown';
  const text = String(reason || '').trim();
  return `${url} (${text || 'Ladefehler'}, browser=${onlineState})`;
}

function markScript(script) {
  if (!script) return;
  if (!script.dataset.onesignalV16) {
    script.dataset.onesignalV16 = 'true';
  }
}

function getExistingScriptByAbsoluteSrc(absoluteSrc) {
  if (typeof document === 'undefined') return null;
  const scripts = Array.from(document.querySelectorAll(SCRIPT_SELECTOR));
  return scripts.find((script) => {
    const src = script.getAttribute('src');
    if (!src) return false;
    try {
      return toAbsoluteUrl(src) === absoluteSrc;
    } catch {
      return false;
    }
  }) || null;
}

function waitForScriptLifecycle(script, { timeoutMs = SCRIPT_LOAD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onLoad = () => {
      script.dataset.loaded = 'true';
      script.dataset.loadState = 'loaded';
      finish(resolve);
    };

    const onError = (event) => {
      script.dataset.loadState = 'error';
      const reason = event?.message || event?.type || 'script-error';
      finish(() => reject(new Error(reason)));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    timeoutId = window.setTimeout(() => {
      script.dataset.loadState = 'error';
      finish(() => reject(new Error(`timeout-${timeoutMs}ms`)));
    }, timeoutMs);
  });
}

async function loadScriptFromUrl(url) {
  const absoluteUrl = toAbsoluteUrl(url);
  let script = getExistingScriptByAbsoluteSrc(absoluteUrl);

  if (script && (script.dataset.loaded === 'true' || script.dataset.loadState === 'loaded' || window.OneSignal?.Notifications)) {
    return absoluteUrl;
  }

  if (script && script.dataset.loadState === 'error') {
    script.remove();
    script = null;
  }

  if (!script) {
    const probe = await probeSdkUrl(absoluteUrl);
    if (!probe.ok) {
      throw new Error(probe.reason || 'url-probe-failed');
    }
  }

  if (!script) {
    script = document.createElement('script');
    script.src = absoluteUrl;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    markScript(script);
    script.dataset.loadState = 'loading';
    document.head.appendChild(script);
  } else {
    markScript(script);
    script.dataset.loadState = 'loading';
  }

  try {
    await waitForScriptLifecycle(script, { timeoutMs: SCRIPT_LOAD_TIMEOUT_MS });
    // Defensive validation: some misconfigured proxies/CDNs return HTML with HTTP 200
    // for this path. In that case "load" fires, but the OneSignal runtime is missing.
    const OneSignal = await waitForOneSignal({ intervalMs: 120, timeoutMs: RUNTIME_READY_TIMEOUT_MS });
    if (!OneSignal?.Notifications) {
      throw new Error('script-loaded-without-onesignal-runtime');
    }
    return absoluteUrl;
  } catch (error) {
    script.dataset.loadState = 'error';
    try {
      script.remove();
    } catch {
      /* ignore */
    }
    throw error;
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

  window.__oneSignalScriptPromise = (async () => {
    const errors = [];
    const candidates = getSdkCandidateUrls();

    for (const url of candidates) {
      try {
        await loadScriptFromUrl(url);
        if (!window.OneSignalDeferred) {
          window.OneSignalDeferred = [];
        }
        return;
      } catch (error) {
        errors.push(formatScriptLoadError({
          url: toAbsoluteUrl(url),
          reason: error?.message || String(error || ''),
        }));
      }
    }

    const details = errors.length
      ? `\nVersuche:\n- ${errors.join('\n- ')}`
      : '';
    throw new Error(
      `OneSignal SDK konnte nicht geladen werden. Bitte Adblocker/Tracking-Schutz, CSP und Netzwerkzugriff auf OneSignal prüfen.${details}`
    );
  })().catch((error) => {
    window.__oneSignalScriptPromise = null;
    throw error;
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

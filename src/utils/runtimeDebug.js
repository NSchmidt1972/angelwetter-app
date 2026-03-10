const STORAGE_FLAG_KEY = '__aw_runtime_debug';
const MAX_LOGS = 1200;

function readLocalFlag() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function isRuntimeDebugEnabled() {
  return import.meta.env.VITE_RUNTIME_DEBUG === '1' || readLocalFlag();
}

function shortenString(value, maxLen = 500) {
  if (typeof value !== 'string') return value;
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…(${value.length - maxLen} more chars)`;
}

function sanitize(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[depth-limit]';
  if (typeof value === 'string') return shortenString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).slice(0, 50).forEach(([key, item]) => {
      out[key] = sanitize(item, depth + 1);
    });
    return out;
  }
  return String(value);
}

function ensureGlobalApi() {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(window.__awRuntimeDebugLogs)) {
    window.__awRuntimeDebugLogs = [];
  }
  if (window.awDebug) return;

  window.awDebug = {
    isEnabled: () => isRuntimeDebugEnabled(),
    enable: ({ reload = true } = {}) => {
      try {
        window.localStorage.setItem(STORAGE_FLAG_KEY, '1');
      } catch {
        /* ignore */
      }
      if (reload) window.location.reload();
    },
    disable: ({ reload = true } = {}) => {
      try {
        window.localStorage.removeItem(STORAGE_FLAG_KEY);
      } catch {
        /* ignore */
      }
      if (reload) window.location.reload();
    },
    getLogs: () => [...window.__awRuntimeDebugLogs],
    clear: () => {
      window.__awRuntimeDebugLogs = [];
    },
    download: (filename = `aw-runtime-debug-${Date.now()}.json`) => {
      const payload = JSON.stringify(window.__awRuntimeDebugLogs, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}

export function debugLog(event, payload = {}) {
  ensureGlobalApi();
  if (!isRuntimeDebugEnabled() || typeof window === 'undefined') return;
  const entry = {
    at: new Date().toISOString(),
    event,
    payload: sanitize(payload),
  };
  window.__awRuntimeDebugLogs.push(entry);
  if (window.__awRuntimeDebugLogs.length > MAX_LOGS) {
    window.__awRuntimeDebugLogs.splice(0, window.__awRuntimeDebugLogs.length - MAX_LOGS);
  }
  try {
    console.info('[AWDBG]', entry);
  } catch {
    /* ignore console failures */
  }
}

ensureGlobalApi();

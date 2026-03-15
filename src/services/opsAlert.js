import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/supabaseClient';

const ALERT_ENDPOINT = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/opsAlert`;
const ALERT_ENABLED = import.meta.env.VITE_ENABLE_OPS_ALERTS !== '0';
const ALERT_DEDUPE_WINDOW_MS = 60_000;
const recentFingerprints = new Map();
let installed = false;

function trimStack(stack) {
  if (!stack) return null;
  return String(stack).split('\n').slice(0, 8).join('\n').slice(0, 1200);
}

function getReleaseTag() {
  const version = import.meta.env.VITE_APP_VERSION || 'dev';
  const commit = import.meta.env.VITE_GIT_COMMIT || null;
  const buildDate = import.meta.env.VITE_BUILD_DATE || null;
  return [version, commit, buildDate].filter(Boolean).join('@') || version;
}

function fingerprintFor(message, context = {}) {
  const scope = [
    String(context.kind || ''),
    String(context.path || ''),
    String(context.source || ''),
  ].join('|');
  return `${message.slice(0, 120)}::${scope}`;
}

function shouldDropByDedupe(fingerprint) {
  const now = Date.now();
  const last = recentFingerprints.get(fingerprint) || 0;
  if (last && now - last < ALERT_DEDUPE_WINDOW_MS) return true;
  recentFingerprints.set(fingerprint, now);
  if (recentFingerprints.size > 150) {
    for (const [key, timestamp] of recentFingerprints.entries()) {
      if (now - timestamp > ALERT_DEDUPE_WINDOW_MS) {
        recentFingerprints.delete(key);
      }
    }
  }
  return false;
}

export async function reportFrontendAlert({ severity = 'error', message, context = {} }) {
  if (!ALERT_ENABLED || !message) return false;
  const compactMessage = String(message).trim().slice(0, 220);
  if (!compactMessage) return false;

  const fingerprint = fingerprintFor(compactMessage, context);
  if (shouldDropByDedupe(fingerprint)) return false;

  const {
    data: { session },
  } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const accessToken = session?.access_token;
  if (!accessToken) return false;

  const payload = {
    source: 'frontend',
    service: 'web-app',
    severity,
    message: compactMessage,
    release: getReleaseTag(),
    context: {
      ...context,
      path: typeof window !== 'undefined' ? window.location.pathname : null,
      href: typeof window !== 'undefined' ? window.location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ts: new Date().toISOString(),
    },
  };

  try {
    const response = await fetch(ALERT_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function installGlobalErrorMonitoring() {
  if (installed || !ALERT_ENABLED || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const err = event.error;
    const stack = trimStack(err?.stack);
    void reportFrontendAlert({
      severity: 'error',
      message: event.message || err?.message || 'window.onerror',
      context: {
        kind: 'window.error',
        source: event.filename || null,
        line: event.lineno || null,
        column: event.colno || null,
        stack,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const reasonMessage = typeof reason === 'string'
      ? reason
      : (reason?.message || String(reason || 'Unhandled promise rejection'));
    const stack = trimStack(reason?.stack);
    void reportFrontendAlert({
      severity: 'error',
      message: reasonMessage,
      context: {
        kind: 'window.unhandledrejection',
        stack,
      },
    });
  });
}

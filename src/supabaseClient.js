// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import { waitForResumeGate } from '@/utils/resumeGate';
import { getActiveClubId } from '@/utils/clubId';
import { debugLog } from '@/utils/runtimeDebug';

const envUrl = import.meta.env?.VITE_SUPABASE_URL?.trim();
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim();

if (!envUrl || !envKey) {
  throw new Error(
    '[supabaseClient] VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen gesetzt sein. ' +
    'Lege eine .env.local an (siehe .env.example).'
  );
}

export const SUPABASE_URL = envUrl;
export const SUPABASE_ANON_KEY = envKey;

const SUPABASE_FETCH_TIMEOUT_MS = 12000;
const SUPABASE_FETCH_RETRY_TIMEOUT_MS = 7000;
const SUPABASE_FETCH_RETRY_DELAY_MS = 250;
const SUPABASE_HEALTH_KEY = '__awSupabaseNetworkHealth';

const localSupabaseHealth = {
  lastSuccessAt: 0,
  lastFailureAt: 0,
  lastTimeoutAt: 0,
  consecutiveTimeouts: 0,
  consecutiveFailures: 0,
  lastError: null,
};

function getSupabaseHealthState() {
  if (typeof window === 'undefined') return localSupabaseHealth;
  if (!window[SUPABASE_HEALTH_KEY]) {
    window[SUPABASE_HEALTH_KEY] = { ...localSupabaseHealth };
  }
  return window[SUPABASE_HEALTH_KEY];
}

function markSupabaseSuccess() {
  const state = getSupabaseHealthState();
  state.lastSuccessAt = Date.now();
  state.consecutiveFailures = 0;
  state.consecutiveTimeouts = 0;
  state.lastError = null;
}

function markSupabaseFailure({ timeout, error }) {
  const state = getSupabaseHealthState();
  state.lastFailureAt = Date.now();
  state.consecutiveFailures += 1;
  if (timeout) {
    state.lastTimeoutAt = Date.now();
    state.consecutiveTimeouts += 1;
  } else {
    state.consecutiveTimeouts = 0;
  }
  state.lastError = error?.message || String(error || '');
}

export function getSupabaseNetworkHealthSnapshot() {
  const state = getSupabaseHealthState();
  return {
    lastSuccessAt: state.lastSuccessAt || 0,
    lastFailureAt: state.lastFailureAt || 0,
    lastTimeoutAt: state.lastTimeoutAt || 0,
    consecutiveTimeouts: state.consecutiveTimeouts || 0,
    consecutiveFailures: state.consecutiveFailures || 0,
    lastError: state.lastError || null,
  };
}

function toRequestUrl(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return '';
}

function toMethod(input, init) {
  if (init?.method) return String(init.method).toUpperCase();
  if (input instanceof Request && input.method) return String(input.method).toUpperCase();
  return 'GET';
}

function toRelativeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
    return `${parsed.pathname}${parsed.search || ''}`;
  } catch {
    return url;
  }
}

function getRouteSlug() {
  if (typeof window === 'undefined') return null;
  return window.location.pathname.split('/').filter(Boolean)[0] || null;
}

async function wait(ms) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForVisible({ timeoutMs = 2500 } = {}) {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') return;

  await new Promise((resolve) => {
    let done = false;
    let timeoutId = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
      resolve();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      finish();
    };

    document.addEventListener('visibilitychange', onVisibility);
    timeoutId = window.setTimeout(finish, timeoutMs);
  });
}

function isTimeoutError(error) {
  return String(error?.name || '').toLowerCase() === 'timeouterror';
}

async function fetchWithTimeout(input, init, timeoutMs) {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  let timedOut = false;
  let timeoutId = null;
  let onExternalAbort;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      onExternalAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`Supabase fetch timeout (${timeoutMs}ms)`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
    }
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function supabaseFetchWithAuthRetry(input, init) {
  const url = toRequestUrl(input);
  const method = toMethod(input, init);
  const relativeUrl = toRelativeUrl(url);
  const isAuthEndpoint = url.includes('/auth/v1/');
  if (!isAuthEndpoint) {
    await waitForResumeGate(2500);
    await waitForVisible({ timeoutMs: 2000 });
  }

  const existingHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const doFetch = (timeoutMs) => fetchWithTimeout(input, { ...init, headers: existingHeaders }, timeoutMs);

  let response;
  try {
    response = await doFetch(SUPABASE_FETCH_TIMEOUT_MS);
  } catch (error) {
    const timeout = isTimeoutError(error);
    markSupabaseFailure({ timeout, error });
    debugLog('supabase:network-error', {
      method,
      url: relativeUrl,
      isAuthEndpoint,
      clubId: !isAuthEndpoint ? getActiveClubId() : null,
      slug: getRouteSlug(),
      visibility: typeof document !== 'undefined' ? document.visibilityState : null,
      error: error?.message || String(error || ''),
      timeout,
    });

    if (!isAuthEndpoint && timeout && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      await wait(SUPABASE_FETCH_RETRY_DELAY_MS);
      try {
        const retryResponse = await doFetch(SUPABASE_FETCH_RETRY_TIMEOUT_MS);
        if (retryResponse.ok) {
          markSupabaseSuccess();
        } else {
          markSupabaseFailure({ timeout: false, error: new Error(`HTTP ${retryResponse.status}`) });
        }
        debugLog('supabase:network-retry-ok', {
          method,
          url: relativeUrl,
          status: retryResponse.status,
          clubId: getActiveClubId(),
          slug: getRouteSlug(),
        });
        return retryResponse;
      } catch (retryError) {
        markSupabaseFailure({ timeout: isTimeoutError(retryError), error: retryError });
        debugLog('supabase:network-retry-failed', {
          method,
          url: relativeUrl,
          clubId: getActiveClubId(),
          slug: getRouteSlug(),
          error: retryError?.message || String(retryError || ''),
          timeout: isTimeoutError(retryError),
        });
        throw retryError;
      }
    }

    throw error;
  }

  if (!isAuthEndpoint && response.status >= 400) {
    markSupabaseFailure({ timeout: false, error: new Error(`HTTP ${response.status}`) });
    debugLog('supabase:error-response', {
      method,
      url: relativeUrl,
      status: response.status,
      clubId: getActiveClubId(),
      slug: getRouteSlug(),
      visibility: typeof document !== 'undefined' ? document.visibilityState : null,
    });
    if (response.status === 401) {
      debugLog('supabase:unauthorized-response', {
        method,
        url: relativeUrl,
        clubId: getActiveClubId(),
        slug: getRouteSlug(),
        visibility: typeof document !== 'undefined' ? document.visibilityState : null,
      });
    }
  }

  if (!isAuthEndpoint && response.ok) {
    markSupabaseSuccess();
  }

  return response;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: supabaseFetchWithAuthRetry,
  },
});

// Optional: Supabase-Client fürs Debugging im Browser verfügbar machen
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

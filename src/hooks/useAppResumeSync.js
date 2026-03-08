import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { withTimeout } from '@/utils/async';

const RESUME_SYNC_EVENT = 'angelwetter:resume-sync';
const RESUME_SYNC_TIMEOUT_MS = 12000;
const RESUME_SYNC_RETRY_DELAYS_MS = [0, 1200, 3000];
const RESUME_TRIGGER_DEBOUNCE_MS = 350;
const RESUME_FOREGROUND_DEDUPE_MS = 2200;
const SAFARI_RESUME_RELOAD_THRESHOLD_MS = 45000;
const SAFARI_RESUME_RELOAD_COOLDOWN_MS = 30000;
const SAFARI_RESUME_RELOAD_KEY = '__aw_resume_reload_at';
const FILE_PICKER_INTENT_KEY = '__aw_file_picker_intent_at';
const FILE_PICKER_RELOAD_SUPPRESS_MS = 300000;
const ENABLE_SAFARI_FORCED_RELOAD = false;
let lastForcedReloadAtMemory = 0;
let lastFilePickerIntentAtMemory = 0;

function parseStoredTimestamp(rawValue) {
  const parsed = Number.parseInt(rawValue || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found')
  );
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function isLikelySafariWebKit() {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '').toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium') && !ua.includes('android');
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  const iosStandalone = Boolean(window.navigator?.standalone);
  return standaloneMedia || iosStandalone;
}

function getLastForcedReloadAt() {
  let best = lastForcedReloadAtMemory;
  if (typeof window === 'undefined') return 0;
  try {
    best = Math.max(best, parseStoredTimestamp(window.sessionStorage.getItem(SAFARI_RESUME_RELOAD_KEY)));
  } catch {
    /* ignore */
  }
  try {
    best = Math.max(best, parseStoredTimestamp(window.localStorage.getItem(SAFARI_RESUME_RELOAD_KEY)));
  } catch {
    /* ignore */
  }
  return best;
}

function setLastForcedReloadAt(value) {
  lastForcedReloadAtMemory = Math.max(lastForcedReloadAtMemory, value);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SAFARI_RESUME_RELOAD_KEY, String(value));
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(SAFARI_RESUME_RELOAD_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function getFilePickerIntentAt() {
  let best = lastFilePickerIntentAtMemory;
  if (typeof window === 'undefined') return 0;
  try {
    best = Math.max(best, parseStoredTimestamp(window.sessionStorage.getItem(FILE_PICKER_INTENT_KEY)));
  } catch {
    /* ignore */
  }
  try {
    best = Math.max(best, parseStoredTimestamp(window.localStorage.getItem(FILE_PICKER_INTENT_KEY)));
  } catch {
    /* ignore */
  }
  return best;
}

function setFilePickerIntentAt(value) {
  lastFilePickerIntentAtMemory = Math.max(lastFilePickerIntentAtMemory, value);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FILE_PICKER_INTENT_KEY, String(value));
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(FILE_PICKER_INTENT_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function clearFilePickerIntentAt() {
  lastFilePickerIntentAtMemory = 0;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(FILE_PICKER_INTENT_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(FILE_PICKER_INTENT_KEY);
  } catch {
    /* ignore */
  }
}

function shouldSuppressForcedReloadForFilePicker(now = Date.now()) {
  const pickerIntentAt = getFilePickerIntentAt();
  if (!pickerIntentAt) return false;
  if (now - pickerIntentAt > FILE_PICKER_RELOAD_SUPPRESS_MS) {
    clearFilePickerIntentAt();
    return false;
  }
  return true;
}

export function markFilePickerIntent() {
  setFilePickerIntentAt(Date.now());
}

export function clearFilePickerIntent() {
  clearFilePickerIntentAt();
}

function dispatchResumeSync(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RESUME_SYNC_EVENT, {
      detail: {
        at: Date.now(),
        ...detail,
      },
    })
  );
}

export function useAppResumeTick({ enabled = true } = {}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const onResumeSync = () => {
      setTick((value) => value + 1);
    };

    window.addEventListener(RESUME_SYNC_EVENT, onResumeSync);
    return () => {
      window.removeEventListener(RESUME_SYNC_EVENT, onResumeSync);
    };
  }, [enabled]);

  return tick;
}

export function useAppResumeSync({ enabled = true, minIntervalMs = 1500 } = {}) {
  const inFlightRef = useRef(null);
  const lastRunRef = useRef(0);
  const queuedTimerRef = useRef(null);
  const hiddenAtRef = useRef(0);
  const forcedReloadIssuedRef = useRef(false);
  const lastForegroundQueueAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let disposed = false;

    const runResumeSync = async ({ reason, force = false, allowHardReloadOnFailure = false }) => {
      if (disposed) return;
      if (!force && !isDocumentVisible()) return;

      const now = Date.now();
      if (!force && now - lastRunRef.current < minIntervalMs) return;
      if (inFlightRef.current) return;
      lastRunRef.current = now;

      inFlightRef.current = (async () => {
        let sessionReady = false;
        let lastError = null;

        for (const retryDelay of RESUME_SYNC_RETRY_DELAYS_MS) {
          if (disposed) return;
          if (retryDelay > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
          }

          try {
            await withTimeout(
              supabase.auth.getSession(),
              RESUME_SYNC_TIMEOUT_MS,
              '[ResumeSync] Session-Refresh timeout'
            );
            sessionReady = true;
            break;
          } catch (err) {
            lastError = err;
          }
        }

        if (sessionReady && !disposed) {
          dispatchResumeSync({
            reason,
            visible: isDocumentVisible(),
            online: isOnline(),
          });
          return;
        }

        if (!disposed) {
          console.warn('[ResumeSync] Session-Refresh fehlgeschlagen:', lastError?.message || lastError);
          if (isInvalidRefreshTokenError(lastError)) {
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch {
              /* ignore */
            }
            dispatchResumeSync({
              reason: `${reason}:invalid-refresh-token`,
              visible: isDocumentVisible(),
              online: isOnline(),
            });
            return;
          }
          if (allowHardReloadOnFailure && maybeForceReloadOnSafariResume()) {
            return;
          }
        }
      })().finally(() => {
        inFlightRef.current = null;
      });
    };

    const queueResumeSync = ({
      reason,
      force = false,
      debounceMs = RESUME_TRIGGER_DEBOUNCE_MS,
      allowHardReloadOnFailure = false,
    }) => {
      if (disposed) return;
      if (queuedTimerRef.current != null) {
        window.clearTimeout(queuedTimerRef.current);
        queuedTimerRef.current = null;
      }

      const trigger = () => {
        queuedTimerRef.current = null;
        void runResumeSync({ reason, force, allowHardReloadOnFailure });
      };

      if (!debounceMs || debounceMs <= 0) {
        trigger();
        return;
      }

      queuedTimerRef.current = window.setTimeout(trigger, debounceMs);
    };

    const queueForegroundResumeSync = ({
      reason,
      debounceMs = RESUME_TRIGGER_DEBOUNCE_MS,
      allowHardReloadOnFailure = false,
    }) => {
      const now = Date.now();
      if (now - lastForegroundQueueAtRef.current < RESUME_FOREGROUND_DEDUPE_MS) {
        return;
      }
      lastForegroundQueueAtRef.current = now;
      queueResumeSync({
        reason,
        debounceMs,
        allowHardReloadOnFailure,
      });
    };

    const maybeForceReloadOnSafariResume = () => {
      if (!ENABLE_SAFARI_FORCED_RELOAD) return false;
      if (forcedReloadIssuedRef.current) return true;
      if (!isLikelySafariWebKit() || !isStandaloneMode()) return false;
      if (!isOnline()) return false;
      const hiddenAt = hiddenAtRef.current;
      if (!hiddenAt) return false;

      const now = Date.now();
      if (shouldSuppressForcedReloadForFilePicker(now)) return false;
      const hiddenDuration = now - hiddenAt;
      if (hiddenDuration < SAFARI_RESUME_RELOAD_THRESHOLD_MS) return false;

      const lastReloadAt = getLastForcedReloadAt();
      if (now - lastReloadAt < SAFARI_RESUME_RELOAD_COOLDOWN_MS) return false;

      forcedReloadIssuedRef.current = true;
      setLastForcedReloadAt(now);
      window.location.reload();
      return true;
    };

    const maybeForceReloadOnForeground = () => {
      if (!ENABLE_SAFARI_FORCED_RELOAD) return false;
      if (forcedReloadIssuedRef.current) return true;
      if (!isLikelySafariWebKit() || !isStandaloneMode()) return false;
      if (!isOnline()) return false;
      const hiddenAt = hiddenAtRef.current;
      if (!hiddenAt) return false;

      const now = Date.now();
      if (shouldSuppressForcedReloadForFilePicker(now)) return false;
      const hiddenDuration = now - hiddenAt;
      if (hiddenDuration < 1000) return false;

      const lastReloadAt = getLastForcedReloadAt();
      if (now - lastReloadAt < 10000) return false;

      forcedReloadIssuedRef.current = true;
      setLastForcedReloadAt(now);
      window.location.reload();
      return true;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        lastForegroundQueueAtRef.current = 0;
        return;
      }

      if (document.visibilityState === 'visible') {
        if (shouldSuppressForcedReloadForFilePicker(Date.now())) return;
        if (maybeForceReloadOnForeground()) return;
        queueForegroundResumeSync({
          reason: 'visibilitychange',
          debounceMs: 500,
          allowHardReloadOnFailure: true,
        });
      }
    };
    const onFocus = () => {
      if (shouldSuppressForcedReloadForFilePicker(Date.now())) return;
      if (forcedReloadIssuedRef.current) return;
      queueForegroundResumeSync({
        reason: 'focus',
        debounceMs: 500,
        allowHardReloadOnFailure: true,
      });
    };
    const onPageShow = (event) => {
      if (shouldSuppressForcedReloadForFilePicker(Date.now())) return;
      if (forcedReloadIssuedRef.current) return;
      queueForegroundResumeSync({
        reason: event?.persisted ? 'pageshow:restored' : 'pageshow',
        debounceMs: 300,
        allowHardReloadOnFailure: true,
      });
    };
    const onOnline = () => {
      queueResumeSync({ reason: 'online', force: true, debounceMs: 0 });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    return () => {
      disposed = true;
      if (queuedTimerRef.current != null) {
        window.clearTimeout(queuedTimerRef.current);
        queuedTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, minIntervalMs]);
}

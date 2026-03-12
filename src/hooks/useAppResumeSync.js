import { useEffect, useRef } from 'react';
import { supabase, getSupabaseNetworkHealthSnapshot } from '@/supabaseClient';
import { beginResumeGate } from '@/utils/resumeGate';
import { debugLog } from '@/utils/runtimeDebug';
import { dispatchResumeSync } from '@/hooks/resumeSyncEvent';
export { useAppResumeTick } from '@/hooks/useAppResumeTick';

const RESUME_SYNC_STEP_TIMEOUT_MS = 1200;
const RESUME_TRIGGER_DEBOUNCE_MS = 350;
const RESUME_FOREGROUND_DEDUPE_MS = 2200;
const RESUME_SYNC_STALE_INFLIGHT_MS = 15000;
const RESUME_RECOVERY_CHECK_MS = 9000;
const SAFARI_RESUME_RELOAD_THRESHOLD_MS = 45000;
const SAFARI_RESUME_RELOAD_COOLDOWN_MS = 30000;
const SAFARI_RESUME_RELOAD_KEY = '__aw_resume_reload_at';
const FILE_PICKER_INTENT_KEY = '__aw_file_picker_intent_at';
const FILE_PICKER_RELOAD_SUPPRESS_MS = 300000;
const ENABLE_SAFARI_FORCED_RELOAD = false;
let lastForcedReloadAtMemory = 0;
let lastFilePickerIntentAtMemory = 0;

function withHardTimeout(promise, timeoutMs, timeoutMessage) {
  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId != null) {
      window.clearTimeout(timerId);
    }
  });
}

function parseStoredTimestamp(rawValue) {
  const parsed = Number.parseInt(rawValue || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
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

export function useAppResumeSync({ enabled = true, minIntervalMs = 1500 } = {}) {
  const inFlightRef = useRef(null);
  const inFlightStartedAtRef = useRef(0);
  const lastRunRef = useRef(0);
  const queuedTimerRef = useRef(null);
  const hiddenAtRef = useRef(0);
  const forcedReloadIssuedRef = useRef(false);
  const lastForegroundQueueAtRef = useRef(0);
  const recoveryTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let disposed = false;
    debugLog('resume:hook-enabled', {
      minIntervalMs,
      visibility: document.visibilityState,
      online: isOnline(),
      path: window.location.pathname,
    });

    const runResumeSync = async ({ reason, force = false, allowHardReloadOnFailure = false }) => {
      if (disposed) return;
      if (!force && !isDocumentVisible()) {
        debugLog('resume:skip-hidden', { reason, force });
        return;
      }

      const now = Date.now();
      if (!force && now - lastRunRef.current < minIntervalMs) {
        debugLog('resume:skip-min-interval', {
          reason,
          minIntervalMs,
          sinceLastMs: now - lastRunRef.current,
        });
        return;
      }
      if (inFlightRef.current) {
        const inFlightAgeMs = now - (inFlightStartedAtRef.current || now);
        if (inFlightAgeMs > RESUME_SYNC_STALE_INFLIGHT_MS) {
          debugLog('resume:inflight-stale-reset', {
            reason,
            inFlightAgeMs,
            staleAfterMs: RESUME_SYNC_STALE_INFLIGHT_MS,
          });
          inFlightRef.current = null;
          inFlightStartedAtRef.current = 0;
        } else {
          // Auch bei laufendem Resume-Flight einen Tick senden,
          // damit neu geöffnete Views re-fetch auslösen können.
          dispatchResumeSync({
            reason: `${reason}:inflight`,
            visible: isDocumentVisible(),
            online: isOnline(),
          });
          debugLog('resume:dispatch-sync-inflight', {
            reason,
            inFlightAgeMs,
          });
          debugLog('resume:skip-inflight', { reason, inFlightAgeMs });
          return;
        }
      }
      lastRunRef.current = now;
      const endResumeGate = beginResumeGate();
      const resumeStartedAt = Date.now();
      debugLog('resume:start', {
        reason,
        force,
        allowHardReloadOnFailure,
        visibility: document.visibilityState,
        online: isOnline(),
      });

      const dispatchProgress = (nextReason = reason) => {
        if (disposed) return;
        debugLog('resume:dispatch-sync', {
          reason: nextReason,
          visible: isDocumentVisible(),
          online: isOnline(),
        });
        dispatchResumeSync({
          reason: nextReason,
          visible: isDocumentVisible(),
          online: isOnline(),
        });
      };

      // Daten-Refresh sofort beim Foreground starten; Session-Check läuft parallel.
      dispatchProgress(`${reason}:start`);

      if (recoveryTimerRef.current != null) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      recoveryTimerRef.current = window.setTimeout(() => {
        recoveryTimerRef.current = null;
        if (disposed || !isDocumentVisible()) return;
        const health = getSupabaseNetworkHealthSnapshot();
        const hasFreshSupabaseSuccess = health.lastSuccessAt >= resumeStartedAt;
        if (hasFreshSupabaseSuccess) {
          debugLog('resume:recovery-not-needed', {
            reason,
            lastSuccessAt: health.lastSuccessAt,
          });
          return;
        }

        debugLog('resume:recovery-trigger', {
          reason,
          checkAfterMs: RESUME_RECOVERY_CHECK_MS,
          health,
        });
        dispatchProgress(`${reason}:recovery`);

        if (
          isLikelySafariWebKit() &&
          isStandaloneMode() &&
          health.consecutiveTimeouts >= 2 &&
          !shouldSuppressForcedReloadForFilePicker(Date.now()) &&
          maybeForceReloadOnForeground()
        ) {
          debugLog('resume:recovery-forced-reload', {
            reason,
            consecutiveTimeouts: health.consecutiveTimeouts,
          });
          return;
        }

        queueResumeSync({
          reason: `${reason}:recovery-retry`,
          force: true,
          debounceMs: 0,
          allowHardReloadOnFailure: true,
        });
      }, RESUME_RECOVERY_CHECK_MS);

      inFlightStartedAtRef.current = Date.now();
      inFlightRef.current = (async () => {
        try {
          if (!disposed && isDocumentVisible() && isOnline()) {
            const { data, error } = await withHardTimeout(
              supabase.auth.getSession(),
              RESUME_SYNC_STEP_TIMEOUT_MS,
              '[ResumeSync] getSession timeout'
            );
            debugLog('resume:session-probe', {
              reason,
              hasSession: Boolean(data?.session),
              error: error?.message || null,
            });
          }
        } catch (err) {
          debugLog('resume:session-probe-timeout', {
            reason,
            error: err?.message || String(err || ''),
          });
          if (!disposed && allowHardReloadOnFailure && maybeForceReloadOnSafariResume()) {
            debugLog('resume:forced-reload-on-failure', { reason });
            return;
          }
        }

        if (!disposed) {
          dispatchProgress(`${reason}:settled`);
        }
      })().finally(() => {
        endResumeGate();
        inFlightRef.current = null;
        inFlightStartedAtRef.current = 0;
        debugLog('resume:done', { reason });
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
        debugLog('resume:foreground-deduped', {
          reason,
          dedupeMs: RESUME_FOREGROUND_DEDUPE_MS,
        });
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
        debugLog('resume:event-visibility-hidden', {});
        return;
      }

      if (document.visibilityState === 'visible') {
        debugLog('resume:event-visibility-visible', {});
        const suppressHardReload = shouldSuppressForcedReloadForFilePicker(Date.now());
        if (!suppressHardReload && maybeForceReloadOnForeground()) return;
        queueForegroundResumeSync({
          reason: 'visibilitychange',
          debounceMs: 500,
          allowHardReloadOnFailure: true,
        });
      }
    };
    const onFocus = () => {
      if (forcedReloadIssuedRef.current) return;
      debugLog('resume:event-focus', {});
      queueForegroundResumeSync({
        reason: 'focus',
        debounceMs: 500,
        allowHardReloadOnFailure: true,
      });
    };
    const onPageShow = (event) => {
      if (forcedReloadIssuedRef.current) return;
      debugLog('resume:event-pageshow', { persisted: Boolean(event?.persisted) });
      queueForegroundResumeSync({
        reason: event?.persisted ? 'pageshow:restored' : 'pageshow',
        debounceMs: 300,
        allowHardReloadOnFailure: true,
      });
    };
    const onOnline = () => {
      debugLog('resume:event-online', {});
      queueResumeSync({ reason: 'online', force: true, debounceMs: 0 });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    return () => {
      disposed = true;
      inFlightRef.current = null;
      inFlightStartedAtRef.current = 0;
      if (recoveryTimerRef.current != null) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
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

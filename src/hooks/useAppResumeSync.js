import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { withTimeout } from '@/utils/async';

const RESUME_SYNC_EVENT = 'angelwetter:resume-sync';
const RESUME_SYNC_TIMEOUT_MS = 12000;
const RESUME_SYNC_RETRY_DELAYS_MS = [0, 1200, 3000];
const RESUME_TRIGGER_DEBOUNCE_MS = 350;

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
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

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let disposed = false;

    const runResumeSync = async ({ reason, force = false }) => {
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
        }
      })().finally(() => {
        inFlightRef.current = null;
      });
    };

    const queueResumeSync = ({ reason, force = false, debounceMs = RESUME_TRIGGER_DEBOUNCE_MS }) => {
      if (disposed) return;
      if (queuedTimerRef.current != null) {
        window.clearTimeout(queuedTimerRef.current);
        queuedTimerRef.current = null;
      }

      const trigger = () => {
        queuedTimerRef.current = null;
        void runResumeSync({ reason, force });
      };

      if (!debounceMs || debounceMs <= 0) {
        trigger();
        return;
      }

      queuedTimerRef.current = window.setTimeout(trigger, debounceMs);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        queueResumeSync({ reason: 'visibilitychange', debounceMs: 500 });
      }
    };
    const onFocus = () => {
      queueResumeSync({ reason: 'focus', debounceMs: 500 });
    };
    const onPageShow = (event) => {
      queueResumeSync({
        reason: event?.persisted ? 'pageshow:restored' : 'pageshow',
        debounceMs: 300,
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

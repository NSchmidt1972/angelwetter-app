function isLikelyWebKitSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '').toLowerCase();
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium') && !ua.includes('android');
  const isAppleWebKit = ua.includes('applewebkit') && !ua.includes('chrome');
  return isSafari || isAppleWebKit;
}

function getEffectiveTimeout(timeoutMs) {
  let effective = timeoutMs;
  if (isLikelyWebKitSafari()) {
    effective = Math.max(effective, 30000);
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    effective = Math.max(effective, timeoutMs + 20000);
  }
  return effective;
}

export function withTimeout(promise, timeoutMs = 10000, timeoutMessage = 'Request timeout') {
  let timerId = null;
  const effectiveTimeout = getEffectiveTimeout(timeoutMs);
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, effectiveTimeout);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId != null) {
      clearTimeout(timerId);
    }
  });
}

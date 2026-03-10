function getEffectiveTimeout(timeoutMs, { addHiddenGraceMs = 1500 } = {}) {
  let effective = timeoutMs;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    effective += Math.max(0, addHiddenGraceMs);
  }
  return effective;
}

export function withTimeout(
  promise,
  timeoutMs = 10000,
  timeoutMessage = 'Request timeout',
  options = {}
) {
  let timerId = null;
  const effectiveTimeout = getEffectiveTimeout(timeoutMs, options);
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

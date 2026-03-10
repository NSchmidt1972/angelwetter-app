let gatePromise = Promise.resolve();
let gateResolve = null;
let gateToken = 0;

export function beginResumeGate() {
  const token = ++gateToken;
  gatePromise = new Promise((resolve) => {
    gateResolve = resolve;
  });

  return () => {
    if (token !== gateToken) return;
    const resolve = gateResolve;
    gateResolve = null;
    gatePromise = Promise.resolve();
    resolve?.();
  };
}

export async function waitForResumeGate(timeoutMs = 2500) {
  if (!gateResolve) return;
  let timeoutId = null;
  try {
    await Promise.race([
      gatePromise,
      new Promise((resolve) => {
        timeoutId = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
  }
}

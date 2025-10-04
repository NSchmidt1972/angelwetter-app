export function waitForControllerChange(timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const onChange = () => {
      if (done) return;
      done = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    setTimeout(() => {
      if (done) return;
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      reject(new Error("controllerchange timeout"));
    }, timeoutMs);
  });
}

export function requestWorkerBuildInfo(worker, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    if (!worker || typeof worker.postMessage !== 'function') {
      resolve(null);
      return;
    }

    let settled = false;
    const channel = new MessageChannel();

    const finalize = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        channel.port1.close();
      } catch (error) {
        console.warn('MessageChannel konnte nicht geschlossen werden:', error);
      }
      fn();
    };

    const timer = setTimeout(() => {
      finalize(() => reject(new Error('build info request timeout')));
    }, timeoutMs);

    channel.port1.onmessage = (event) => {
      finalize(() => {
        const payload = event?.data?.payload || null;
        resolve(payload && typeof payload === 'object' ? payload : null);
      });
    };

    try {
      worker.postMessage({ type: 'GET_BUILD_INFO' }, [channel.port2]);
    } catch (error) {
      finalize(() => reject(error));
    }
  });
}

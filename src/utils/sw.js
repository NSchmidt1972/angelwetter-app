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

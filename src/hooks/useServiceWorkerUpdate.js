import { useEffect, useRef, useState } from "react";
import { waitForControllerChange } from "@/utils/sw";

export function useServiceWorkerUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const regRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let offCC;

    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      regRef.current = reg;
      if (reg.waiting) setUpdateReady(true);

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && reg.waiting) setUpdateReady(true);
        });
      });

      const onControllerChange = () => window.location.reload();
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      offCC = () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);

      const onVis = async () => {
        if (document.visibilityState === "visible") await reg.update();
      };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    })();

    return () => { if (offCC) offCC(); };
  }, []);

  const applyUpdateNow = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      const reg = regRef.current || (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        window.location.reload();
        return;
      }

      const skip = async () => {
        try { reg.waiting && reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
        try { await waitForControllerChange(3000); return true; } catch { return false; }
      };

      if (reg.waiting && await skip()) return;

      try {
        await reg.update();
        if (reg.waiting && await skip()) return;
      } catch {}

      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map(r => r.unregister()));
      } catch {}
      try {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map(k => caches.delete(k)));
      } catch {}

      window.location.reload();
    } finally {
      setUpdating(false);
    }
  };

  return { updateReady, updating, applyUpdateNow, regRef };
}

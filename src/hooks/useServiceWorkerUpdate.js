import { useEffect, useRef, useState } from "react";
import { waitForControllerChange } from "@/utils/sw";

export function useServiceWorkerUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const regRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let offControllerChange = null;
    let cancel = false;
    let visibilityHandler = null;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg || cancel) return;
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
        offControllerChange = () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);

        visibilityHandler = async () => {
          if (document.visibilityState === "visible") {
            try {
              await reg.update();
            } catch (error) {
              console.warn('[SW] Update beim Sichtbarwerden fehlgeschlagen:', error);
            }
          }
        };
        document.addEventListener("visibilitychange", visibilityHandler);
      } catch (error) {
        console.warn('[SW] Registrierung laden fehlgeschlagen:', error);
      }
    })();

    return () => {
      cancel = true;
      if (offControllerChange) offControllerChange();
      if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
    };
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
        try {
          reg.waiting && reg.waiting.postMessage({ type: "SKIP_WAITING" });
        } catch (error) {
          console.warn('[SW] SKIP_WAITING Nachricht fehlgeschlagen:', error);
        }
        try {
          await waitForControllerChange(3000);
          return true;
        } catch (error) {
          console.warn('[SW] Controller-Änderung abgewartet aber fehlgeschlagen:', error);
          return false;
        }
      };

      if (reg.waiting && await skip()) return;

      try {
        await reg.update();
        if (reg.waiting && await skip()) return;
      } catch (error) {
        console.warn('[SW] Manuelles Update fehlgeschlagen:', error);
      }

      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map(r => r.unregister()));
      } catch (error) {
        console.warn('[SW] Registrierungen konnten nicht bereinigt werden:', error);
      }
      try {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map(k => caches.delete(k)));
      } catch (error) {
        console.warn('[SW] Cache-Bereinigung fehlgeschlagen:', error);
      }

      window.location.reload();
    } finally {
      setUpdating(false);
    }
  };

  return { updateReady, updating, applyUpdateNow, regRef };
}

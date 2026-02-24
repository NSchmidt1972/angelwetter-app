import { useCallback, useEffect, useRef, useState } from "react";
import { waitForControllerChange, requestWorkerBuildInfo } from "@/utils/sw";

export function useServiceWorkerUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState("");
  const [waitingBuild, setWaitingBuild] = useState(null);
  const [waitingBuildResolved, setWaitingBuildResolved] = useState(false);
  const regRef = useRef(null);
  const reloadRequestedRef = useRef(false);
  const waitingRequestIdRef = useRef(0);

  const resolveWaitingBuild = useCallback(async (worker) => {
    const requestId = ++waitingRequestIdRef.current;

    if (!worker) {
      if (waitingRequestIdRef.current === requestId) {
        setWaitingBuild(null);
        setWaitingBuildResolved(true);
      }
      return;
    }

    setWaitingBuildResolved(false);

    try {
      const info = await requestWorkerBuildInfo(worker).catch(() => null);
      if (waitingRequestIdRef.current !== requestId) return;
      setWaitingBuild(info || null);
      setWaitingBuildResolved(true);
    } catch (error) {
      console.warn('[SW] Build-Info konnte nicht geladen werden:', error);
      if (waitingRequestIdRef.current !== requestId) return;
      setWaitingBuild(null);
      setWaitingBuildResolved(true);
    }
  }, []);

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
        const waiting = Boolean(reg.waiting);
        setUpdateReady(waiting);
        if (waiting) {
          resolveWaitingBuild(reg.waiting);
        } else {
          setWaitingBuild(null);
          setWaitingBuildResolved(true);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") {
              const hasWaiting = Boolean(reg.waiting);
              setUpdateReady(hasWaiting);
              if (hasWaiting) {
                resolveWaitingBuild(reg.waiting);
              } else {
                setWaitingBuild(null);
                setWaitingBuildResolved(true);
              }
            }
          });
        });

        const onControllerChange = () => {
          setWaitingBuild(null);
          setWaitingBuildResolved(true);
          setUpdateReady(false);
          if (reloadRequestedRef.current) {
            reloadRequestedRef.current = false;
            window.location.reload();
          }
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        offControllerChange = () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);

        try {
          await reg.update();

          if (!cancel) {
            const hasWaiting = Boolean(reg.waiting);
            setUpdateReady(hasWaiting);
            if (hasWaiting) {
              resolveWaitingBuild(reg.waiting);
            } else {
              setWaitingBuild(null);
              setWaitingBuildResolved(true);
            }
          }
        } catch (error) {
          console.warn('[SW] Initialer Update-Check fehlgeschlagen:', error);
        }

        visibilityHandler = async () => {
          if (document.visibilityState === "visible") {
            try {
              await reg.update();

              const hasWaiting = Boolean(reg.waiting);
              setUpdateReady(hasWaiting);

              if (reg.waiting) {
                resolveWaitingBuild(reg.waiting);
              }
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
  }, [resolveWaitingBuild]);

  useEffect(() => {
    if (!updateReady) {
      setWaitingBuild(null);
      setWaitingBuildResolved(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const reg = regRef.current || (await navigator.serviceWorker.getRegistration());
        if (!reg || cancelled) return;
        if (!reg.waiting) {
          setWaitingBuild(null);
          setWaitingBuildResolved(true);
          return;
        }
        resolveWaitingBuild(reg.waiting);
      } catch {
        if (!cancelled) {
          setWaitingBuild(null);
          setWaitingBuildResolved(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [updateReady, resolveWaitingBuild]);

  const activateWaitingWorker = useCallback(async (reg, reason = 'manual') => {
    if (!reg?.waiting) return false;

    reloadRequestedRef.current = true;
    try {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      reloadRequestedRef.current = false;
      console.warn(`[SW] SKIP_WAITING Nachricht fehlgeschlagen (${reason}):`, error);
      return false;
    }

    try {
      await waitForControllerChange(3000);
      setUpdateReady(false);
      setWaitingBuild(null);
      setWaitingBuildResolved(true);
      return true;
    } catch (error) {
      reloadRequestedRef.current = false;
      console.warn(`[SW] Controller-Änderung abgewartet aber fehlgeschlagen (${reason}):`, error);
      return false;
    }
  }, []);

  const applyUpdateNow = async () => {
    if (updating) return;
    setUpdating(true);
    setUpdateStatusText("Prüfe auf Updates…");
    try {
      const reg = regRef.current || (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        setUpdateStatusText("Starte App neu…");
        window.location.reload();
        return;
      }
      setUpdateStatusText("Aktualisierung wird angewendet…");
      if (await activateWaitingWorker(reg, 'apply-update-existing')) return;

      try {
        setUpdateStatusText("Prüfe auf Updates…");
        await reg.update();
        setUpdateStatusText("Aktualisierung wird angewendet…");
        if (await activateWaitingWorker(reg, 'apply-update-after-check')) return;
        const hasWaiting = Boolean(reg.waiting);
        setUpdateReady(hasWaiting);
        if (hasWaiting) {
          await resolveWaitingBuild(reg.waiting);
        } else {
          setWaitingBuild(null);
          setWaitingBuildResolved(true);
        }
      } catch (error) {
        console.warn('[SW] Manuelles Update fehlgeschlagen:', error);
      }
    } finally {
      setUpdateStatusText("");
      setUpdating(false);
    }
  };

  const restartApp = async () => {
    if (updating) return;
    setUpdating(true);
    setUpdateStatusText("Prüfe auf Updates…");
    try {
      if (!("serviceWorker" in navigator)) {
        setUpdateStatusText("Starte App neu…");
        window.location.reload();
        return;
      }

      const reg = regRef.current || (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        setUpdateStatusText("Starte App neu…");
        window.location.reload();
        return;
      }

      setUpdateStatusText("Aktualisierung wird angewendet…");
      if (await activateWaitingWorker(reg, 'restart-existing')) return;

      try {
        setUpdateStatusText("Prüfe auf Updates…");
        await reg.update();
      } catch (error) {
        console.warn('[SW] Update vor Neustart fehlgeschlagen:', error);
      }

      setUpdateStatusText("Aktualisierung wird angewendet…");
      if (await activateWaitingWorker(reg, 'restart-after-check')) return;

      setUpdateStatusText("Starte App neu…");
      window.location.reload();
    } finally {
      setUpdateStatusText("");
      setUpdating(false);
    }
  };

  return {
    updateReady,
    updating,
    updateStatusText,
    applyUpdateNow,
    restartApp,
    regRef,
    waitingBuild,
    waitingBuildResolved,
  };
}

// src/components/PushInit.jsx
import { useEffect } from 'react';

export default function PushInit() {
  useEffect(() => {
    if (window.__osInitialized) return;
    window.__osInitialized = true;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        // auf bestehende SW-Registration warten
        const registration = await navigator.serviceWorker.ready;

        await OneSignal.init({
          appId: 'b05a44e8-bea5-4941-8972-5194254aadad',
          serviceWorkerRegistration: registration,   // 👈 WICHTIG
          allowLocalhostAsSecureOrigin: true,        // dev
        });
      } catch (e) {
        console.warn('[OS] init error:', e);
      }
    });
  }, []);

  return null;
}

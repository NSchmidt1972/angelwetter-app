import { useEffect, useState } from 'react';
import useOneSignal from '../hooks/useOneSignal';

export default function OneSignalHealthCheck() {
  const [state, setState] = useState({
    isPushEnabled: null,
    userId: null,
    swActive: false,
    error: null,
  });

  const { isPushEnabled, getUserId } = useOneSignal();

  useEffect(() => {
    async function check() {
      try {
        const enabled = await isPushEnabled();
        const userId = await getUserId();
        const registration = await navigator.serviceWorker.getRegistration();
        const swActive = !!registration;

        setState({
          isPushEnabled: enabled,
          userId,
          swActive,
          error: null,
        });
      } catch (err) {
        setState(s => ({ ...s, error: err.message }));
      }
    }

    check();
  }, []);

  return (
    <div className="p-4 border rounded bg-white shadow-md max-w-md mx-auto my-6">
      <h2 className="text-lg font-bold mb-3">🔎 OneSignal Health Check</h2>

      <ul className="space-y-2 text-sm">
        <li>🔔 Push aktiviert: <b>{state.isPushEnabled === null ? '...' : (state.isPushEnabled ? '✅' : '❌')}</b></li>
        <li>🆔 User ID: <b>{state.userId || '—'}</b></li>
        <li>🛠 Service Worker aktiv: <b>{state.swActive ? '✅' : '❌'}</b></li>
        {state.error && (
          <li className="text-red-600">❌ Fehler: {state.error}</li>
        )}
      </ul>
    </div>
  );
}

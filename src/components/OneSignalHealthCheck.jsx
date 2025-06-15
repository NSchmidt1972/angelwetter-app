import { useEffect, useState } from 'react';

export default function OneSignalHealthCheck() {
  const [state, setState] = useState({
    isPushEnabled: null,
    userId: null,
    error: null,
  });

  useEffect(() => {
    const check = async () => {
      try {
        const isEnabled = await window.OneSignal.isPushNotificationsEnabled();
        const userId = await window.OneSignal.getUserId();
        setState({ isPushEnabled: isEnabled, userId, error: null });
      } catch (err) {
        setState(s => ({ ...s, error: err.message }));
      }
    };

    window.OneSignal.push(check);
  }, []);

  return (
    <div className="p-4 bg-white border rounded shadow max-w-md mx-auto mt-6">
      <h2 className="text-lg font-bold mb-3">🔎 OneSignal Health Check</h2>
      <ul className="space-y-2 text-sm">
        <li>🔔 Push aktiviert: <b>{state.isPushEnabled === null ? '...' : (state.isPushEnabled ? '✅' : '❌')}</b></li>
        <li>🆔 User ID: <b>{state.userId || '—'}</b></li>
        {state.error && (
          <li className="text-red-600">❌ Fehler: {state.error}</li>
        )}
      </ul>
    </div>
  );
}

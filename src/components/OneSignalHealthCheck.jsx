import { useEffect, useState } from 'react';

export default function OneSignalHealthCheck() {
  const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';

  const [state, setState] = useState({
    isPushEnabled: null,
    userId: null,
    error: null,
  });

  useEffect(() => {
    const check = () => {
      window.OneSignal.push(async () => {
        try {
          const isEnabled = await window.OneSignal.isPushNotificationsEnabled();
          const userId = await window.OneSignal.getUserId();
          setState({ isPushEnabled: isEnabled, userId, error: null });
        } catch (err) {
          setState({ isPushEnabled: null, userId: null, error: err.message });
        }
      });
    };
    check();
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow max-w-md mx-auto mt-6 text-gray-800 dark:text-gray-100">
      <h2 className="text-lg font-bold mb-3 text-blue-700 dark:text-blue-400">🔎 OneSignal Health Check</h2>
      <ul className="space-y-2 text-sm">
        <li>🔔 Push aktiviert: <b>{state.isPushEnabled === null ? '...' : (state.isPushEnabled ? '✅' : '❌')}</b></li>
        <li>🆔 User ID: <b>{state.userId || '—'}</b></li>
        {state.error && (
          <li className="text-red-600 dark:text-red-400">❌ Fehler: {state.error}</li>
        )}
      </ul>
    </div>
  );
}

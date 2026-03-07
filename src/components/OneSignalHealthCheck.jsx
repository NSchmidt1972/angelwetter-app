import usePushStatus from '@/hooks/usePushStatus';

export default function OneSignalHealthCheck() {
  const {
    sdk,
    supported,
    permissionState,
    optedIn,
    subId,
    loading,
    error,
    subscribe,
    unsubscribe,
  } = usePushStatus();

  const sdkLoaded = Boolean(sdk);
  const permissionGranted = permissionState === 'granted';
  const isPushEnabled = !!(supported && permissionGranted && optedIn && subId);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow max-w-xl mx-auto mt-6 text-gray-800 dark:text-gray-100">
      <h2 className="text-lg font-bold mb-3 text-blue-700 dark:text-blue-400">🔎 OneSignal Health Check</h2>
      <ul className="space-y-1 text-sm">
        <li>📦 SDK geladen: <b>{sdkLoaded ? '✅' : loading ? '…' : '❌'}</b></li>
        <li>🧭 Browser unterstützt Push: <b>{supported == null ? '…' : supported ? '✅' : '❌'}</b></li>
        <li>🔐 Permission: <b>{permissionState}</b></li>
        <li>📬 Opt-in (Abo-Status): <b>{optedIn == null ? '…' : optedIn ? '✅' : '❌'}</b></li>
        <li>🆔 Subscription-ID: <b className="break-all">{subId || '—'}</b></li>
        <li>🔔 Push aktiviert (gesamt): <b>{isPushEnabled ? '✅' : '❌'}</b></li>
      </ul>

      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">❌ {error}</p> : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={subscribe}
          disabled={loading}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-60"
        >
          Abo anfragen (Subscribe)
        </button>
        <button
          type="button"
          onClick={unsubscribe}
          disabled={loading}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded disabled:opacity-60"
        >
          Abo beenden (Unsubscribe)
        </button>
      </div>
    </div>
  );
}

// src/components/navbar/PushMenuButton.jsx
import usePushStatus from '@/hooks/usePushStatus';

export default function PushMenuButton() {
  const {
    sdk,
    supported,
    blocked,
    optedIn,
    subId,
    loading,
    error,
    subscribe,
    unsubscribe,
  } = usePushStatus();

  const ready = Boolean(sdk);
  const supportUnavailable = supported === false;
  const enabled = ready && !!(optedIn && subId);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(subId || "");
    } catch (err) {
      console.warn('Subscription-ID konnte nicht kopiert werden:', err);
    }
  };

  const handleToggle = () => {
    if (loading || supportUnavailable) return;
    if (enabled) {
      void unsubscribe();
      return;
    }
    void subscribe();
  };

  const statusLabel = (() => {
    if (error) {
      if (/nicht verfügbar/i.test(error) || /Timeout/i.test(error)) {
        return "Push nicht verfügbar";
      }
      return `Fehler: ${error}`;
    }
    if (supportUnavailable) return "Nicht unterstützt";
    if (loading) return "Status wird aktualisiert...";
    if (!ready) return "Nicht initialisiert";
    if (blocked) return "Im Browser blockiert";
    if (!subId) return "deaktiviert";
    return enabled ? "aktiviert" : "deaktiviert";
  })();

  const disabled = loading || supportUnavailable;

  const containerClass = supportUnavailable
    ? "border-yellow-300 bg-yellow-100 text-yellow-900 shadow-sm dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-100"
    : enabled
      ? "border-green-300 bg-green-100 text-green-900 shadow-sm dark:border-green-700 dark:bg-green-900/40 dark:text-green-100"
      : "border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="w-full">
      <div className={`flex items-start gap-4 rounded-3xl border px-4 py-3 transition ${containerClass}`}>
        <div className="flex-1 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span role="img" aria-hidden="true">🔔</span>
            Push
          </div>
          <div className="mt-1 text-xs opacity-80">{statusLabel}</div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          role="switch"
          aria-checked={enabled}
          aria-label="Push-Benachrichtigungen umschalten"
          title={
            supportUnavailable
              ? "Push-Benachrichtigungen werden in diesem Browser nicht unterstützt"
              : blocked
                ? "Benachrichtigungen im Browser freigeben"
                : "Push-Benachrichtigungen umschalten"
          }
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 ${
            enabled
              ? "bg-green-500"
              : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
          } ${disabled ? "opacity-60" : ""}`}
        >
          <span
            className={`absolute inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
              enabled ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-2 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
        <div className="font-semibold">Subscription-ID:</div>
        <div className="font-mono break-all select-all">{subId || "— keine ID —"}</div>
        <div className="mt-1">
          <button
            type="button"
            onClick={copyId}
            disabled={!subId}
            aria-label="Subscription-ID kopieren"
            className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            ID kopieren
          </button>
        </div>
      </div>
    </div>
  );
}

// src/components/navbar/SettingsMenuToggle.jsx
export default function SettingsMenuToggle({ open, onToggle, onNavigate }) {
  const statusLabel = open ? "Fanglisten" : "Fanglisten";

  const handleToggleClick = () => {
    onToggle?.();
    if (!open) {
      onNavigate?.();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`flex items-start gap-4 rounded-3xl border px-4 py-3 transition ${
          open
            ? "border-blue-300 bg-blue-100 text-blue-900 shadow-sm dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
            : "border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        <div className="flex-1 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span role="img" aria-hidden="true">
              ⚙️
            </span>
            Download
          </div>
          <div className="mt-1 text-xs opacity-80">{statusLabel}</div>
        </div>
        <button
          type="button"
          onClick={handleToggleClick}
          role="switch"
          aria-checked={open}
          aria-label="Schnellzugriff für Einstellungen umschalten"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
            open
              ? "bg-blue-500"
              : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
          }`}
        >
          <span
            className={`absolute inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
              open ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="mt-2 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
          <div className="font-semibold">Downloads &amp; Exporte</div>
          <p className="mt-1">
            CSV- und PDF-Dateien findest du gesammelt auf der Einstellungsseite.
          </p>
          <button
            type="button"
            onClick={onNavigate}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 transition hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
          >
            <span aria-hidden="true">📂</span>
            Seite öffnen
          </button>
        </div>
      )}
    </div>
  );
}

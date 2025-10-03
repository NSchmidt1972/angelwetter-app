// src/components/dialogs/TakenDialog.jsx
export default function TakenDialog({ open, onPick, loading = false }) {
  if (!open) return null;

  const disabledClasses = loading ? "opacity-80 cursor-not-allowed" : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div className="w-80 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/90 p-6 shadow-2xl shadow-slate-900/40">
        <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">🐟 Wurde der Fisch entnommen?</h3>
        {loading && (
          <p className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-200">
            ⏳ Fang wird gespeichert...
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onPick(true)}
            disabled={loading}
            className={`flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:from-emerald-400 hover:to-green-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-emerald-600 disabled:opacity-70 ${disabledClasses}`}
          >
            ✅ Ja
          </button>
          <button
            onClick={() => onPick(false)}
            disabled={loading}
            className={`flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-900/40 transition hover:from-amber-400 hover:to-yellow-500 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-amber-500 disabled:opacity-70 ${disabledClasses}`}
          >
            🚫 Nein
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CrayfishPreviewModal({ pdfUrl, onDownload, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 overflow-y-auto" role="presentation" onClick={onClose}>
      <div className="mx-auto mt-10 flex min-h-[75vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">PDF-Vorschau</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Bericht invasive Flusskrebse
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={!pdfUrl}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-gray-900"
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Schließen
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800">
          {pdfUrl ? (
            <iframe
              title="Krebsbericht Vorschau"
              src={pdfUrl}
              className="h-[80vh] w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-300">
              Vorschau wird geladen...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

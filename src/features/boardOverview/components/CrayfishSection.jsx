import useCrayfishPdf from '@/hooks/useCrayfishPdf';
import CrayfishPreviewModal from '@/components/CrayfishPreviewModal';

export default function CrayfishSection({
  stats,
  dateRange,
  entries,
  loading,
  error,
  showAnglers,
  onToggleAnglers,
  formatNumber,
  formatDate,
}) {
  const {
    pdfUrl,
    showPreview,
    error: pdfError,
    generating,
    previewReport,
    downloadReport,
    closePreview,
  } = useCrayfishPdf({ entries, stats, dateRange });

  const pdfButtonDisabled = !showPreview && (loading || stats.entriesCount === 0 || generating);
  const handlePdfButton = () => {
    if (showPreview) {
      closePreview();
      return;
    }
    previewReport();
  };

  return (
    <>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Krebs-Entnahmen</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Erfasste invasive Krebsarten (Meldungen aus dem Formular „+ 🦞“).
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm text-gray-500 dark:text-gray-400 sm:items-end">
            <div>
              {loading
                ? 'Lädt...'
                : `${formatNumber(stats.totalCount)} Stück gesamt (${formatNumber(stats.entriesCount)} Meldungen)`}
            </div>
            {dateRange && (
              <div className="text-[11px] text-gray-600 dark:text-gray-400">
                Zeitraum: {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
              <button
                type="button"
                onClick={handlePdfButton}
                disabled={pdfButtonDisabled}
                className={`rounded px-4 py-2 text-sm font-semibold transition ${
                  showPreview
                    ? 'border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } ${pdfButtonDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                aria-busy={generating}
              >
                {generating ? 'PDF wird erstellt...' : showPreview ? 'Vorschau schließen' : ' PDF Vorschau'}
              </button>
            </div>
          </div>
        </div>

        {pdfError && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
            {pdfError}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
            Lädt Krebsdaten...
          </div>
        ) : stats.entriesCount === 0 ? (
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
            Noch keine Krebs-Entnahmen erfasst.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
                <p className="text-sm font-medium uppercase tracking-wide">Entnommen gesamt</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatNumber(stats.totalCount)}
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-200/70">über alle Meldungen</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
                <p className="text-sm font-medium uppercase tracking-wide">Meldungen</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatNumber(stats.entriesCount)}
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-200/70">Formulareinträge</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                <p className="text-sm font-medium uppercase tracking-wide">Letzte 30 Tage</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatNumber(stats.last30d)}
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-200/70">gemeldet im letzten Monat</p>
              </div>
              <button
                type="button"
                onClick={onToggleAnglers}
                aria-expanded={showAnglers}
                className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-left text-indigo-800 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-100 dark:focus:ring-indigo-300"
              >
                <p className="text-sm font-medium uppercase tracking-wide">Aktive Krebsjäger</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatNumber(stats.uniqueAnglers)}
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700/90 dark:text-indigo-200/80">
                  {showAnglers ? 'Namen verbergen' : 'Namen anzeigen'}
                </p>
              </button>
            </div>

            {stats.bySpecies.length > 0 && (
              showAnglers && (
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-100">
                  <p className="font-semibold text-indigo-800 dark:text-indigo-100">
                    Aktive Krebsjäger ({formatNumber(stats.uniqueAnglers)}):
                  </p>
                  {stats.anglerNames.length === 0 ? (
                    <p className="mt-1 text-indigo-700/80 dark:text-indigo-200/80">Keine Einträge.</p>
                  ) : (
                    <p className="mt-2 leading-relaxed text-indigo-800 dark:text-indigo-100">
                      {stats.anglerNames.join(', ')}
                    </p>
                  )}
                </div>
              )
            )}

            {stats.bySpecies.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Art</th>
                      <th className="px-4 py-2 text-left font-semibold">Entnommen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.bySpecies.map((item) => (
                      <tr key={item.name} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{item.name}</td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatNumber(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </>
        )}
      </section>

      {showPreview && (
        <CrayfishPreviewModal
          pdfUrl={pdfUrl}
          onDownload={downloadReport}
          onClose={closePreview}
        />
      )}
    </>
  );
}

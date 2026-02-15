export default function SeasonalSection({
  seasonalStats,
  seasonalMaxActiveTotal,
  activeSeasonalFish,
  onToggleFish,
  onSelectAll,
  selectedYearLabel,
  formatNumber,
}) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
            Saisonale Muster je Art ({selectedYearLabel || '12 Monate'})
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Stack je Monat zeigt die Verteilung der Top-Fischarten im gewählten Jahr.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          {seasonalStats.legend.length === 0 ? (
            <span className="text-gray-500 dark:text-gray-400">Noch keine Daten.</span>
          ) : (
            <>
              <button
                type="button"
                onClick={onSelectAll}
                className={`rounded-full border px-3 py-1 font-semibold transition ${
                  activeSeasonalFish.length === seasonalStats.legend.length
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                Alle
              </button>
              {seasonalStats.legend.map((item) => {
                const isActive = activeSeasonalFish.includes(item.name);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => onToggleFish(item.name, isActive)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 font-semibold transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full ${item.color.className || ''}`}
                      style={item.color.style}
                      aria-hidden
                    />
                    {item.name}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {seasonalStats.months.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
            Noch keine Daten vorhanden.
          </div>
        ) : (
          seasonalStats.months.map((month) => (
            <div key={`season-${month.label}`} className="flex items-center gap-3">
              <div className="w-12 shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {month.label}
              </div>
              {(() => {
                const activeParts = month.parts.filter(
                  (part) => activeSeasonalFish.includes(part.fish) && part.count > 0
                );
                const activeTotal = activeParts.reduce((sum, part) => sum + part.count, 0);
                const scalePercent =
                  activeTotal > 0 ? (activeTotal / seasonalMaxActiveTotal) * 100 : 0;
                const widthPercent = Math.min(100, Math.max(5, scalePercent));

                return (
                  <>
                    <div className="flex h-6 flex-1 items-center rounded bg-gray-200/70 px-1 dark:bg-gray-700/70">
                      {month.total === 0 ? (
                        <div className="flex w-full items-center justify-center text-xs text-gray-500 dark:text-gray-300">
                          keine Fänge
                        </div>
                      ) : activeParts.length === 0 || activeTotal === 0 ? (
                        <div className="flex w-full items-center justify-center text-xs text-gray-500 dark:text-gray-300">
                          Auswahl ohne Fänge
                        </div>
                      ) : (
                        <div
                          className="flex h-4 overflow-hidden rounded"
                          style={{ width: `${widthPercent}%` }}
                        >
                          {activeParts.map((part) => {
                            const share = activeTotal > 0 ? (part.count / activeTotal) * 100 : 0;
                            return (
                              <div
                                key={`${month.label}-${part.fish}`}
                                className={part.color.className}
                                style={{ width: `${Math.max(1, share)}%`, ...(part.color.style || {}) }}
                                title={`${part.fish}: ${formatNumber(part.count)}`}
                                aria-label={`${part.fish}: ${formatNumber(part.count)}`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="w-14 text-right text-xs text-gray-600 dark:text-gray-300">
                      {formatNumber(activeTotal)}
                    </div>
                  </>
                );
              })()}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

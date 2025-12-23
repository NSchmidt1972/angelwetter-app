export function MonthlyCatchSection({ diagramStats, monthlyMaxTotal, selectedYearLabel, formatNumber }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
            Zeitverlauf Fänge ({selectedYearLabel || '12 Monate'})
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Gesamtfänge und Entnahmen im Vergleich je Monat des gewählten Jahres.
          </p>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Skala relativ zum stärksten Monat.
        </div>
      </div>

      <div className="mt-6">
        {diagramStats.monthlyCatchSeries.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
            Noch keine Daten vorhanden.
          </div>
        ) : (
          <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2">
            {diagramStats.monthlyCatchSeries.map((item) => {
              const totalHeight = Math.max(0, (item.total / monthlyMaxTotal) * 100);
              const takenHeight =
                item.total > 0 ? Math.max(0, (item.taken / monthlyMaxTotal) * 100) : 0;
              const totalPercent = Math.min(100, totalHeight);
              const takenPercent = Math.min(100, takenHeight);
              const takenOffset = Math.max(0, totalPercent - takenPercent);
              return (
                <div
                  key={`monthly-${item.label}`}
                  className="flex min-w-[46px] flex-col items-center justify-end gap-2"
                >
                  <div className="relative flex h-44 w-10 items-end rounded bg-blue-100/80 dark:bg-blue-900/40">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t bg-blue-400/80 dark:bg-blue-500"
                      style={{ height: `${totalPercent}%` }}
                      aria-hidden
                    />
                    <div
                      className="absolute left-0 right-0 rounded bg-blue-700 dark:bg-blue-400"
                      style={{ height: `${takenPercent}%`, bottom: `${takenOffset}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="text-center text-xs text-gray-700 dark:text-gray-300">
                    <div className="font-semibold">{item.label}</div>
                    <div>{formatNumber(item.total)} / {formatNumber(item.taken)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function SessionSection({ diagramStats, sessionMaxTotal, selectedYearLabel, formatNumber }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
            Fang vs. Schneidersession ({selectedYearLabel || '12 Monate'})
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Sessions pro Monat, unterschieden nach Fang- und Schneider-Tagen.
          </p>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Skala relativ zum stärksten Monat.
        </div>
      </div>

      <div className="mt-6">
        {diagramStats.blankVsCatchSeries.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
            Noch keine Daten vorhanden.
          </div>
        ) : (
          <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2">
            {diagramStats.blankVsCatchSeries.map((item) => {
              const catchHeight =
                item.totalSessions > 0
                  ? Math.max(0, (item.catchSessions / sessionMaxTotal) * 100)
                  : 0;
              const blankHeight =
                item.totalSessions > 0
                  ? Math.max(0, (item.blankSessions / sessionMaxTotal) * 100)
                  : 0;
              return (
                <div
                  key={`sessions-${item.label}`}
                  className="flex min-w-[46px] flex-col items-center justify-end gap-2"
                >
                  <div className="flex h-44 w-10 flex-col justify-end overflow-hidden rounded bg-gray-200/80 dark:bg-gray-700/70">
                    <div
                      className="bg-red-500/80 dark:bg-red-400"
                      style={{ height: `${Math.min(100, blankHeight)}%` }}
                      aria-hidden
                    />
                    <div
                      className="bg-emerald-500/80 dark:bg-emerald-400"
                      style={{ height: `${Math.min(100, catchHeight)}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="text-center text-xs text-gray-700 dark:text-gray-300">
                    <div className="font-semibold">{item.label}</div>
                    <div>{formatNumber(item.catchSessions)} / {formatNumber(item.blankSessions)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

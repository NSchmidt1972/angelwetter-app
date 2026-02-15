export default function FishTableSection({
  fishStats,
  fishStatsLoading,
  fishStatsError,
  fishOverviewTotals,
  selectedYearLabel,
  selectedFishDetail,
  onSelectFishDetail,
  fishDetailData,
  detailSectionRef,
  formatNumber,
  formatPercent,
}) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
            Fänge nach Fischart ({selectedYearLabel || '12 Monate'})
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Gegenüberstellung aller Fänge sowie entnommener Fische pro Art.
          </p>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <div className="text-right font-semibold text-gray-800 dark:text-gray-100">
            {formatNumber(fishOverviewTotals.total)} gesamt
          </div>
          <div className="text-right text-xs">
            {formatNumber(fishOverviewTotals.taken)} entnommen ({
              fishOverviewTotals.total > 0
                ? formatPercent(fishOverviewTotals.taken / fishOverviewTotals.total)
                : '—'
            })
          </div>
        </div>
      </div>

      {fishStatsError && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
          {fishStatsError}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Fischart</th>
              <th className="px-4 py-2 text-left font-semibold">Gefangen gesamt</th>
              <th className="px-4 py-2 text-left font-semibold">Davon entnommen</th>
              <th className="px-4 py-2 text-left font-semibold">Entnahmequote</th>
              <th className="px-4 py-2 text-left font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {fishStatsLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  Lädt Fangstatistik...
                </td>
              </tr>
            ) : fishStats.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  Keine Fänge erfasst.
                </td>
              </tr>
            ) : (
              fishStats.map((entry) => {
                const total = Number(entry?.total) || 0;
                const taken = Number(entry?.taken) || 0;
                const ratio = total > 0 ? Math.max(0, Math.min(1, taken / total)) : 0;
                const ratioPercent = Math.round(ratio * 100);
                const isActive = selectedFishDetail === entry.fish;

                return (
                  <tr key={entry.fish} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{entry.fish}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatNumber(total)}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatNumber(taken)}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {total > 0 ? formatPercent(ratio) : '—'}
                      {total > 0 && (
                        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={`h-1.5 rounded-full ${
                              ratioPercent >= 66
                                ? 'bg-red-500 dark:bg-red-400'
                                : ratioPercent >= 33
                                  ? 'bg-amber-500 dark:bg-amber-400'
                                  : 'bg-emerald-500 dark:bg-emerald-400'
                            }`}
                            style={{ width: `${ratioPercent}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectFishDetail(isActive ? '' : entry.fish)}
                        className={`rounded border px-3 py-1 text-xs font-semibold transition ${
                          isActive
                            ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-gray-900'
                            : 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-900/30'
                        }`}
                        aria-pressed={isActive}
                      >
                        {isActive ? 'Schließen' : 'Details'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedFishDetail && (
        <div
          ref={detailSectionRef}
          className="mt-6 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-gray-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-gray-200"
        >
          {fishDetailData ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                    Detailansicht: {fishDetailData.fish}
                  </h3>
                 
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {formatNumber(fishDetailData.total)} Meldungen, davon {formatNumber(fishDetailData.taken)} entnommen.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Altersangaben sind grobe Erfahrungswerte je Art.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectFishDetail('')}
                  className="self-start rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-900/30"
                >
                  Schließen
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fishDetailData.buckets.map((bucket) => {
                  const hasData = fishDetailData.measuredCount > 0;
                  const share = hasData && bucket.count > 0
                    ? formatPercent(bucket.count / fishDetailData.measuredCount)
                    : '—';
                  const takenShare =
                    bucket.count > 0 ? formatPercent((bucket.takenCount || 0) / bucket.count) : '—';
                  return (
                    <div
                      key={`${fishDetailData.fish}-${bucket.key}`}
                      className="rounded border border-white/60 bg-white/70 p-3 shadow-sm dark:border-blue-900/30 dark:bg-blue-900/30"
                    >
                      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {bucket.label}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        {formatNumber(bucket.count)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Anteil: {share}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Entnommen: {formatNumber(bucket.takenCount)} ({takenShare})
                      </div>
                      {bucket.ageLabel && (
                        <div className="mt-1 text-xs text-blue-700 dark:text-blue-200">
                          Alter: {bucket.ageLabel}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                {fishDetailData.measuredCount > 0 ? (
                  <>
                    {formatNumber(fishDetailData.measuredCount)} Fänge mit Größenangabe bilden die Cluster.
                    {fishDetailData.missingCount > 0 && (
                      <> Zusätzlich {formatNumber(fishDetailData.missingCount)} ohne Größenwert.</>
                    )}
                  </>
                ) : (
                  <>Noch keine Größenangaben verfügbar. Sobald Werte eingehen, erscheinen hier Cluster.</>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>Keine Details verfügbar.</div>
              <button
                type="button"
                onClick={() => onSelectFishDetail('')}
                className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-900/30"
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

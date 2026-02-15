import { Fragment } from 'react';
import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function PageViewsSection({
  pageViewLoading,
  pageViewTotal,
  pageViewYearLabel,
  pageViewAggregates,
  pageViewAverage,
  pageViewError,
  pageViewMonthlyStats,
  pageViewTopAnglers,
  fallbackTextClass,
  formatDateTimeLabel,
  pageViewUniqueOpenPath,
  uniqueAnglersForPath,
  setPageViewUniqueOpenPath,
  pageViewLastEvents,
  pageViewLastEventsSourceCount,
  pageViewLastLimit,
  setPageViewLastLimit,
}) {
  return (
    <OverviewSection
      title="📊 Seitenaufrufe"
      value={pageViewLoading ? 'Lade…' : `${pageViewTotal} Aufrufe`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
          <span>Zeitraum: Gesamtjahr {pageViewYearLabel}</span>
          <span>Seiten: {pageViewAggregates.length}</span>
          <span>Ø je Seite: {pageViewAverage}</span>
        </div>

        {pageViewError ? (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            {pageViewError}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Monatliche Aufrufe ({pageViewYearLabel})</h4>
              {pageViewLoading ? (
                <div className={fallbackTextClass}>Lädt…</div>
              ) : pageViewMonthlyStats.length === 0 ? (
                <div className={fallbackTextClass}>Keine Daten im Zeitraum.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left">Monat</th>
                        <th className="px-3 py-2 text-right">Aufrufe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {pageViewMonthlyStats.map((entry) => (
                        <tr key={entry.key} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="px-3 py-2 capitalize text-xs sm:text-sm">{entry.label}</td>
                          <td className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">{entry.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Aktivste Angler</h4>
              {pageViewLoading ? (
                <div className={fallbackTextClass}>Lädt…</div>
              ) : pageViewTopAnglers.length === 0 ? (
                <div className={fallbackTextClass}>Keine Aufrufe im Zeitraum.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left">Angler</th>
                        <th className="px-3 py-2 text-right">Aufrufe</th>
                        <th className="px-3 py-2 text-right">Zuletzt aktiv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {pageViewTopAnglers.map((entry) => (
                        <tr key={entry.name} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="px-3 py-2 text-xs sm:text-sm">{entry.name}</td>
                          <td className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">{entry.total}</td>
                          <td className="px-3 py-2 text-right text-xs sm:text-sm">
                            {entry.lastSeen ? formatDateTimeLabel(entry.lastSeen) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Beliebteste Seiten</h4>
              {pageViewLoading ? (
                <div className={fallbackTextClass}>Lädt…</div>
              ) : pageViewAggregates.length === 0 ? (
                <div className={fallbackTextClass}>Keine Daten im Zeitraum.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left">Menüpunkt</th>
                        <th className="px-3 py-2 text-right">Aufrufe</th>
                        <th className="px-3 py-2 text-right">Unique</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {pageViewAggregates.slice(0, 20).map((row) => {
                        const isOpen = pageViewUniqueOpenPath === row.path;
                        const uniqueNames = isOpen ? uniqueAnglersForPath(row.path) : [];
                        return (
                          <Fragment key={row.path}>
                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-900">
                              <td className="px-3 py-2 text-xs sm:text-sm">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-gray-800 dark:text-gray-100">{row.label}</span>
                                  {row.label !== row.path && row.path && row.path !== '—' && (
                                    <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{row.path}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-green-700 dark:text-green-300">{row.total}</td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-200">
                                    {row.uniqueAnglers}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setPageViewUniqueOpenPath((current) => (current === row.path ? null : row.path))}
                                    className="inline-flex items-center justify-center rounded px-1.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:text-blue-200 dark:hover:bg-blue-800/40 dark:focus:ring-blue-500"
                                    title="Angler anzeigen"
                                    aria-label={isOpen ? 'Angler verbergen' : 'Angler anzeigen'}
                                  >
                                    <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">{isOpen ? '▼' : '▶'}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="bg-blue-50/60 dark:bg-blue-900/20">
                                <td colSpan={3} className="px-3 py-2 text-xs sm:text-sm">
                                  {uniqueNames.length === 0 ? (
                                    <span className="text-gray-600 dark:text-gray-300">Keine Angler erfasst.</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {uniqueNames.map((name) => (
                                        <span
                                          key={name}
                                          className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-blue-800 shadow-sm ring-1 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-100 dark:ring-blue-700/50"
                                        >
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Letzte Ereignisse</h4>
              {pageViewLoading ? (
                <div className={fallbackTextClass}>Lädt…</div>
              ) : pageViewLastEvents.length === 0 ? (
                <div className={fallbackTextClass}>Keine Aufrufe im Zeitraum.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left">Menüpunkt</th>
                        <th className="px-3 py-2 text-left">Angler</th>
                        <th className="px-3 py-2 text-left">Zeit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {pageViewLastEvents.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="px-3 py-2 text-xs sm:text-sm">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-gray-800 dark:text-gray-100">{row.label || '—'}</span>
                              {row.label !== row.path && row.path && row.path !== '—' && (
                                <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{row.path}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs sm:text-sm">
                            <span
                              className={`${row.matchesCurrentBuild
                                ? 'text-green-600 dark:text-green-300 font-semibold'
                                : 'text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              {row.angler || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs sm:text-sm">{formatDateTimeLabel(row.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pageViewLastEventsSourceCount > pageViewLastLimit && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setPageViewLastLimit((limit) => Math.min(limit + 20, pageViewLastEventsSourceCount))}
                    className="inline-flex items-center justify-center rounded border border-blue-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-400/10"
                  >
                    Mehr anzeigen
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </OverviewSection>
  );
}

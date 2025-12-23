export default function ActivitySection({
  activityRange,
  activityRangeLabel,
  activityStats,
  onSelectRange,
  showActiveAnglers,
  onToggleActiveAnglers,
  formatNumber,
  formatDecimal,
  formatPercent,
  rangeOptions,
}) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Aktivität & Nutzung</h2>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
            {rangeOptions.map((option) => {
              const isActive = activityRange === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelectRange(option.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-gray-900'
                      : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-500/60 dark:bg-gray-800 dark:text-blue-200 dark:hover:bg-blue-900/30'
                  }`}
                  aria-pressed={isActive}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Zeitraum: {activityRangeLabel}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={onToggleActiveAnglers}
          aria-expanded={showActiveAnglers}
          className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-left text-emerald-800 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100 dark:focus:ring-emerald-300"
        >
          <p className="text-sm font-medium uppercase tracking-wide">Aktive Angler</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatNumber(activityStats.activeAnglers)}
          </p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-200/70">im gewählten Zeitraum</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-200/80">
            {showActiveAnglers ? 'Namen verbergen' : 'Namen anzeigen'}
          </p>
        </button>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
          <p className="text-sm font-medium uppercase tracking-wide">Ø Fänge pro Fangtag</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatDecimal(activityStats.avgCatchesPerCatchDay)}
          </p>
          <p className="text-xs text-blue-700/80 dark:text-blue-200/70">im gewählten Zeitraum</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <p className="text-sm font-medium uppercase tracking-wide">Sessions</p>
          <p className="mt-1 text-lg font-semibold">
            {formatNumber(activityStats.catchSessions)} {activityStats.catchSessions === 1 ? 'Fangtag' : 'Fangtage'} / {formatNumber(activityStats.blankSessions)} Schneider
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-200/70">
            Schneider-Anteil: {formatPercent(activityStats.blankShare)}
          </p>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-100">
          <p className="text-sm font-medium uppercase tracking-wide">Peak-Zeiten</p>
          {activityStats.topWeekdays.length === 0 && activityStats.topHours.length === 0 ? (
            <p className="mt-1 text-sm text-indigo-700/80 dark:text-indigo-200/70">Noch keine Daten.</p>
          ) : (
            <div className="mt-1 space-y-1 text-sm">
              {activityStats.topWeekdays.length > 0 && (
                <div>Wochentag: {activityStats.topWeekdays.map((d) => d.label).join(', ')}</div>
              )}
              {activityStats.topHours.length > 0 && (
                <div>Uhrzeit: {activityStats.topHours.map((h) => h.label).join(', ')}</div>
              )}
            </div>
          )}
        </div>
      </div>
      {showActiveAnglers && (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
          <p className="font-semibold text-emerald-800 dark:text-emerald-100">
            Aktive Angler im Zeitraum ({formatNumber(activityStats.activeAnglers)}):
          </p>
          {activityStats.activeAnglerNames.length === 0 ? (
            <p className="mt-1 text-emerald-700/80 dark:text-emerald-200/80">Keine Einträge.</p>
          ) : (
            <p className="mt-2 leading-relaxed text-emerald-800 dark:text-emerald-100">
              {activityStats.activeAnglerNames.join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

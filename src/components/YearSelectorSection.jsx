export default function YearSelectorSection({ yearOptions, selectedYear, onSelectYear }) {
  if (!yearOptions || yearOptions.length === 0) return null;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Jahr wählen</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Alle Fang-Diagramme unten zeigen das ausgewählte Jahr.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {yearOptions.map((year) => {
            const isAll = year === 'all';
            return (
              <button
                key={isAll ? 'all-years' : year}
                type="button"
                onClick={() => onSelectYear(year)}
                className={`rounded-full border px-4 py-1 text-sm transition ${
                  selectedYear === year
                    ? 'border-blue-600 bg-blue-600 text-white font-semibold dark:border-blue-400 dark:bg-blue-500 dark:text-gray-900'
                    : 'border-blue-400 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-500 dark:bg-gray-800 dark:text-blue-200 dark:hover:bg-gray-700'
                }`}
                aria-pressed={selectedYear === year}
              >
                {isAll ? 'Alle Jahre' : year}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

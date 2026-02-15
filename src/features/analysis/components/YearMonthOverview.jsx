import { Card } from '@/components/ui';

export default function YearMonthOverview({
  selectedYear,
  yearMonthStats,
  currentMonthIndex,
  monthRefs,
  monthNames,
  yearTotalCount,
  yearTotalStats,
}) {
  if (!selectedYear) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex overflow-x-auto space-x-4 pb-2">
        {Object.entries(yearMonthStats[selectedYear] || {})
          .sort(([a], [b]) => a - b)
          .map(([monthIndex, types]) => {
            const index = parseInt(monthIndex, 10);
            return (
              <div
                key={monthIndex}
                ref={(el) => {
                  if (index === currentMonthIndex) monthRefs.current[index] = el;
                }}
                className={`min-w-[200px] rounded-lg p-4 text-center flex-shrink-0 shadow transition ${index === currentMonthIndex
                  ? 'border-2 border-blue-500 bg-white dark:bg-gray-800'
                  : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <h3 className="text-base font-bold mb-2 text-gray-800 dark:text-gray-100">
                  {monthNames[index]}
                </h3>
                <p className="text-xs italic text-gray-500 dark:text-gray-400 mb-2">
                  (gesamt: {Object.values(types).reduce((sum, count) => sum + count, 0)})
                </p>

                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.entries(types)
                    .sort((a, b) => b[1] - a[1])
                    .map(([fish, count]) => (
                      <li key={fish} className="flex justify-between px-2 py-1 text-sm">
                        <span>{fish}</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300">{count}</span>
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}

        {yearTotalCount > 0 && (
          <Card className="min-w-[220px] rounded-lg p-4 text-center flex-shrink-0 shadow border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h3 className="text-base font-bold mb-1 text-gray-800 dark:text-gray-100">
              Gesamt {selectedYear}
            </h3>
            <p className="text-xs italic text-gray-500 dark:text-gray-400 mb-2">
              (gesamt: {yearTotalCount})
            </p>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(yearTotalStats)
                .sort((a, b) => b[1] - a[1])
                .map(([fish, count]) => (
                  <li key={fish} className="flex justify-between px-2 py-1 text-sm">
                    <span>{fish}</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">{count}</span>
                  </li>
                ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

import { CLUB_STATUS_OPTIONS } from '@/apps/superadmin/features/overview/utils/overviewUtils';

export default function ClubStatusFilterSection({ clubFilter, onChange, statusCounts }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Filter Vereine</div>
      <div className="flex flex-wrap gap-2">
        {CLUB_STATUS_OPTIONS.map((option) => {
          const active = clubFilter === option.key;
          const count = statusCounts[option.key] || 0;

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {option.label} ({count})
            </button>
          );
        })}
      </div>
    </section>
  );
}

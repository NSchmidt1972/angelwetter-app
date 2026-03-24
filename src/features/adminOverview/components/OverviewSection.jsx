import { Card } from '@/components/ui';

export default function OverviewSection({
  title,
  value,
  children,
  collapsible = false,
  defaultOpen = true,
}) {
  if (collapsible) {
    return (
      <Card className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <details open={defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <h3 className="text-base font-semibold text-blue-700 dark:text-blue-400">{title}</h3>
            <div className="flex items-center gap-2">
              {value ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {value}
                </span>
              ) : null}
              <span className="text-xs text-gray-500 transition-transform group-open:rotate-90 dark:text-gray-400">
                ▶
              </span>
            </div>
          </summary>
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-700">
            {children}
          </div>
        </details>
      </Card>
    );
  }

  return (
    <Card className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">{title}</h3>
        {value && <div className="text-sm text-gray-700 dark:text-gray-300">{value}</div>}
      </div>
      {children}
    </Card>
  );
}

import { Card } from '@/components/ui';

export default function StatListCard({ title, stats, activeKey, descIconMap }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">{title}</h3>
      <Card
        as="ul"
        className="bg-white dark:bg-gray-800 shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700"
      >
        {Object.entries(stats)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => {
            const iconCode = descIconMap[label];
            const iconUrl = iconCode ? `https://openweathermap.org/img/wn/${iconCode}.png` : null;

            return (
              <li
                key={label}
                className={`flex justify-between items-center px-4 py-2 text-sm ${activeKey === label ? 'bg-green-100 dark:bg-green-900 font-bold' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {iconUrl && <img src={iconUrl} alt={label} className="w-6 h-6" />}
                  <span>
                    {label}{' '}
                    {activeKey === label && (
                      <span className="ml-2 text-green-600 dark:text-green-400 text-xs">(Jetzt)</span>
                    )}
                  </span>
                </div>
                <span className="font-mono text-gray-700 dark:text-gray-300">{count}</span>
              </li>
            );
          })}
      </Card>
    </div>
  );
}

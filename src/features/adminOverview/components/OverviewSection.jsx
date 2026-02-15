import { Card } from '@/components/ui';

export default function OverviewSection({ title, value, children }) {
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">{title}</h3>
        {value && <div className="text-sm text-gray-700 dark:text-gray-300">{value}</div>}
      </div>
      {children}
    </Card>
  );
}

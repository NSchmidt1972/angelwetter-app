import { Card } from '@/components/ui';

export default function AnalysisSummaryCard({
  totalFishes,
  catchSessions,
  blankSessions,
  blankSessionRatio,
}) {
  return (
    <Card className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300 max-w-xl mx-auto mb-8 bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
      <div className="flex items-center gap-2">
        <span className="text-xl">🐟</span>
        <span>Gesamtanzahl Fische:</span>
        <span className="ml-auto font-bold text-right">{totalFishes}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">📅</span>
        <span>Sessions mit Fang:</span>
        <span className="ml-auto font-bold text-right">{catchSessions}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">❌</span>
        <span>Schneidersessions:</span>
        <span className="ml-auto font-bold text-right">{blankSessions}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">📉</span>
        <span>Schneider-Anteil:</span>
        <span className="ml-auto font-bold text-right">{blankSessionRatio}%</span>
      </div>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function getKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getMonthLabel(y, m) {
  return new Date(y, m).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function FishCalendarMobileView() {
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('fishes')
        .select('timestamp, fish, angler')
        .eq('angler', anglerName);

      if (error) {
        console.error('Fehler beim Laden:', error);
        return;
      }

      const monthMap = {};

      data.forEach(entry => {
        const date = new Date(entry.timestamp);
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const key = getKey(year, month, day);
        const monthKey = `${year}-${month}`;
        if (!monthMap[monthKey]) monthMap[monthKey] = { year, month, days: {} };

        monthMap[monthKey].days[key] = entry.fish ? '🐟' : '❌';
      });

      setGroupedData(monthMap);
      setLoading(false);
    }

    fetchData();
  }, [anglerName]);

  const sortedMonths = Object.values(groupedData).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  if (loading) {
    return <p className="text-center text-gray-500 dark:text-gray-300 mt-6">Lade Kalenderdaten...</p>;
  }

  const overallStats = sortedMonths.reduce(
    (acc, { days }) => {
      Object.values(days).forEach((status) => {
        if (status === '🐟') acc.catchDays += 1;
        else if (status === '❌') acc.blankDays += 1;
      });
      return acc;
    },
    { catchDays: 0, blankDays: 0 }
  );

  return (
    <div className="p-4 max-w-md mx-auto space-y-10">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Gesamtübersicht</h3>
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-300">
          <span>🐟 Fangtage: <span className="font-bold text-gray-800 dark:text-gray-100">{overallStats.catchDays}</span></span>
          <span>❌ Schneidertage: <span className="font-bold text-gray-800 dark:text-gray-100">{overallStats.blankDays}</span></span>
        </div>
      </div>

      {sortedMonths.map(({ year, month, days }) => {
        const firstDay = new Date(year, month, 1);
        const startWeekday = (firstDay.getDay() + 6) % 7;
        const numDays = getDaysInMonth(year, month);

        const { catchDays, blankDays } = Object.values(days).reduce(
          (acc, status) => {
            if (status === '🐟') acc.catchDays += 1;
            else if (status === '❌') acc.blankDays += 1;
            return acc;
          },
          { catchDays: 0, blankDays: 0 }
        );

        const dayCells = [];

        for (let i = 0; i < startWeekday; i++) {
          dayCells.push(<div key={`empty-${i}`} className="text-center py-1 text-lg"> </div>);
        }

        for (let d = 1; d <= numDays; d++) {
          const key = getKey(year, month, d);
          const status = days[key] || d;
          dayCells.push(
            <div
              key={key}
              className={`text-center py-1 text-lg font-medium rounded ${
                status === '🐟' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                status === '❌' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
                'text-gray-700 dark:text-gray-300'
              }`}
            >
              {typeof status === 'string' ? status : <span>{status}</span>}
            </div>
          );
        }

        return (
          <div key={`${year}-${month}`} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
            <h2 className="text-lg font-bold text-center text-blue-700 dark:text-blue-300 mb-2">
              📆 {getMonthLabel(year, month)}
            </h2>
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span className="mr-4">🐟 Fangtage: <span className="font-semibold text-gray-700 dark:text-gray-200">{catchDays}</span></span>
              <span>❌ Schneidertage: <span className="font-semibold text-gray-700 dark:text-gray-200">{blankDays}</span></span>
            </p>
            <div className="grid grid-cols-7 text-center text-sm font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600 pb-1">
              <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
            </div>
            <div className="grid grid-cols-7 text-center pt-1 gap-y-1">
              {dayCells}
            </div>
          </div>
        );
      })}
    </div>
  );
}

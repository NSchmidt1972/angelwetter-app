import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { useLocalStorageValue } from '@/hooks/useLocalStorageValue';
import { Card } from '@/components/ui';

const YEAR_FILTER_ALL = 'all';

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
  const currentYear = new Date().getFullYear();
  const resumeTick = useAppResumeTick({ enabled: true });
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [anglerName] = useLocalStorageValue('anglerName', 'Unbekannt');

  useEffect(() => {
    let active = true;
    async function fetchData() {
      const clubId = getActiveClubId();
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('fishes')
          .select('timestamp, fish, angler')
          .eq('club_id', clubId)
          .eq('angler', anglerName);

        if (!active) return;
        if (error) {
          console.error('Fehler beim Laden:', error);
          setGroupedData({});
          return;
        }

        const monthMap = {};

        (data || []).forEach(entry => {
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
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      active = false;
    };
  }, [anglerName, resumeTick]);

  const sortedMonths = useMemo(
    () => Object.values(groupedData).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    }),
    [groupedData]
  );

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    sortedMonths.forEach(({ year }) => years.add(year));
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, sortedMonths]);

  useEffect(() => {
    if (selectedYear === YEAR_FILTER_ALL) return;
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(currentYear);
    }
  }, [availableYears, currentYear, selectedYear]);

  const filteredMonths = useMemo(
    () => (selectedYear === YEAR_FILTER_ALL
      ? sortedMonths
      : sortedMonths.filter(({ year }) => year === selectedYear)),
    [selectedYear, sortedMonths]
  );

  if (loading) {
    return <p className="text-center text-gray-500 dark:text-gray-300 mt-6">Lade Kalenderdaten...</p>;
  }

  const overallStats = filteredMonths.reduce(
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
    <Card className="p-4 max-w-md mx-auto space-y-10">
      <div className="flex flex-wrap justify-center gap-2">
        {[YEAR_FILTER_ALL, ...availableYears].map((year) => {
          const isAll = year === YEAR_FILTER_ALL;
          const isSelected = selectedYear === year;
          return (
            <button
              key={isAll ? 'all-years' : year}
              type="button"
              onClick={() => setSelectedYear(year)}
              aria-pressed={isSelected}
              className={`rounded-full border px-4 py-1 text-sm transition ${
                isSelected
                  ? 'border-blue-600 bg-blue-600 text-white font-semibold dark:border-blue-400 dark:bg-blue-500 dark:text-gray-900'
                  : 'border-blue-400 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-500 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-gray-700'
              }`}
            >
              {isAll ? 'Alle' : year}
            </button>
          );
        })}
      </div>

      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Gesamtübersicht</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {selectedYear === YEAR_FILTER_ALL ? 'Alle Jahre' : `Jahr ${selectedYear}`}
        </p>
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-300">
          <span>🐟 Fangtage: <span className="font-bold text-gray-800 dark:text-gray-100">{overallStats.catchDays}</span></span>
          <span>❌ Schneidertage: <span className="font-bold text-gray-800 dark:text-gray-100">{overallStats.blankDays}</span></span>
        </div>
      </Card>

      {filteredMonths.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center text-sm text-gray-500 dark:text-gray-300">
          Keine Kalendereinträge für das gewählte Jahr.
        </Card>
      ) : null}

      {filteredMonths.map(({ year, month, days }) => {
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
          <Card key={`${year}-${month}`} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
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
          </Card>
        );
      })}
    </Card>
  );
}

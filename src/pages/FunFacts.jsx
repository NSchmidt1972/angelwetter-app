// src/pages/FunFacts.jsx
import { useEffect, useState } from 'react';
import PageContainer from '../components/PageContainer';
import FunFactsCards from '../features/funfacts/FunFactsCards';
import { useFunFactsData } from '../features/funfacts/useFunFactsData';
import { Card } from '@/components/ui';

export default function FunFacts() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const funFacts = useFunFactsData({ selectedYear });
  const { statsFishes, loading, loadError, availableYears } = funFacts;

  useEffect(() => {
    if (selectedYear === 'all') return;
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(currentYear);
    }
  }, [availableYears, currentYear, selectedYear]);

  const yearOptions = ['all', ...Array.from(new Set([currentYear, ...availableYears])).sort((a, b) => b - a)];

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">
        🎉 Fangfragen
      </h2>

      {!loadError ? (
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {yearOptions.map((year) => {
            const isAll = year === 'all';
            const isSelected = selectedYear === year;
            return (
              <button
                key={isAll ? 'all-years' : year}
                type="button"
                onClick={() => setSelectedYear(year)}
                disabled={loading}
                aria-pressed={isSelected}
                className={`rounded-full border px-4 py-1 text-sm transition ${
                  isSelected
                    ? 'border-green-600 bg-green-600 text-white font-semibold dark:border-green-400 dark:bg-green-500 dark:text-gray-900'
                    : 'border-green-400 bg-white text-green-700 hover:bg-green-50 dark:border-green-500 dark:bg-gray-800 dark:text-green-300 dark:hover:bg-gray-700'
                } ${loading ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {isAll ? 'Alle' : year}
              </button>
            );
          })}
        </div>
      ) : null}

      {loadError ? (
        <Card className="p-6 text-center text-red-700 dark:text-red-300 space-y-3">
          <div className="font-semibold">Fehler beim Laden aus Supabase</div>
          <div className="text-sm opacity-80 break-words">{loadError}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Tipp: Prüfe Tabellenname (<code>fishes</code>), Spalten, RLS/Policies und die Supabase-Keys/URL.
          </div>
        </Card>
      ) : loading ? (
        <Card className="p-6 text-center text-gray-600 dark:text-gray-300">
          Lade Funfragen…
        </Card>
      ) : statsFishes.length === 0 ? (
        <Card className="p-6 text-center text-gray-600 dark:text-gray-300">
          Keine Fänge in der aktuellen Sichtbarkeit.
        </Card>
      ) : (
        <FunFactsCards data={funFacts} />
      )}
    </PageContainer>
  );
}

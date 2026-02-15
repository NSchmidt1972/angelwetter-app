// src/pages/FunFacts.jsx
import PageContainer from '../components/PageContainer';
import FunFactsCards from '../features/funfacts/FunFactsCards';
import { useFunFactsData } from '../features/funfacts/useFunFactsData';
import { Card } from '@/components/ui';

const PUBLIC_FROM = new Date('2025-06-01');
const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

export default function FunFacts() {
  const funFacts = useFunFactsData({ PUBLIC_FROM, vertraute });
  const { statsFishes, loading, loadError } = funFacts;

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">
        🎉 Fangfragen
      </h2>

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

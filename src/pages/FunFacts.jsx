// src/pages/FunFacts.jsx
import { useState } from 'react';
import PageContainer from '../components/PageContainer';
import FunFactsCards from '../features/funfacts/FunFactsCards';
import { useFunFactsData } from '../features/funfacts/useFunFactsData';

const PUBLIC_FROM = new Date('2025-06-01');
const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

function useStableShuffleSeed() {
  const [seed] = useState(() => Math.random());
  return seed;
}

function shuffleStable(array, seed) {
  let s = Math.floor(seed * 1e9) || 1;
  const rand = () => ((s = (s * 48271) % 0x7fffffff) / 0x7fffffff);
  return array
    .map((item) => ({ item, rnd: rand() }))
    .sort((a, b) => a.rnd - b.rnd)
    .map(({ item }) => item);
}

export default function FunFacts() {
  const seed = useStableShuffleSeed();
  const funFacts = useFunFactsData({ PUBLIC_FROM, vertraute });
  const { validFishes, loading, loadError } = funFacts;

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">
        🎉 Fangfragen
      </h2>

      {loadError ? (
        <div className="p-6 text-center text-red-700 dark:text-red-300 space-y-3">
          <div className="font-semibold">Fehler beim Laden aus Supabase</div>
          <div className="text-sm opacity-80 break-words">{loadError}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Tipp: Prüfe Tabellenname (<code>fishes</code>), Spalten, RLS/Policies und die Supabase-Keys/URL.
          </div>
        </div>
      ) : loading ? (
        <div className="p-6 text-center text-gray-600 dark:text-gray-300">
          Lade Funfragen…
        </div>
      ) : validFishes.length === 0 ? (
        <div className="p-6 text-center text-gray-600 dark:text-gray-300">
          Keine Fänge in der aktuellen Sichtbarkeit.
        </div>
      ) : (
        <FunFactsCards seed={seed} shuffle={shuffleStable} data={funFacts} />
      )}
    </PageContainer>
  );
}

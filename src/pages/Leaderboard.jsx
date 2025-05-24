import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Leaderboard() {
  const [fishes, setFishes] = useState([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.from('fishes').select('*');
      if (!error) setFishes(data);
    }

    loadData();
  }, []);

  if (fishes.length === 0) {
    return <p className="text-center text-gray-500 mt-6">Keine Fänge vorhanden.</p>;
  }

  const byAngler = {};
  fishes.forEach(f => {
    const name = f.angler || 'Unbekannt';
    if (!byAngler[name]) {
      byAngler[name] = { total: 0, sizeSum: 0, byFish: {} };
    }
    const size = parseFloat(f.size) || 0;
    byAngler[name].total += 1;
    byAngler[name].sizeSum += size;
    const fishType = f.fish || 'Unbekannt';
    byAngler[name].byFish[fishType] = (byAngler[name].byFish[fishType] || 0) + size;
  });

  const ranking = Object.entries(byAngler).map(([name, stats]) => {
    const totalPoints = Object.values(stats.byFish).reduce((a, b) => a + b, 0);
    return { name, ...stats, totalPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700">🏆 Rangliste der Angler</h2>
      <div className="space-y-6 max-w-3xl mx-auto">
        {ranking.map((a, i) => (
          <div
            key={i}
            className="p-5 border border-gray-200 rounded-xl bg-white shadow-md"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">#{i + 1} {a.name}</h3>
            <p className="text-sm text-gray-600">🎣 {a.total} Fänge • 📏 Durchschnitt: {(a.sizeSum / a.total).toFixed(1)} cm</p>
            <p className="text-sm text-gray-600 mb-3">🏆 Punkte: <span className="font-mono">{a.totalPoints.toFixed(0)} Pkt.</span></p>
            <ul className="ml-2 space-y-1">
              {Object.entries(a.byFish).map(([f, p]) => (
                <li key={f} className="flex justify-between font-mono text-sm text-gray-700">
                  <span className="font-sans">{f}</span>
                  <span>{p.toFixed(0)} Pkt.</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

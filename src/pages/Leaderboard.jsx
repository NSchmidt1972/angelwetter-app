import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Leaderboard() {
  const [fishes, setFishes] = useState([]);
  const [showIntern, setShowIntern] = useState(false);

  // robusten Namen lesen und normalisieren
  const rawName = localStorage.getItem('anglerName') || 'Unbekannt';
  const anglerName = rawName.trim().toLowerCase();

  // vertraute Namen ebenfalls normalisiert
  const vertraute = ['nicol schmidt', 'laura rittlinger'];
  const PUBLIC_FROM = new Date('2025-05-29');

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.from('fishes').select('*');
      if (!error) setFishes(data);
    }
    loadData();
  }, []);

  const filteredFishes = fishes.filter(f => {
  const fangDatum = new Date(f.timestamp);
  const istAbNeu = fangDatum >= PUBLIC_FROM;
  const istVertrauter = vertraute.includes((f.angler || '').trim().toLowerCase());

  let darfSehen = false;

  if (showIntern) {
    darfSehen = vertraute.includes(anglerName) && istVertrauter;
  } else {
    darfSehen = istAbNeu;
  }

  const size = parseFloat(f.size);
  const istVerwertbar = f.fish && f.fish !== 'Unbekannt' && !isNaN(size) && size > 0;

  return darfSehen && istVerwertbar;
});


  const byAngler = {};
  filteredFishes.forEach(f => {
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

  const ranking = Object.entries(byAngler)
    .map(([name, stats]) => {
      const totalPoints = Object.values(stats.byFish).reduce((a, b) => a + b, 0);
      return { name, ...stats, totalPoints };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  if (filteredFishes.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-6">Keine Fänge zum Anzeigen.</p>;
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🏆 Rangliste</h2>

      {/* Toggle-Switch nur für vertraute Angler */}
      {vertraute.includes(anglerName) && (
        <div className="flex justify-center items-center mb-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-300">Laura vs. Nicol</span>
            <input
              type="checkbox"
              checked={showIntern}
              onChange={() => setShowIntern(!showIntern)}
              className="form-checkbox h-5 w-5 text-green-600"
            />
          </label>
        </div>
      )}

      <div className="space-y-6 max-w-3xl mx-auto">
        {ranking.map((a, i) => (
          <div
            key={i}
            className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md"
          >
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">#{i + 1} {a.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
            🎣 {a.total} {a.total === 1 ? 'Fang' : 'Fänge'} • 📏 Durchschnitt: {(a.sizeSum / a.total).toFixed(1)}cm
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              🏆 Punkte: <span className="font-mono">{a.totalPoints.toFixed(0)}Pkt.</span>
            </p>
            <ul className="ml-2 space-y-1">
              {Object.entries(a.byFish).map(([f, p]) => (
                <li key={f} className="flex justify-between font-mono text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-sans">{f}</span>
                  <span>{p.toFixed(0)}Pkt.</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

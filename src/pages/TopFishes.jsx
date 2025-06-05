import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function TopFishes() {
  const [fishes, setFishes] = useState([]);
  const [selectedFish, setSelectedFish] = useState('');
  const [formattedNamesMap, setFormattedNamesMap] = useState({});

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.from('fishes').select('*');
      if (error || !Array.isArray(data)) {
        console.error('Fehler beim Laden der Fische:', error);
        return;
      }

      const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';
      const PUBLIC_FROM = new Date('2025-05-29');
      const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

      const filtered = data.filter(f => {
        const fangDatum = new Date(f.timestamp);
        const istAbNeu = fangDatum >= PUBLIC_FROM;
        const istVertrauter = vertraute.includes(f.angler);
        return istAbNeu || (istVertrauter && vertraute.includes(anglerName));
      });

      setFishes(filtered);

      // Namensformatierung vorbereiten wie im Leaderboard
      const { data: profiles, error: profileError } = await supabase.from('profiles').select('name');
      if (profileError) {
        console.error('Fehler beim Laden der Profile:', profileError);
        return;
      }

      const vornameHäufigkeit = {};
      profiles.forEach(p => {
        const [first] = p.name.trim().split(' ');
        vornameHäufigkeit[first] = (vornameHäufigkeit[first] || 0) + 1;
      });

      const mapping = {};
      profiles.forEach(p => {
        const [first, last] = p.name.trim().split(' ');
        const mehrfach = vornameHäufigkeit[first] > 1;
        mapping[p.name.trim()] = mehrfach && last ? `${first} ${last[0]}.` : first;
      });

      setFormattedNamesMap(mapping);
    }

    loadData();
  }, []);

  const allTypes = [...new Set(
    fishes.map(f => f.fish?.trim()).filter(fish => fish && fish !== 'Unbekannt')
  )].sort();

  const top10 = fishes
    .filter(f => f.fish === selectedFish && f.size && f.angler && f.fish !== 'Unbekannt')
    .sort((a, b) => parseFloat(b.size) - parseFloat(a.size))
    .slice(0, 10);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-300">🏅 Top 10</h2>

      <div className="max-w-md mx-auto mb-8">
        <select
          value={selectedFish}
          onChange={(e) => setSelectedFish(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Fischart auswählen</option>
          {allTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {selectedFish && (
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold text-green-700 dark:text-green-300 mb-4">{selectedFish}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left font-mono bg-white dark:bg-gray-800 shadow rounded-xl">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Angler</th>
                  <th className="px-4 py-2 text-right">Größe</th>
                  <th className="px-4 py-2 text-right">Datum</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((f, i) => {
                  const dateStr = new Date(f.timestamp).toLocaleDateString('de-DE');
                  const nameKey = (f.angler || '').trim();
                  const shortName = formattedNamesMap[nameKey] || f.angler || 'Unbekannt';

                  return (
                    <tr key={f.id || i} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">{i + 1}</td>
                      <td className="px-4 py-2 font-sans">{shortName}</td>
                      <td className="px-4 py-2 text-right">{parseFloat(f.size).toFixed(1)} cm</td>
                      <td className="px-4 py-2 text-right">{dateStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

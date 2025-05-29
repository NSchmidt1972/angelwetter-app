import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatNameList } from '../utils/nameFormatter';

export default function TopFishes() {
  const [fishes, setFishes] = useState([]);
  const [selectedFish, setSelectedFish] = useState('');
  const [formattedNames, setFormattedNames] = useState([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.from('fishes').select('*');
      if (!error && Array.isArray(data)) {
        const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';
        const PUBLIC_FROM = new Date('2025-05-29');
        const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

        const filtered = data.filter(f => {
          const fangDatum = new Date(f.timestamp);
          const istAbNeu = fangDatum >= PUBLIC_FROM;
          const istVertrauter = vertraute.includes(f.angler);
          const darfSehen = istAbNeu || (istVertrauter && vertraute.includes(anglerName));
          return darfSehen;
        });

        setFishes(filtered);

        const { data: profiles } = await supabase.from('profiles').select('name');
        const validFishes = filtered.filter(f => f.angler);
        const formatted = formatNameList(validFishes.map(f => f.angler), profiles);
        setFormattedNames(formatted);
      } else {
        console.error('Fehler beim Laden der Fische:', error);
      }
    }
    loadData();
  }, []);

  const allTypes = [...new Set(
    fishes
      .map(f => f.fish?.trim())
      .filter(fish => fish && fish !== 'Unbekannt')
  )].sort();

  const top10 = fishes
    .filter(f => f.fish === selectedFish && f.size && f.angler && f.fish !== 'Unbekannt')
    .sort((a, b) => parseFloat(b.size) - parseFloat(a.size))
    .slice(0, 10);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-300">🏅 Top 10 einer Fischart</h2>

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
          <h3 className="text-xl font-semibold text-green-700 dark:text-green-300 mb-2">{selectedFish}</h3>
          <ul className="bg-white dark:bg-gray-800 shadow rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
            {top10.map((f, i) => {
              const dateStr = new Date(f.timestamp).toLocaleDateString('de-DE');
              const index = fishes.findIndex(entry => entry.id === f.id);
              const shortName = formattedNames[index] || f.angler || 'Unbekannt';
              return (
                <li key={f.id || i} className="px-4 py-2 flex justify-between text-sm">
                  <span>#{i + 1} {shortName}</span>
                  <span>{f.size} cm – {dateStr}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
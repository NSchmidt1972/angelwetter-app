import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function TopFishes() {
  const [fishes, setFishes] = useState([]);
  const [selectedFish, setSelectedFish] = useState('');

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.from('fishes').select('*');
      if (!error && Array.isArray(data)) {
        setFishes(data);
      } else {
        console.error('Fehler beim Laden der Fische:', error);
      }
    }
    loadData();
  }, []);

  // Fischarten extrahieren und sortieren
 const allTypes = [...new Set(
  fishes
    .map(f => f.fish?.trim())
    .filter(fish => fish && fish !== 'Unbekannt')
)].sort();


  // Gefilterte Top 10
const top10 = fishes
  .filter(f => f.fish === selectedFish && f.size && f.angler && f.fish !== 'Unbekannt')
  .sort((a, b) => parseFloat(b.size) - parseFloat(a.size))
  .slice(0, 10);



  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700">🏅 Top 10 einer Fischart</h2>

      {/* Dropdown zur Auswahl */}
      <div className="max-w-md mx-auto mb-8">
        <select
          value={selectedFish}
          onChange={(e) => setSelectedFish(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Fischart auswählen</option>
          {allTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Anzeige nur bei Auswahl */}
      {selectedFish && (
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold text-green-700 mb-2">{selectedFish}</h3>
          <ul className="bg-white shadow rounded-xl divide-y divide-gray-200">
            {top10.map((f, i) => {
              const dateStr = new Date(f.timestamp).toLocaleDateString('de-DE');
              return (
                <li key={f.id || i} className="px-4 py-2 flex justify-between text-sm">
                  <span>#{i + 1} {f.angler || 'Unbekannt'}</span>
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

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function SpotAdmin() {
  const [spots, setSpots] = useState([]);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isNicol, setIsNicol] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem('anglerName') || '';
    setIsNicol(name.trim().toLowerCase() === 'nicol schmidt');
  }, []);

  const loadSpots = async () => {
    const { data, error } = await supabase.from('spots').select('*').order('id');
    if (!error) setSpots(data);
    else console.error('❌ Fehler beim Laden:', error);
  };

  useEffect(() => {
    if (isNicol) loadSpots();
  }, [isNicol]);

  const handleSave = async () => {
    if (!name || !lat || !lon) {
      alert('Bitte Name und Koordinaten eingeben');
      return;
    }

    setLoading(true);

    if (editingId) {
      // Update-Modus
      const { error } = await supabase.from('spots')
        .update({ name: name.trim(), lat: parseFloat(lat), lon: parseFloat(lon) })
        .eq('id', editingId);
      if (error) {
        alert('Fehler beim Aktualisieren');
        console.error(error);
      }
    } else {
      // Neu anlegen
      const { error } = await supabase.from('spots').insert({
        name: name.trim(),
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      });
      if (error) {
        alert('Fehler beim Speichern');
        console.error(error);
      }
    }

    setName('');
    setLat('');
    setLon('');
    setEditingId(null);
    setLoading(false);
    await loadSpots();
  };

  const handleEdit = (spot) => {
    setEditingId(spot.id);
    setName(spot.name);
    setLat(spot.lat.toString());
    setLon(spot.lon.toString());
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setLat('');
    setLon('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Wirklich löschen?')) return;

    const { error } = await supabase.from('spots').delete().eq('id', id);
    if (error) {
      alert('Fehler beim Löschen');
    } else {
      await loadSpots();
    }
  };

  if (!isNicol) {
    return (
      <div className="p-6 text-center text-red-600">
        🚫 Kein Zugriff – Nur für Nicol Schmidt
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 rounded-xl shadow space-y-6">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300">
        {editingId ? '✏ Angelplatz bearbeiten' : '🛠 Angelplatz hinzufügen'}
      </h2>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Name (z. B. Steg Nord)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
        />
        <input
          type="number"
          placeholder="Breitengrad (lat)"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
        />
        <input
          type="number"
          placeholder="Längengrad (lon)"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
        />

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
          >
            {editingId ? '💾 Aktualisieren' : '➕ Speichern'}
          </button>
          {editingId && (
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-2 rounded"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {spots.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Keine Angelplätze vorhanden.</p>
        ) : (
          <ul className="space-y-2">
            {spots.map((s) => (
              <li
                key={s.id}
                className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-3 rounded"
              >
                <span>{s.name} ({s.lat.toFixed(5)}, {s.lon.toFixed(5)})</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(s)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    ✏ Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    🗑 Löschen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase < 0.25) return '🌒 zunehmend';
  if (phase === 0.25) return '🌓 erstes Viertel';
  if (phase < 0.5) return '🌔 zunehmend';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase < 0.75) return '🌖 abnehmend';
  if (phase === 0.75) return '🌗 letztes Viertel';
  return '🌘 abnehmend';
}

function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export default function CatchList({ anglerName }) {
  const [catches, setCatches] = useState([]);

  useEffect(() => {
    async function loadFishes() {
      const { data, error } = await supabase
        .from('fishes')
        .select('*')
        .eq('blank', false)
        .order('timestamp', { ascending: false });

      if (!error) {
        setCatches(data);
      } else {
        console.error('Fehler beim Laden der Fänge:', error);
      }
    }

    loadFishes();
  }, []);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Diesen Fang wirklich löschen?");
    if (!confirmDelete) return;

    const { error } = await supabase.from('fishes').delete().eq('id', id);
    if (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Löschen fehlgeschlagen.");
    } else {
      setCatches(prev => prev.filter(c => c.id !== id));
    }
  };

  if (catches.length === 0) {
    return <p className="text-center text-gray-500 mt-6">Keine Fänge gespeichert.</p>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700">🎣 gefangene Fische</h2>
      <ul className="space-y-6 max-w-3xl mx-auto">
        {catches.map((entry, index) => {
          const date = new Date(entry.timestamp);
          const dateStr = date.toLocaleDateString('de-DE');
          const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

          return (
            <li
              key={entry.id || index}
              className="relative p-5 border border-gray-200 rounded-xl bg-white shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              {entry.angler === anglerName && (
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-lg"
                  title="Fang löschen"
                >
                  ❌
                </button>
              )}

              <p className="text-sm text-gray-500 mb-1">{dateStr} – {timeStr}</p>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">👤</span>
                <span className="font-semibold">{entry.angler}</span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🐟</span>
                <span className="font-medium text-blue-600">{entry.fish}</span>
                <span className="text-gray-600">{entry.size} cm</span>
              </div>

              {entry.note && (
                <p className="italic text-sm text-gray-600 mb-2">{entry.note}</p>
              )}

              {entry.weather && (
                <div className="flex items-center gap-3 text-sm text-gray-700 flex-wrap mt-3">
                  <img
                    src={`https://openweathermap.org/img/wn/${entry.weather.icon}@2x.png`}
                    alt={entry.weather.description}
                    className="w-12 h-12"
                  />
                  <div>
                    <p className="font-medium">
                      {entry.weather.temp} °C, {entry.weather.description}
                    </p>
                    <p>
                      💨 {entry.weather.wind} m/s
                      {entry.weather.wind_deg !== undefined && (
                        <> aus {windDirection(entry.weather.wind_deg)} ({entry.weather.wind_deg}°)</>
                      )}
                    </p>
                    <p>
                      💦 {entry.weather.humidity}% • 🧪 {entry.weather.pressure} hPa
                      {entry.weather.rain !== undefined && (
                        <> • 💧 {entry.weather.rain} mm</>
                      )}
                    </p>
                    <p>{getMoonDescription(entry.weather.moon_phase)}</p>
                  </div>
                </div>
              )}

             
            </li>
          );
        })}
      </ul>
    </div>
  );
}

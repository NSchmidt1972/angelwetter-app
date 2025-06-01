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
  const [onlyMine, setOnlyMine] = useState(false);
  const [formattedNames, setFormattedNames] = useState([]);

  useEffect(() => {
    async function loadFishes() {
      let query = supabase
        .from('fishes')
        .select('*')
        .eq('blank', false)
        .order('timestamp', { ascending: false });

      if (onlyMine && anglerName) {
        query = query.eq('angler', anglerName);
      }

      const { data: fishData, error: fishError } = await query;
      if (fishError) {
        console.error('Fehler beim Laden der Fänge:', fishError);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name');

      if (profileError) {
        console.error('Fehler beim Laden der Profile:', profileError);
        return;
      }

      const PUBLIC_FROM = new Date('2025-05-29');
      const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

      const filteredFishes = fishData.filter(f => {
        const fangDatum = new Date(f.timestamp);
        const istAbNeu = fangDatum >= PUBLIC_FROM;
        const istVertrauter = vertraute.includes(f.angler);
        const darfSehen = istAbNeu || (istVertrauter && vertraute.includes(anglerName));
        return darfSehen;
      });

      const formatted = filteredFishes.map(f => {
        const [first, last] = f.angler.split(' ');
        const count = profileData.filter(p => p.name.startsWith(first + ' ')).length;
        return count > 1 && last ? `${first} ${last[0]}.` : first;
      });

      setCatches(filteredFishes);
      setFormattedNames(formatted);
    }

    loadFishes();
  }, [onlyMine, anglerName]);

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

  const handleShare = async (entry) => {

    const FISH_ARTICLES = {
  Aal: 'einen',
  Barsch: 'einen',
  Brasse: 'eine',
  Hecht: 'einen',
  Karpfen: 'einen',
  Rotauge: 'ein',
  Rotfeder: 'eine',
  Schleie: 'eine',
  Wels: 'einen',
  Zander: 'einen',
};

    const date = new Date(entry.timestamp).toLocaleDateString('de-DE');
    const weather = entry.weather;

   const article = FISH_ARTICLES[entry.fish] || 'einen';
const shareText = `🎣 Ich habe am ${date} ${article} ${entry.fish} gefangen!\n` +
  `📏 Größe: ${entry.size} cm\n` +
  `🌡 Wetter: ${weather?.temp ?? '?'} °C, ${weather?.description ?? 'unbekannt'}\n` +
  `💨 Wind: ${weather?.wind ?? '?'} m/s${weather?.wind_deg !== undefined ? ` aus ${windDirection(weather.wind_deg)}` : ''}\n` +
  `🧪 Luftdruck: ${weather?.pressure ?? '?'} hPa • 💦 Feuchte: ${weather?.humidity ?? '?'}%\n` +
  `🌙 Mond: ${getMoonDescription(weather?.moon_phase)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mein Fang', text: shareText });
      } catch (err) {
        console.warn('❌ Teilen abgebrochen oder nicht möglich:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert('📋 Fanginfo kopiert! Jetzt z. B. in WhatsApp einfügen.');
      } catch (err) {
        alert('Teilen nicht unterstützt. Bitte manuell kopieren.');
      }
    }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <div className="flex justify-between items-center max-w-3xl mx-auto mb-6">
        <div>
          <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-300">
            🎣 {onlyMine ? 'meine Fische' : 'alle Fische'}
          </h2>
          {catches.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
         🎯 {onlyMine ? 'Meine' : 'Gesamt'}: {catches.length} {catches.length === 1 ? 'Fang' : 'Fänge'}
            </p>
          )}
        </div>

        <label className="text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={e => setOnlyMine(e.target.checked)}
            className="mr-2"
          />
          nur meine
        </label>
      </div>

      {catches.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-6">Keine Fänge gespeichert.</p>
      ) : (
        <ul className="space-y-6 max-w-3xl mx-auto">
          {catches.map((entry, index) => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString('de-DE');
            const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            return (
              <li
                key={entry.id || index}
                className="relative p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow duration-200"
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

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{dateStr} – {timeStr}</p>

                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">👤</span>
                  <span className="font-semibold">{formattedNames[index]}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🐟</span>
                  <span className="text-blue-600 dark:text-blue-300 font-medium">{entry.fish}</span>
                  <span className="text-gray-600 dark:text-gray-300">{entry.size} cm</span>
                </div>

                {entry.note && (
                  <p className="italic text-sm text-gray-600 dark:text-gray-400 mb-2">{entry.note}</p>
                )}

                {entry.weather && (
                  <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 flex-wrap mt-3">
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

                {entry.angler === anglerName && (
                  <div className="mt-4 text-right">
                    <button
                      onClick={() => handleShare(entry)}
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                    >
                      📤 Teilen
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
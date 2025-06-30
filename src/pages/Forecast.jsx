import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PUBLIC_FROM = new Date('2025-05-29');
const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

function getMoonDescription(phase) {
  if (phase < 0.03 || phase > 0.97) return '🌑 Neumond';
  if (phase < 0.22) return '🌒 zunehmend';
  if (phase < 0.28) return '🌓 erstes Viertel';
  if (phase < 0.47) return '🌔 zunehmend';
  if (phase < 0.53) return '🌕 Vollmond';
  if (phase < 0.72) return '🌖 abnehmend';
  if (phase < 0.78) return '🌗 letztes Viertel';
  return '🌘 abnehmend';
}

function isWeatherSimilar(w, current, timestamp) {
  const fangDatum = new Date(timestamp);

  const basicMatch =
    Math.abs(w.temp - current.temp) <= 12 &&
    Math.abs(w.pressure - current.pressure) <= 15 &&
    Math.abs(w.humidity - current.humidity) <= 35 &&
    Math.abs(w.wind_deg - current.wind_deg) <= 90;

  const mondOk = w.moon_phase != null && current.moon_phase != null
    ? Math.abs(w.moon_phase - current.moon_phase) <= 0.4
    : true;

  const beschreibungOk = w.description && current.description
    ? w.description.includes(current.description) || current.description.includes(w.description)
    : true;

  const windSpeedOk = typeof w.wind === 'number' && typeof current.wind === 'number'
    ? Math.abs(w.wind - current.wind) <= 5
    : true;

  if (fangDatum < PUBLIC_FROM) {
    return basicMatch && mondOk && beschreibungOk;
  } else {
    return basicMatch && windSpeedOk && mondOk && beschreibungOk;
  }
}

export default function Forecast() {
  const [fishes, setFishes] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);

  useEffect(() => {
    const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';

    const loadWeatherAndFishes = async () => {
      const { data: weatherRow, error: weatherError } = await supabase
        .from('weather_cache')
        .select('data')
        .eq('id', 'latest')
        .single();

      if (weatherError || !weatherRow) {
        console.warn("⚠️ Wetterdaten konnten nicht geladen werden:", weatherError);
        return;
      }

      const current = weatherRow.data?.current;
      const daily = weatherRow.data?.daily?.[0];

      if (!current) return;

      const weather = {
        temp: current.temp,
        pressure: current.pressure,
        wind: current.wind_speed,
        humidity: current.humidity,
        wind_deg: current.wind_deg,
        description: current.weather?.[0]?.description ?? '',
        moon_phase: daily?.moon_phase ?? null
      };

      setWeatherData(weather);

      // KI-Server Abfrage
     try {
  const aiResponse = await fetch("https://ai.asv-rotauge.de/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      temp: weather.temp,
      pressure: weather.pressure,
      humidity: weather.humidity,
      wind: weather.wind,
      wind_deg: weather.wind_deg,
      moon_phase: weather.moon_phase
    })
  });
  const aiResult = await aiResponse.json();
  console.log("KI-Server Antwort:", aiResult);
  setAiPrediction(aiResult);
} catch (err) {
  console.error("Fehler bei der KI-Server-Anfrage:", err);
}

      // Regelbasierte Fänge laden
      const { data: catchData, error: catchError } = await supabase
        .from('fishes')
        .select('*');

      if (catchError) {
        console.error("❌ Fehler beim Laden der Fänge:", catchError);
        return;
      }

      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
      const istVertrauter = vertraute.includes(anglerName);

      const filteredFishes = catchData.filter(f => {
        if (f.is_marilou) return false; 
        const fangDatum = new Date(f.timestamp);
        if (istVertrauter) {
          if (filterSetting === 'all') return true;
          return fangDatum >= PUBLIC_FROM;
        }
        return fangDatum >= PUBLIC_FROM;
      });

      setFishes(filteredFishes);
    };

    loadWeatherAndFishes();
  }, []);

  const fishesWithWeather = fishes.filter(f =>
    f.weather && f.fish && typeof f.fish === 'string' && f.fish.trim() !== ''
  );

  const similar = fishesWithWeather.filter(f => isWeatherSimilar(f.weather, weatherData, f.timestamp));

  const chance =
    fishesWithWeather.length > 0
      ? ((similar.length / fishesWithWeather.length) * 100).toFixed(1)
      : '0.0';

  const byDescription = {};
  const byTempRange = {};
  similar.forEach(f => {
    const d = f.weather?.description || 'unbekannt';
    byDescription[d] = (byDescription[d] || 0) + 1;

    const t = f.weather?.temp;
    if (typeof t === 'number') {
      const bucket = `${Math.floor(t / 5) * 5}–${Math.floor(t / 5) * 5 + 4}°C`;
      byTempRange[bucket] = (byTempRange[bucket] || 0) + 1;
    }
  });

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🔮 Fangprognose</h2>

      <p className="text-center text-gray-600 dark:text-gray-300 mb-4 max-w-xl mx-auto">
        Diese Schätzung basiert auf dem aktuellen Wetter und gefangenen Fischen bei ähnlichen Bedingungen.
        Umso mehr Eintragungen, umso genauer wird die Prognose. 👀
      </p>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6">
          {weatherData ? (
            <>
              <p className="text-gray-800 dark:text-gray-100 text-lg">
                Bei vergleichbarem Wetter wurden in der Vergangenheit <span className="font-bold">{similar.length}</span> Fische gefangen.
              </p>

              {fishesWithWeather.length === 0 ? (
                <p className="mt-2 text-gray-500 dark:text-gray-400 italic">
                  Es liegen noch keine Fänge mit Wetterdaten vor.
                </p>
              ) : (
                <p className="mt-2 text-xl text-green-700 dark:text-green-400 font-bold">
                  🎯 Prognose (Regel): {chance}% Fangwahrscheinlichkeit
                </p>
              )}

              {aiPrediction && (
                <div className="mt-4 bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
                  <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">🤖 KI-Prognose</h3>
                  <p className="text-xl text-blue-700 dark:text-blue-300 font-bold">
                    🎯 Fangwahrscheinlichkeit laut KI: {aiPrediction.probability}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Vorhersage: {aiPrediction.prediction === 1 ? "Fang wahrscheinlich" : "Schneidertag wahrscheinlich"}
                  </p>
                </div>
              )}

              {similar.length > 0 && (
                <div className="mt-6 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-inner">
                  <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">📊 Details zu ähnlichen Fängen</h3>

                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">🌦 Wetterbeschreibung</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-300">
                      {Object.entries(byDescription).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                        <li key={label} className="flex justify-between">
                          <span>{label}</span>
                          <span className="font-mono">{count}x</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">🌡 Temperaturbereich</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-300">
                      {Object.entries(byTempRange).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                        <li key={label} className="flex justify-between">
                          <span>{label}</span>
                          <span className="font-mono">{count}x</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Keine aktuellen Wetterdaten verfügbar.</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Forecast() {
  const [weatherData, setWeatherData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadWeatherAndPredict = async () => {
    setLoading(true);
    const { data: weatherRow, error: weatherError } = await supabase
      .from('weather_cache')
      .select('data')
      .eq('id', 'latest')
      .single();

    if (weatherError || !weatherRow) {
      console.warn("⚠️ Wetterdaten konnten nicht geladen werden:", weatherError);
      setLoading(false);
      return;
    }

    const current = weatherRow.data?.current;
    const daily = weatherRow.data?.daily?.[0];

    if (!current) {
      setLoading(false);
      return;
    }

    const weather = {
      temp: current.temp,
      pressure: current.pressure,
      wind: current.wind_speed,
      humidity: current.humidity,
      wind_deg: current.wind_deg,
      moon_phase: daily?.moon_phase ?? null
    };

    setWeatherData(weather);

    try {
      const aiResponse = await fetch("https://ai.asv-rotauge.de/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weather)
      });
      const aiResult = await aiResponse.json();
      console.log("KI-Server Antwort:", aiResult);
      setAiPrediction(aiResult);
    } catch (err) {
      console.error("Fehler bei der KI-Server-Anfrage:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadWeatherAndPredict();
  }, []);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🔮 Fangprognose</h2>
      <p className="text-center text-gray-600 dark:text-gray-300 mb-4 max-w-xl mx-auto">
        Diese KI Berechnung basiert auf dem aktuellen Wetter und gefangenen Fischen bei ähnlichen Bedingungen.
        Umso mehr Eintragungen, umso genauer wird die Prognose. 👀
      </p>
      <p className="text-xs italic text-center text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
        Die KI braucht auch die Schneidertage, sonst denkt die es wird immer gefangen, wenn jemand am See sitzt.
      </p>

      <div className="flex justify-center mb-6">
        <button
          onClick={loadWeatherAndPredict}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            loading
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {loading ? 'Lädt...' : '🔄 Aktualisieren'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto">
        {weatherData && aiPrediction ? (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
              <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">🤖 KI-Prognose</h3>
              <p className="text-xl text-blue-700 dark:text-blue-300 font-bold">
                🎯 Fangwahrscheinlichkeit: {aiPrediction.probability}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {aiPrediction.prediction === 1 ? "Fang wahrscheinlich" : "Schneidertag wahrscheinlich"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">Lade KI-Prognose…</p>
        )}
      </div>
    </div>
  );
}

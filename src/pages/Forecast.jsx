import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function renderFishRating(probability) {
  const rating = Math.round((parseFloat(probability) / 100) * 5);
  if (isNaN(rating)) return '❓';
  if (rating === 0) return '🚫';
  return '🐟'.repeat(rating);
}

export default function Forecast() {
  const [weatherData, setWeatherData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [dailyPredictions, setDailyPredictions] = useState([]);
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
    const daily = weatherRow.data?.daily;

    if (!current || !daily) {
      setLoading(false);
      return;
    }

    const weather = {
      temp: current.temp,
      pressure: current.pressure,
      wind: current.wind_speed,
      humidity: current.humidity,
      wind_deg: current.wind_deg,
      moon_phase: daily?.[0]?.moon_phase ?? null
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

    // 🧠 KI-Prognose für jeden Tag berechnen
    const dailyWithPrediction = await Promise.all(
      daily.map(async (day) => {
        const dayWeather = {
          temp: day.temp.day,
          pressure: day.pressure,
          wind: day.wind_speed,
          humidity: day.humidity,
          wind_deg: day.wind_deg,
          moon_phase: day.moon_phase
        };

        try {
          const aiResponse = await fetch("https://ai.asv-rotauge.de/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dayWeather)
          });
          const aiResult = await aiResponse.json();
          return { ...day, aiPrediction: aiResult };
        } catch (err) {
          console.error("Fehler bei der KI-Vorhersage für Tag:", err);
          return { ...day, aiPrediction: null };
        }
      })
    );

    setDailyPredictions(dailyWithPrediction);
    setLoading(false);
  };

  useEffect(() => {
    loadWeatherAndPredict();
  }, []);

  const getPressureTrendLabel = () => {
    const val = aiPrediction?.trend?.pressure_trend_5d;
    if (val == null) return 'n/a';
    const rounded = Math.abs(val).toFixed(2);
    if (val >= 3) return `stark steigend (+${rounded} hPa)`;
    if (val >= 1) return `steigend (+${rounded} hPa)`;
    if (val >= 0.5) return `leicht steigend (+${rounded} hPa)`;
    if (val <= -3) return `stark fallend (-${rounded} hPa)`;
    if (val <= -1) return `fallend (-${rounded} hPa)`;
    if (val <= -0.5) return `leicht fallend (-${rounded} hPa)`;
    return `stabil (${val.toFixed(2)} hPa)`;
  };

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
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 mb-6">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
              <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">🤖 KI-Prognose</h3>
              <p className="text-xl text-blue-700 dark:text-blue-300 font-bold">
                🎯 Fangwahrscheinlichkeit: {aiPrediction.probability}% {renderFishRating(aiPrediction.probability)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {aiPrediction.prediction === 1
                  ? "Fang wahrscheinlich"
                  : "Schneidertag wahrscheinlich"}
              </p>

              {aiPrediction.stats && (
                <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                  <h4 className="font-semibold mb-1">🧮 Trainingsdaten</h4>
                  <ul className="ml-2 list-disc list-inside space-y-1">
                    <li>Gesamtanzahl: {aiPrediction.stats.total_samples}</li>
                    <li>🎣 Fänge: {aiPrediction.stats.positive_samples}</li>
                    <li>❌ Schneidertage: {aiPrediction.stats.negative_samples}</li>
                  </ul>
                </div>
              )}

              <div className="text-sm text-gray-700 dark:text-gray-300">
                <h4 className="font-semibold mb-1">📈 Trenddaten</h4>
                <div className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="font-medium">Luftdruck-Trend (5 Tage):</div>
                    <div className="ml-2">{getPressureTrendLabel()}</div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="font-medium">Temp-Mittel (3 Tage):</div>
                    <div className="ml-2">
                      {aiPrediction?.trend?.temp_mean_3d != null
                        ? `${aiPrediction.trend.temp_mean_3d.toFixed(2)} °C`
                        : 'n/a'}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="font-medium">Temp-Volatilität (3 Tage):</div>
                    <div className="ml-2 flex items-center gap-2">
                      {aiPrediction?.trend?.temp_volatility_3d != null ? (
                        <>
                          <span>{aiPrediction.trend.temp_volatility_3d.toFixed(2)} °C</span>
                          {(() => {
                            const v = aiPrediction.trend.temp_volatility_3d;
                            if (v < 3) {
                              return <span className="text-green-600 dark:text-green-400 font-semibold">✅ günstig</span>;
                            } else if (v < 6) {
                              return <span className="text-yellow-600 dark:text-yellow-300 font-semibold">⚠️ wechselhaft</span>;
                            } else {
                              return <span className="text-red-600 dark:text-red-400 font-semibold">❌ ungünstig</span>;
                            }
                          })()}
                        </>
                      ) : (
                        'n/a'
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">Lade KI-Prognose…</p>
        )}

     
      </div>
    </div>
  );
}

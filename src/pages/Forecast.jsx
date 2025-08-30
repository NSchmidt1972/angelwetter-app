import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function renderFishRating(probability) {
  const rating = Math.round((parseFloat(probability) / 100) * 5);
  if (isNaN(rating)) return '❓';
  if (rating === 0) return '🚫';
  return '🐟'.repeat(rating);
}

function formatDate(ts) {
  // OpenWeatherMap daily.dt ist Unix (Sekunden)
  const d = new Date((ts ?? 0) * 1000);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export default function Forecast() {
  const [weatherData, setWeatherData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [dailyPredictions, setDailyPredictions] = useState([]); // <-- wird unten genutzt
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
      setAiPrediction(aiResult);
    } catch (err) {
      console.error("Fehler bei der KI-Server-Anfrage:", err);
    }

    // 🧠 KI-Prognose für jeden Tag berechnen
    const dailyWithPrediction = await Promise.all(
      daily.map(async (day) => {
        const dayWeather = {
          temp: day.temp?.day ?? day.temp, // fallback
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
          className={`px-4 py-2 rounded-lg font-medium transition ${loading
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
                {aiPrediction.prediction === 1 ? "Fang wahrscheinlich" : "Schneidertag wahrscheinlich"}
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
                          <span>{aiPrediction.trend.temp_volatility_3d.toFixed(2)} °C</span>
                          {(() => {
                            const v = aiPrediction.trend.temp_volatility_3d;
                            if (v < 3) return <span className="text-green-600 dark:text-green-400 font-semibold">✅ günstig</span>;
                            if (v < 6) return <span className="text-yellow-600 dark:text-yellow-300 font-semibold">⚠️ wechselhaft</span>;
                            return <span className="text-red-600 dark:text-red-400 font-semibold">❌ ungünstig</span>;
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

            {/* 🎣 KI: Wahrscheinlichkeiten pro Fischart */}
            {aiPrediction?.per_fish_type && Object.keys(aiPrediction.per_fish_type).length > 0 ? (
              <div className="mt-6">
                <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">🐠 Wahrscheinlichkeiten nach Fischart</h4>
                <div className="space-y-2">
                  {Object.entries(aiPrediction.per_fish_type)
                    .sort(([, a], [, b]) => b - a)
                    .map(([fish, prob]) => (
                      <div key={fish} className="flex items-center justify-between px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 shadow-sm">
                        <span className="font-medium text-gray-800 dark:text-gray-100">{fish}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-blue-700 dark:text-blue-300 text-sm">
                            {prob.toFixed(1)} %
                          </span>
                          <span>{renderFishRating(prob)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 italic mt-6">
                Keine Fischarten-Prognose verfügbar. 🤷‍♂️
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">Lade KI-Prognose…</p>
        )}

        {/* 🗓️ 7-Tage-Ausblick: Datum • Icon • Temperatur • Fischarten-Prognose */}
        {dailyPredictions?.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6">
            <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">🗓️ 7-Tage-Ausblick</h3>

            <div className="space-y-3">
              {dailyPredictions.map((d, idx) => {
                const icon = d.weather?.[0]?.icon;
                const desc = d.weather?.[0]?.description ?? 'Wetter';
                const tempDay = d?.temp?.day != null ? Math.round(d.temp.day) : null;
                const fishMap = d.aiPrediction?.per_fish_type || {};
                // Top 3 Fischarten nach Wahrscheinlichkeit
                const sortedFish = Object.entries(fishMap).sort(([, a], [, b]) => b - a);
                const top = sortedFish.slice(0, 3);
                const moreCount = Math.max(sortedFish.length - top.length, 0);

                const dateStr = new Date(d.dt * 1000).toLocaleDateString('de-DE', {
                  weekday: 'short', day: '2-digit', month: '2-digit'
                });

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
                  >
                    {/* Kopfzeile: Datum • Icon • Temperatur */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {icon ? (
                          <img
                            src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                            alt={desc}
                            className="w-10 h-10"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-600" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{dateStr}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 capitalize">{desc}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {tempDay != null ? `${tempDay}°C` : '–'}
                        </div>
                      </div>
                    </div>

                    {/* Fischarten-Prognose */}
                    <div className="mt-2">
                      {top.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {top.map(([fish, prob]) => (
                            <div
                              key={fish}
                              className="px-2 py-1 rounded-md bg-white/70 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 text-sm flex items-center gap-2"
                            >
                              <span className="font-medium text-gray-800 dark:text-gray-100">{fish}</span>
                              <span className="font-mono text-gray-700 dark:text-gray-200">
                                {prob.toFixed(1)}%
                              </span>
                              <span className="leading-none">
                                {renderFishRating(prob)}
                              </span>
                            </div>
                          ))}
                          {moreCount > 0 && (
                            <div className="px-2 py-1 rounded-md bg-white/50 dark:bg-black/10 border border-dashed border-gray-300/60 dark:border-white/20 text-sm">
                              +{moreCount} weitere
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm italic text-gray-500 dark:text-gray-300">
                          Keine Fischarten-Prognose verfügbar.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

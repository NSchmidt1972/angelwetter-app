// src/pages/Forecast.jsx
import { renderFishRating, formatPercent, getPressureTrendLabel, formatDateFromUnix } from "../utils/formatters";
import { useForecast } from "../hooks/useForecast";
import { useState } from "react";
import PageContainer from "../components/PageContainer";


export default function Forecast() {
  const { loading, weatherData, aiPrediction, dailyPredictions, reload } = useForecast();
  const modelTrainingRows = getModelTrainingRows(aiPrediction);

        
  const [expanded, setExpanded] = useState({}); // key: idx, value: bool

  const toggle = (idx) =>
    setExpanded((e) => ({ ...e, [idx]: !e[idx] }));


  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🔮 Fangprognose</h2>

      <p className="text-center text-gray-600 dark:text-gray-300 mb-4 max-w-xl mx-auto">
        Diese KI-Berechnung basiert auf aktuellem Wetter und historischen Fängen unter ähnlichen Bedingungen.
      </p>
      <p className="text-xs italic text-center text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
        Bitte auch Schneidersessions eintragen – sonst überschätzt die KI die Fangchancen.
      </p>

      <div className="flex justify-center mb-6">
        <button
          onClick={reload}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium transition ${loading
            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          {loading ? "Lädt..." : "🔄 Aktualisieren"}
        </button>
      </div>

      <div className="max-w-2xl mx-auto">
        {weatherData && aiPrediction ? (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 mb-6">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
              <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">🤖 KI-Prognose</h3>

              <p className="text-xl text-blue-700 dark:text-blue-300 font-bold">
                🎯 Fangwahrscheinlichkeit: {formatPercent(aiPrediction.probability, 0)}{" "}
                {renderFishRating(aiPrediction.probability)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {aiPrediction.prediction === 1 ? "Fang wahrscheinlich" : "Schneidersession wahrscheinlich"}
              </p>

              {aiPrediction.stats && (
                <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                  <h4 className="font-semibold mb-1">🧮 Trainingsdaten</h4>
                  <ul className="ml-2 list-disc list-inside space-y-1">
                    <li>Gesamtanzahl: {aiPrediction.stats.total_samples}</li>
                    <li>🎣 Fänge: {aiPrediction.stats.positive_samples}</li>
                    <li>❌ Schneidersessions: {aiPrediction.stats.negative_samples}</li>
                  </ul>
                </div>
              )}

              <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                <h4 className="font-semibold mb-1">🕒 Modellstand</h4>
                {modelTrainingRows.length > 0 ? (
                  <ul className="ml-2 list-disc list-inside space-y-1">
                    {modelTrainingRows.map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic text-gray-500 dark:text-gray-400">
                    Zeitstempel der trainierten Modelle wird vom KI-Service aktuell nicht mitgeliefert.
                  </p>
                )}
              </div>

              <div className="text-sm text-gray-700 dark:text-gray-300">
                <h4 className="font-semibold mb-1">📈 Trenddaten</h4>
                <div className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="font-medium">Luftdruck-Trend (5 Tage):</div>
                    <div className="ml-2">{getPressureTrendLabel(aiPrediction?.trend?.pressure_trend_5d)}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="font-medium">Temp-Mittel (3 Tage):</div>
                    <div className="ml-2">
                      {aiPrediction?.trend?.temp_mean_3d != null ? `${aiPrediction.trend.temp_mean_3d.toFixed(2)} °C` : "n/a"}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="font-medium">Temp-Volatilität (3 Tage):</div>
                    <div className="ml-2 flex items-center gap-2">
                      {aiPrediction?.trend?.temp_volatility_3d != null ? (
                        <>
                          <span>{aiPrediction.trend.temp_volatility_3d.toFixed(2)} °C</span>
                          <VolatilityBadge v={aiPrediction.trend.temp_volatility_3d} />
                        </>
                      ) : ("n/a")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">Lade KI-Prognose…</p>
        )}


  
    {/* 🗓️ 7-Tage-Ausblick */}
    {dailyPredictions?.length > 0 && (
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">🗓️ 7-Tage-Ausblick</h3>

        <div className="space-y-3">
          {dailyPredictions.map((d, idx) => {
            const icon = d.weather?.[0]?.icon;
            const desc = d.weather?.[0]?.description ?? "Wetter";
            const tempDay = d?.temp?.day != null ? Math.round(d.temp.day) : null;
            const fishMap = d.aiPrediction?.per_fish_type || {};
            const sortedFish = Object.entries(fishMap).sort(([, a], [, b]) => b - a);

            const top = sortedFish.slice(0, 3);
            const rest = sortedFish.slice(3);
            const moreCount = rest.length;

            const isOpen = !!expanded[idx];

            return (
              <div key={idx} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
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
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {formatDateFromUnix(d.dt)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 capitalize">{desc}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {tempDay != null ? `${tempDay}°C` : "–"}
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  {sortedFish.length > 0 ? (
                    <>
                      {/* Top 3 */}
                      <div className="flex flex-wrap gap-2">
                        {top.map(([fish, prob]) => (
                          <div
                            key={fish}
                            className="px-2 py-1 rounded-md bg-white/70 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 text-sm flex items-center gap-2"
                          >
                            <span className="font-medium text-gray-800 dark:text-gray-100">{fish}</span>
                            <span className="font-mono text-gray-700 dark:text-gray-200">
                              {Number(prob).toFixed(1)}%
                            </span>
                            <span className="leading-none">{renderFishRating(prob)}</span>
                          </div>
                        ))}

                        {/* Toggle-Button */}
                        {moreCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggle(idx)}
                            aria-expanded={isOpen}
                            className="px-2 py-1 rounded-md bg-white/50 dark:bg-black/10 border border-dashed border-gray-300/60 dark:border-white/20 text-sm hover:bg-white/70 dark:hover:bg-black/20 transition"
                          >
                            {isOpen ? "– ausblenden" : `+${moreCount} weitere`}
                          </button>
                        )}
                      </div>

                      {/* Aufklappbarer Bereich für restliche Fischarten */}
                      {moreCount > 0 && (
                        <div
                          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                            isOpen ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
                          }`}
                          id={`more-fishes-${idx}`}
                        >
                          <div className="flex flex-wrap gap-2">
                            {rest.map(([fish, prob]) => (
                              <div
                                key={fish}
                                className="px-2 py-1 rounded-md bg-white/60 dark:bg-black/10 border border-gray-200/40 dark:border-white/10 text-sm flex items-center gap-2"
                              >
                                <span className="font-medium text-gray-800 dark:text-gray-100">{fish}</span>
                                <span className="font-mono text-gray-700 dark:text-gray-200">
                                  {Number(prob).toFixed(1)}%
                                </span>
                                <span className="leading-none">{renderFishRating(prob)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
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
    </PageContainer>
  );
}

function getModelTrainingRows(aiPrediction) {
  if (!aiPrediction || typeof aiPrediction !== "object") return [];

  const rows = [
    {
      label: "Hauptmodell",
      value: pickFirstFormattedDate(
        aiPrediction?.trained_at,
        aiPrediction?.model_trained_at,
        aiPrediction?.last_trained_at,
        aiPrediction?.models?.main?.trained_at,
        aiPrediction?.models?.main?.model_trained_at,
        aiPrediction?.models?.main?.last_trained_at,
        aiPrediction?.stats?.trained_at,
        aiPrediction?.stats?.model_trained_at,
        aiPrediction?.stats?.last_trained_at,
        aiPrediction?.metadata?.trained_at,
        aiPrediction?.meta?.trained_at
      ),
    },
    {
      label: "Fischarten-Modell",
      value: pickFirstFormattedDate(
        aiPrediction?.models?.per_fish_type?.trained_at,
        aiPrediction?.models?.species?.trained_at,
        aiPrediction?.stats?.per_fish_model_trained_at,
        aiPrediction?.stats?.species_model_trained_at,
        aiPrediction?.metadata?.per_fish_model_trained_at
      ),
    },
  ].filter((row) => !!row.value);

  return rows;
}

function pickFirstFormattedDate(...candidates) {
  for (const candidate of candidates) {
    const formatted = formatDateTime(candidate);
    if (formatted) return formatted;
  }
  return null;
}

function formatDateTime(value) {
  if (value == null || value === "") return null;

  let date = null;
  if (typeof value === "number") {
    const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
    date = new Date(timestamp);
  } else if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      const timestamp = asNumber < 1_000_000_000_000 ? asNumber * 1000 : asNumber;
      date = new Date(timestamp);
    } else {
      date = new Date(value);
    }
  } else if (value instanceof Date) {
    date = value;
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VolatilityBadge({ v }) {
  if (v < 3) return <span className="text-green-600 dark:text-green-400 font-semibold">✅ günstig</span>;
  if (v < 6) return <span className="text-yellow-600 dark:text-yellow-300 font-semibold">⚠️ wechselhaft</span>;
  return <span className="text-red-600 dark:text-red-400 font-semibold">❌ ungünstig</span>;
}

import { useEffect, useState } from 'react';

function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase > 0 && phase < 0.25) return '🌒 Zunehmender Sichelmond';
  if (phase === 0.25) return '🌓 Erstes Viertel';
  if (phase > 0.25 && phase < 0.5) return '🌔 Zunehmender Dreiviertelmond';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase > 0.5 && phase < 0.75) return '🌖 Abnehmender Dreiviertelmond';
  if (phase === 0.75) return '🌗 Letztes Viertel';
  if (phase > 0.75 && phase < 1) return '🌘 Abnehmender Sichelmond';
  return '❓ Unbekannt';
}

function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function renderFishRating(probability) {
  const rating = Math.round((parseFloat(probability) / 100) * 5);
  if (isNaN(rating)) return '❓';
  if (rating === 0) return '🚫';
  return '🐟'.repeat(rating);
}

async function fetchPrediction(weather) {
  try {
    const response = await fetch("https://ai.asv-rotauge.de/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(weather)
    });
    return await response.json();
  } catch (error) {
    console.error("KI-Prognose fehlgeschlagen:", error);
    return null;
  }
}

export default function WeatherNow({ data, onRefresh }) {
  const [autoUpdated, setAutoUpdated] = useState(false);
  const [dailyWithPrediction, setDailyWithPrediction] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setAutoUpdated(true);
      onRefresh?.();
      setTimeout(() => setAutoUpdated(false), 2000);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  useEffect(() => {
    const enrichWithPrediction = async () => {
      if (!data?.data?.daily || !data?.data?.current) return;

      // Vorhersagen für die kommenden Tage
      const enriched = await Promise.all(
        data.data.daily.map(async (day) => {
          const weather = {
            temp: day.temp.day,
            pressure: day.pressure,
            wind: day.wind_speed,
            humidity: day.humidity,
            wind_deg: day.wind_deg,
            moon_phase: day.moon_phase
          };
          const prediction = await fetchPrediction(weather);
          return { ...day, aiPrediction: prediction };
        })
      );

      setDailyWithPrediction(enriched);

      // Prognose für aktuelles Wetter
      const currentWeather = {
        temp: data.data.current.temp,
        pressure: data.data.current.pressure,
        wind: data.data.current.wind_speed,
        humidity: data.data.current.humidity,
        wind_deg: data.data.current.wind_deg,
        moon_phase: data.data.daily?.[0]?.moon_phase ?? null
      };
      const prediction = await fetchPrediction(currentWeather);
      setCurrentPrediction(prediction);
    };

    enrichWithPrediction();
  }, [data]);

  if (!data?.data) {
    return (
      <div className="p-4 bg-white dark:bg-gray-900 text-center text-red-600 rounded-xl shadow max-w-xl mx-auto">
        ⚠️ Keine Wetterdaten verfügbar.
        <br />
        Die Daten konnten nicht von Supabase geladen werden.
      </div>
    );
  }

  const now = data.data.current;
  const hourly = data.data.hourly || [];
  const savedAt = data.savedAt;
  const savedAtString = savedAt
    ? new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';

  const desc = now.weather[0].description;
  const iconUrl = `https://openweathermap.org/img/wn/${now.weather[0].icon}@2x.png`;
  const moonText = getMoonDescription(data.data.daily?.[0]?.moon_phase ?? -1);

  const weekday = (dt) =>
    new Date(dt * 1000).toLocaleDateString('de-DE', { weekday: 'short' });

  const hour = (dt) =>
    new Date(dt * 1000).toLocaleTimeString('de-DE', { hour: '2-digit' });

  return (
    <div className="p-6 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-md rounded-xl max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {autoUpdated ? (
            <span className="text-green-600 dark:text-green-400 animate-pulse">🔄 Aktualisierung...</span>
          ) : (
            <span className="text-blue-700 dark:text-blue-300">🌤 Aktuelles Wetter</span>
          )}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{savedAtString} Uhr</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
        <img src={iconUrl} alt={desc} className="w-24 h-24 mx-auto sm:mx-0" />
        <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <p className="text-lg font-semibold">{now.temp.toFixed(0)} °C – {desc}</p>
          <p>🌅 Sonnenaufgang: {new Date(now.sunrise * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🌄 Sonnenuntergang: {new Date(now.sunset * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🧪 Luftdruck: {now.pressure} hPa • 💦 Luftfeuchte: {now.humidity}%</p>
          <p>💨 Wind: {now.wind_speed} m/s aus {windDirection(now.wind_deg)}</p>
          <p>🔆 UV-Index: {now.uvi}</p>
          <p>🌙 Mondphase: {moonText}</p>
          {currentPrediction?.probability != null && (
            <p className="text-sm text-green-700 dark:text-green-300 font-semibold">
              🎯 {currentPrediction.probability.toFixed(0)} % {renderFishRating(currentPrediction.probability)}
            </p>
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">🕒 Stündliche Vorhersage (24h)</h3>
      <div className="flex overflow-x-auto gap-4 pb-4">
        {hourly.slice(0, 24).map((h, index) => (
          <div
            key={index}
            className="min-w-[160px] bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center flex-shrink-0 hover:shadow-md transition"
          >
            <p className="font-bold">{hour(h.dt)}</p>
            <img
              src={`https://openweathermap.org/img/wn/${h.weather?.[0]?.icon}@2x.png`}
              alt={h.weather?.[0]?.description}
              className="mx-auto w-12 h-12"
            />
            <p className="text-sm">{h.weather?.[0]?.description}</p>
            <p className="text-lg font-semibold">{h.temp.toFixed(0)} °C</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              🌧 {Math.round(h.pop * 100)} %
              {h.pop > 0 && h.rain?.["1h"] && <> • 💧 {h.rain["1h"].toFixed(1)} mm</>}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {h.pressure} hPa • 💦 {h.humidity}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧭 {windDirection(h.wind_deg)} ({h.wind_speed.toFixed(1)} m/s)</p>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-700 dark:text-gray-200">🗓 7-Tage-Vorhersage</h3>
      <div className="flex overflow-x-auto gap-4 pb-4">
        {dailyWithPrediction.slice(0, 7).map((day, index) => (
          <div
            key={index}
            className="min-w-[200px] bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center flex-shrink-0 hover:shadow-md transition"
          >
            <p className="font-bold">{weekday(day.dt)}</p>
            <img
              src={`https://openweathermap.org/img/wn/${day.weather?.[0]?.icon}@2x.png`}
              alt={day.weather?.[0]?.description}
              className="mx-auto w-12 h-12"
            />
            <p className="text-sm">{day.weather?.[0]?.description}</p>
            <p className="text-lg font-semibold">{day.temp.day.toFixed(0)} °C</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              🌧 {Math.round(day.pop * 100)} %
              {day.pop > 0 && day.rain && <> • 💧 {day.rain.toFixed(1)} mm</>}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {day.pressure} hPa • 💦 {day.humidity}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧭 {windDirection(day.wind_deg)} ({day.wind_speed.toFixed(1)} m/s)</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{getMoonDescription(day.moon_phase)}</p>
            {day.aiPrediction?.probability != null && (
              <p className="text-sm text-green-700 dark:text-green-300 font-semibold mt-2">
                🎯 {day.aiPrediction.probability.toFixed(0)} % {renderFishRating(day.aiPrediction.probability)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

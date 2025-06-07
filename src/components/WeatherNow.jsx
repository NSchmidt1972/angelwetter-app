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

export default function WeatherNow({ data, onRefresh }) {
  const [autoUpdated, setAutoUpdated] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAutoUpdated(true);
      onRefresh?.();
      setTimeout(() => setAutoUpdated(false), 2000);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [onRefresh]);

  if (!data?.data) {
    return (
      <div className="p-4 bg-white dark:bg-gray-900 shadow rounded-xl max-w-full mx-auto text-center text-red-600">
        ⚠️ Keine Wetterdaten verfügbar.<br />
        Die Daten konnten nicht von Supabase geladen werden.
      </div>
    );
  }

  const now = data.data.current;
  const hourly = data.data.hourly || [];
  const daily = data.data.daily || [];

  const savedAt = data.savedAt;
  const savedAtString = savedAt
    ? new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';

  const desc = now.weather[0].description;
  const iconUrl = `https://openweathermap.org/img/wn/${now.weather[0].icon}@2x.png`;
  const moonText = getMoonDescription(daily[0]?.moon_phase ?? -1);

  const weekday = (dt) =>
    new Date(dt * 1000).toLocaleDateString('de-DE', { weekday: 'short' });

  const hour = (dt) =>
    new Date(dt * 1000).toLocaleTimeString('de-DE', { hour: '2-digit' });

  return (
    <div className="p-4 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow rounded-xl max-w-full mx-auto relative">
      <div className="flex justify-between items-baseline mb-2">
        <h2 className="text-xl font-bold">
          {autoUpdated ? (
            <span className="text-green-700 dark:text-green-400 animate-fadeInSlide">
              🔄 Aktualisierung<span className="dot-typing ml-1"></span>
            </span>
          ) : (
            <span className="text-blue-700 dark:text-blue-300">🌤 Aktuelles Wetter</span>
          )}
        </h2>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Stand: {savedAtString} Uhr
        </p>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <img src={iconUrl} alt={desc} className="w-24 h-24" />
        <div>
          <p className="text-lg font-semibold">{now.temp.toFixed(0)} °C – {desc}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            🌅 Sonnenaufgang: {new Date(now.sunrise * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr<br />
            🌄 Sonnenuntergang: {new Date(now.sunset * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">🧪 {now.pressure} hPa • 💦 {now.humidity} %</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">💨 {now.wind_speed} m/s • 🧭 {windDirection(now.wind_deg)} ({now.wind_speed.toFixed(1)} m/s)</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">🔆 UV-Index: {now.uvi}</p>
          {moonText && <p className="text-sm text-gray-600 dark:text-gray-300">🌙 Mondphase: {moonText}</p>}
        </div>
      </div>

      <h3 className="text-md font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">🕒 Stündliche Vorhersage (24h)</h3>
      <div className="flex overflow-x-auto space-x-4 pb-2">
        {hourly.slice(0, 24).map((h, index) => (
          <div
            key={index}
            className="min-w-[160px] bg-blue-50 dark:bg-gray-800 rounded-lg p-3 text-center flex-shrink-0 shadow-sm"
          >
            <p className="text-base font-bold mb-1">{hour(h.dt)}</p>
            <img
              src={`https://openweathermap.org/img/wn/${h.weather?.[0]?.icon}@2x.png`}
              alt={h.weather?.[0]?.description}
              className="mx-auto w-16 h-16"
            />
            <p className="text-sm text-gray-700 dark:text-gray-300">{h.weather?.[0]?.description}</p>
            <p className="text-lg font-semibold">{h.temp.toFixed(0)} °C</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              🌧 {Math.round(h.pop * 100)} %
              {h.pop > 0 && h.rain?.["1h"] && <> • 💧 {h.rain["1h"].toFixed(1)} mm</>}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {h.pressure} hPa • 💦 {h.humidity} %</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧭 {windDirection(h.wind_deg)} ({h.wind_speed.toFixed(1)} m/s)</p>
          </div>
        ))}
      </div>

      <h3 className="text-md font-semibold mt-6 mb-2 text-gray-700 dark:text-gray-200">🗓 7-Tage-Vorhersage</h3>
      <div className="flex overflow-x-auto space-x-4 pb-2">
        {daily.slice(0, 7).map((day, index) => (
          <div
            key={index}
            className="min-w-[200px] bg-blue-50 dark:bg-gray-800 rounded-lg p-4 text-center flex-shrink-0 shadow-sm"
          >
            <p className="text-base font-bold mb-1">{weekday(day.dt)}</p>
            <img
              src={`https://openweathermap.org/img/wn/${day.weather?.[0]?.icon}@2x.png`}
              alt={day.weather?.[0]?.description}
              className="mx-auto w-16 h-16"
            />
            <p className="text-sm text-gray-700 dark:text-gray-300">{day.weather?.[0]?.description}</p>
            <p className="text-lg font-semibold">{day.temp.day.toFixed(0)} °C</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              🌧 {Math.round(day.pop * 100)} %
              {day.pop > 0 && day.rain && <> • 💧 {day.rain.toFixed(1)} mm</>}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {day.pressure} hPa • 💦 {day.humidity} %</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧭 {windDirection(day.wind_deg)} ({day.wind_speed.toFixed(1)} m/s)</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{getMoonDescription(day.moon_phase)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

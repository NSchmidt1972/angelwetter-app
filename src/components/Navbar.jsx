import { useEffect, useState } from 'react';

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

export default function WeatherNow({ data }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!data) return;
    setLoading(true);
    setWeather(data);
    setTimeout(() => setLoading(false), 500); // kurze Verzögerung für Animation
  }, [data]);

  if (!weather) return <p>Lade aktuelles Wetter...</p>;

  const now = weather.current;
  const hourly = weather.hourly || [];
  const daily = weather.daily || [];
  const desc = now.weather[0].description;
  const iconCode = now.weather[0].icon;
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

  const moonPhase = daily[0]?.moon_phase;
  const moonText = moonPhase !== undefined ? getMoonDescription(moonPhase) : null;

  const weekday = (dt) =>
    new Date(dt * 1000).toLocaleDateString('de-DE', { weekday: 'short' });

  const hour = (dt) =>
    new Date(dt * 1000).toLocaleTimeString('de-DE', { hour: '2-digit' });

  return (
    <div className="p-4 bg-white shadow rounded-xl max-w-full mx-auto">
      <h2 className="text-xl font-bold mb-2 text-blue-700">
        {loading ? (
          <span className="animate-fadeInSlide">
            🔄 Aktualisierung<span className="dot-typing ml-1"></span>
          </span>
        ) : (
          '🌤 Aktuelles Wetter'
        )}
      </h2>

      <div className="flex items-center gap-3 mb-2">
        <img src={iconUrl} alt={desc} className="w-12 h-12" />
        <div>
          <p className="text-lg font-semibold">{now.temp} °C – {desc}</p>
          <p className="text-sm text-gray-600">💧 {now.humidity}% • 💨 {now.wind_speed} m/s • 🧪 {now.pressure} hPa</p>
          <p className="text-sm text-gray-600">🔆 UV-Index: {now.uvi}</p>
          {moonText && <p className="text-sm text-gray-600">🌙 Mondphase: {moonText}</p>}
        </div>
      </div>

      <h3 className="text-md font-semibold mt-4 mb-2 text-gray-700">🕒 Stündliche Vorhersage (24h)</h3>
      <div className="flex overflow-x-auto space-x-4 pb-2">
        {hourly.slice(0, 24).map((h, index) => (
          <div
            key={index}
            className="min-w-[160px] bg-blue-50 rounded-lg p-3 text-center flex-shrink-0 shadow-sm"
          >
            <p className="text-base font-bold mb-1">{hour(h.dt)}</p>
            <img
              src={`https://openweathermap.org/img/wn/${h.weather?.[0]?.icon}@2x.png`}
              alt={h.weather?.[0]?.description}
              className="mx-auto w-10 h-10"
            />
            <p className="text-lg font-semibold">{h.temp.toFixed(0)} °C</p>
            <p className="text-sm text-gray-700">{h.weather?.[0]?.description}</p>
            <p className="text-sm text-gray-600 mt-1">💧 {h.humidity}%</p>
            <p className="text-sm text-gray-600">🧪 {h.pressure} hPa</p>
            <p className="text-sm text-gray-600">🧭 {windDirection(h.wind_deg)} ({h.wind_speed.toFixed(1)} m/s)</p>
          </div>
        ))}
      </div>

      <h3 className="text-md font-semibold mt-6 mb-2 text-gray-700">🗓 Detaillierte 7-Tage-Vorhersage</h3>
      <div className="flex overflow-x-auto space-x-4 pb-2">
        {daily.slice(0, 7).map((day, index) => (
          <div
            key={index}
            className="min-w-[200px] bg-blue-50 rounded-lg p-4 text-center flex-shrink-0 shadow-sm"
          >
            <p className="text-base font-bold mb-1">{weekday(day.dt)}</p>
            <img
              src={`https://openweathermap.org/img/wn/${day.weather?.[0]?.icon}@2x.png`}
              alt={day.weather?.[0]?.description}
              className="mx-auto w-12 h-12"
            />
            <p className="text-lg font-semibold">{day.temp.day.toFixed(0)} °C</p>
            <p className="text-sm text-gray-700">{day.weather?.[0]?.description}</p>
            <p className="text-sm text-gray-600 mt-1">🌧 {day.pop * 100}%</p>
            {day.rain && <p className="text-sm text-gray-600">💧 {day.rain} mm</p>}
            <p className="text-sm text-gray-600">🧪 {day.pressure} hPa</p>
            <p className="text-sm text-gray-600">🧭 {windDirection(day.wind_deg)} ({day.wind_speed.toFixed(1)} m/s)</p>
            <p className="text-sm text-gray-600">{getMoonDescription(day.moon_phase)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

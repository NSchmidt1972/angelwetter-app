// src/components/weather/CurrentPanel.jsx
import { owmIconUrl, degToDir, moonPhaseText } from '@/utils/weatherFormat';

export default function CurrentPanel({ now, daily, savedAt }) {
  const savedAtString = savedAt
    ? new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';
  const desc = now.weather[0].description;
  const iconUrl = owmIconUrl(now.weather[0].icon);
  const moonText = moonPhaseText(daily?.[0]?.moon_phase ?? -1);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          <span className="text-blue-700 dark:text-blue-300">🌤 Aktuelles Wetter</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{savedAtString} Uhr</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
        <img src={iconUrl} alt={desc} className="w-24 h-24 mx-auto sm:mx-0" loading="lazy" decoding="async" />
        <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <p className="text-lg font-semibold">{now.temp.toFixed(0)} °C – {desc}</p>
          <p>🌅 Sonnenaufgang: {new Date(now.sunrise * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🌄 Sonnenuntergang: {new Date(now.sunset * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🧪 Luftdruck: {now.pressure} hPa • 💦 Luftfeuchte: {now.humidity}%</p>
          <p>💨 Wind: {now.wind_speed} m/s aus {degToDir(now.wind_deg)}</p>
          <p>🔆 UV-Index: {now.uvi}</p>
          <p>🌙 Mondphase: {moonText}</p>
        </div>
      </div>
    </>
  );
}

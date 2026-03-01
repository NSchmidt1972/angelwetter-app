// src/components/weather/CurrentPanel.jsx
import { owmIconUrl, degToDir, moonPhaseText } from '@/utils/weatherFormat';

export default function CurrentPanel({
  now,
  daily,
  savedAt,
  waterTemperature,
  waterTemperatureLoading = false,
  showWaterTemperature = false,
}) {
  const savedAtString = savedAt
    ? new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';
  const desc = now.weather[0].description;
  const iconUrl = owmIconUrl(now.weather[0].icon);
  const moonText = moonPhaseText(daily?.[0]?.moon_phase ?? -1);
  const waterTempValueRaw = waterTemperature?.temperature_c
    ?? now?.water_temp
    ?? now?.waterTemp
    ?? now?.water_temperature;
  const waterTempValue = Number(waterTempValueRaw);
  const hasWaterTemp = Number.isFinite(waterTempValue);
  const measuredAtRaw = waterTemperature?.measured_at
    ?? now?.water_temp_measured_at
    ?? now?.waterTempMeasuredAt
    ?? null;
  const measuredAtDate = measuredAtRaw ? new Date(measuredAtRaw) : null;
  const measuredAtString = measuredAtDate && !Number.isNaN(measuredAtDate.getTime())
    ? measuredAtDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';
  const waterTempLabel = hasWaterTemp
    ? `${waterTempValue.toFixed(1)} °C`
    : waterTemperatureLoading
      ? 'lädt...'
      : '—';

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
          {showWaterTemperature && (
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-900 dark:border-cyan-800/70 dark:bg-cyan-950/40 dark:text-cyan-100">
              <span>🌊 Wassertemperatur: {waterTempLabel}</span>
              {measuredAtString && (
                <span className="text-xs text-cyan-700 dark:text-cyan-300">({measuredAtString} Uhr)</span>
              )}
            </p>
          )}
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

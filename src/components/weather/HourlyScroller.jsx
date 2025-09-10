// src/components/weather/HourlyScroller.jsx
import { owmIconUrl, degToDir, hour2 } from '@/utils/weatherFormat';
import FishRating from '@/components/common/FishRating';

export default function HourlyScroller({ hours, hourPreds, onScroll, scrollRef }) {
  return (
    <>
      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">🕒 Stündliche Vorhersage</h3>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto gap-4 pb-4"
      >
        {hours.map((h, idx) => {
          const pred = hourPreds[idx];
          const iconUrl = owmIconUrl(h.weather?.[0]?.icon);
          return (
            <div key={idx} className="min-w-[160px] bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center flex-shrink-0 hover:shadow-md transition">
              <p className="font-bold">{hour2(h.dt)}</p>
              <img
                src={iconUrl}
                alt={h.weather?.[0]?.description}
                className="mx-auto w-12 h-12"
                loading="lazy"
                decoding="async"
              />
              <p className="text-sm">{h.weather?.[0]?.description}</p>
              <p className="text-lg font-semibold">{h.temp?.toFixed ? h.temp.toFixed(0) : Math.round(h.temp)} °C</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🌧 {Math.round((h.pop || 0) * 100)} %
                {h.pop > 0 && h.rain?.['1h'] && <> • 💧 {h.rain['1h'].toFixed(1)} mm</>}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {h.pressure} hPa • 💦 {h.humidity}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🧭 {degToDir(h.wind_deg)} ({h.wind_speed?.toFixed ? h.wind_speed.toFixed(1) : Math.round(h.wind_speed * 10) / 10} m/s)
              </p>
              {pred?.probability != null && (
                <p className="text-sm text-green-700 dark:text-green-300 font-semibold mt-1">
                  🎯 {Number(pred.probability).toFixed(0)} % <FishRating probability={pred.probability} />
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

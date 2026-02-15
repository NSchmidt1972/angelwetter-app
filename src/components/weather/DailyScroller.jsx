// src/components/weather/DailyScroller.jsx
import { owmIconUrl, degToDir, weekdayShort, moonPhaseText } from '@/utils/weatherFormat';
import FishRating from '@/components/common/FishRating';

export default function DailyScroller({ days, onScroll, scrollRef }) {
  return (
    <>
      <h3 className="text-lg font-semibold mt-2 mb-2 text-gray-700 dark:text-gray-200">🗓 7-Tage-Vorhersage</h3>
      <div ref={scrollRef} onScroll={onScroll} className="flex overflow-x-auto gap-4 pb-4">
        {days.map((day, index) => {
          const iconUrl = owmIconUrl(day.weather?.[0]?.icon);
          return (
            <div key={index} className="min-w-[200px] bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center flex-shrink-0 hover:shadow-md transition">
              <p className="font-bold">{weekdayShort(day.dt)}</p>
              <img
                src={iconUrl}
                alt={day.weather?.[0]?.description}
                className="mx-auto w-12 h-12"
                loading="lazy"
                decoding="async"
              />
              <p className="text-sm">{day.weather?.[0]?.description}</p>
              <p className="text-lg font-semibold">
                {day.temp?.day?.toFixed ? day.temp.day.toFixed(0) : Math.round(day.temp.day)} °C
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🌧 {Math.round((day.pop || 0) * 100)} %
                {day.pop > 0 && day.rain && <> • 💧 {Number(day.rain).toFixed(1)} mm</>}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {day.pressure} hPa • 💦 {day.humidity}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🧭 {degToDir(day.wind_deg)} ({day.wind_speed?.toFixed ? day.wind_speed.toFixed(1) : Math.round(day.wind_speed * 10) / 10} m/s)
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{moonPhaseText(day.moon_phase)}</p>
              {day.aiPrediction?.probability != null && (
                <p className="text-sm text-green-700 dark:text-green-300 font-semibold mt-2">
                  🎯 {Number(day.aiPrediction.probability).toFixed(0)} % <FishRating probability={day.aiPrediction.probability} />
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

import { Card } from '@/components/ui';
import { formatDateFromUnix, renderFishRating } from '@/utils/formatters';
import { FishChipsLoader } from '@/features/forecast/components/ForecastLoadingPanels';

export default function DailyOutlookCard({ dailyPredictions, expanded, onToggle, loading }) {
  if (!dailyPredictions?.length) return null;

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6">
      <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">🗓️ 7-Tage-Ausblick</h3>

      <div className="space-y-3">
        {dailyPredictions.map((dayPrediction, index) => {
          const icon = dayPrediction.weather?.[0]?.icon;
          const desc = dayPrediction.weather?.[0]?.description ?? 'Wetter';
          const tempDay = dayPrediction?.temp?.day != null ? Math.round(dayPrediction.temp.day) : null;
          const fishMap = dayPrediction.aiPrediction?.per_fish_type || {};
          const sortedFish = Object.entries(fishMap).sort(([, a], [, b]) => b - a);

          const top = sortedFish.slice(0, 3);
          const rest = sortedFish.slice(3);
          const moreCount = rest.length;
          const isOpen = !!expanded[index];

          return (
            <div key={index} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
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
                      {formatDateFromUnix(dayPrediction.dt)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 capitalize">{desc}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {tempDay != null ? `${tempDay}°C` : '–'}
                  </div>
                </div>
              </div>

              <div className="mt-2">
                {sortedFish.length > 0 ? (
                  <>
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

                      {moreCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onToggle(index)}
                          aria-expanded={isOpen}
                          className="px-2 py-1 rounded-md bg-white/50 dark:bg-black/10 border border-dashed border-gray-300/60 dark:border-white/20 text-sm hover:bg-white/70 dark:hover:bg-black/20 transition"
                        >
                          {isOpen ? '– ausblenden' : `+${moreCount} weitere`}
                        </button>
                      )}
                    </div>

                    {moreCount > 0 && (
                      <div
                        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${isOpen ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
                        id={`more-fishes-${index}`}
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
                ) : loading ? (
                  <FishChipsLoader />
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
    </Card>
  );
}

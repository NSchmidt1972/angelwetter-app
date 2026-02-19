import { Card } from '@/components/ui';
import { formatPercent, getPressureTrendLabel, renderFishRating } from '@/utils/formatters';
import VolatilityBadge from '@/features/forecast/components/VolatilityBadge';
import { LoadingPanel } from '@/features/forecast/components/ForecastLoadingPanels';
import { formatMetric, formatSignedMetric } from '@/features/forecast/utils';

export default function ForecastAiCard({ aiPrediction, modelTrainingRows, loading, errorMessage, onRetry }) {
  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 mb-6">
      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
        <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">🤖 KI-Prognose</h3>

        {aiPrediction ? (
          <>
            <p className="text-xl text-blue-700 dark:text-blue-300 font-bold">
              🎯 Fangwahrscheinlichkeit: {formatPercent(aiPrediction.probability, 0)}{' '}
              {renderFishRating(aiPrediction.probability)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {aiPrediction.prediction === 1
                ? 'Fang wahrscheinlich'
                : 'Schneidersession wahrscheinlich'}
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
                  <div className="ml-2">
                    {getPressureTrendLabel(aiPrediction?.trend?.pressure_trend_5d)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                  <div className="font-medium">Luftdruck-Änderung (24h):</div>
                  <div className="ml-2">
                    {formatSignedMetric(aiPrediction?.trend?.pressure_delta_24h, 'hPa')}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                  <div className="font-medium">Luftdruck-Schwankung (48h):</div>
                  <div className="ml-2">
                    {formatMetric(aiPrediction?.trend?.pressure_volatility_48h, 'hPa')}
                  </div>
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
                        <VolatilityBadge value={aiPrediction.trend.temp_volatility_3d} />
                      </>
                    ) : (
                      'n/a'
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                  <div className="font-medium">Temp-Änderung (24h):</div>
                  <div className="ml-2">
                    {formatSignedMetric(aiPrediction?.trend?.temp_delta_24h, '°C')}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : loading ? (
          <LoadingPanel label="KI-Prognose wird berechnet..." />
        ) : (
          <div className="space-y-3">
            <p className="text-sm italic text-gray-500 dark:text-gray-300">
              {errorMessage || 'KI-Prognose aktuell nicht verfügbar.'}
            </p>
            {typeof onRetry === 'function' && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
              >
                Erneut versuchen
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

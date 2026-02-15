import { useState } from 'react';
import { useForecast } from '@/features/forecast/hooks/useForecast';
import PageContainer from '../components/PageContainer';
import DailyOutlookCard from '@/features/forecast/components/DailyOutlookCard';
import ForecastAiCard from '@/features/forecast/components/ForecastAiCard';
import { InitialForecastLoader } from '@/features/forecast/components/ForecastLoadingPanels';
import { getModelTrainingRows } from '@/features/forecast/utils';

export default function Forecast() {
  const { weatherData, aiPrediction, dailyPredictions, loading } = useForecast();
  const modelTrainingRows = getModelTrainingRows(aiPrediction);
  const [expanded, setExpanded] = useState({});

  const toggle = (idx) => setExpanded((state) => ({ ...state, [idx]: !state[idx] }));

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🔮 Fangprognose</h2>

      <p className="text-center text-gray-600 dark:text-gray-300 mb-4 max-w-xl mx-auto">
        Diese KI-Berechnung basiert auf aktuellem Wetter und historischen Fängen unter ähnlichen Bedingungen.
      </p>
      <p className="text-xs italic text-center text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
        Bitte auch Schneidersessions eintragen – sonst überschätzt die KI die Fangchancen.
      </p>

      <div className="max-w-2xl mx-auto">
        {weatherData ? (
          <ForecastAiCard
            aiPrediction={aiPrediction}
            modelTrainingRows={modelTrainingRows}
            loading={loading}
          />
        ) : loading ? (
          <InitialForecastLoader />
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">
            Wetterdaten konnten nicht geladen werden.
          </p>
        )}

        <DailyOutlookCard
          dailyPredictions={dailyPredictions}
          expanded={expanded}
          onToggle={toggle}
          loading={loading}
        />
      </div>
    </PageContainer>
  );
}

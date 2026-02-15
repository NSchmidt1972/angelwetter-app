import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLatestForecastWeather,
  predictForecastBatch,
  predictForecastForWeather,
} from '@/features/forecast/services/forecastApi';
import { withModelTimestamps } from '@/features/forecast/services/predictionModelInfo';

function isAbortError(error) {
  return error?.name === 'AbortError' || /aborted|abort/i.test(error?.message ?? '');
}

export function useForecast() {
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [dailyPredictions, setDailyPredictions] = useState([]);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const toModelInput = useCallback((source) => {
    const dt = source?.dt != null ? Number(source.dt) : null;
    const timestamp = Number.isFinite(dt)
      ? new Date((dt < 1_000_000_000_000 ? dt * 1000 : dt)).toISOString()
      : null;

    return {
      temp: source?.temp?.day ?? source?.temp,
      pressure: source?.pressure,
      wind: source?.wind_speed,
      humidity: source?.humidity,
      wind_deg: source?.wind_deg,
      moon_phase: source?.moon_phase ?? null,
      dt: Number.isFinite(dt) ? dt : null,
      timestamp,
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const { current, daily } = await getLatestForecastWeather();
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;

      const currentModelIn = toModelInput({ ...current, moon_phase: daily?.[0]?.moon_phase ?? null });
      setWeatherData(currentModelIn);
      setAiPrediction(null);

      const safeDaily = Array.isArray(daily) ? daily : [];
      setDailyPredictions(safeDaily.map((day) => ({ ...day, aiPrediction: null })));

      const dayInputs = safeDaily.map((day) => toModelInput(day));
      const dayInputsWithoutNow = dayInputs.slice(1);

      const nowTask = predictForecastForWeather(currentModelIn, { signal: controller.signal })
        .then((nowPredictionRaw) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          const nowPrediction = withModelTimestamps(nowPredictionRaw, null);
          setAiPrediction(nowPrediction);
          setDailyPredictions((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            next[0] = { ...next[0], aiPrediction: nowPrediction };
            return next;
          });
        })
        .catch((error) => {
          if (!isAbortError(error)) {
            console.warn('⚠️ KI-Prognose für jetzt fehlgeschlagen:', error);
          }
          if (requestId === requestIdRef.current) setAiPrediction(null);
        });

      const batchTask =
        dayInputsWithoutNow.length > 0
          ? predictForecastBatch(dayInputsWithoutNow, { signal: controller.signal })
              .then((remainingDailyResults) => {
                if (controller.signal.aborted || requestId !== requestIdRef.current) return;
                setDailyPredictions((prev) =>
                  prev.map((day, index) => {
                    if (index === 0) return day;
                    const predictionRaw = remainingDailyResults[index - 1] ?? null;
                    return {
                      ...day,
                      aiPrediction: withModelTimestamps(predictionRaw, null),
                    };
                  })
                );
              })
              .catch((error) => {
                if (!isAbortError(error)) {
                  console.warn('⚠️ KI-Prognosen für 7-Tage-Ausblick fehlgeschlagen:', error);
                }
              })
          : Promise.resolve();

      await Promise.all([nowTask, batchTask]);
    } catch (error) {
      if (!isAbortError(error)) {
        console.warn('⚠️ Forecast laden/predict fehlgeschlagen:', error);
      }
      setAiPrediction(null);
      setDailyPredictions([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [toModelInput]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { loading, weatherData, aiPrediction, dailyPredictions, reload: load };
}

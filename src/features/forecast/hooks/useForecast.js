import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLatestForecastWeather,
  predictForecastBatch,
  predictForecastForWeather,
} from '@/features/forecast/services/forecastApi';
import { isAiUnavailableError } from '@/services/aiService';
import { withModelTimestamps } from '@/features/forecast/services/predictionModelInfo';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';

function isAbortError(error) {
  return error?.name === 'AbortError' || /aborted|abort/i.test(error?.message ?? '');
}

const DEFAULT_RETRY_DELAY_MS = 450;
const DEFAULT_RETRY_ATTEMPTS = 1;

function readEnvInt(key, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = import.meta.env?.[key];
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const RETRY_ATTEMPTS = readEnvInt('VITE_FORECAST_RETRY_ATTEMPTS', DEFAULT_RETRY_ATTEMPTS, {
  min: 0,
  max: 3,
});
const RETRY_DELAY_MS = readEnvInt('VITE_FORECAST_RETRY_DELAY_MS', DEFAULT_RETRY_DELAY_MS, {
  min: 0,
  max: 5000,
});

function getErrorStatus(error) {
  const direct = Number(error?.status ?? error?.response?.status);
  if (Number.isFinite(direct)) return direct;

  const message = String(error?.message ?? '');
  const match = message.match(/\b(\d{3})\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toForecastErrorMessage(_error, scope = 'ai') {
  if (scope === 'weather') return 'Wetterdaten konnten nicht geladen werden.';
  return 'KI-Prognose aktuell nicht verfügbar.';
}

function isRetriableError(error) {
  if (isAbortError(error)) return false;
  if (isAiUnavailableError(error)) return false;

  const status = getErrorStatus(error);
  if (status === 408 || status === 429 || status >= 500) return true;

  if (error instanceof TypeError) return true;

  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('load failed')
  );
}

function createAbortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let done = false;
    const finalizeResolve = () => {
      if (done) return;
      done = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const finalizeReject = (error) => {
      if (done) return;
      done = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(error);
    };
    const id = window.setTimeout(finalizeResolve, ms);
    if (!signal) return;

    const onAbort = () => {
      window.clearTimeout(id);
      finalizeReject(createAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function withRetry(task, { attempts = RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS, signal, label } = {}) {
  let attempt = 0;
  while (attempt <= attempts) {
    if (signal?.aborted) throw createAbortError();
    try {
      return await task();
    } catch (error) {
      const canRetry = attempt < attempts && isRetriableError(error) && !signal?.aborted;
      if (!canRetry) throw error;
      console.warn(`⚠️ ${label || 'Request'} fehlgeschlagen, neuer Versuch...`, error);
      await waitForRetry(delayMs, signal);
      attempt += 1;
    }
  }
  throw new Error('Retry loop failed');
}

export function useForecast() {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [dailyPredictions, setDailyPredictions] = useState([]);
  const [forecastError, setForecastError] = useState(null);
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
    setForecastError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const { current, daily } = await withRetry(
        () => getLatestForecastWeather(),
        { signal: controller.signal, label: 'Wetter laden' },
      );
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;

      const currentModelIn = toModelInput({ ...current, moon_phase: daily?.[0]?.moon_phase ?? null });
      setWeatherData(currentModelIn);
      setAiPrediction(null);

      const safeDaily = Array.isArray(daily) ? daily : [];
      setDailyPredictions(safeDaily.map((day) => ({ ...day, aiPrediction: null })));

      const dayInputs = safeDaily.map((day) => toModelInput(day));
      const dayInputsWithoutNow = dayInputs.slice(1);

      const nowTask = withRetry(
        () => predictForecastForWeather(currentModelIn, { signal: controller.signal }),
        { signal: controller.signal, label: 'KI-Prognose (jetzt)' },
      )
        .then((nowPredictionRaw) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          const nowPrediction = withModelTimestamps(nowPredictionRaw, null);
          setForecastError(null);
          setAiPrediction(nowPrediction);
          setDailyPredictions((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            next[0] = { ...next[0], aiPrediction: nowPrediction };
            return next;
          });
        })
        .catch((error) => {
          if (!isAbortError(error) && !isAiUnavailableError(error)) {
            console.warn('⚠️ KI-Prognose für jetzt fehlgeschlagen:', error);
          }
          if (requestId === requestIdRef.current) {
            setAiPrediction(null);
            setForecastError({
              scope: 'ai',
              message: toForecastErrorMessage(error, 'ai'),
              status: getErrorStatus(error),
            });
          }
        });

      const batchTask =
        dayInputsWithoutNow.length > 0
          ? withRetry(
              async () => {
                const results = await predictForecastBatch(dayInputsWithoutNow, { signal: controller.signal });
                const hasAtLeastOnePrediction = Array.isArray(results)
                  && results.some((item) => item != null);
                if (!hasAtLeastOnePrediction) {
                  throw new Error('Batch prediction returned no entries.');
                }
                return results;
              },
              { signal: controller.signal, label: 'KI-Prognosen (7 Tage)' },
            )
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
                if (!isAbortError(error) && !isAiUnavailableError(error)) {
                  console.warn('⚠️ KI-Prognosen für 7-Tage-Ausblick fehlgeschlagen:', error);
                }
              })
          : Promise.resolve();

      await Promise.all([nowTask, batchTask]);
    } catch (error) {
      if (!isAbortError(error)) {
        console.warn('⚠️ Forecast laden/predict fehlgeschlagen:', error);
      }
      // Prevent stale/aborted requests from wiping state of a newer request.
      if (requestId === requestIdRef.current) {
        setWeatherData(null);
        setAiPrediction(null);
        setDailyPredictions([]);
        setForecastError({
          scope: 'weather',
          message: toForecastErrorMessage(error, 'weather'),
          status: getErrorStatus(error),
        });
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [toModelInput]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load, resumeTick]);

  return { loading, weatherData, aiPrediction, dailyPredictions, forecastError, reload: load };
}

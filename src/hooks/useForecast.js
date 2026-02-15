// src/hooks/useForecast.js
import { useCallback, useEffect, useRef, useState } from "react";
import { getLatestWeather } from "../services/weatherService";
import { predictForWeather, predictBatch } from "../services/aiService";

function hasValue(value) {
  return value != null && value !== "";
}

function withModelTimestamps(prediction, modelInfo) {
  if (!prediction) return prediction;
  const safeModelInfo = modelInfo && typeof modelInfo === "object" ? modelInfo : {};

  const mainTrainedAt =
    prediction?.trained_at ||
    prediction?.model_trained_at ||
    prediction?.last_trained_at ||
    prediction?.models?.main?.trained_at ||
    prediction?.models?.main?.model_trained_at ||
    prediction?.models?.main?.last_trained_at ||
    prediction?.stats?.trained_at ||
    prediction?.metadata?.trained_at ||
    safeModelInfo?.trained_at ||
    safeModelInfo?.models?.main?.trained_at;

  const perFishTrainedAt =
    prediction?.models?.per_fish_type?.trained_at ||
    prediction?.models?.species?.trained_at ||
    prediction?.stats?.per_fish_model_trained_at ||
    prediction?.metadata?.per_fish_model_trained_at ||
    safeModelInfo?.per_fish_model_trained_at ||
    safeModelInfo?.models?.per_fish_type?.trained_at;

  const speciesMap =
    prediction?.models?.per_fish_type?.models ||
    prediction?.models?.species ||
    prediction?.fish_model_trained_at ||
    safeModelInfo?.fish_model_trained_at ||
    safeModelInfo?.models?.species ||
    {};

  return {
    ...prediction,
    trained_at: hasValue(prediction?.trained_at) ? prediction.trained_at : mainTrainedAt,
    model_trained_at: hasValue(prediction?.model_trained_at)
      ? prediction.model_trained_at
      : mainTrainedAt,
    last_trained_at: hasValue(prediction?.last_trained_at)
      ? prediction.last_trained_at
      : mainTrainedAt,
    models: {
      ...(prediction?.models || {}),
      main: {
        ...(prediction?.models?.main || {}),
        trained_at: hasValue(prediction?.models?.main?.trained_at)
          ? prediction.models.main.trained_at
          : mainTrainedAt,
      },
      per_fish_type: {
        ...(prediction?.models?.per_fish_type || {}),
        trained_at: hasValue(prediction?.models?.per_fish_type?.trained_at)
          ? prediction.models.per_fish_type.trained_at
          : perFishTrainedAt,
        models: hasValue(prediction?.models?.per_fish_type?.models)
          ? prediction.models.per_fish_type.models
          : speciesMap,
      },
    },
    metadata: {
      ...(prediction?.metadata || {}),
      trained_at: hasValue(prediction?.metadata?.trained_at)
        ? prediction.metadata.trained_at
        : mainTrainedAt,
      per_fish_model_trained_at: hasValue(prediction?.metadata?.per_fish_model_trained_at)
        ? prediction.metadata.per_fish_model_trained_at
        : perFishTrainedAt,
    },
    stats: prediction?.stats
      ? {
          ...prediction.stats,
          trained_at: hasValue(prediction?.stats?.trained_at)
            ? prediction.stats.trained_at
            : mainTrainedAt,
          per_fish_model_trained_at: hasValue(prediction?.stats?.per_fish_model_trained_at)
            ? prediction.stats.per_fish_model_trained_at
            : perFishTrainedAt,
        }
      : prediction?.stats,
  };
}

function isAbortError(error) {
  return error?.name === "AbortError" || /aborted|abort/i.test(error?.message ?? "");
}

export function useForecast() {
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);     // kompaktes current-Set
  const [aiPrediction, setAiPrediction] = useState(null);   // KI für jetzt
  const [dailyPredictions, setDailyPredictions] = useState([]); // 7-Tage inkl. KI
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const toModelInput = useCallback((src) => {
    const dt = src?.dt != null ? Number(src.dt) : null;
    const timestamp =
      Number.isFinite(dt)
        ? new Date((dt < 1_000_000_000_000 ? dt * 1000 : dt)).toISOString()
        : null;

    return {
      temp: src?.temp?.day ?? src?.temp,          // daily.temp.day oder current.temp
      pressure: src?.pressure,
      wind: src?.wind_speed,
      humidity: src?.humidity,
      wind_deg: src?.wind_deg,
      moon_phase: src?.moon_phase ?? null,
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
      const { current, daily } = await getLatestWeather();
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;

      const currentModelIn = toModelInput({ ...current, moon_phase: daily?.[0]?.moon_phase ?? null });
      setWeatherData(currentModelIn);
      setAiPrediction(null);

      const safeDaily = Array.isArray(daily) ? daily : [];
      setDailyPredictions(safeDaily.map((d) => ({ ...d, aiPrediction: null })));

      // "Jetzt"-Prognose und Tagesprognosen parallel laden.
      // Wetterkarten sind bereits sichtbar; KI-Daten werden sukzessive eingepflegt.
      const dayInputs = safeDaily.map((d) => toModelInput(d));
      const dayInputsWithoutNow = dayInputs.slice(1);

      const nowTask = predictForWeather(currentModelIn, { signal: controller.signal })
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
        .catch((e) => {
          if (!isAbortError(e)) {
            console.warn("⚠️ KI-Prognose für jetzt fehlgeschlagen:", e);
          }
          if (requestId === requestIdRef.current) setAiPrediction(null);
        });

      const batchTask =
        dayInputsWithoutNow.length > 0
          ? predictBatch(dayInputsWithoutNow, { signal: controller.signal })
              .then((remainingDailyResults) => {
                if (controller.signal.aborted || requestId !== requestIdRef.current) return;
                setDailyPredictions((prev) =>
                  prev.map((day, i) => {
                    if (i === 0) return day;
                    const predictionRaw = remainingDailyResults[i - 1] ?? null;
                    return {
                      ...day,
                      aiPrediction: withModelTimestamps(predictionRaw, null),
                    };
                  })
                );
              })
              .catch((e) => {
                if (!isAbortError(e)) {
                  console.warn("⚠️ KI-Prognosen für 7-Tage-Ausblick fehlgeschlagen:", e);
                }
              })
          : Promise.resolve();

      await Promise.all([nowTask, batchTask]);
    } catch (e) {
      if (!isAbortError(e)) {
        console.warn("⚠️ Forecast laden/predict fehlgeschlagen:", e);
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

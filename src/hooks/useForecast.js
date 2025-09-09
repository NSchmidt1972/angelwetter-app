// src/hooks/useForecast.js
import { useCallback, useEffect, useRef, useState } from "react";
import { getLatestWeather } from "../services/weatherService";
import { predictForWeather, predictBatch } from "../services/aiService";

export function useForecast() {
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);     // kompaktes current-Set
  const [aiPrediction, setAiPrediction] = useState(null);   // KI für jetzt
  const [dailyPredictions, setDailyPredictions] = useState([]); // 7-Tage inkl. KI
  const abortRef = useRef(null);

  const toModelInput = useCallback((src) => ({
    temp: src?.temp?.day ?? src?.temp,          // daily.temp.day oder current.temp
    pressure: src?.pressure,
    wind: src?.wind_speed,
    humidity: src?.humidity,
    wind_deg: src?.wind_deg,
    moon_phase: src?.moon_phase ?? null,
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const { current, daily } = await getLatestWeather();

      const currentModelIn = toModelInput({ ...current, moon_phase: daily?.[0]?.moon_phase ?? null });
      setWeatherData(currentModelIn);

      // 1) Sofort-Prognose (aktuell)
      const nowPrediction = await predictForWeather(currentModelIn, { signal: abortRef.current.signal });
      setAiPrediction(nowPrediction);

      // 2) 7-Tage-Prognosen
      const dayInputs = daily.map(d => toModelInput(d));
      const results = await predictBatch(dayInputs, { signal: abortRef.current.signal });

      const merged = daily.map((d, i) => ({
        ...d,
        aiPrediction: results[i] ?? null,
      }));
      setDailyPredictions(merged);
    } catch (e) {
      console.warn("⚠️ Forecast laden/predict fehlgeschlagen:", e);
      setAiPrediction(null);
      setDailyPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [toModelInput]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { loading, weatherData, aiPrediction, dailyPredictions, reload: load };
}

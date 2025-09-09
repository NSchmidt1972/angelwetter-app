// src/hooks/useWeatherNow.js
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWeather } from "../api/weather"; // deine Funktion

function normalizeOneCall(data) {
  const c = data?.current ?? {};
  const w = Array.isArray(c.weather) ? c.weather[0] : null;
  return {
    temp: c.temp ?? null,
    feelsLike: c.feels_like ?? null,
    humidity: c.humidity ?? null,
    pressure: c.pressure ?? null,
    windSpeed: c.wind_speed ?? null,
    windDeg: c.wind_deg ?? null,
    description: w?.description ?? "",
    icon: w?.icon ?? "01d",
    dt: c.dt ? c.dt * 1000 : Date.now(),
    // One Call liefert keinen Ortsnamen:
    name: "",
  };
}

export function useWeatherNow({ coords, enabled = true, fetcher = fetchWeather }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const canFetch = enabled && (!!coords?.lat && !!coords?.lon);

  useEffect(() => {
    if (!canFetch) return;
    setStatus("loading");
    setError(null);

    Promise.resolve(fetcher(coords))
      .then((raw) => {
        if (!alive.current) return;
        setData(normalizeOneCall(raw));
        setStatus("success");
      })
      .catch((e) => {
        if (!alive.current) return;
        setError(e);
        setStatus("error");
      });
  }, [canFetch, coords, fetcher]);

  return useMemo(
    () => ({
      data,
      status,
      error,
      isLoading: status === "loading",
      isError: status === "error",
      isSuccess: status === "success",
    }),
    [data, status, error]
  );
}

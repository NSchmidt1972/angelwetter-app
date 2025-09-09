// src/components/weather/WeatherNow.jsx
import { useWeatherNow } from "../../hooks/useWeatherNow";
import { fmtC, fmtHpa, fmtPct, fmtWindMs, degToDir, fmtTime, owmIconUrl } from "../../utils/weatherFormat";
import Stat from "./Stat";
import WindArrow from "./WindArrow";

export default function WeatherNow({ coords, title = "Aktuelles Wetter" }) {
  const { data, isLoading, isError, error } = useWeatherNow({ coords });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 animate-pulse">
        <div className="h-5 w-40 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded" />
            <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-300 dark:border-red-800 p-4 bg-red-50/50 dark:bg-red-900/10">
        <div className="font-semibold text-red-700 dark:text-red-300">Wetter konnte nicht geladen werden</div>
        <div className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
          {error?.message ?? "Unbekannter Fehler"}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { temp, feelsLike, humidity, pressure, windSpeed, windDeg, description, icon, dt } = data;

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white/50 dark:bg-zinc-900/40 backdrop-blur">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-zinc-500">Stand: {fmtTime(dt)}</span>
      </header>

      <div className="flex items-center gap-4">
        <img src={owmIconUrl(icon)} alt={description} className="h-16 w-16 drop-shadow-sm" loading="lazy" />
        <div className="flex-1">
          <div className="text-3xl font-bold">{fmtC(temp)}</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">{description || "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Stat label="Gefühlt" value={fmtC(feelsLike)} />
        <Stat label="Luftfeuchte" value={fmtPct(humidity)} />
        <Stat label="Luftdruck" value={fmtHpa(pressure)} />
        <Stat
          label={`Wind (${degToDir(windDeg)})`}
          value={fmtWindMs(windSpeed)}
          icon={<WindArrow deg={windDeg ?? 0} />}
        />
      </div>
    </section>
  );
}

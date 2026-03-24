import { supabase } from "../supabaseClient";
import { getDistanceKm } from "@/utils/geo";
import { getActiveClubId } from "@/utils/clubId";
import { fetchClubCoordinates } from "@/services/clubCoordinatesService";

const DEFAULT_LAT = 51.3135;
const DEFAULT_LON = 6.256;
const MIN_DISTANCE_KM = 1.0;
const WEATHER_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const UX_TEST_MODE_ENABLED = import.meta.env.VITE_UX_TEST_MODE === "1";
const UX_TEST_WEATHER = {
  current: {
    temp: 12.4,
    weather: [{ description: "leicht bewölkt", icon: "03d" }],
    wind_speed: 2.7,
    wind_deg: 135,
    humidity: 78,
    pressure: 1014,
    dt: Math.floor(Date.now() / 1000),
  },
  daily: [{ moon_phase: 0.42 }],
};
function toNumberOrNull(value) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

async function loadClubWeatherCoords(clubId) {
  if (!clubId) return null;
  try {
    return await fetchClubCoordinates(clubId, {
      timeoutLabel: "weatherService Club-Koordinaten timeout",
    });
  } catch (error) {
    console.warn("[weatherService] Club-Wetterkoordinaten konnten nicht geladen werden:", error.message || error);
    return null;
  }
}

function resolveWeatherCoords(userCoords = null, fallbackCoords = null) {
  const fallbackLat = toNumberOrNull(fallbackCoords?.lat) ?? DEFAULT_LAT;
  const fallbackLon = toNumberOrNull(fallbackCoords?.lon) ?? DEFAULT_LON;

  const userLat = toNumberOrNull(userCoords?.lat);
  const userLon = toNumberOrNull(userCoords?.lon);

  if (userLat == null || userLon == null) {
    return { lat: fallbackLat, lon: fallbackLon };
  }

  const distance = getDistanceKm(userLat, userLon, fallbackLat, fallbackLon);
  if (distance <= MIN_DISTANCE_KM) {
    return { lat: fallbackLat, lon: fallbackLon };
  }

  return { lat: userLat, lon: userLon };
}

export async function fetchWeather(userCoords = null, options = {}) {
  if (UX_TEST_MODE_ENABLED) {
    return UX_TEST_WEATHER;
  }

  const activeClubId = options?.clubId ?? getActiveClubId();
  const clubFallbackCoords = await loadClubWeatherCoords(activeClubId);
  const fallbackCoords = options?.fallbackCoords ?? clubFallbackCoords;
  const coords = resolveWeatherCoords(userCoords, fallbackCoords);
  const { data, error } = await supabase.functions.invoke("weatherProxy", {
    body: { lat: coords.lat, lon: coords.lon, clubId: activeClubId || null },
  });

  if (error) {
    throw new Error(error.message || "Wetterdaten konnten nicht geladen werden.");
  }
  if (!data?.current || !Array.isArray(data?.daily)) {
    throw new Error("Weather data incomplete");
  }
  return data;
}

export async function loadWeatherForPosition(position, fallbackCoords = null, onWeatherUpdate) {
  const data = await fetchWeather(position, { fallbackCoords });
  const weather = {
    temp: data.current.temp ?? null,
    description: data.current.weather?.[0]?.description ?? "",
    icon: data.current.weather?.[0]?.icon ?? "",
    wind: data.current.wind_speed ?? null,
    wind_deg: data.current.wind_deg ?? null,
    humidity: data.current.humidity ?? null,
    pressure: data.current.pressure ?? null,
    moon_phase: data.daily?.[0]?.moon_phase ?? null,
  };

  if (onWeatherUpdate) {
    onWeatherUpdate({ data, savedAt: Date.now() });
  }

  return weather;
}

export async function getLatestWeather() {
  const clubId = getActiveClubId();
  const { data: weatherRow, error } = await supabase
    .from("weather_cache")
    .select("data, updated_at")
    .eq("club_id", clubId)
    .eq("id", "latest")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const updatedAtMs = weatherRow?.updated_at ? new Date(weatherRow.updated_at).getTime() : NaN;
  const isFresh = Number.isFinite(updatedAtMs) && (Date.now() - updatedAtMs <= WEATHER_CACHE_MAX_AGE_MS);

  if (error || !weatherRow?.data || !isFresh) {
    const live = await fetchWeather(null);
    const { current, daily } = live || {};
    if (!current || !Array.isArray(daily)) throw error || new Error("No weather data");
    return { current, daily };
  }

  const { current, daily } = weatherRow.data;
  if (!current || !Array.isArray(daily)) {
    const live = await fetchWeather(null);
    if (!live?.current || !Array.isArray(live?.daily)) throw new Error("Weather data incomplete");
    return { current: live.current, daily: live.daily };
  }
  return { current, daily };
}

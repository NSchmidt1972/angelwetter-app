import { supabase } from "../supabaseClient";
import { getDistanceKm } from "@/utils/geo";
import { getActiveClubId } from "@/utils/clubId";

const DEFAULT_LAT = 51.3135;
const DEFAULT_LON = 6.256;
const MIN_DISTANCE_KM = 1.0;
const CLUB_COORDS_CACHE_TTL_MS = 5 * 60 * 1000;
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
const clubCoordsCache = new Map();
const clubCoordsInFlight = new Map();

function toNumberOrNull(value) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function isMissingClubWeatherCoordsError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42703" && (message.includes("clubs.weather_lat") || message.includes("clubs.weather_lon"));
}

function readCachedClubCoords(clubId) {
  const cached = clubCoordsCache.get(clubId);
  if (!cached) return { hit: false, coords: null };
  if (Date.now() - cached.fetchedAt > CLUB_COORDS_CACHE_TTL_MS) {
    clubCoordsCache.delete(clubId);
    return { hit: false, coords: null };
  }
  return { hit: true, coords: cached.coords };
}

function cacheClubCoords(clubId, coords) {
  clubCoordsCache.set(clubId, {
    coords,
    fetchedAt: Date.now(),
  });
}

async function loadClubWeatherCoords(clubId) {
  if (!clubId) return null;
  const cached = readCachedClubCoords(clubId);
  if (cached.hit) return cached.coords;
  if (clubCoordsInFlight.has(clubId)) {
    return clubCoordsInFlight.get(clubId);
  }

  const request = (async () => {
    const { data, error } = await supabase
      .from("clubs")
      .select("weather_lat, weather_lon")
      .eq("id", clubId)
      .maybeSingle();

    if (error) {
      if (!isMissingClubWeatherCoordsError(error)) {
        console.warn("[weatherService] Club-Wetterkoordinaten konnten nicht geladen werden:", error.message || error);
      }
      cacheClubCoords(clubId, null);
      return null;
    }

    const lat = toNumberOrNull(data?.weather_lat);
    const lon = toNumberOrNull(data?.weather_lon);
    const coords = lat != null && lon != null ? { lat, lon } : null;
    cacheClubCoords(clubId, coords);
    return coords;
  })()
    .finally(() => {
      clubCoordsInFlight.delete(clubId);
    });

  clubCoordsInFlight.set(clubId, request);
  return request;
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

  const activeClubId = getActiveClubId();
  const clubFallbackCoords = await loadClubWeatherCoords(activeClubId);
  const fallbackCoords = options?.fallbackCoords ?? clubFallbackCoords;
  const coords = resolveWeatherCoords(userCoords, fallbackCoords);
  const { data, error } = await supabase.functions.invoke("weatherProxy", {
    body: { lat: coords.lat, lon: coords.lon },
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

  if (error || !weatherRow?.data) {
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

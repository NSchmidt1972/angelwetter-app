import { supabase } from "../supabaseClient";
import { getDistanceKm } from "@/utils/geo";
import { getActiveClubId } from "@/utils/clubId";
import { fetchClubCoordinates } from "@/services/clubCoordinatesService";
import { listWaterbodiesByClub } from "@/services/waterbodiesService";

const DEFAULT_LAT = 51.3135;
const DEFAULT_LON = 6.256;
const MIN_DISTANCE_KM = 1.0;
const WEATHER_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const SELECTED_WATERBODY_STORAGE_KEY = "angelwetter_selected_waterbody_id";
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

function readStoredWaterbodyId() {
  if (typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem(SELECTED_WATERBODY_STORAGE_KEY);
    return id ? String(id).trim() : null;
  } catch {
    return null;
  }
}

function resolveWaterbodyFallbackCoords(waterbody) {
  const weatherLat = toNumberOrNull(waterbody?.weather_lat);
  const weatherLon = toNumberOrNull(waterbody?.weather_lon);
  if (weatherLat != null && weatherLon != null) {
    return { lat: weatherLat, lon: weatherLon };
  }

  const lat = toNumberOrNull(waterbody?.lat);
  const lon = toNumberOrNull(waterbody?.lon);
  if (lat != null && lon != null) {
    return { lat, lon };
  }

  return null;
}

async function resolvePreferredWaterbodyContext(clubId, options = {}) {
  if (!clubId) return null;

  const preferredWaterbodyId = options?.waterbodyId || readStoredWaterbodyId();
  if (!preferredWaterbodyId) return null;

  try {
    const waterbodies = Array.isArray(options?.waterbodies)
      ? options.waterbodies
      : await listWaterbodiesByClub(clubId, { activeOnly: false });
    const selected = (waterbodies || []).find((entry) => entry?.id === preferredWaterbodyId);
    if (!selected) return null;
    return {
      waterbodyId: selected.id,
      fallbackCoords: resolveWaterbodyFallbackCoords(selected),
    };
  } catch (error) {
    console.warn("[weatherService] Gewässerkontext konnte nicht geladen werden:", error?.message || error);
    return null;
  }
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
  const waterbodyContext = (options?.fallbackCoords == null || options?.waterbodyId)
    ? await resolvePreferredWaterbodyContext(activeClubId, options)
    : null;
  const clubFallbackCoords = await loadClubWeatherCoords(activeClubId);
  const fallbackCoords = options?.fallbackCoords ?? waterbodyContext?.fallbackCoords ?? clubFallbackCoords;
  const coords = resolveWeatherCoords(userCoords, fallbackCoords);
  const { data, error } = await supabase.functions.invoke("weatherProxy", {
    body: {
      lat: coords.lat,
      lon: coords.lon,
      clubId: activeClubId || null,
      waterbodyId: options?.waterbodyId ?? waterbodyContext?.waterbodyId ?? null,
    },
  });

  if (error) {
    throw new Error(error.message || "Wetterdaten konnten nicht geladen werden.");
  }
  if (!data?.current || !Array.isArray(data?.daily)) {
    throw new Error("Weather data incomplete");
  }
  return data;
}

export async function loadWeatherForPosition(position, fallbackCoords = null, onWeatherUpdate, options = {}) {
  const data = await fetchWeather(position, { fallbackCoords, ...options });
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

export async function getLatestWeather(options = {}) {
  const clubId = options?.clubId ?? getActiveClubId();
  const preferredWaterbody = await resolvePreferredWaterbodyContext(clubId, options);
  const scopedFallbackCoords = options?.fallbackCoords ?? preferredWaterbody?.fallbackCoords ?? null;
  const scopedWaterbodyId = options?.waterbodyId ?? preferredWaterbody?.waterbodyId ?? null;

  if (scopedFallbackCoords && scopedWaterbodyId) {
    const liveScoped = await fetchWeather(null, {
      clubId,
      fallbackCoords: scopedFallbackCoords,
      waterbodyId: scopedWaterbodyId,
    });
    if (!liveScoped?.current || !Array.isArray(liveScoped?.daily)) {
      throw new Error("Weather data incomplete");
    }
    return { current: liveScoped.current, daily: liveScoped.daily };
  }

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
    const live = await fetchWeather(null, { clubId });
    const { current, daily } = live || {};
    if (!current || !Array.isArray(daily)) throw error || new Error("No weather data");
    return { current, daily };
  }

  const { current, daily } = weatherRow.data;
  if (!current || !Array.isArray(daily)) {
    const live = await fetchWeather(null, { clubId });
    if (!live?.current || !Array.isArray(live?.daily)) throw new Error("Weather data incomplete");
    return { current: live.current, daily: live.daily };
  }
  return { current, daily };
}

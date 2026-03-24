import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRIMARY_KEY = (Deno.env.get("OPENWEATHER_PRIMARY_KEY") ?? "").trim();
const SECONDARY_KEY = (Deno.env.get("OPENWEATHER_SECONDARY_KEY") ?? "").trim();
const OPS_ALERT_SECRET = (Deno.env.get("OPS_ALERT_SECRET") ?? "").trim();
const OPS_ALERT_URL = (Deno.env.get("OPS_ALERT_URL") ?? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/opsAlert`).trim();
const WEATHER_CACHE_TTL_SECONDS = Math.max(60, Number.parseInt(Deno.env.get("WEATHER_CACHE_TTL_SECONDS") ?? "900", 10) || 900);
const WEATHER_CACHE_MAX_DISTANCE_KM = Math.max(0, Number.parseFloat(Deno.env.get("WEATHER_CACHE_MAX_DISTANCE_KM") ?? "2.0") || 2.0);
const WEATHER_CACHE_ID = "latest";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,x-client-info,content-type,accept,accept-language",
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cors(),
    },
  });
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function parseCoord(value: unknown, { min, max }: { min: number; max: number }): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function parseClubId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function isClubId(value: string): boolean {
  // Accept canonical 8-4-4-4-12 hex IDs, including legacy non-RFC variant/version IDs.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidWeatherPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as Record<string, unknown>;
  return Boolean(
    data.current &&
    Array.isArray(data.daily) &&
    Array.isArray(data.hourly),
  );
}

function toTsMillis(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function distanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function isCacheReusableForCoords(data: Record<string, unknown>, lat: number, lon: number): boolean {
  if (WEATHER_CACHE_MAX_DISTANCE_KM <= 0) return true;
  const dataLat = parseCoord(data.lat, { min: -90, max: 90 });
  const dataLon = parseCoord(data.lon, { min: -180, max: 180 });
  if (dataLat == null || dataLon == null) return false;
  return distanceKm(dataLat, dataLon, lat, lon) <= WEATHER_CACHE_MAX_DISTANCE_KM;
}

function positiveInt(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(Number(value)));
}

function oneCallUrl(lat: number, lon: number, apiKey: string): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
    units: "metric",
    lang: "de",
  });
  return `https://api.openweathermap.org/data/3.0/onecall?${params.toString()}`;
}

async function sendOpsAlert(message: string, meta: Record<string, unknown> = {}) {
  if (!OPS_ALERT_URL) return;
  try {
    await fetch(OPS_ALERT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_KEY ? { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } : {}),
        ...(OPS_ALERT_SECRET ? { "x-ops-secret": OPS_ALERT_SECRET } : {}),
      },
      body: JSON.stringify({
        source: "edge",
        service: "weatherProxy",
        severity: "error",
        message,
        context: meta,
      }),
    });
  } catch (error) {
    console.error("[weatherProxy] opsAlert dispatch failed:", error);
  }
}

async function fetchWithKey(lat: number, lon: number, apiKey: string) {
  const response = await fetch(oneCallUrl(lat, lon, apiKey), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { error: raw };
    }
  }
  if (!response.ok) {
    const err = new Error(`OpenWeather ${response.status}`);
    (err as Error & { status?: number; details?: unknown }).status = response.status;
    (err as Error & { status?: number; details?: unknown }).details = parsed;
    throw err;
  }
  return parsed;
}

async function isUserInClub(userId: string, clubId: string): Promise<boolean> {
  const [memberRes, superadminRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id")
      .eq("user_id", userId)
      .eq("club_id", clubId)
      .eq("is_active", true)
      .limit(1),
    supabase
      .from("superadmins")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1),
  ]);

  if (memberRes.error) {
    console.warn("[weatherProxy] memberships lookup failed:", memberRes.error);
  }
  if (superadminRes.error) {
    console.warn("[weatherProxy] superadmins lookup failed:", superadminRes.error);
  }

  const isMember = Array.isArray(memberRes.data) && memberRes.data.length > 0;
  const isSuperadmin = Array.isArray(superadminRes.data) && superadminRes.data.length > 0;
  return isMember || isSuperadmin;
}

async function resolveImplicitClubId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("club_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(2);

  if (error) {
    console.warn("[weatherProxy] implicit club lookup failed:", error);
    return null;
  }

  if (!Array.isArray(data) || data.length !== 1) return null;
  const clubId = parseClubId(data[0]?.club_id);
  if (!clubId || !isClubId(clubId)) return null;
  return clubId;
}

async function readFreshClubCache(clubId: string, lat: number, lon: number): Promise<Record<string, unknown> | null> {
  const latest = await readLatestClubCache(clubId, lat, lon);
  if (!latest) return null;
  if (Date.now() - latest.updatedAtMs > WEATHER_CACHE_TTL_SECONDS * 1000) return null;
  return latest.data;
}

async function readLatestClubCache(
  clubId: string,
  lat: number,
  lon: number,
): Promise<{ data: Record<string, unknown>; updatedAtMs: number } | null> {
  const { data, error } = await supabase
    .from("weather_cache")
    .select("data, updated_at")
    .eq("club_id", clubId)
    .eq("id", WEATHER_CACHE_ID)
    .maybeSingle();

  if (error || !data?.data) return null;
  if (!isValidWeatherPayload(data.data)) return null;

  const updatedAtMs = toTsMillis(data.updated_at);
  if (updatedAtMs == null) return null;
  if (!isCacheReusableForCoords(data.data, lat, lon)) return null;

  return { data: data.data, updatedAtMs };
}

async function writeClubCache(clubId: string, weatherData: unknown): Promise<void> {
  if (!isValidWeatherPayload(weatherData)) return;
  const { error } = await supabase
    .from("weather_cache")
    .upsert(
      {
        club_id: clubId,
        id: WEATHER_CACHE_ID,
        data: weatherData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id,id" },
    );
  if (error) {
    console.warn("[weatherProxy] weather_cache upsert failed:", error);
  }
}

async function bumpWeatherMetric(
  clubId: string | null,
  {
    requestCount = 0,
    cacheHitCount = 0,
    cacheMissCount = 0,
    openweatherCallCount = 0,
    secondaryKeyCount = 0,
  }: {
    requestCount?: number;
    cacheHitCount?: number;
    cacheMissCount?: number;
    openweatherCallCount?: number;
    secondaryKeyCount?: number;
  },
): Promise<void> {
  if (!clubId) return;
  const pRequestCount = positiveInt(requestCount);
  const pCacheHitCount = positiveInt(cacheHitCount);
  const pCacheMissCount = positiveInt(cacheMissCount);
  const pOpenweatherCallCount = positiveInt(openweatherCallCount);
  const pSecondaryKeyCount = positiveInt(secondaryKeyCount);
  if (
    pRequestCount === 0 &&
    pCacheHitCount === 0 &&
    pCacheMissCount === 0 &&
    pOpenweatherCallCount === 0 &&
    pSecondaryKeyCount === 0
  ) {
    return;
  }

  const { error } = await supabase.rpc("bump_weather_proxy_metric", {
    p_club_id: clubId,
    p_metric_date: new Date().toISOString().slice(0, 10),
    p_request_count: pRequestCount,
    p_cache_hit_count: pCacheHitCount,
    p_cache_miss_count: pCacheMissCount,
    p_openweather_call_count: pOpenweatherCallCount,
    p_secondary_key_count: pSecondaryKeyCount,
  });
  if (error) {
    console.warn("[weatherProxy] bump_weather_proxy_metric failed:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors(),
    });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const missingEnv = [
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
    ["OPENWEATHER_PRIMARY_KEY", PRIMARY_KEY],
  ].filter(([, value]) => !value);
  if (missingEnv.length) {
    console.error("[weatherProxy] missing env vars:", missingEnv.map(([key]) => key));
    await sendOpsAlert("weatherProxy missing env vars", {
      missing: missingEnv.map(([key]) => key),
    });
    return json(500, {
      error: "Missing ENV",
      missing: missingEnv.map(([key]) => key),
    });
  }

  const accessToken = readBearerToken(req);
  let callerUserId: string | null = null;
  if (accessToken) {
    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabase.auth.getUser(accessToken);
    if (!callerError && callerUser?.id) {
      callerUserId = callerUser.id;
    } else {
      console.warn("[weatherProxy] invalid bearer token, continuing in anonymous mode");
    }
  }

  const payload = await req.json().catch(() => ({}));
  const body = payload as Record<string, unknown>;
  const lat = parseCoord(body?.lat, { min: -90, max: 90 });
  const lon = parseCoord(body?.lon, { min: -180, max: 180 });
  if (lat == null || lon == null) {
    return json(400, { error: "Invalid coordinates" });
  }

  const requestedClubId = parseClubId(body?.clubId);
  let cacheClubId: string | null = null;
  let staleFallbackCache: Record<string, unknown> | null = null;
  if (requestedClubId) {
    if (!isClubId(requestedClubId)) {
      return json(400, { error: "Invalid clubId" });
    }
    const hasAccess = callerUserId ? await isUserInClub(callerUserId, requestedClubId) : true;
    if (hasAccess) {
      cacheClubId = requestedClubId;
      const cached = await readFreshClubCache(cacheClubId, lat, lon);
      if (cached) {
        return json(200, cached);
      }
      const latest = await readLatestClubCache(cacheClubId, lat, lon);
      staleFallbackCache = latest?.data ?? null;
    } else {
      // Club context in the client can be stale (e.g. after club switch/login race).
      // Fall back to implicit membership to avoid hard weather failures.
      cacheClubId = await resolveImplicitClubId(callerUserId);
      if (cacheClubId) {
        const cached = await readFreshClubCache(cacheClubId, lat, lon);
        if (cached) {
          return json(200, cached);
        }
        const latest = await readLatestClubCache(cacheClubId, lat, lon);
        staleFallbackCache = latest?.data ?? null;
      }
    }
  } else {
    if (callerUserId) {
      cacheClubId = await resolveImplicitClubId(callerUserId);
      if (cacheClubId) {
        const cached = await readFreshClubCache(cacheClubId, lat, lon);
        if (cached) {
          return json(200, cached);
        }
        const latest = await readLatestClubCache(cacheClubId, lat, lon);
        staleFallbackCache = latest?.data ?? null;
      }
    }
  }

  try {
    await bumpWeatherMetric(cacheClubId, {
      openweatherCallCount: 1,
    });
    const primary = await fetchWithKey(lat, lon, PRIMARY_KEY);
    if (cacheClubId) {
      void writeClubCache(cacheClubId, primary);
    }
    return json(200, primary);
  } catch (primaryError) {
    console.warn("[weatherProxy] primary key failed:", primaryError);
    if (!SECONDARY_KEY) {
      if (staleFallbackCache) {
        return json(200, staleFallbackCache);
      }
      const status = (primaryError as { status?: number })?.status || 502;
      return json(status, { error: "Weather provider failed" });
    }

    try {
      await bumpWeatherMetric(cacheClubId, {
        openweatherCallCount: 1,
        secondaryKeyCount: 1,
      });
      const secondary = await fetchWithKey(lat, lon, SECONDARY_KEY);
      if (cacheClubId) {
        void writeClubCache(cacheClubId, secondary);
      }
      return json(200, secondary);
    } catch (secondaryError) {
      console.error("[weatherProxy] secondary key failed:", secondaryError);
      if (staleFallbackCache) {
        return json(200, staleFallbackCache);
      }
      await sendOpsAlert("weatherProxy provider failed on primary+secondary key", {
        primaryStatus: (primaryError as { status?: number })?.status ?? null,
        secondaryStatus: (secondaryError as { status?: number })?.status ?? null,
        lat,
        lon,
      });
      const status = (secondaryError as { status?: number })?.status || 502;
      return json(status, { error: "Weather provider failed" });
    }
  }
});

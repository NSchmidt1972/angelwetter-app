import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRIMARY_KEY = (Deno.env.get("OPENWEATHER_PRIMARY_KEY") ?? "").trim();
const SECONDARY_KEY = (Deno.env.get("OPENWEATHER_SECONDARY_KEY") ?? "").trim();
const OPS_ALERT_SECRET = (Deno.env.get("OPS_ALERT_SECRET") ?? "").trim();
const OPS_ALERT_URL = (Deno.env.get("OPS_ALERT_URL") ?? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/opsAlert`).trim();

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
  if (!accessToken) {
    return json(401, { error: "Missing bearer token" });
  }

  const {
    data: { user: callerUser },
    error: callerError,
  } = await supabase.auth.getUser(accessToken);
  if (callerError || !callerUser?.id) {
    return json(401, { error: "Invalid bearer token" });
  }

  const payload = await req.json().catch(() => ({}));
  const lat = parseCoord((payload as Record<string, unknown>)?.lat, { min: -90, max: 90 });
  const lon = parseCoord((payload as Record<string, unknown>)?.lon, { min: -180, max: 180 });
  if (lat == null || lon == null) {
    return json(400, { error: "Invalid coordinates" });
  }

  try {
    const primary = await fetchWithKey(lat, lon, PRIMARY_KEY);
    return json(200, primary);
  } catch (primaryError) {
    console.warn("[weatherProxy] primary key failed:", primaryError);
    if (!SECONDARY_KEY) {
      const status = (primaryError as { status?: number })?.status || 502;
      return json(status, { error: "Weather provider failed" });
    }

    try {
      const secondary = await fetchWithKey(lat, lon, SECONDARY_KEY);
      return json(200, secondary);
    } catch (secondaryError) {
      console.error("[weatherProxy] secondary key failed:", secondaryError);
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

// src/services/aiService.js
const AI_BASE = import.meta.env.VITE_AI_BASE_URL || "https://ai.asv-rotauge.de";
const AI_COOLDOWN_MS = Number.parseInt(
  String(import.meta.env.VITE_AI_COOLDOWN_MS ?? ''),
  10
) || 120000;

let aiBlockedUntil = 0;

function createAiError(message, meta = {}) {
  const error = new Error(message);
  error.code = meta.code || null;
  error.status = meta.status ?? null;
  error.url = meta.url || null;
  error.responseText = meta.responseText || "";
  error.isAiUnavailable = Boolean(meta.isAiUnavailable);
  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError" || /aborted|abort/i.test(String(error?.message || ""));
}

function isNetworkLikeError(error) {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("cors") ||
    message.includes("access-control")
  );
}

function openAiCircuit() {
  aiBlockedUntil = Math.max(aiBlockedUntil, Date.now() + AI_COOLDOWN_MS);
}

export function isAiUnavailableError(error) {
  return Boolean(error?.isAiUnavailable || error?.code === "AI_TEMP_UNAVAILABLE");
}

export function isAiCircuitOpen() {
  return Date.now() < aiBlockedUntil;
}

async function postJSON(url, body, { signal } = {}) {
  if (isAiCircuitOpen()) {
    throw createAiError("AI service temporarily unavailable", {
      code: "AI_TEMP_UNAVAILABLE",
      status: 503,
      url,
      isAiUnavailable: true,
    });
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    if (!isAbortError(err) && isNetworkLikeError(err)) {
      openAiCircuit();
      throw createAiError("AI request network/cors failure", {
        code: "AI_TEMP_UNAVAILABLE",
        status: 503,
        url,
        isAiUnavailable: true,
      });
    }
    throw err;
  }

  if (!res.ok) {
    const responseText = await res.text().catch(() => "");
    const serviceUnavailable = res.status === 429 || res.status >= 500;
    if (serviceUnavailable) {
      openAiCircuit();
    }
    const error = createAiError(`AI request failed: ${res.status}`, {
      status: res.status,
      code: serviceUnavailable ? "AI_TEMP_UNAVAILABLE" : null,
      url,
      responseText: responseText ? responseText.slice(0, 250) : "",
      isAiUnavailable: serviceUnavailable,
    });
    throw error;
  }
  return res.json();
}

async function getJSON(url, { signal } = {}) {
  if (isAiCircuitOpen()) {
    throw createAiError("AI service temporarily unavailable", {
      code: "AI_TEMP_UNAVAILABLE",
      status: 503,
      url,
      isAiUnavailable: true,
    });
  }

  let res;
  try {
    res = await fetch(url, { method: "GET", signal });
  } catch (err) {
    if (!isAbortError(err) && isNetworkLikeError(err)) {
      openAiCircuit();
      throw createAiError("AI request network/cors failure", {
        code: "AI_TEMP_UNAVAILABLE",
        status: 503,
        url,
        isAiUnavailable: true,
      });
    }
    throw err;
  }

  if (!res.ok) {
    const responseText = await res.text().catch(() => "");
    const serviceUnavailable = res.status === 429 || res.status >= 500;
    if (serviceUnavailable) {
      openAiCircuit();
    }
    const error = createAiError(`AI request failed: ${res.status}`, {
      status: res.status,
      code: serviceUnavailable ? "AI_TEMP_UNAVAILABLE" : null,
      url,
      responseText: responseText ? responseText.slice(0, 250) : "",
      isAiUnavailable: serviceUnavailable,
    });
    throw error;
  }
  return res.json();
}

// Einzel-Prognose
export async function predictForWeather(weather, options = {}) {
  return postJSON(`${AI_BASE}/predict`, weather, options);
}

export async function getModelInfo(options = {}) {
  return getJSON(`${AI_BASE}/modelinfo`, options);
}

// Optional: Batch-Endpoint (falls du ihn später anbietest)
export async function predictBatch(weathers, options = {}) {
  // Fallback: parallel ohne echten Batch
  if (!Array.isArray(weathers)) return [];
  const controller = options.signal ? { signal: options.signal } : {};
  const results = await Promise.allSettled(
    weathers.map(w => predictForWeather(w, controller))
  );
  return results.map(r => (r.status === "fulfilled" ? r.value : null));
}

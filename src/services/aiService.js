// src/services/aiService.js
const AI_BASE = import.meta.env.VITE_AI_BASE_URL || "https://ai.asv-rotauge.de";

async function postJSON(url, body, { signal } = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) {
    const responseText = await res.text().catch(() => "");
    const error = new Error(`AI request failed: ${res.status}`);
    error.status = res.status;
    error.url = url;
    error.responseText = responseText ? responseText.slice(0, 250) : "";
    throw error;
  }
  return res.json();
}

async function getJSON(url, { signal } = {}) {
  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    const responseText = await res.text().catch(() => "");
    const error = new Error(`AI request failed: ${res.status}`);
    error.status = res.status;
    error.url = url;
    error.responseText = responseText ? responseText.slice(0, 250) : "";
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

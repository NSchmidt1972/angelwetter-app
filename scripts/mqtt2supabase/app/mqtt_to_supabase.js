import mqtt from "mqtt";
import { createClient } from "@supabase/supabase-js";

process.on("unhandledRejection", (r) => {
  console.error("[FATAL] unhandledRejection:", r);
});
process.on("uncaughtException", (e) => {
  console.error("[FATAL] uncaughtException:", e);
});

console.log("Starting mqtt2supabase...");
console.log("MQTT_URL =", process.env.MQTT_URL);
console.log("TOPICS =", process.env.TOPICS);
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USER = process.env.MQTT_USER || "";
const MQTT_PASS = process.env.MQTT_PASS || "";
const TOPICS = (process.env.TOPICS || "gps/#,asv/sensors/#,temperature/#,temp/#")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MQTT_URL) throw new Error("MQTT_URL is missing");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseUtcCompactToIso(utcStr) {
  if (!utcStr || typeof utcStr !== "string") return null;
  const m = utcStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?$/);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, s, frac] = m;
  const ms = frac ? frac.slice(1).padEnd(3, "0").slice(0, 3) : "000";
  return `${Y}-${Mo}-${D}T${h}:${mi}:${s}.${ms}Z`;
}

function toFiniteNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clampPercent(value) {
  const num = toFiniteNumberOrNull(value);
  if (num === null) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function toIntegerOrNull(value) {
  const num = toFiniteNumberOrNull(value);
  if (num === null) return null;
  return Math.trunc(num);
}

function parseAnyTimestampToIso(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const compact = parseUtcCompactToIso(value);
  if (compact) return compact;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asNonEmptyString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function getDeviceIdFromTopic(topic) {
  const parts = String(topic || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  if (parts[0] === "gps" || parts[0] === "temperature" || parts[0] === "temp") {
    return asNonEmptyString(parts[1]);
  }

  // Optional format for future: asv/sensors/<deviceId>/state
  if (parts[0] === "asv" && parts[1] === "sensors" && parts.length >= 4) {
    return asNonEmptyString(parts[2]);
  }

  return null;
}

function resolveDeviceId(topic, payload) {
  return (
    asNonEmptyString(payload?.device_id) ||
    asNonEmptyString(payload?.deviceId) ||
    asNonEmptyString(payload?.sensor_id) ||
    asNonEmptyString(payload?.sensorId) ||
    getDeviceIdFromTopic(topic)
  );
}

function resolveMeasuredAt(payload) {
  return (
    parseAnyTimestampToIso(payload?.measured_at) ||
    parseAnyTimestampToIso(payload?.timestamp) ||
    parseUtcCompactToIso(payload?.utc) ||
    parseUtcCompactToIso(payload?.gps?.utc) ||
    new Date().toISOString()
  );
}

function warnAndSkipMissingDeviceId(topic, raw, payload) {
  console.warn("[WARN] missing device_id, skipping message:", topic, { raw, payload });
}

const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USER,
  password: MQTT_PASS,
  keepalive: 30,
  reconnectPeriod: 2000,
});

client.on("connect", () => {
  console.log("MQTT connected:", MQTT_URL);
  client.subscribe(TOPICS, { qos: 1 }, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("Subscribed:", TOPICS);
  });
});

client.on("message", async (topic, message) => {
  try {
    const raw = message.toString("utf-8");
    console.log("[MQTT] msg", topic, raw);

    let payload;
    try {
      payload = JSON.parse(raw);
      if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
        payload = { raw, value: payload };
      }
    } catch {
      payload = { raw };
    }

    // --- ASV State Topic: asv/sensors/state ---
    if (topic === "asv/sensors/state") {
      const deviceId = resolveDeviceId(topic, payload);
      if (!deviceId) {
        warnAndSkipMissingDeviceId(topic, raw, payload);
        return;
      }

      const measuredAt = resolveMeasuredAt(payload);

      const temperatureC =
        toFiniteNumberOrNull(payload?.temp_c) ??
        toFiniteNumberOrNull(payload?.temperature_c) ??
        toFiniteNumberOrNull(payload?.temperature) ??
        toFiniteNumberOrNull(payload?.temp);

      if (temperatureC !== null) {
        const tempRow = {
          device_id: deviceId,
          topic,
          measured_at: measuredAt,
          temperature_c: temperatureC,
          payload,
        };

        const { error } = await supabase.from("temperature_log").insert(tempRow);
        if (error) console.error("Supabase temperature insert error:", error);
        else console.log("[OK] inserted state temperature", tempRow.device_id, tempRow.temperature_c, tempRow.measured_at);
      } else {
        console.warn("[WARN] state has no valid temperature:", topic, raw);
      }

      const battery = payload?.battery && typeof payload.battery === "object" ? payload.battery : {};
      const voltageV =
        toFiniteNumberOrNull(battery?.voltage_v) ??
        toFiniteNumberOrNull(battery?.battery_v) ??
        toFiniteNumberOrNull(payload?.voltage_v) ??
        toFiniteNumberOrNull(payload?.battery_v);
      const percent = clampPercent(battery?.percent ?? payload?.percent);
      const batteryValidRaw = battery?.valid ?? payload?.valid;
      const batteryValid = typeof batteryValidRaw === "boolean" ? batteryValidRaw : null;

      if (voltageV !== null && percent !== null) {
        const battRow = {
          device_id: deviceId,
          topic,
          measured_at: measuredAt,
          voltage_v: voltageV,
          percent,
          valid: batteryValid,
          payload: battery,
        };

        const { error } = await supabase.from("batt_log").insert(battRow);
        if (error) console.error("Supabase battery insert error:", error);
        else console.log("[OK] inserted state battery", battRow.device_id, battRow.voltage_v, battRow.percent, battRow.valid);
      } else {
        console.warn("[WARN] state has no valid battery values:", topic, raw);
      }

      const gps = payload?.gps && typeof payload.gps === "object" ? payload.gps : {};
      const lat = toFiniteNumberOrNull(gps?.lat);
      const lon = toFiniteNumberOrNull(gps?.lon);

      if (lat !== null && lon !== null) {
        const gpsRow = {
          device_id: deviceId,
          topic,
          fix_time_utc: parseAnyTimestampToIso(gps?.utc) ?? parseUtcCompactToIso(gps?.utc),
          lat,
          lon,
          alt: toFiniteNumberOrNull(gps?.alt),
          speed: toFiniteNumberOrNull(gps?.speed),
          course: toFiniteNumberOrNull(gps?.course),
          hdop: toFiniteNumberOrNull(gps?.hdop),
          fix: typeof gps?.fix === "boolean" ? gps.fix : null,
          sats: typeof gps?.sats === "string" ? gps.sats : null,
          sats_used: toIntegerOrNull(gps?.sats_used),
          sats_view: toIntegerOrNull(gps?.sats_view),
          payload: gps,
        };

        const { error } = await supabase.from("gps_log").insert(gpsRow);
        if (error) console.error("Supabase gps insert error:", error);
        else console.log("[OK] inserted state gps", gpsRow.device_id, gpsRow.fix_time_utc ?? "");
      } else {
        console.warn("[WARN] state has no valid gps coordinates:", topic, raw);
      }

      return;
    }

    // --- ASV Temp Topic: asv/sensors/temp_c ---
    if (topic === "asv/sensors/temp_c") {
      const deviceId = resolveDeviceId(topic, payload);
      if (!deviceId) {
        warnAndSkipMissingDeviceId(topic, raw, payload);
        return;
      }

      const temperatureC =
        (typeof payload.raw === "string" ? toFiniteNumberOrNull(payload.raw) : null) ??
        toFiniteNumberOrNull(payload.value) ??
        toFiniteNumberOrNull(payload?.temp_c) ??
        toFiniteNumberOrNull(payload?.temperature_c) ??
        toFiniteNumberOrNull(payload?.temperature) ??
        toFiniteNumberOrNull(payload?.temp);

      if (temperatureC === null) {
        console.warn("[WARN] could not parse temp:", topic, raw, payload);
        return;
      }

      const row = {
        device_id: deviceId,
        topic,
        measured_at: resolveMeasuredAt(payload),
        temperature_c: temperatureC,
        payload,
      };

      const { error } = await supabase.from("temperature_log").insert(row);
      if (error) console.error("Supabase temperature insert error:", error);
      else console.log("[OK] inserted temperature", row.device_id, row.temperature_c, row.measured_at);
      return;
    }

    // --- ASV Battery Topic: asv/sensors/battery ---
    if (topic === "asv/sensors/battery") {
      const deviceId = resolveDeviceId(topic, payload);
      if (!deviceId) {
        warnAndSkipMissingDeviceId(topic, raw, payload);
        return;
      }

      const voltageV =
        toFiniteNumberOrNull(payload?.voltage_v) ??
        toFiniteNumberOrNull(payload?.battery_v) ??
        (typeof payload.raw === "string" ? toFiniteNumberOrNull(payload.raw) : null) ??
        toFiniteNumberOrNull(payload?.value);

      const percentRaw =
        toFiniteNumberOrNull(payload?.percent) ??
        toFiniteNumberOrNull(payload?.battery_pct);

      const percent = percentRaw === null ? null : clampPercent(percentRaw);
      const valid = typeof payload?.valid === "boolean" ? payload.valid : null;

      if (voltageV === null || percent === null) {
        console.warn("[WARN] could not parse battery:", topic, raw, payload);
        return;
      }

      const row = {
        device_id: deviceId,
        topic,
        measured_at: resolveMeasuredAt(payload),
        voltage_v: voltageV,
        percent,
        valid,
        payload,
      };

      const { error } = await supabase.from("batt_log").insert(row);
      if (error) console.error("Supabase battery insert error:", error);
      else console.log("[OK] inserted battery", row.device_id, row.voltage_v, row.percent);
      return;
    }

    // --- GPS ---
    if (topic.startsWith("gps/")) {
      const deviceId = resolveDeviceId(topic, payload);
      if (!deviceId) {
        warnAndSkipMissingDeviceId(topic, raw, payload);
        return;
      }

      const lat = toFiniteNumberOrNull(payload?.lat);
      const lon = toFiniteNumberOrNull(payload?.lon);
      if (lat === null || lon === null) return;

      const row = {
        device_id: deviceId,
        topic,
        fix_time_utc: parseAnyTimestampToIso(payload?.utc) ?? parseUtcCompactToIso(payload?.utc),
        lat,
        lon,
        alt: toFiniteNumberOrNull(payload?.alt),
        speed: toFiniteNumberOrNull(payload?.speed),
        course: toFiniteNumberOrNull(payload?.course),
        hdop: toFiniteNumberOrNull(payload?.hdop),
        fix: typeof payload?.fix === "boolean" ? payload.fix : null,
        sats: typeof payload?.sats === "string" ? payload.sats : null,
        sats_used: toIntegerOrNull(payload?.sats_used),
        sats_view: toIntegerOrNull(payload?.sats_view),
        payload,
      };

      const { error } = await supabase.from("gps_log").insert(row);
      if (error) console.error("Supabase gps insert error:", error);
      else console.log("[OK] inserted gps", row.device_id, row.fix_time_utc ?? "");
      return;
    }

    // --- Generic temperature topics (temperature/<id> oder temp/<id>) ---
    if (topic.startsWith("temperature/") || topic.startsWith("temp/")) {
      const deviceId = resolveDeviceId(topic, payload);
      if (!deviceId) {
        warnAndSkipMissingDeviceId(topic, raw, payload);
        return;
      }

      const temperatureC =
        toFiniteNumberOrNull(payload?.temperature_c) ??
        toFiniteNumberOrNull(payload?.temperature) ??
        toFiniteNumberOrNull(payload?.temp_c) ??
        toFiniteNumberOrNull(payload?.temp) ??
        (typeof payload.raw === "string" ? toFiniteNumberOrNull(payload.raw) : null) ??
        toFiniteNumberOrNull(payload.value);

      if (temperatureC === null) {
        console.warn("[WARN] could not parse temp:", topic, raw, payload);
        return;
      }

      const row = {
        device_id: deviceId,
        topic,
        measured_at: resolveMeasuredAt(payload),
        temperature_c: temperatureC,
        payload,
      };

      const { error } = await supabase.from("temperature_log").insert(row);
      if (error) console.error("Supabase temperature insert error:", error);
      else console.log("[OK] inserted temperature", row.device_id, row.temperature_c, row.measured_at);
      return;
    }
  } catch (e) {
    console.error("[ERR] handler exception:", e);
  }
});

client.on("error", (err) => console.error("MQTT error:", err));
client.on("reconnect", () => console.log("MQTT reconnecting..."));
client.on("close", () => console.log("MQTT connection closed"));

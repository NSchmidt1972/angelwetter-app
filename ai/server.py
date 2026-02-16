from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timezone
import json
import pytz
import os
import time
from scipy.stats import linregress
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# Supabase-Zugang
# ──────────────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pfrvxmywfbnmdbvcduvx.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_KEY:
    raise RuntimeError("Missing Supabase service key. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ──────────────────────────────────────────────────────────────────────────────
# Modellpfade & Laden
# ──────────────────────────────────────────────────────────────────────────────
model_dir = "/model"
model_metadata_path = os.path.join(model_dir, "model_metadata.json")
main_model_file = "model.joblib"
main_from_species_model_file = "model_main_from_species.joblib"
calibrators_file = "probability_calibrators.joblib"
fish_model_files = {
    "Karpfen": "model_karpfen.joblib",
    "Schleie": "model_schleie.joblib",
    "Brasse": "model_brasse.joblib",
    "Rotfeder": "model_rotfeder.joblib",
    "Rotauge": "model_rotauge.joblib",
    "Barsch": "model_barsch.joblib",
    "Karausche": "model_karausche.joblib",
    "Hecht": "model_hecht.joblib",
    "Aal": "model_aal.joblib",
}
API_MODEL_VERSION = "2026-02-14-main-max-agg-v10"
MAIN_MIN_SPECIES_POSITIVE_SAMPLES = 10
WEATHER_LOG_CACHE_TTL_SECONDS = max(0, int(os.getenv("WEATHER_LOG_CACHE_TTL_SECONDS", "90")))
FISH_STATS_CACHE_TTL_SECONDS = max(0, int(os.getenv("FISH_STATS_CACHE_TTL_SECONDS", "300")))
MAX_WEATHER_LOG_CACHE_ENTRIES = max(1, int(os.getenv("MAX_WEATHER_LOG_CACHE_ENTRIES", "16")))
PRESSURE_PA_THRESHOLD = 2000.0
PRESSURE_HPA_MIN = 850.0
PRESSURE_HPA_MAX = 1100.0
PRESSURE_TREND_CLIP_HPA_PER_DAY = 25.0

SPECIES_PROFILE = {
    "aal": {"active_months": [5, 6, 7, 8, 9], "min_temp": 12, "type": "warm"},
    "schleie": {"active_months": [6, 7, 8], "min_temp": 14, "type": "warm"},
    "karpfen": {"active_months": [4, 5, 6, 7, 8, 9], "min_temp": 10, "type": "warm"},
    "karausche": {"active_months": [5, 6, 7, 8, 9], "min_temp": 12, "type": "warm"},
    "brasse": {"active_months": [4, 5, 6, 7, 8, 9], "min_temp": 8, "type": "moderate"},
    "rotfeder": {"active_months": [4, 5, 6, 7, 8, 9], "min_temp": 8, "type": "moderate"},
    "hecht": {"active_months": [3, 4, 5, 9, 10], "min_temp": 4, "type": "cold"},
    "barsch": {"active_months": list(range(1, 13)), "min_temp": 3, "type": "cold"},
    "rotauge": {"active_months": list(range(1, 13)), "min_temp": 4, "type": "cold"},
}

def model_path(fname):
    return os.path.join(model_dir, fname)

def load_model(fname):
    path = model_path(fname)
    return joblib.load(path) if os.path.exists(path) else None

def load_probability_calibrators():
    path = model_path(calibrators_file)
    if not os.path.exists(path):
        return {"main": None, "species": {}}
    try:
        payload = joblib.load(path)
        if not isinstance(payload, dict):
            return {"main": None, "species": {}}
        return {
            "main": payload.get("main"),
            "species": payload.get("species", {}) if isinstance(payload.get("species", {}), dict) else {},
        }
    except Exception as error:
        print("⚠️ Kalibratoren konnten nicht geladen werden:", repr(error))
        return {"main": None, "species": {}}

def load_model_metadata():
    if not os.path.exists(model_metadata_path):
        return {}
    try:
        with open(model_metadata_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception as error:
        print("⚠️ model_metadata.json konnte nicht gelesen werden:", repr(error))
        return {}

def normalize_pressure_to_hpa(value) -> float:
    try:
        pressure = float(value)
    except Exception:
        return np.nan

    if not np.isfinite(pressure):
        return np.nan

    if PRESSURE_PA_THRESHOLD < abs(pressure) < 200_000:
        pressure = pressure / 100.0

    if pressure < PRESSURE_HPA_MIN or pressure > PRESSURE_HPA_MAX:
        return np.nan

    return float(pressure)

def normalize_pressure_series(values) -> pd.Series:
    if values is None:
        return pd.Series(dtype=float)
    numeric = pd.to_numeric(values, errors="coerce")
    if isinstance(numeric, pd.Series):
        return numeric.apply(normalize_pressure_to_hpa)
    return pd.Series([normalize_pressure_to_hpa(numeric)], dtype=float)

model           = load_model(main_model_file)
main_from_species_model = load_model(main_from_species_model_file)
karpfen_model   = load_model(fish_model_files["Karpfen"])
schleie_model   = load_model(fish_model_files["Schleie"])
brasse_model    = load_model(fish_model_files["Brasse"])
rotfeder_model  = load_model(fish_model_files["Rotfeder"])
rotauge_model   = load_model(fish_model_files["Rotauge"])
barsch_model    = load_model(fish_model_files["Barsch"])
karausche_model = load_model(fish_model_files["Karausche"])
hecht_model     = load_model(fish_model_files["Hecht"])
aal_model       = load_model(fish_model_files["Aal"])
probability_calibrators = load_probability_calibrators()
main_prob_calibrator = probability_calibrators.get("main")
species_prob_calibrators = probability_calibrators.get("species", {})

fish_models_map = {
    "Karpfen": karpfen_model,
    "Schleie": schleie_model,
    "Brasse": brasse_model,
    "Rotfeder": rotfeder_model,
    "Rotauge": rotauge_model,
    "Barsch": barsch_model,
    "Karausche": karausche_model,
    "Hecht": hecht_model,
    "Aal": aal_model,
}

_loaded_model_mtimes = {}
_weather_log_cache = {}
_fish_stats_cache = {"value": None, "expires_at": 0.0}

def _file_mtime(path):
    try:
        return os.path.getmtime(path)
    except OSError:
        return None

def reload_models_if_changed(force: bool = False) -> bool:
    global model
    global main_from_species_model
    global karpfen_model, schleie_model, brasse_model, rotfeder_model
    global rotauge_model, barsch_model, karausche_model, hecht_model, aal_model
    global fish_models_map
    global probability_calibrators, main_prob_calibrator, species_prob_calibrators

    watched = {
        "main_base": main_model_file,
        "main_from_species": main_from_species_model_file,
        "calibrators": calibrators_file,
        **fish_model_files,
    }
    current_mtimes = {}
    changed = force

    for key, file_name in watched.items():
        mtime = _file_mtime(model_path(file_name))
        current_mtimes[key] = mtime
        if _loaded_model_mtimes.get(key) != mtime:
            changed = True

    if not changed:
        return False

    model           = load_model(main_model_file)
    main_from_species_model = load_model(main_from_species_model_file)
    karpfen_model   = load_model(fish_model_files["Karpfen"])
    schleie_model   = load_model(fish_model_files["Schleie"])
    brasse_model    = load_model(fish_model_files["Brasse"])
    rotfeder_model  = load_model(fish_model_files["Rotfeder"])
    rotauge_model   = load_model(fish_model_files["Rotauge"])
    barsch_model    = load_model(fish_model_files["Barsch"])
    karausche_model = load_model(fish_model_files["Karausche"])
    hecht_model     = load_model(fish_model_files["Hecht"])
    aal_model       = load_model(fish_model_files["Aal"])
    probability_calibrators = load_probability_calibrators()
    main_prob_calibrator = probability_calibrators.get("main")
    species_prob_calibrators = probability_calibrators.get("species", {})

    fish_models_map = {
        "Karpfen": karpfen_model,
        "Schleie": schleie_model,
        "Brasse": brasse_model,
        "Rotfeder": rotfeder_model,
        "Rotauge": rotauge_model,
        "Barsch": barsch_model,
        "Karausche": karausche_model,
        "Hecht": hecht_model,
        "Aal": aal_model,
    }

    _loaded_model_mtimes.clear()
    _loaded_model_mtimes.update(current_mtimes)
    print(f"♻️ Modelle neu geladen ({API_MODEL_VERSION})")
    return True

print("✅ Basis-Hauptmodell geladen")      if model                   else print("⚠️ Kein Basis-Hauptmodell gefunden")
print("✅ Hauptmodell aus Fischmodellen geladen") if main_from_species_model else print("⚠️ Kein Hauptmodell aus Fischmodellen gefunden")
print("✅ Karpfen-Modell geladen")        if karpfen_model   else print("⚠️ Kein Karpfen-Modell gefunden")
print("✅ Schleie-Modell geladen")        if schleie_model   else print("⚠️ Kein Schleie-Modell gefunden")
print("✅ Brasse-Modell geladen")         if brasse_model    else print("⚠️ Kein Brasse-Modell gefunden")
print("✅ Rotfeder-Modell geladen")       if rotfeder_model  else print("⚠️ Kein Rotfeder-Modell gefunden")
print("✅ Rotauge-Modell geladen")        if rotauge_model   else print("⚠️ Kein Rotauge-Modell gefunden")
print("✅ Barsch-Modell geladen")         if barsch_model    else print("⚠️ Kein Barsch-Modell gefunden")
print("✅ Karausche-Modell geladen")      if karausche_model else print("⚠️ Kein Karausche-Modell gefunden")
print("✅ Hecht-Modell geladen")          if hecht_model     else print("⚠️ Kein Hecht-Modell gefunden")
print("✅ Aal-Modell geladen")            if aal_model       else print("⚠️ Kein Aal-Modell gefunden")
print("✅ Haupt-Kalibrator geladen")      if main_prob_calibrator else print("⚠️ Kein Haupt-Kalibrator gefunden")
reload_models_if_changed(force=True)

# ──────────────────────────────────────────────────────────────────────────────
# FastAPI-App
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

class WeatherInput(BaseModel):
    temp: float
    pressure: float
    humidity: float
    wind: float
    wind_deg: float
    moon_phase: float
    timestamp: Optional[str] = None
    dt: Optional[int] = None
    date: Optional[str] = None
    hour: Optional[int] = None

# ──────────────────────────────────────────────────────────────────────────────
# Trendberechnung
# ──────────────────────────────────────────────────────────────────────────────
def berechne_steigung(df: pd.DataFrame, with_meta: bool = False):
    if len(df) < 3:
        if with_meta:
            return 0.0, {"raw": 0.0, "clipped": False, "points": 0}
        return 0.0
    df = df.sort_values("timestamp").copy()
    df["pressure"] = normalize_pressure_series(df["pressure"])
    df = df.dropna(subset=["timestamp", "pressure"]).copy()
    if len(df) < 3:
        if with_meta:
            return 0.0, {"raw": 0.0, "clipped": False, "points": int(len(df))}
        return 0.0
    df["timestamp_unix"] = df["timestamp"].astype("int64") // 10**9
    slope, *_ = linregress(df["timestamp_unix"], df["pressure"])
    # auf hPa/Tag umrechnen und robuste Grenzen setzen (Mess-/Einheiten-Ausreißer)
    raw_trend_hpa_per_day = float(slope) * 60 * 60 * 24
    if not np.isfinite(raw_trend_hpa_per_day):
        if with_meta:
            return 0.0, {"raw": 0.0, "clipped": False, "points": int(len(df))}
        return 0.0
    clipped_trend_hpa_per_day = float(np.clip(
        raw_trend_hpa_per_day,
        -PRESSURE_TREND_CLIP_HPA_PER_DAY,
        PRESSURE_TREND_CLIP_HPA_PER_DAY,
    ))
    clipped = abs(raw_trend_hpa_per_day - clipped_trend_hpa_per_day) > 1e-9
    if with_meta:
        return round(clipped_trend_hpa_per_day, 2), {
            "raw": round(raw_trend_hpa_per_day, 2),
            "clipped": clipped,
            "points": int(len(df)),
        }
    return round(clipped_trend_hpa_per_day, 2)

def nearest_delta_with_lookback(
    df: pd.DataFrame,
    value_col: str,
    lookback_hours: int = 24,
    tolerance_hours: int = 6,
):
    if df.empty or value_col not in df.columns:
        return None

    work = df.dropna(subset=["timestamp", value_col]).sort_values("timestamp").copy()
    if len(work) < 2:
        return None

    latest = work.iloc[-1]
    latest_ts = latest["timestamp"]
    target_ts = latest_ts - pd.Timedelta(hours=lookback_hours)

    deltas = (work["timestamp"] - target_ts).abs()
    nearest_idx = deltas.idxmin()
    nearest = work.loc[nearest_idx]
    diff_hours = abs((nearest["timestamp"] - target_ts).total_seconds()) / 3600
    if diff_hours > tolerance_hours:
        return None

    latest_val = float(latest[value_col])
    past_val = float(nearest[value_col])
    delta = latest_val - past_val
    if not np.isfinite(delta):
        return None
    return round(delta, 2)

def berechne_trend(ts: pd.Timestamp, weather_log: pd.DataFrame) -> dict:
    df_pressure = weather_log[(weather_log["timestamp"] >= ts - pd.Timedelta(days=5)) & (weather_log["timestamp"] < ts)].copy()
    df_temp     = weather_log[(weather_log["timestamp"] >= ts - pd.Timedelta(days=3)) & (weather_log["timestamp"] < ts)].copy()
    df_pressure_48h = weather_log[(weather_log["timestamp"] >= ts - pd.Timedelta(hours=48)) & (weather_log["timestamp"] < ts)].copy()

    pressure_trend_5d, pressure_meta = berechne_steigung(df_pressure, with_meta=True)
    pressure_delta_24h = nearest_delta_with_lookback(df_pressure, "pressure", lookback_hours=24, tolerance_hours=6)
    temp_delta_24h = nearest_delta_with_lookback(df_temp, "temp", lookback_hours=24, tolerance_hours=6)

    pressure_volatility_48h = None
    if "pressure" in df_pressure_48h.columns:
        pressure_48h = normalize_pressure_series(df_pressure_48h["pressure"]).dropna()
        if len(pressure_48h) >= 3:
            volatility = float(pressure_48h.std())
            pressure_volatility_48h = round(volatility, 2) if np.isfinite(volatility) else None

    temp_mean_3d = float(df_temp["temp"].mean()) if len(df_temp) >= 2 else 0.0
    temp_volatility_3d = float(df_temp["temp"].std()) if len(df_temp) >= 2 else 0.0
    if not np.isfinite(temp_mean_3d):
        temp_mean_3d = 0.0
    if not np.isfinite(temp_volatility_3d):
        temp_volatility_3d = 0.0

    trend_quality = "ok"
    if pressure_meta.get("clipped"):
        trend_quality = "limited_clipped"
    elif pressure_meta.get("points", 0) < 24:
        trend_quality = "limited_sparse"

    return {
        "pressure_trend_5d": pressure_trend_5d,
        "pressure_trend_raw_5d": pressure_meta.get("raw", pressure_trend_5d),
        "pressure_trend_clipped": bool(pressure_meta.get("clipped", False)),
        "pressure_points_5d": int(pressure_meta.get("points", 0)),
        "pressure_delta_24h": pressure_delta_24h,
        "pressure_volatility_48h": pressure_volatility_48h,
        "temp_mean_3d": temp_mean_3d,
        "temp_volatility_3d": temp_volatility_3d,
        "temp_delta_24h": temp_delta_24h,
        "quality": trend_quality,
    }

def empty_weather_log_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=["timestamp", "temp", "pressure"])

def iso_minute(ts: pd.Timestamp) -> str:
    dt = ts.floor("min").to_pydatetime().astimezone(timezone.utc)
    return dt.replace(second=0, microsecond=0).isoformat().replace("+00:00", "Z")

def get_weather_log_window_cached(start_ts: pd.Timestamp, end_ts: pd.Timestamp) -> pd.DataFrame:
    if end_ts < start_ts:
        return empty_weather_log_frame()

    key = (iso_minute(start_ts), iso_minute(end_ts))
    now_ts = time.time()
    cached = _weather_log_cache.get(key)
    if cached and cached["expires_at"] > now_ts:
        return cached["value"]

    resp = (
        supabase.table("weather_log")
        .select("timestamp,temp,pressure")
        .gte("timestamp", str(start_ts))
        .lte("timestamp", str(end_ts))
        .execute()
    )

    if not resp.data:
        frame = empty_weather_log_frame()
    else:
        frame = pd.DataFrame(resp.data)
        if "timestamp" not in frame.columns:
            frame = empty_weather_log_frame()
        else:
            frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
            frame["temp"] = pd.to_numeric(frame.get("temp"), errors="coerce")
            frame["pressure"] = normalize_pressure_series(frame.get("pressure"))
            frame = frame.dropna(subset=["timestamp"]).copy()
            if "temp" not in frame.columns:
                frame["temp"] = np.nan
            if "pressure" not in frame.columns:
                frame["pressure"] = np.nan
            frame = frame[["timestamp", "temp", "pressure"]]

    if WEATHER_LOG_CACHE_TTL_SECONDS > 0:
        _weather_log_cache[key] = {
            "value": frame,
            "expires_at": now_ts + WEATHER_LOG_CACHE_TTL_SECONDS,
        }
        if len(_weather_log_cache) > MAX_WEATHER_LOG_CACHE_ENTRIES:
            stale_keys = [cache_key for cache_key, entry in _weather_log_cache.items() if entry["expires_at"] <= now_ts]
            for cache_key in stale_keys:
                _weather_log_cache.pop(cache_key, None)
            if len(_weather_log_cache) > MAX_WEATHER_LOG_CACHE_ENTRIES:
                oldest_key = min(_weather_log_cache, key=lambda cache_key: _weather_log_cache[cache_key]["expires_at"])
                _weather_log_cache.pop(oldest_key, None)

    return frame

def count_fishes_by_blank(is_blank: bool) -> int:
    try:
        base_query = supabase.table("fishes").select("id", count="exact", head=True)
        resp = base_query.eq("blank", True).execute() if is_blank else base_query.is_("blank", False).execute()
        if getattr(resp, "count", None) is not None:
            return int(resp.count)
    except Exception as error:
        print("⚠️ Fallback auf zeilenbasiertes Count für fishes:", repr(error))

    try:
        fallback_query = supabase.table("fishes").select("blank")
        fallback_resp = fallback_query.eq("blank", True).execute() if is_blank else fallback_query.is_("blank", False).execute()
        return len(fallback_resp.data or [])
    except Exception:
        return 0

def get_fish_stats_cached() -> dict:
    now_ts = time.time()
    cached_value = _fish_stats_cache.get("value")
    cached_until = float(_fish_stats_cache.get("expires_at", 0.0))
    if (
        FISH_STATS_CACHE_TTL_SECONDS > 0
        and cached_value is not None
        and cached_until > now_ts
    ):
        return cached_value

    stats = {
        "positive_samples": count_fishes_by_blank(False),
        "negative_samples": count_fishes_by_blank(True),
    }
    if FISH_STATS_CACHE_TTL_SECONDS > 0:
        _fish_stats_cache["value"] = stats
        _fish_stats_cache["expires_at"] = now_ts + FISH_STATS_CACHE_TTL_SECONDS
    return stats

# ──────────────────────────────────────────────────────────────────────────────
# Hilfsfunktionen
# ──────────────────────────────────────────────────────────────────────────────
def get_probability_for_class_1(m, X_df: pd.DataFrame) -> float:
    proba = m.predict_proba(X_df)[0]
    # classes_ kann z. B. array([0, 1]) sein – Index sauber bestimmen
    if 1 in m.classes_:
        idx = list(m.classes_).index(1)
        return float(proba[idx])
    return 0.0

def build_features_for(m, feature_dict: dict) -> pd.DataFrame:
    """
    Baut für *jedes* Modell die Feature-Zeile in der *genau richtigen Spaltenreihenfolge*.
    Fehlende Features werden defensiv mit 0.0 aufgefüllt.
    """
    cols = list(getattr(m, "feature_names_in_", []))
    row = [feature_dict.get(c, 0.0) for c in cols]
    return pd.DataFrame([row], columns=cols)

def species_meta_feature_name(species_name: str) -> str:
    return f"species_{str(species_name).strip().lower()}"

def build_main_from_species_features(m, species_probabilities: dict) -> pd.DataFrame:
    cols = list(getattr(m, "feature_names_in_", []))
    row = [float(species_probabilities.get(c, 0.0)) for c in cols]
    return pd.DataFrame([row], columns=cols)

def clamp_probability(value: float) -> float:
    return max(0.0, min(float(value), 0.999))

def _normalize_calibrator_entry(calibrator_entry):
    if calibrator_entry is None:
        return None, None, 0.0, None
    if isinstance(calibrator_entry, dict):
        model = calibrator_entry.get("model") or calibrator_entry.get("calibrator")
        prior = calibrator_entry.get("prior")
        blend_weight = calibrator_entry.get("blend_weight", 1.0 if model is not None else 0.0)
        cap = calibrator_entry.get("cap")
        return model, prior, float(blend_weight), cap
    return calibrator_entry, None, 1.0, None

def apply_probability_calibrator(raw_probability: float, calibrator_entry):
    raw = clamp_probability(raw_probability)
    model, prior, blend_weight, cap = _normalize_calibrator_entry(calibrator_entry)
    calibrated = raw
    if model is not None:
        try:
            calibrated = float(model.predict(np.asarray([raw], dtype=float))[0])
        except Exception:
            calibrated = raw
    calibrated = clamp_probability(calibrated)

    if prior is not None:
        try:
            prior_f = clamp_probability(float(prior))
            blend_weight = max(0.0, min(float(blend_weight), 1.0))
            calibrated = prior_f + (calibrated - prior_f) * blend_weight
        except Exception:
            pass

    if cap is not None:
        try:
            calibrated = min(calibrated, clamp_probability(float(cap)))
        except Exception:
            pass

    return clamp_probability(calibrated)

def normalize_iso(value):
    if value is None or value == "":
        return None
    ts = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(ts):
        return None
    if hasattr(ts, "to_pydatetime"):
        dt = ts.to_pydatetime()
    else:
        dt = ts
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def get_nested(data, *path):
    cur = data
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur

def file_mtime_iso(fname):
    path = model_path(fname)
    if not os.path.exists(path):
        return None
    dt = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

def pick_first_iso(*values):
    for value in values:
        normalized = normalize_iso(value)
        if normalized:
            return normalized
    return None

def latest_iso(values):
    best = None
    for value in values:
        normalized = normalize_iso(value)
        if not normalized:
            continue
        dt = pd.to_datetime(normalized, utc=True, errors="coerce")
        if pd.isna(dt):
            continue
        if best is None or dt > best:
            best = dt
    if best is None:
        return None
    return best.to_pydatetime().replace(microsecond=0).isoformat().replace("+00:00", "Z")

def resolve_prediction_timestamp(input_data: WeatherInput) -> pd.Timestamp:
    now_utc = pd.Timestamp(datetime.now(timezone.utc))

    # 1) explicit ISO timestamp
    if input_data.timestamp:
        ts = pd.to_datetime(input_data.timestamp, utc=True, errors="coerce")
        if not pd.isna(ts):
            return ts

    # 2) unix dt from forecast payload (seconds or milliseconds)
    if input_data.dt is not None:
        try:
            dt_value = int(input_data.dt)
            unit = "ms" if dt_value > 1_000_000_000_000 else "s"
            ts = pd.to_datetime(dt_value, unit=unit, utc=True, errors="coerce")
            if not pd.isna(ts):
                return ts
        except Exception:
            pass

    # 3) date + hour in local Berlin time
    if input_data.date and input_data.hour is not None:
        try:
            naive = datetime.fromisoformat(f"{str(input_data.date)}T{int(input_data.hour):02d}:00:00")
            berlin = pytz.timezone("Europe/Berlin").localize(naive)
            return pd.Timestamp(berlin.astimezone(timezone.utc))
        except Exception:
            pass

    return now_utc

def apply_biological_weighting(fish_type: str, month: int, temp: float, base_proba: float) -> float:
    profile = SPECIES_PROFILE.get(str(fish_type or "").strip().lower())
    if not profile:
        return base_proba

    weight = 1.0

    if month not in profile["active_months"]:
        weight *= 0.35

    min_temp = profile["min_temp"]
    if temp < min_temp:
        diff = min_temp - temp
        if diff >= 6:
            weight *= 0.15
        elif diff >= 3:
            weight *= 0.3
        else:
            weight *= 0.5

    if profile["type"] == "warm":
        if month in [11, 12, 1, 2]:
            weight *= 0.12
        elif month in [3, 10]:
            weight *= 0.45
        if temp < 8:
            weight *= 0.2

    if profile["type"] == "moderate" and month in [12, 1, 2]:
        weight *= 0.4

    fish_lc = str(fish_type or "").strip().lower()
    adjusted = base_proba * weight
    if fish_lc == "aal":
        if temp < 10:
            adjusted *= 0.1
        if temp < 7:
            adjusted *= 0.05
        if month in [11, 12, 1, 2]:
            adjusted *= 0.1
        elif month in [3, 10]:
            adjusted *= 0.35
        if temp <= 5:
            adjusted = min(adjusted, 0.08)

    return max(adjusted, 0.001)

def collect_model_training_metadata():
    metadata = load_model_metadata()
    main_base_trained_at = pick_first_iso(
        get_nested(metadata, "models", "main_base", "trained_at"),
        file_mtime_iso(main_model_file),
    )
    main_from_species_trained_at = pick_first_iso(
        get_nested(metadata, "models", "main_from_species", "trained_at"),
        file_mtime_iso(main_from_species_model_file),
    )
    main_trained_at = pick_first_iso(
        get_nested(metadata, "models", "main", "trained_at"),
        get_nested(metadata, "models", "main", "generated_at"),
        get_nested(metadata, "main_model", "trained_at"),
        get_nested(metadata, "trained_at"),
        get_nested(metadata, "generated_at"),
        main_from_species_trained_at,
        main_base_trained_at,
    )
    main_source = get_nested(metadata, "models", "main", "source")

    fish_trained_at = {}
    species_positive_samples = {}
    for fish_name, fish_file in fish_model_files.items():
        ts = pick_first_iso(
            get_nested(metadata, "models", "species", fish_name, "trained_at"),
            get_nested(metadata, "species_models", fish_name, "trained_at"),
            get_nested(metadata, "models", fish_name, "trained_at"),
            file_mtime_iso(fish_file),
        )
        if ts:
            fish_trained_at[fish_name] = ts
        sample_count = get_nested(metadata, "stats", "species_training", fish_name, "positive_samples")
        try:
            sample_count_int = int(sample_count)
            if sample_count_int >= 0:
                species_positive_samples[fish_name] = sample_count_int
        except Exception:
            pass

    per_fish_model_trained_at = pick_first_iso(
        get_nested(metadata, "models", "per_fish_type", "trained_at"),
        get_nested(metadata, "models", "species", "trained_at"),
        get_nested(metadata, "metadata", "per_fish_model_trained_at"),
        latest_iso(fish_trained_at.values()),
    )
    calibrators_trained_at = pick_first_iso(
        get_nested(metadata, "models", "calibrators", "trained_at"),
        get_nested(metadata, "metadata", "calibrators_trained_at"),
        file_mtime_iso(calibrators_file),
    )
    return {
        "trained_at": main_trained_at,
        "main_source": str(main_source) if main_source else None,
        "main_base_trained_at": main_base_trained_at,
        "main_from_species_trained_at": main_from_species_trained_at,
        "per_fish_model_trained_at": per_fish_model_trained_at,
        "species_models": fish_trained_at,
        "species_positive_samples": species_positive_samples,
        "calibrators_trained_at": calibrators_trained_at,
    }

def aggregate_main_probability_from_species(
    per_fish_type_percent: dict,
) -> float:
    if not per_fish_type_percent:
        return 0.0

    active_probs = []
    for _, payload in per_fish_type_percent.items():
        try:
            if isinstance(payload, dict):
                p_percent = float(payload.get("probability_percent", 0.0))
            else:
                p_percent = float(payload)
        except Exception:
            continue
        active_probs.append(clamp_probability(p_percent / 100.0))
    if not active_probs:
        return 0.0

    # Hauptwert ist exakt der höchste zugelassene Einzelwert.
    return clamp_probability(float(np.max(np.asarray(active_probs, dtype=float))))

# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(input_data: WeatherInput):
    reload_models_if_changed()
    if not any(m is not None for m in fish_models_map.values()):
        return {"error": "Keine Fischmodelle geladen"}

    # Zeitfeatures aus Forecast-Zeitpunkt (falls vorhanden), sonst now.
    ts = resolve_prediction_timestamp(input_data)
    now_utc = pd.Timestamp(datetime.now(timezone.utc))
    trend_end_ts = ts if ts <= now_utc else now_utc
    ts_utc_dt = ts.to_pydatetime().astimezone(timezone.utc)
    now_berlin = ts_utc_dt.astimezone(pytz.timezone("Europe/Berlin"))
    hour = now_berlin.hour
    month = now_berlin.month
    hour_sin = np.sin(2 * np.pi * hour / 24)
    hour_cos = np.cos(2 * np.pi * hour / 24)
    month_sin = np.sin(2 * np.pi * month / 12)
    month_cos = np.cos(2 * np.pi * month / 12)

    # Wetter-Log der letzten 5 Tage für Trend.
    # Bei Forecasts in der Zukunft wird das Fenster auf "jetzt" gedeckelt,
    # damit die Trendberechnung weiterhin auf realen Messdaten basiert.
    trend = {
        "pressure_trend_5d": 0.0,
        "pressure_trend_raw_5d": 0.0,
        "pressure_trend_clipped": False,
        "pressure_points_5d": 0,
        "pressure_delta_24h": None,
        "pressure_volatility_48h": None,
        "temp_mean_3d": 0.0,
        "temp_volatility_3d": 0.0,
        "temp_delta_24h": None,
        "quality": "limited_sparse",
    }
    weather_log = get_weather_log_window_cached(
        trend_end_ts - pd.Timedelta(days=5),
        trend_end_ts,
    )
    if not weather_log.empty:
        trend = berechne_trend(trend_end_ts, weather_log)

    # Gemeinsames Feature-Dict
    feature_dict = {
        "temp": input_data.temp,
        "pressure": float(np.nan_to_num(normalize_pressure_to_hpa(input_data.pressure), nan=-1.0)),
        "humidity": input_data.humidity,
        "wind": input_data.wind,
        "wind_deg": input_data.wind_deg,
        "moon_phase": input_data.moon_phase,
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "month_sin": month_sin,
        "month_cos": month_cos,
        "pressure_trend_5d": trend["pressure_trend_5d"],
        "temp_mean_3d": trend["temp_mean_3d"],
        "temp_volatility_3d": trend["temp_volatility_3d"],
    }

    training_meta = collect_model_training_metadata()
    species_positive_samples = training_meta.get("species_positive_samples", {})

    # Artspezifische Modelle – korrektes Mapping & robustes Feature-Building
    per_fish_type = {}
    per_fish_type_for_main = {}
    excluded_species_for_main = {}
    species_models = [
        ("Karpfen",   karpfen_model),
        ("Schleie",   schleie_model),
        ("Brasse",    brasse_model),
        ("Rotfeder",  rotfeder_model),
        ("Rotauge",   rotauge_model),
        ("Barsch",    barsch_model),     # ✅ gefixt
        ("Karausche", karausche_model),
        ("Hecht", hecht_model),
        ("Aal", aal_model),
    ]

    for name, fish_model in species_models:
        if fish_model:
            try:
                fish_features = build_features_for(fish_model, feature_dict)
                raw_species_proba = get_probability_for_class_1(fish_model, fish_features)
                calibrated_species_proba = apply_probability_calibrator(
                    raw_species_proba,
                    species_prob_calibrators.get(name),
                )
                weighted_species_proba = apply_biological_weighting(
                    name,
                    month,
                    float(input_data.temp),
                    calibrated_species_proba,
                )
                weighted_percent = float(weighted_species_proba) * 100.0
                per_fish_type[name] = round(weighted_percent, 1)

                sample_count = species_positive_samples.get(name)
                if sample_count is None:
                    excluded_species_for_main[name] = "missing_sample_count"
                    continue

                sample_count_int = int(sample_count)
                if sample_count_int > MAIN_MIN_SPECIES_POSITIVE_SAMPLES:
                    per_fish_type_for_main[name] = {
                        "probability_percent": weighted_percent,
                        "positive_samples": sample_count_int,
                    }
                else:
                    excluded_species_for_main[name] = f"positive_samples_le_{MAIN_MIN_SPECIES_POSITIVE_SAMPLES}"
            except Exception as e:
                print(f"❌ Fehler bei {name}-Prognose:", repr(e))

    main_model_source = f"species_max_no_fallback_samples_gt_{MAIN_MIN_SPECIES_POSITIVE_SAMPLES}"
    raw_main_probability = aggregate_main_probability_from_species(per_fish_type_for_main)
    calibrated_probability = raw_main_probability
    prediction = int(calibrated_probability >= 0.5)

    # Stats
    stats = get_fish_stats_cached()
    main_trained_at = training_meta["trained_at"]
    main_source = main_model_source
    per_fish_model_trained_at = training_meta["per_fish_model_trained_at"]
    calibrators_trained_at = training_meta["calibrators_trained_at"]

    return {
        "prediction": prediction,
        "probability": round(calibrated_probability * 100, 1),
        "raw_main_probability": round(raw_main_probability * 100, 1),
        "raw_base_main_probability": None,
        "main_model_source": main_source,
        "trained_at": main_trained_at,
        "model_trained_at": main_trained_at,
        "last_trained_at": main_trained_at,
        "per_fish_type": per_fish_type,
        "models": {
            "main": {
                "trained_at": main_trained_at,
                "file": "derived_from_species_probabilities",
            },
            "main_base": {
                "trained_at": training_meta["main_base_trained_at"],
                "file": main_model_file,
            },
            "per_fish_type": {
                "trained_at": per_fish_model_trained_at,
                "models": training_meta["species_models"],
            },
            "calibrators": {
                "trained_at": calibrators_trained_at,
                "file": calibrators_file,
            },
        },
        "metadata": {
            "trained_at": main_trained_at,
            "main_model_source": main_source,
            "main_min_species_positive_samples": MAIN_MIN_SPECIES_POSITIVE_SAMPLES,
            "species_used_for_main": sorted(list(per_fish_type_for_main.keys())),
            "species_excluded_for_main": excluded_species_for_main,
            "main_base_trained_at": training_meta["main_base_trained_at"],
            "main_from_species_trained_at": training_meta["main_from_species_trained_at"],
            "per_fish_model_trained_at": per_fish_model_trained_at,
            "calibrators_trained_at": calibrators_trained_at,
        },
        "trend": trend,
        "input": {
            **feature_dict,
            "hour": hour,
            "forecast_timestamp_utc": ts_utc_dt.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        },
        "stats": {
            "total_samples": stats["positive_samples"] + stats["negative_samples"],
            "trained_at": main_trained_at,
            "model_trained_at": main_trained_at,
            "last_trained_at": main_trained_at,
            "main_model_source": main_source,
            "per_fish_model_trained_at": per_fish_model_trained_at,
            "calibrators_trained_at": calibrators_trained_at,
            **stats,
        },
        "api_model_version": API_MODEL_VERSION,
    }

@app.get("/modelinfo")
async def modelinfo():
    reload_models_if_changed()
    training_meta = collect_model_training_metadata()
    main_source = f"species_max_no_fallback_samples_gt_{MAIN_MIN_SPECIES_POSITIVE_SAMPLES}"
    return {
        "features": list(model.feature_names_in_) if model else [],
        "main_from_species_features": list(main_from_species_model.feature_names_in_) if main_from_species_model is not None else [],
        "fish_models": [name for name, m in fish_models_map.items() if m is not None],
        "trained_at": training_meta["trained_at"],
        "main_source": main_source,
        "main_min_species_positive_samples": MAIN_MIN_SPECIES_POSITIVE_SAMPLES,
        "species_positive_samples": training_meta.get("species_positive_samples", {}),
        "main_base_trained_at": training_meta["main_base_trained_at"],
        "main_from_species_trained_at": training_meta["main_from_species_trained_at"],
        "per_fish_model_trained_at": training_meta["per_fish_model_trained_at"],
        "fish_model_trained_at": training_meta["species_models"],
        "calibrators_trained_at": training_meta["calibrators_trained_at"],
        "calibrators_loaded": {
            "main": main_prob_calibrator is not None,
            "species": sorted(list(species_prob_calibrators.keys())),
        },
        "models_loaded": {
            "main_base": model is not None,
            "main_from_species": main_from_species_model is not None,
        },
        "api_model_version": API_MODEL_VERSION,
    }

@app.get("/health")
def health():
    reload_models_if_changed()
    training_meta = collect_model_training_metadata()
    main_source = f"species_max_no_fallback_samples_gt_{MAIN_MIN_SPECIES_POSITIVE_SAMPLES}"
    loaded = []
    if model is not None:
        loaded.append("main_base")
    if main_from_species_model is not None:
        loaded.append("main_from_species")
    loaded.extend([name for name, m in fish_models_map.items() if m is not None])
    return {
        "status": "ok",
        "models_loaded": loaded,
        "trained_at": training_meta["trained_at"],
        "main_source": main_source,
        "main_min_species_positive_samples": MAIN_MIN_SPECIES_POSITIVE_SAMPLES,
        "species_positive_samples": training_meta.get("species_positive_samples", {}),
        "main_base_trained_at": training_meta["main_base_trained_at"],
        "main_from_species_trained_at": training_meta["main_from_species_trained_at"],
        "per_fish_model_trained_at": training_meta["per_fish_model_trained_at"],
        "calibrators_trained_at": training_meta["calibrators_trained_at"],
        "calibrators_loaded": {
            "main": main_prob_calibrator is not None,
            "species": sorted(list(species_prob_calibrators.keys())),
        },
        "api_model_version": API_MODEL_VERSION,
    }

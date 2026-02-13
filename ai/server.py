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
from scipy.stats import linregress

# ──────────────────────────────────────────────────────────────────────────────
# Supabase-Zugang
# ──────────────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://kirevrwmmthqgceprbhl.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcmV2cndtbXRocWdjZXByYmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzU5MzY3OCwiZXhwIjoyMDYzMTY5Njc4fQ.OFce0qhDdeMl6Bd1iM-MEXV1kQ8t1xmgXRJuzFwRRac"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ──────────────────────────────────────────────────────────────────────────────
# Modellpfade & Laden
# ──────────────────────────────────────────────────────────────────────────────
model_dir = "/model"
model_metadata_path = os.path.join(model_dir, "model_metadata.json")
main_model_file = "model.joblib"
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
API_MODEL_VERSION = "2026-02-13-aal-weighting-v3"

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

model           = load_model(main_model_file)
karpfen_model   = load_model(fish_model_files["Karpfen"])
schleie_model   = load_model(fish_model_files["Schleie"])
brasse_model    = load_model(fish_model_files["Brasse"])
rotfeder_model  = load_model(fish_model_files["Rotfeder"])
rotauge_model   = load_model(fish_model_files["Rotauge"])
barsch_model    = load_model(fish_model_files["Barsch"])
karausche_model = load_model(fish_model_files["Karausche"])
hecht_model     = load_model(fish_model_files["Hecht"])
aal_model       = load_model(fish_model_files["Aal"])

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

def _file_mtime(path):
    try:
        return os.path.getmtime(path)
    except OSError:
        return None

def reload_models_if_changed(force: bool = False) -> bool:
    global model
    global karpfen_model, schleie_model, brasse_model, rotfeder_model
    global rotauge_model, barsch_model, karausche_model, hecht_model, aal_model
    global fish_models_map

    watched = {"main": main_model_file, **fish_model_files}
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
    karpfen_model   = load_model(fish_model_files["Karpfen"])
    schleie_model   = load_model(fish_model_files["Schleie"])
    brasse_model    = load_model(fish_model_files["Brasse"])
    rotfeder_model  = load_model(fish_model_files["Rotfeder"])
    rotauge_model   = load_model(fish_model_files["Rotauge"])
    barsch_model    = load_model(fish_model_files["Barsch"])
    karausche_model = load_model(fish_model_files["Karausche"])
    hecht_model     = load_model(fish_model_files["Hecht"])
    aal_model       = load_model(fish_model_files["Aal"])

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

print("✅ Hauptmodell geladen")            if model          else print("⚠️ Kein Hauptmodell gefunden")
print("✅ Karpfen-Modell geladen")        if karpfen_model   else print("⚠️ Kein Karpfen-Modell gefunden")
print("✅ Schleie-Modell geladen")        if schleie_model   else print("⚠️ Kein Schleie-Modell gefunden")
print("✅ Brasse-Modell geladen")         if brasse_model    else print("⚠️ Kein Brasse-Modell gefunden")
print("✅ Rotfeder-Modell geladen")       if rotfeder_model  else print("⚠️ Kein Rotfeder-Modell gefunden")
print("✅ Rotauge-Modell geladen")        if rotauge_model   else print("⚠️ Kein Rotauge-Modell gefunden")
print("✅ Barsch-Modell geladen")         if barsch_model    else print("⚠️ Kein Barsch-Modell gefunden")
print("✅ Karausche-Modell geladen")      if karausche_model else print("⚠️ Kein Karausche-Modell gefunden")
print("✅ Hecht-Modell geladen")          if hecht_model     else print("⚠️ Kein Hecht-Modell gefunden")
print("✅ Aal-Modell geladen")            if aal_model       else print("⚠️ Kein Aal-Modell gefunden")
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

# ──────────────────────────────────────────────────────────────────────────────
# Trendberechnung
# ──────────────────────────────────────────────────────────────────────────────
def berechne_steigung(df: pd.DataFrame) -> float:
    if len(df) < 3:
        return 0.0
    df = df.sort_values("timestamp").copy()
    df["timestamp_unix"] = df["timestamp"].astype("int64") // 10**9
    slope, *_ = linregress(df["timestamp_unix"], df["pressure"])
    # auf hPa/Tag umrechnen
    return round(float(slope) * 60 * 60 * 24, 2)

def berechne_trend(ts: pd.Timestamp, weather_log: pd.DataFrame) -> dict:
    df_pressure = weather_log[(weather_log["timestamp"] >= ts - pd.Timedelta(days=5)) & (weather_log["timestamp"] < ts)]
    df_temp     = weather_log[(weather_log["timestamp"] >= ts - pd.Timedelta(days=3)) & (weather_log["timestamp"] < ts)]

    return {
        "pressure_trend_5d": berechne_steigung(df_pressure),
        "temp_mean_3d": float(df_temp["temp"].mean()) if len(df_temp) >= 2 else 0.0,
        "temp_volatility_3d": float(df_temp["temp"].std()) if len(df_temp) >= 2 else 0.0,
    }

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
    main_trained_at = pick_first_iso(
        get_nested(metadata, "models", "main", "trained_at"),
        get_nested(metadata, "models", "main", "generated_at"),
        get_nested(metadata, "main_model", "trained_at"),
        get_nested(metadata, "trained_at"),
        get_nested(metadata, "generated_at"),
        file_mtime_iso(main_model_file),
    )

    fish_trained_at = {}
    for fish_name, fish_file in fish_model_files.items():
        ts = pick_first_iso(
            get_nested(metadata, "models", "species", fish_name, "trained_at"),
            get_nested(metadata, "species_models", fish_name, "trained_at"),
            get_nested(metadata, "models", fish_name, "trained_at"),
            file_mtime_iso(fish_file),
        )
        if ts:
            fish_trained_at[fish_name] = ts

    per_fish_model_trained_at = pick_first_iso(
        get_nested(metadata, "models", "per_fish_type", "trained_at"),
        get_nested(metadata, "models", "species", "trained_at"),
        get_nested(metadata, "metadata", "per_fish_model_trained_at"),
        latest_iso(fish_trained_at.values()),
    )
    return {
        "trained_at": main_trained_at,
        "per_fish_model_trained_at": per_fish_model_trained_at,
        "species_models": fish_trained_at,
    }

def calibrate_main_probability(
    raw_main_probability: float,
    per_fish_type: dict,
    month: int,
    temp: float,
) -> float:
    # If species models are not available, keep the main model probability.
    if not per_fish_type:
        return max(0.0, min(float(raw_main_probability), 0.95))

    species_probs = []
    for value in per_fish_type.values():
        try:
            p = float(value) / 100.0
        except Exception:
            continue
        species_probs.append(max(0.0, min(p, 0.99)))

    if not species_probs:
        return max(0.0, min(float(raw_main_probability), 0.95))

    # "Any species catch" proxy from weighted single-species probabilities.
    no_catch_product = 1.0
    for p in species_probs:
        no_catch_product *= (1.0 - p)
    species_any_probability = 1.0 - no_catch_product

    # Blend: main model still leads, but species-weighted signal stabilizes output.
    blended = (0.65 * float(raw_main_probability)) + (0.35 * species_any_probability)

    # Extra conservative in cold winter shoulder conditions.
    seasonal_factor = 1.0
    if month in [11, 12, 1, 2] and temp <= 8:
        seasonal_factor *= 0.8
    if temp <= 5:
        seasonal_factor *= 0.8

    return max(0.0, min(blended * seasonal_factor, 0.95))

# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(input_data: WeatherInput):
    reload_models_if_changed()
    if model is None:
        return {"error": "Kein Hauptmodell geladen"}

    # Zeitfeatures (lokal für Berlin)
    now_utc = datetime.now(timezone.utc)
    ts = pd.Timestamp(now_utc)
    now_berlin = now_utc.astimezone(pytz.timezone("Europe/Berlin"))
    hour = now_berlin.hour
    month = now_berlin.month
    hour_sin = np.sin(2 * np.pi * hour / 24)
    hour_cos = np.cos(2 * np.pi * hour / 24)
    month_sin = np.sin(2 * np.pi * month / 12)
    month_cos = np.cos(2 * np.pi * month / 12)

    # Wetter-Log der letzten 5 Tage für Trend
    resp = supabase.table("weather_log").select("*") \
        .gte("timestamp", str(ts - pd.Timedelta(days=5))) \
        .lte("timestamp", str(ts)).execute()

    if not resp.data:
        return {"error": "Keine Wetterdaten für Trendberechnung verfügbar"}

    weather_log = pd.DataFrame(resp.data)
    weather_log["timestamp"] = pd.to_datetime(weather_log["timestamp"], utc=True)
    trend = berechne_trend(ts, weather_log)

    # Gemeinsames Feature-Dict
    feature_dict = {
        "temp": input_data.temp,
        "pressure": input_data.pressure,
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

    # Hauptmodell-Vorhersage (mit korrekter Spaltenreihenfolge)
    features_main = build_features_for(model, feature_dict)
    prediction = int(model.predict(features_main)[0])
    raw_probability = get_probability_for_class_1(model, features_main)
    probability = min(raw_probability, 0.95)  # Cap bei 95 %

    # Artspezifische Modelle – korrektes Mapping & robustes Feature-Building
    per_fish_type = {}
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
                weighted_species_proba = apply_biological_weighting(
                    name,
                    month,
                    float(input_data.temp),
                    raw_species_proba,
                )
                per_fish_type[name] = round(weighted_species_proba * 100, 1)
            except Exception as e:
                print(f"❌ Fehler bei {name}-Prognose:", repr(e))

    calibrated_probability = calibrate_main_probability(
        raw_main_probability=probability,
        per_fish_type=per_fish_type,
        month=month,
        temp=float(input_data.temp),
    )
    prediction = int(calibrated_probability >= 0.5)

    # Stats
    pos = supabase.table("fishes").select("blank").is_("blank", False).execute().data or []
    neg = supabase.table("fishes").select("blank").eq("blank", True).execute().data or []
    stats = {
        "positive_samples": len(pos),
        "negative_samples": len(neg),
    }
    training_meta = collect_model_training_metadata()
    main_trained_at = training_meta["trained_at"]
    per_fish_model_trained_at = training_meta["per_fish_model_trained_at"]

    return {
        "prediction": prediction,
        "probability": round(calibrated_probability * 100, 1),
        "raw_main_probability": round(probability * 100, 1),
        "trained_at": main_trained_at,
        "model_trained_at": main_trained_at,
        "last_trained_at": main_trained_at,
        "per_fish_type": per_fish_type,
        "models": {
            "main": {
                "trained_at": main_trained_at,
                "file": main_model_file,
            },
            "per_fish_type": {
                "trained_at": per_fish_model_trained_at,
                "models": training_meta["species_models"],
            },
        },
        "metadata": {
            "trained_at": main_trained_at,
            "per_fish_model_trained_at": per_fish_model_trained_at,
        },
        "trend": trend,
        "input": {**feature_dict, "hour": hour},
        "stats": {
            "total_samples": stats["positive_samples"] + stats["negative_samples"],
            "trained_at": main_trained_at,
            "model_trained_at": main_trained_at,
            "last_trained_at": main_trained_at,
            "per_fish_model_trained_at": per_fish_model_trained_at,
            **stats,
        },
        "api_model_version": API_MODEL_VERSION,
    }

@app.get("/modelinfo")
async def modelinfo():
    reload_models_if_changed()
    training_meta = collect_model_training_metadata()
    return {
        "features": list(model.feature_names_in_) if model else [],
        "fish_models": [name for name, m in fish_models_map.items() if m is not None],
        "trained_at": training_meta["trained_at"],
        "per_fish_model_trained_at": training_meta["per_fish_model_trained_at"],
        "fish_model_trained_at": training_meta["species_models"],
        "api_model_version": API_MODEL_VERSION,
    }

@app.get("/health")
def health():
    reload_models_if_changed()
    training_meta = collect_model_training_metadata()
    loaded = ["main"] if model is not None else []
    loaded.extend([name for name, m in fish_models_map.items() if m is not None])
    return {
        "status": "ok",
        "models_loaded": loaded,
        "trained_at": training_meta["trained_at"],
        "per_fish_model_trained_at": training_meta["per_fish_model_trained_at"],
        "api_model_version": API_MODEL_VERSION,
    }

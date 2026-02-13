import os
import json
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timezone
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.utils import resample
from scipy.stats import linregress
from supabase import create_client
from dateutil import parser

# =====================================================
# Supabase Zugang
# =====================================================

SUPABASE_URL = "https://kirevrwmmthqgceprbhl.supabase.co"
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcmV2cndtbXRocWdjZXByYmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzU5MzY3OCwiZXhwIjoyMDYzMTY5Njc4fQ.OFce0qhDdeMl6Bd1iM-MEXV1kQ8t1xmgXRJuzFwRRac'
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MODEL_DIR = "/model"
MODEL_METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")
MAIN_MODEL_FILE = "model.joblib"
SPECIES_MODEL_FILES = {
    "Karpfen": "model_karpfen.joblib",
    "Schleie": "model_schleie.joblib",
    "Brasse": "model_brasse.joblib",
    "Rotfeder": "model_rotfeder.joblib",
    "Rotauge": "model_rotauge.joblib",
    "Barsch": "model_barsch.joblib",
    "Karausche": "model_karausche.joblib",
    "Aal": "model_aal.joblib",
}

os.makedirs(MODEL_DIR, exist_ok=True)

# =====================================================
# Biologische Profile (Variante B)
# =====================================================

SPECIES_PROFILE = {
    "aal": {"active_months": [5,6,7,8,9], "min_temp": 12, "type": "warm"},
    "schleie": {"active_months": [6,7,8], "min_temp": 14, "type": "warm"},
    "karpfen": {"active_months": [4,5,6,7,8,9], "min_temp": 10, "type": "warm"},
    "karausche": {"active_months": [5,6,7,8,9], "min_temp": 12, "type": "warm"},
    "brasse": {"active_months": [4,5,6,7,8,9], "min_temp": 8, "type": "moderate"},
    "rotfeder": {"active_months": [4,5,6,7,8,9], "min_temp": 8, "type": "moderate"},
    "hecht": {"active_months": [3,4,5,9,10], "min_temp": 4, "type": "cold"},
    "barsch": {"active_months": list(range(1,13)), "min_temp": 3, "type": "cold"},
    "rotauge": {"active_months": list(range(1,13)), "min_temp": 4, "type": "cold"}
}

# =====================================================
# Hilfsfunktionen
# =====================================================

def parse_ts(ts):
    try:
        return parser.parse(ts)
    except:
        return pd.NaT

def to_weather_dict(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}

def weather_metric(value, key, default=-1):
    weather = to_weather_dict(value)
    metric = weather.get(key, default)
    return default if metric is None else metric

def berechne_steigung(df):
    if len(df) < 3:
        return 0
    df = df.sort_values("timestamp").copy()
    df["timestamp_unix"] = df["timestamp"].astype("int64") // 10**9
    slope, *_ = linregress(df["timestamp_unix"], df["pressure"])
    return round(slope * 60 * 60 * 24, 2)

def iso_utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def file_mtime_iso(path):
    if not os.path.exists(path):
        return None
    dt = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

def latest_iso(values):
    parsed = []
    for value in values:
        if not value:
            continue
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            parsed.append(dt.astimezone(timezone.utc))
        except Exception:
            continue
    if not parsed:
        return None
    return max(parsed).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def write_model_metadata(total_samples, positive_samples, negative_samples):
    now_iso = iso_utc_now()
    main_path = os.path.join(MODEL_DIR, MAIN_MODEL_FILE)
    species_meta = {}

    for species_name, file_name in SPECIES_MODEL_FILES.items():
        trained_at = file_mtime_iso(os.path.join(MODEL_DIR, file_name))
        if trained_at:
            species_meta[species_name] = {
                "file": file_name,
                "trained_at": trained_at,
            }

    metadata = {
        "generated_at": now_iso,
        "models": {
            "main": {
                "file": MAIN_MODEL_FILE,
                "trained_at": file_mtime_iso(main_path) or now_iso,
            },
            "species": species_meta,
        },
        "stats": {
            "total_samples": int(total_samples),
            "positive_samples": int(positive_samples),
            "negative_samples": int(negative_samples),
        },
    }

    metadata["models"]["per_fish_type"] = {
        "trained_at": latest_iso([v.get("trained_at") for v in species_meta.values()])
    }

    with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"✅ Modell-Metadaten gespeichert: {MODEL_METADATA_PATH}")

# =====================================================
# Daten laden
# =====================================================

print("📥 Lade Fänge...")
resp_fish = supabase.table("fishes").select("*").execute()
fish_data = pd.DataFrame(resp_fish.data or [])

print("📥 Lade Schneidertage...")
resp_blank = supabase.table("weather_summary").select("*").execute()
blank_data = pd.DataFrame(resp_blank.data or [])

print("📥 Lade Wetterlog...")
resp_log = supabase.table("weather_log").select("*").execute()
weather_log = pd.DataFrame(resp_log.data or [])
weather_log["timestamp"] = pd.to_datetime(weather_log["timestamp"], utc=True)

# =====================================================
# Fänge vorbereiten
# =====================================================

fish_data["timestamp"] = fish_data["timestamp"].astype(str).apply(parse_ts)
fish_data = fish_data.dropna(subset=["timestamp"]).reset_index(drop=True)

fish_data["hour"] = fish_data["timestamp"].dt.hour
fish_data["hour_sin"] = np.sin(2*np.pi*fish_data["hour"]/24)
fish_data["hour_cos"] = np.cos(2*np.pi*fish_data["hour"]/24)

fish_data["month"] = fish_data["timestamp"].dt.month
fish_data["month_sin"] = np.sin(2*np.pi*fish_data["month"]/12)
fish_data["month_cos"] = np.cos(2*np.pi*fish_data["month"]/12)

if "weather" not in fish_data.columns:
    fish_data["weather"] = [{}] * len(fish_data)

fish_data["temp"] = fish_data["weather"].apply(lambda w: weather_metric(w, "temp", -1))
fish_data["pressure"] = fish_data["weather"].apply(lambda w: weather_metric(w, "pressure", -1))
fish_data["humidity"] = fish_data["weather"].apply(lambda w: weather_metric(w, "humidity", -1))
fish_data["wind"] = fish_data["weather"].apply(lambda w: weather_metric(w, "wind", -1))
fish_data["wind_deg"] = fish_data["weather"].apply(lambda w: weather_metric(w, "wind_deg", -1))
fish_data["moon_phase"] = fish_data["weather"].apply(lambda w: weather_metric(w, "moon_phase", -1))

fish_data["label"] = 1

# Trend hinzufügen
def add_trend(ts):
    ts_prev = ts - pd.Timedelta(days=5)
    df_pressure = weather_log[
        (weather_log["timestamp"] >= ts_prev) &
        (weather_log["timestamp"] < ts)
    ]
    return berechne_steigung(df_pressure)

fish_data["pressure_trend_5d"] = fish_data["timestamp"].apply(add_trend)

fish_data = fish_data.fillna(-1)

# =====================================================
# Schneidertage vorbereiten
# =====================================================

blank_data["timestamp"] = pd.to_datetime(blank_data["caught_at"], utc=True)
blank_data = blank_data.dropna(subset=["timestamp"]).reset_index(drop=True)

blank_data["hour"] = blank_data["timestamp"].dt.hour
blank_data["hour_sin"] = np.sin(2*np.pi*blank_data["hour"]/24)
blank_data["hour_cos"] = np.cos(2*np.pi*blank_data["hour"]/24)

blank_data["month"] = blank_data["timestamp"].dt.month
blank_data["month_sin"] = np.sin(2*np.pi*blank_data["month"]/12)
blank_data["month_cos"] = np.cos(2*np.pi*blank_data["month"]/12)

blank_data["temp"] = blank_data["temp"].fillna(-1)
blank_data["pressure"] = blank_data["pressure"].fillna(-1)
blank_data["humidity"] = blank_data["humidity"].fillna(-1)
blank_data["wind"] = blank_data["wind_speed"].fillna(-1)
blank_data["wind_deg"] = blank_data["wind_deg"].fillna(-1)
blank_data["moon_phase"] = blank_data["moon_phase"].fillna(-1)

blank_data["pressure_trend_5d"] = blank_data["timestamp"].apply(add_trend)

blank_data["label"] = 0
blank_data = blank_data.fillna(-1)

# =====================================================
# Training Hauptmodell
# =====================================================

common_cols = [
    "temp","pressure","humidity","wind","wind_deg","moon_phase",
    "hour_sin","hour_cos",
    "month_sin","month_cos",
    "pressure_trend_5d",
    "label"
]

data = pd.concat([
    fish_data[common_cols],
    blank_data[common_cols]
]).reset_index(drop=True)

X = data.drop(columns=["label"])
y = data["label"]

fang = X[y==1]
schneider = X[y==0]

schneider_up = resample(
    schneider,
    replace=True,
    n_samples=len(fang),
    random_state=42
)

X_bal = pd.concat([fang, schneider_up])
y_bal = pd.Series([1]*len(fang) + [0]*len(schneider_up))

X_train, X_test, y_train, y_test = train_test_split(
    X_bal, y_bal, test_size=0.3, random_state=42
)

print("🚀 Trainiere Modell...")
model = RandomForestClassifier(
    n_estimators=200,
    class_weight="balanced",
    random_state=42
)

model.fit(X_train, y_train)

print("\n📊 Testreport:")
print(classification_report(y_test, model.predict(X_test)))

main_model_path = os.path.join(MODEL_DIR, MAIN_MODEL_FILE)
joblib.dump(model, main_model_path)
print("✅ Modell gespeichert")
write_model_metadata(
    total_samples=len(data),
    positive_samples=(data["label"] == 1).sum(),
    negative_samples=(data["label"] == 0).sum(),
)

# =====================================================
# BIOLOGISCHE DÄMPFUNG (Variante B)
# =====================================================

def apply_biological_weighting(fish_type, month, temp, base_proba):

    profile = SPECIES_PROFILE.get(fish_type.lower())
    if not profile:
        return base_proba

    weight = 1.0

    # Saison
    if month not in profile["active_months"]:
        weight *= 0.35

    # Temperatur unter Mindestwert
    if temp < profile["min_temp"]:
        weight *= 0.4

    # Warmwasserarten stark dämpfen im Winter
    if profile["type"] == "warm":
        if month in [11,12,1,2]:
            weight *= 0.2
        if temp < 8:
            weight *= 0.25

    # Moderate Arten
    if profile["type"] == "moderate":
        if month in [12,1,2]:
            weight *= 0.4

    # Aal extra streng
    if fish_type.lower() == "aal":
        if temp < 8:
            weight *= 0.15
        if month in [11,12,1,2]:
            weight *= 0.15

    adjusted = base_proba * weight

    # niemals komplett 0
    return max(adjusted, 0.01)

# =====================================================
# Beispiel Forecast-Funktion
# =====================================================

def predict_for_species(model, X_input, fish_type, temp):
    base_proba = model.predict_proba(X_input)[0][1]
    month = datetime.now().month
    final = apply_biological_weighting(fish_type, month, temp, base_proba)
    return round(final * 100, 1)

print("🎯 Training abgeschlossen.")

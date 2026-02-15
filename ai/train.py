import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from dateutil import parser
from scipy.stats import linregress
from sklearn.ensemble import RandomForestClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.utils import resample
from supabase import create_client

# =====================================================
# Supabase Zugang
# =====================================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kirevrwmmthqgceprbhl.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_KEY:
    raise RuntimeError("Missing Supabase service key. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MODEL_DIR = "/model"
MODEL_METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")
MAIN_MODEL_FILE = "model.joblib"
MAIN_FROM_SPECIES_MODEL_FILE = "model_main_from_species.joblib"
CALIBRATORS_FILE = "probability_calibrators.joblib"
SPECIES_MODEL_FILES = {
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
SPECIES_NAME_MAP = {name.lower(): name for name in SPECIES_MODEL_FILES.keys()}

FEATURE_COLUMNS = [
    "temp",
    "pressure",
    "humidity",
    "wind",
    "wind_deg",
    "moon_phase",
    "hour_sin",
    "hour_cos",
    "month_sin",
    "month_cos",
    "pressure_trend_5d",
    "temp_mean_3d",
    "temp_volatility_3d",
]

RANDOM_STATE = 42
NEGATIVE_MULTIPLIER_MAIN = 1.45
NEGATIVE_MULTIPLIER_SPECIES = 1.6
MIN_SPECIES_POSITIVE = 10
MIN_CALIBRATION_SAMPLES = 80
MIN_CALIBRATION_CLASS_SAMPLES = 20
CALIBRATION_HOLDOUT_SIZE = 0.25
CALIBRATION_BLEND_BASE = 220.0
MAIN_CALIBRATION_PRIOR = 0.50
MAIN_META_CALIBRATION_CAP = 0.90
MAIN_BASE_CALIBRATION_CAP = 0.94
SPECIES_CALIBRATION_CAP = 0.92
PRESSURE_PA_THRESHOLD = 2000.0
PRESSURE_HPA_MIN = 850.0
PRESSURE_HPA_MAX = 1100.0
PRESSURE_TREND_CLIP_HPA_PER_DAY = 25.0

os.makedirs(MODEL_DIR, exist_ok=True)


# =====================================================
# Hilfsfunktionen
# =====================================================
def parse_ts(ts):
    try:
        return parser.parse(ts)
    except Exception:
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


def weather_metric(value, key, default=-1.0):
    weather = to_weather_dict(value)
    metric = weather.get(key, default)
    if metric is None:
        return default
    try:
        return float(metric)
    except Exception:
        return default


def to_numeric_series(df, col_name, default=-1.0):
    if col_name in df.columns:
        return pd.to_numeric(df[col_name], errors="coerce").fillna(default).astype(float)
    return pd.Series(default, index=df.index, dtype=float)

def normalize_pressure_to_hpa(value):
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

def normalize_pressure_series(values):
    if values is None:
        return pd.Series(dtype=float)
    numeric = pd.to_numeric(values, errors="coerce")
    if isinstance(numeric, pd.Series):
        return numeric.apply(normalize_pressure_to_hpa)
    return pd.Series([normalize_pressure_to_hpa(numeric)], dtype=float)

def normalize_pressure_feature_series(values, fallback=-1.0):
    normalized = normalize_pressure_series(values)
    return normalized.fillna(float(fallback)).astype(float)


def berechne_steigung(df):
    if len(df) < 3:
        return 0.0
    df = df.dropna(subset=["timestamp", "pressure"]).sort_values("timestamp").copy()
    df["pressure"] = normalize_pressure_series(df["pressure"])
    df = df.dropna(subset=["timestamp", "pressure"]).copy()
    if len(df) < 3:
        return 0.0
    df["timestamp_unix"] = df["timestamp"].astype("int64") // 10**9
    slope, *_ = linregress(df["timestamp_unix"], df["pressure"])
    trend_hpa_per_day = float(slope) * 60 * 60 * 24
    if not np.isfinite(trend_hpa_per_day):
        return 0.0
    trend_hpa_per_day = float(np.clip(
        trend_hpa_per_day,
        -PRESSURE_TREND_CLIP_HPA_PER_DAY,
        PRESSURE_TREND_CLIP_HPA_PER_DAY,
    ))
    return round(trend_hpa_per_day, 2)


def trend_features_for_ts(ts, weather_log):
    if weather_log.empty:
        return {
            "pressure_trend_5d": 0.0,
            "temp_mean_3d": 0.0,
            "temp_volatility_3d": 0.0,
        }

    df_pressure = weather_log[
        (weather_log["timestamp"] >= ts - pd.Timedelta(days=5))
        & (weather_log["timestamp"] < ts)
    ]
    df_temp = weather_log[
        (weather_log["timestamp"] >= ts - pd.Timedelta(days=3))
        & (weather_log["timestamp"] < ts)
    ]

    temp_mean = float(df_temp["temp"].mean()) if len(df_temp) >= 2 else 0.0
    temp_volatility = float(df_temp["temp"].std()) if len(df_temp) >= 2 else 0.0
    if np.isnan(temp_mean):
        temp_mean = 0.0
    if np.isnan(temp_volatility):
        temp_volatility = 0.0

    return {
        "pressure_trend_5d": berechne_steigung(df_pressure),
        "temp_mean_3d": temp_mean,
        "temp_volatility_3d": temp_volatility,
    }


def add_time_features(df):
    df["hour"] = df["timestamp"].dt.hour
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["month"] = df["timestamp"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    return df


def add_trend_features(df, weather_log):
    if df.empty:
        df["pressure_trend_5d"] = pd.Series(dtype=float)
        df["temp_mean_3d"] = pd.Series(dtype=float)
        df["temp_volatility_3d"] = pd.Series(dtype=float)
        return df

    trend_rows = df["timestamp"].apply(lambda ts: trend_features_for_ts(ts, weather_log))
    trend_df = pd.DataFrame(list(trend_rows), index=df.index)
    return pd.concat([df, trend_df], axis=1)


def normalize_species_name(value):
    key = str(value or "").strip().lower()
    return SPECIES_NAME_MAP.get(key)


def build_balanced_training_frame(positive_df, negative_df, negative_multiplier=1.0):
    if positive_df.empty or negative_df.empty:
        return None

    target_negative = max(1, int(len(positive_df) * negative_multiplier))
    negative_sample = resample(
        negative_df,
        replace=len(negative_df) < target_negative,
        n_samples=target_negative,
        random_state=RANDOM_STATE,
    )

    pos = positive_df.copy()
    neg = negative_sample.copy()
    pos["label"] = 1
    neg["label"] = 0
    combined = pd.concat([pos, neg], ignore_index=True)
    return combined.sample(frac=1.0, random_state=RANDOM_STATE).reset_index(drop=True)


def split_train_test(X, y, test_size=0.25):
    if y.nunique() < 2 or y.value_counts().min() < 2:
        return X, X, y, y
    return train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=RANDOM_STATE,
        stratify=y,
    )


def split_observed_for_calibration(positive_df, negative_df, holdout_size=CALIBRATION_HOLDOUT_SIZE):
    pos = positive_df.copy()
    neg = negative_df.copy()
    pos["label"] = 1
    neg["label"] = 0
    observed = pd.concat([pos, neg], ignore_index=True)
    observed = observed.sample(frac=1.0, random_state=RANDOM_STATE).reset_index(drop=True)

    if observed["label"].nunique() < 2 or observed["label"].value_counts().min() < 2:
        return (
            positive_df.copy(),
            negative_df.copy(),
            observed[FEATURE_COLUMNS].copy(),
            observed["label"].astype(int).copy(),
        )

    train_observed, calib_observed = train_test_split(
        observed,
        test_size=holdout_size,
        random_state=RANDOM_STATE,
        stratify=observed["label"],
    )
    train_positive = train_observed[train_observed["label"] == 1][FEATURE_COLUMNS].copy()
    train_negative = train_observed[train_observed["label"] == 0][FEATURE_COLUMNS].copy()
    X_calib = calib_observed[FEATURE_COLUMNS].copy()
    y_calib = calib_observed["label"].astype(int).copy()
    return train_positive, train_negative, X_calib, y_calib


def fit_random_forest(X_train, y_train, class_weight):
    model = RandomForestClassifier(
        n_estimators=350,
        max_depth=14,
        min_samples_leaf=6,
        min_samples_split=14,
        class_weight=class_weight,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model


def get_probability_for_class_1(model, X_df: pd.DataFrame) -> np.ndarray:
    proba = model.predict_proba(X_df)
    classes = list(getattr(model, "classes_", []))
    if 1 in classes:
        idx = classes.index(1)
        return proba[:, idx]
    if proba.shape[1] > 1:
        return proba[:, -1]
    return np.zeros(len(X_df), dtype=float)


def fit_probability_calibrator(probabilities, labels):
    probs = np.asarray(probabilities, dtype=float)
    y = np.asarray(labels, dtype=int)

    if len(probs) < MIN_CALIBRATION_SAMPLES:
        return None, "too_few_samples"

    unique, counts = np.unique(y, return_counts=True)
    class_counts = dict(zip(unique.tolist(), counts.tolist()))
    if len(class_counts) < 2:
        return None, "single_class"
    if min(class_counts.values()) < MIN_CALIBRATION_CLASS_SAMPLES:
        return None, "class_imbalance"

    probs = np.clip(probs, 0.0, 1.0)
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(probs, y)
    return calibrator, "ok"


def build_calibrator_entry(calibrator, y_calib, status, cap, prior_override=None):
    y = np.asarray(y_calib, dtype=int)
    samples = int(len(y))
    prior = float(np.mean(y)) if samples > 0 else 0.5
    if prior_override is not None:
        prior = float(prior_override)
    blend_weight = float(samples / (samples + CALIBRATION_BLEND_BASE)) if samples > 0 else 0.0
    if calibrator is None:
        blend_weight = 0.0
    return {
        "model": calibrator,
        "prior": prior,
        "blend_weight": blend_weight,
        "cap": float(cap),
        "status": status,
        "samples": samples,
    }


def clamp_probability_array(values):
    arr = np.asarray(values, dtype=float)
    return np.clip(arr, 0.0, 0.999)


def apply_calibrator_entry_to_probabilities(probabilities, calibrator_entry):
    probs = clamp_probability_array(probabilities)
    if calibrator_entry is None:
        return probs

    if isinstance(calibrator_entry, dict):
        calibrator = calibrator_entry.get("model") or calibrator_entry.get("calibrator")
        prior = calibrator_entry.get("prior")
        blend_weight = calibrator_entry.get("blend_weight", 1.0 if calibrator is not None else 0.0)
        cap = calibrator_entry.get("cap")
    else:
        calibrator = calibrator_entry
        prior = None
        blend_weight = 1.0
        cap = None

    calibrated = probs.copy()
    if calibrator is not None:
        try:
            calibrated = np.asarray(calibrator.predict(probs), dtype=float)
        except Exception:
            calibrated = probs
    calibrated = clamp_probability_array(calibrated)

    if prior is not None:
        try:
            prior_f = float(np.clip(float(prior), 0.0, 0.999))
            blend = float(np.clip(float(blend_weight), 0.0, 1.0))
            calibrated = prior_f + (calibrated - prior_f) * blend
        except Exception:
            pass

    if cap is not None:
        try:
            calibrated = np.minimum(calibrated, float(np.clip(float(cap), 0.0, 0.999)))
        except Exception:
            pass

    return clamp_probability_array(calibrated)


def species_meta_feature_name(species_name):
    return f"species_{str(species_name).strip().lower()}"


def build_species_meta_feature_frame(source_features_df, trained_species_models, species_calibrators):
    if source_features_df.empty:
        return pd.DataFrame(columns=[species_meta_feature_name(name) for name in SPECIES_MODEL_FILES.keys()])

    rows = {}
    for species_name in SPECIES_MODEL_FILES.keys():
        col_name = species_meta_feature_name(species_name)
        model = trained_species_models.get(species_name)
        if model is None:
            rows[col_name] = np.zeros(len(source_features_df), dtype=float)
            continue
        raw_proba = get_probability_for_class_1(model, source_features_df[FEATURE_COLUMNS])
        calibrated_proba = apply_calibrator_entry_to_probabilities(
            raw_proba,
            species_calibrators.get(species_name),
        )
        rows[col_name] = calibrated_proba

    return pd.DataFrame(rows, index=source_features_df.index)


def iso_utc_now():
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


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


def write_model_metadata(
    total_samples,
    positive_samples,
    negative_samples,
    species_stats,
    calibration_stats,
    serving_main_model_file,
    serving_main_model_source,
):
    now_iso = iso_utc_now()
    main_base_path = os.path.join(MODEL_DIR, MAIN_MODEL_FILE)
    main_meta_path = os.path.join(MODEL_DIR, MAIN_FROM_SPECIES_MODEL_FILE)
    calibrator_path = os.path.join(MODEL_DIR, CALIBRATORS_FILE)
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
                "file": serving_main_model_file,
                "trained_at": file_mtime_iso(os.path.join(MODEL_DIR, serving_main_model_file)) or now_iso,
                "source": serving_main_model_source,
            },
            "main_base": {
                "file": MAIN_MODEL_FILE,
                "trained_at": file_mtime_iso(main_base_path),
            },
            "main_from_species": {
                "file": MAIN_FROM_SPECIES_MODEL_FILE,
                "trained_at": file_mtime_iso(main_meta_path),
            },
            "species": species_meta,
            "per_fish_type": {
                "trained_at": latest_iso([v.get("trained_at") for v in species_meta.values()])
            },
            "calibrators": {
                "file": CALIBRATORS_FILE,
                "trained_at": file_mtime_iso(calibrator_path),
            },
        },
        "stats": {
            "total_samples": int(total_samples),
            "positive_samples": int(positive_samples),
            "negative_samples": int(negative_samples),
            "serving_main_model_file": serving_main_model_file,
            "serving_main_model_source": serving_main_model_source,
            "species_training": species_stats,
            "calibration": calibration_stats,
        },
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
if not weather_log.empty:
    weather_log["timestamp"] = pd.to_datetime(weather_log["timestamp"], utc=True, errors="coerce")
    weather_log = weather_log.dropna(subset=["timestamp"]).reset_index(drop=True)
    weather_log["pressure"] = normalize_pressure_series(weather_log.get("pressure"))
    weather_log["temp"] = to_numeric_series(weather_log, "temp", default=np.nan)
else:
    weather_log = pd.DataFrame(columns=["timestamp", "pressure", "temp"])

if fish_data.empty:
    raise RuntimeError("Keine Fangdaten gefunden (Tabelle fishes leer).")
if blank_data.empty:
    raise RuntimeError("Keine Schneidersessions gefunden (Tabelle weather_summary leer).")


# =====================================================
# Fänge vorbereiten
# =====================================================
if "timestamp" not in fish_data.columns:
    raise RuntimeError("Spalte 'timestamp' fehlt in fishes.")

fish_data["timestamp"] = fish_data["timestamp"].astype(str).apply(parse_ts)
fish_data = fish_data.dropna(subset=["timestamp"]).reset_index(drop=True)
fish_data = add_time_features(fish_data)

if "weather" not in fish_data.columns:
    fish_data["weather"] = [{}] * len(fish_data)

fish_data["temp"] = fish_data["weather"].apply(lambda w: weather_metric(w, "temp", -1))
fish_data["pressure"] = fish_data["weather"].apply(lambda w: weather_metric(w, "pressure", -1))
fish_data["pressure"] = normalize_pressure_feature_series(fish_data["pressure"], fallback=-1.0)
fish_data["humidity"] = fish_data["weather"].apply(lambda w: weather_metric(w, "humidity", -1))
fish_data["wind"] = fish_data["weather"].apply(lambda w: weather_metric(w, "wind", -1))
fish_data["wind_deg"] = fish_data["weather"].apply(lambda w: weather_metric(w, "wind_deg", -1))
fish_data["moon_phase"] = fish_data["weather"].apply(lambda w: weather_metric(w, "moon_phase", -1))
fish_data = add_trend_features(fish_data, weather_log)

if "fish" in fish_data.columns:
    fish_data["species_name"] = fish_data["fish"].apply(normalize_species_name)
else:
    fish_data["species_name"] = None

fish_data = fish_data.fillna(-1)


# =====================================================
# Schneidertage vorbereiten
# =====================================================
timestamp_col = "caught_at" if "caught_at" in blank_data.columns else "timestamp"
blank_data["timestamp"] = pd.to_datetime(blank_data[timestamp_col], utc=True, errors="coerce")
blank_data = blank_data.dropna(subset=["timestamp"]).reset_index(drop=True)
blank_data = add_time_features(blank_data)

blank_data["temp"] = to_numeric_series(blank_data, "temp", -1)
blank_data["pressure"] = to_numeric_series(blank_data, "pressure", -1)
blank_data["pressure"] = normalize_pressure_feature_series(blank_data["pressure"], fallback=-1.0)
blank_data["humidity"] = to_numeric_series(blank_data, "humidity", -1)
if "wind_speed" in blank_data.columns:
    blank_data["wind"] = to_numeric_series(blank_data, "wind_speed", -1)
else:
    blank_data["wind"] = to_numeric_series(blank_data, "wind", -1)
blank_data["wind_deg"] = to_numeric_series(blank_data, "wind_deg", -1)
blank_data["moon_phase"] = to_numeric_series(blank_data, "moon_phase", -1)
blank_data = add_trend_features(blank_data, weather_log)
blank_data = blank_data.fillna(-1)


# =====================================================
# Training Basis-Hauptmodell (Fallback)
# =====================================================
main_positive = fish_data[FEATURE_COLUMNS].copy()
main_negative = blank_data[FEATURE_COLUMNS].copy()
main_train_positive, main_train_negative, X_main_calib, y_main_calib = split_observed_for_calibration(
    main_positive,
    main_negative,
)
main_train_df = build_balanced_training_frame(
    main_train_positive,
    main_train_negative,
    negative_multiplier=NEGATIVE_MULTIPLIER_MAIN,
)
if main_train_df is None:
    raise RuntimeError("Basis-Hauptmodell kann nicht trainiert werden (zu wenig positive/negative Daten).")

X_main = main_train_df[FEATURE_COLUMNS]
y_main = main_train_df["label"].astype(int)
X_train, X_test, y_train, y_test = split_train_test(X_main, y_main)

print("🚀 Trainiere Basis-Hauptmodell...")
main_model = fit_random_forest(X_train, y_train, class_weight={0: 1.5, 1: 1.0})
print("\n📊 Basis-Hauptmodell Testreport:")
print(classification_report(y_test, main_model.predict(X_test), zero_division=0))

main_base_calibration_stats = {
    "samples": int(len(y_main_calib)),
    "positive_samples": int((y_main_calib == 1).sum()),
    "negative_samples": int((y_main_calib == 0).sum()),
    "status": "skipped",
}
main_base_calibration_proba = get_probability_for_class_1(main_model, X_main_calib)
main_base_calibrator, main_base_calibration_reason = fit_probability_calibrator(
    main_base_calibration_proba,
    y_main_calib,
)
main_base_calibration_stats["status"] = main_base_calibration_reason
main_base_calibration_stats["trained"] = main_base_calibrator is not None
main_base_calibrator_entry = build_calibrator_entry(
    calibrator=main_base_calibrator,
    y_calib=y_main_calib,
    status=main_base_calibration_reason,
    cap=MAIN_BASE_CALIBRATION_CAP,
    prior_override=MAIN_CALIBRATION_PRIOR,
)

main_model_path = os.path.join(MODEL_DIR, MAIN_MODEL_FILE)
joblib.dump(main_model, main_model_path)
print(f"✅ Basis-Hauptmodell gespeichert: {main_model_path}")


# =====================================================
# Training Fischarten-Modelle (One-vs-Rest)
# =====================================================
species_stats = {}
species_calibrators = {}
trained_species_models = {}
calibration_stats = {
    "main": {},
    "main_base": main_base_calibration_stats,
    "species": {},
}
for species_name, file_name in SPECIES_MODEL_FILES.items():
    species_positive = fish_data[fish_data["species_name"] == species_name][FEATURE_COLUMNS].copy()
    species_negative_pool = pd.concat(
        [
            blank_data[FEATURE_COLUMNS].copy(),
            fish_data[fish_data["species_name"] != species_name][FEATURE_COLUMNS].copy(),
        ],
        ignore_index=True,
    )
    species_train_positive, species_train_negative, X_species_calib, y_species_calib = split_observed_for_calibration(
        species_positive,
        species_negative_pool,
    )

    species_stats[species_name] = {
        "positive_samples": int(len(species_positive)),
        "negative_pool_samples": int(len(species_negative_pool)),
        "trained": False,
        "calibrated": False,
    }
    calibration_stats["species"][species_name] = {
        "samples": 0,
        "positive_samples": 0,
        "negative_samples": 0,
        "status": "skipped",
        "trained": False,
    }

    if len(species_train_positive) < MIN_SPECIES_POSITIVE:
        print(
            f"⚠️ {species_name}: zu wenige positive Samples "
            f"({len(species_train_positive)} < {MIN_SPECIES_POSITIVE}), Modell bleibt unverändert."
        )
        calibration_stats["species"][species_name]["status"] = "too_few_positive_samples"
        continue

    species_train_df = build_balanced_training_frame(
        species_train_positive,
        species_train_negative,
        negative_multiplier=NEGATIVE_MULTIPLIER_SPECIES,
    )
    if species_train_df is None:
        print(f"⚠️ {species_name}: zu wenig Daten für Training, Modell bleibt unverändert.")
        calibration_stats["species"][species_name]["status"] = "insufficient_training_data"
        continue

    X_species = species_train_df[FEATURE_COLUMNS]
    y_species = species_train_df["label"].astype(int)
    Xs_train, Xs_test, ys_train, ys_test = split_train_test(X_species, y_species)

    species_model = fit_random_forest(Xs_train, ys_train, class_weight={0: 1.35, 1: 1.0})
    print(f"\n📊 {species_name}-Modell Testreport:")
    print(classification_report(ys_test, species_model.predict(Xs_test), zero_division=0))

    species_calibration_proba = get_probability_for_class_1(species_model, X_species_calib)
    species_calibrator, species_calibration_reason = fit_probability_calibrator(
        species_calibration_proba,
        y_species_calib,
    )
    species_calibrators[species_name] = build_calibrator_entry(
        calibrator=species_calibrator,
        y_calib=y_species_calib,
        status=species_calibration_reason,
        cap=SPECIES_CALIBRATION_CAP,
    )

    species_model_path = os.path.join(MODEL_DIR, file_name)
    joblib.dump(species_model, species_model_path)
    trained_species_models[species_name] = species_model
    species_stats[species_name]["trained"] = True
    species_stats[species_name]["model_samples"] = int(len(species_train_df))
    species_stats[species_name]["calibrated"] = species_calibrator is not None

    calibration_stats["species"][species_name] = {
        "samples": int(len(y_species_calib)),
        "positive_samples": int((y_species_calib == 1).sum()),
        "negative_samples": int((y_species_calib == 0).sum()),
        "status": species_calibration_reason,
        "trained": species_calibrator is not None,
    }
    print(f"✅ {species_name}-Modell gespeichert: {species_model_path}")


# =====================================================
# Training Hauptmodell aus Fischmodellen (Serving-Modell)
# =====================================================
serving_main_model_file = MAIN_MODEL_FILE
serving_main_model_source = "base_main_model_fallback"
main_calibrator_entry = main_base_calibrator_entry
main_calibration_stats = {
    "samples": int(len(y_main_calib)),
    "positive_samples": int((y_main_calib == 1).sum()),
    "negative_samples": int((y_main_calib == 0).sum()),
    "status": "fallback_to_base_main",
    "trained": bool(main_base_calibrator is not None),
}

if len(trained_species_models) > 0:
    meta_train_positive, meta_train_negative, X_meta_calib_source, y_meta_calib = split_observed_for_calibration(
        main_positive,
        main_negative,
    )
    meta_train_df = build_balanced_training_frame(
        meta_train_positive,
        meta_train_negative,
        negative_multiplier=NEGATIVE_MULTIPLIER_MAIN,
    )

    if meta_train_df is not None:
        X_meta_source = meta_train_df[FEATURE_COLUMNS]
        y_meta = meta_train_df["label"].astype(int)
        X_meta = build_species_meta_feature_frame(X_meta_source, trained_species_models, species_calibrators)
        Xm_train, Xm_test, ym_train, ym_test = split_train_test(X_meta, y_meta)

        print("\n🚀 Trainiere Hauptmodell aus Fischmodell-Prognosen...")
        main_from_species_model = fit_random_forest(Xm_train, ym_train, class_weight={0: 1.25, 1: 1.0})
        print("\n📊 Hauptmodell-aus-Fischmodellen Testreport:")
        print(classification_report(ym_test, main_from_species_model.predict(Xm_test), zero_division=0))

        X_meta_calib = build_species_meta_feature_frame(
            X_meta_calib_source,
            trained_species_models,
            species_calibrators,
        )
        main_meta_calibration_proba = get_probability_for_class_1(main_from_species_model, X_meta_calib)
        main_meta_calibrator, main_meta_calibration_reason = fit_probability_calibrator(
            main_meta_calibration_proba,
            y_meta_calib,
        )
        main_calibration_stats = {
            "samples": int(len(y_meta_calib)),
            "positive_samples": int((y_meta_calib == 1).sum()),
            "negative_samples": int((y_meta_calib == 0).sum()),
            "status": main_meta_calibration_reason,
            "trained": main_meta_calibrator is not None,
            "species_models_used": sorted(list(trained_species_models.keys())),
        }
        main_calibrator_entry = build_calibrator_entry(
            calibrator=main_meta_calibrator,
            y_calib=y_meta_calib,
            status=main_meta_calibration_reason,
            cap=MAIN_META_CALIBRATION_CAP,
            prior_override=MAIN_CALIBRATION_PRIOR,
        )

        main_from_species_path = os.path.join(MODEL_DIR, MAIN_FROM_SPECIES_MODEL_FILE)
        joblib.dump(main_from_species_model, main_from_species_path)
        print(f"✅ Hauptmodell-aus-Fischmodellen gespeichert: {main_from_species_path}")

        serving_main_model_file = MAIN_FROM_SPECIES_MODEL_FILE
        serving_main_model_source = "species_meta_model"
    else:
        main_calibration_stats["status"] = "meta_training_insufficient_data"
else:
    main_calibration_stats["status"] = "meta_training_no_species_models"

calibration_stats["main"] = main_calibration_stats

calibrators_payload = {
    "main": main_calibrator_entry,
    "main_base": main_base_calibrator_entry,
    "species": species_calibrators,
    "main_model_source": serving_main_model_source,
    "trained_at": iso_utc_now(),
}
calibrators_path = os.path.join(MODEL_DIR, CALIBRATORS_FILE)
joblib.dump(calibrators_payload, calibrators_path)
print(f"✅ Kalibratoren gespeichert: {calibrators_path}")


write_model_metadata(
    total_samples=len(fish_data) + len(blank_data),
    positive_samples=len(fish_data),
    negative_samples=len(blank_data),
    species_stats=species_stats,
    calibration_stats=calibration_stats,
    serving_main_model_file=serving_main_model_file,
    serving_main_model_source=serving_main_model_source,
)

print("🎯 Training abgeschlossen.")

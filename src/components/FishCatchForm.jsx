// src/components/FishCatchForm.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// Utils
import { validateCatchForm } from "@/utils/validation";
import { getDistanceMeters, reverseGeocode } from "@/utils/geo";
import { parseFloatLocale } from "@/utils/number";
import { fishListForRegion, DEFAULT_REGION_OPTIONS } from "@/constants/fishRegions";
import { getActiveClubId } from "@/utils/clubId";

// Services
import { processAndUploadImage } from "@/services/imageProcessing";
import { loadWeatherForPosition } from "@/services/weatherService";
import { fetchLatestWaterTemperature } from "@/services/waterTemperatureService";
import { saveBlankDay } from "@/services/blankService";
import { saveCatchEntry } from "@/services/catchService";
import { fetchFishRegionCatalog } from "@/services/fishRegionsService";
import { fetchRuleSpeciesForContext } from "@/services/rulesService";
import {
  getNearestMatchingWaterbody,
  listWaterbodiesByClub,
} from "@/services/waterbodiesService";

// Hooks & UI
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useGeoPosition } from "@/hooks/useGeoPosition";
import RegionSelect from "@/components/form/RegionSelect";
import FishSelect from "@/components/form/FishSelect";
import PhotoPicker from "@/components/form/PhotoPicker";
import HourDialog from "@/components/dialogs/HourDialog";
import TakenDialog from "@/components/dialogs/TakenDialog";
import { useWeatherCache } from "@/hooks/useWeatherCache";

// Achievements (optional/best-effort)
import { supabase } from "@/supabaseClient";
import { useAchievements } from "@/achievements/useAchievements";
import { localRemember } from "@/achievements/localRemember";

const WATERBODY_STORAGE_KEY = "angelwetter_selected_waterbody_id";
const HOMEWATER_MISMATCH_TOLERANCE_M = 200;

export default function FishCatchForm({
  showEffect,                // Achievement-Effekt triggern
  anglerName: propAnglerName // optional vorgegeben
}) {
  // --- Form State ---
  const [fish, setFish] = useState("");
  const [size, setSize] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  // Medien
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Dialoge
  const [hours, setHours] = useState(4);
  const [fishingType, setFishingType] = useState("Allround");
  const [showHourDialog, setShowHourDialog] = useState(false);
  const [showTakenDialog, setShowTakenDialog] = useState(false);

  // Busy Flags
  const [loadingCatch, setLoadingCatch] = useState(false);
  const [loadingBlank, setLoadingBlank] = useState(false);
  const [savingCatch, setSavingCatch] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const savingCatchRef = useRef(false);

  // Misc
  const navigate = useNavigate();
  const { clubSlug } = useParams();
  const clubBasePath = clubSlug ? `/${clubSlug}` : '';
  const { position } = useGeoPosition();
  const { weather: cachedWeather, updateWeather } = useWeatherCache();

  // Achievement-Layer aus dem Router-Kontext, falls Prop nicht gesetzt ist
  const outletContext = useOutletContext() ?? {};
  const contextShowEffect = outletContext.showEffect;
  const effectiveShowEffect = typeof showEffect === "function"
    ? showEffect
    : (typeof contextShowEffect === "function" ? contextShowEffect : null);

  // Region mit Persistenz
  const [region, setRegion] = useLocalStorage("fishRegion", "ferkensbruch");
  const [regionOptions, setRegionOptions] = useState(DEFAULT_REGION_OPTIONS);
  const [regionFishMap, setRegionFishMap] = useState({});
  const [clubScopedFishList, setClubScopedFishList] = useState(null);
  const [waterbodies, setWaterbodies] = useState([]);
  const [selectedWaterbodyId, setSelectedWaterbodyId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(WATERBODY_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [autoDetectedWaterbodyId, setAutoDetectedWaterbodyId] = useState(null);
  const [detectedDistanceM, setDetectedDistanceM] = useState(null);
  const [waterbodyManuallySelected, setWaterbodyManuallySelected] = useState(false);
  const [clubContextTick, setClubContextTick] = useState(0);
  const [gpsMismatchWarning, setGpsMismatchWarning] = useState(null);
  const waterbodySelectRef = useRef(null);

  const selectedWaterbody = useMemo(
    () => waterbodies.find((entry) => entry.id === selectedWaterbodyId) || null,
    [selectedWaterbodyId, waterbodies],
  );
  const isHomeWaterRegion = typeof region === "string" && region.toLowerCase() === "ferkensbruch";
  const hasClubWaterContext = isHomeWaterRegion;

  const fishList = useMemo(() => {
    if (hasClubWaterContext) {
      if (Array.isArray(clubScopedFishList) && clubScopedFishList.length > 0) return clubScopedFishList;
      return fishListForRegion(region);
    }
    const dynamicList = regionFishMap?.[region];
    if (Array.isArray(dynamicList)) return dynamicList;
    return fishListForRegion(region);
  }, [clubScopedFishList, hasClubWaterContext, region, regionFishMap]);
  const currentRegionLabel = useMemo(
    () => regionOptions.find((entry) => entry?.id === region)?.label || region,
    [region, regionOptions],
  );

  // Name-Quelle: Prop > localStorage
  const anglerName = propAnglerName || localStorage.getItem("anglerName") || "Unbekannt";

  // Achievements (best-effort; nicht kritisch)
  const { checkOnNewCatch } = useAchievements({
    supabase,
    showEffect: effectiveShowEffect,
    remember: localRemember,
  });

  // Falls Region geändert wurde und aktuelle Fischart dort nicht existiert → zurücksetzen
  useEffect(() => {
    if (fish && !fishList.includes(fish)) setFish("");
  }, [fishList, fish]);

  useEffect(() => {
    let active = true;
    (async () => {
      const catalog = await fetchFishRegionCatalog();
      if (!active) return;
      if (Array.isArray(catalog.regionOptions) && catalog.regionOptions.length > 0) {
        setRegionOptions(catalog.regionOptions);
      }
      if (catalog.regionFishMap && typeof catalog.regionFishMap === "object") {
        setRegionFishMap(catalog.regionFishMap);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => setClubContextTick((prev) => prev + 1);
    window.addEventListener("angelwetter:club-context-changed", handler);
    return () => window.removeEventListener("angelwetter:club-context-changed", handler);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const clubId = getActiveClubId();
        if (!clubId) {
          if (!active) return;
          setWaterbodies([]);
          setSelectedWaterbodyId("");
          setAutoDetectedWaterbodyId(null);
          setDetectedDistanceM(null);
          setWaterbodyManuallySelected(false);
          return;
        }

        const nextWaterbodies = await listWaterbodiesByClub(clubId, { activeOnly: true });
        if (!active) return;
        const firstWaterbodyId = nextWaterbodies?.[0]?.id || "";
        let rememberedWaterbodyId = "";
        try {
          rememberedWaterbodyId = window.localStorage.getItem(WATERBODY_STORAGE_KEY) || "";
        } catch {
          rememberedWaterbodyId = "";
        }
        const keepRememberedSelection = Boolean(
          rememberedWaterbodyId
          && nextWaterbodies.some((entry) => entry?.id === rememberedWaterbodyId),
        );
        setWaterbodies(Array.isArray(nextWaterbodies) ? nextWaterbodies : []);
        setSelectedWaterbodyId(keepRememberedSelection ? rememberedWaterbodyId : firstWaterbodyId);
        setAutoDetectedWaterbodyId(null);
        setDetectedDistanceM(null);
        setWaterbodyManuallySelected(keepRememberedSelection);
      } catch {
        if (!active) return;
        setWaterbodies([]);
        setSelectedWaterbodyId("");
        setAutoDetectedWaterbodyId(null);
        setDetectedDistanceM(null);
        setWaterbodyManuallySelected(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clubContextTick]);

  useEffect(() => {
    const match = getNearestMatchingWaterbody({
      waterbodies,
      lat: position?.lat,
      lon: position?.lon,
    });

    if (!match) {
      setAutoDetectedWaterbodyId(null);
      setDetectedDistanceM(null);
      if (!waterbodyManuallySelected && isHomeWaterRegion) {
        setSelectedWaterbodyId(waterbodies?.[0]?.id || "");
      }
      return;
    }

    const matchedId = match.waterbody?.id || "";
    setAutoDetectedWaterbodyId(matchedId || null);
    setDetectedDistanceM(match.distance_m ?? null);
    if (!waterbodyManuallySelected && isHomeWaterRegion && matchedId) {
      setSelectedWaterbodyId(matchedId);
    }
  }, [isHomeWaterRegion, position?.lat, position?.lon, waterbodies, waterbodyManuallySelected]);

  useEffect(() => {
    if (!hasClubWaterContext) {
      setClubScopedFishList(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const clubId = getActiveClubId();
        if (!clubId) {
          if (!active) return;
          setClubScopedFishList(null);
          return;
        }

        const speciesList = await fetchRuleSpeciesForContext({
          waterbodyId: selectedWaterbodyId || null,
          fallbackToClubDefault: true,
          useStaticFallback: false,
        });
        if (!active) return;
        setClubScopedFishList(
          Array.isArray(speciesList) && speciesList.length > 0 ? speciesList : null,
        );
      } catch {
        if (!active) return;
        setClubScopedFishList(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [clubContextTick, hasClubWaterContext, selectedWaterbodyId]);

  useEffect(() => {
    if (!Array.isArray(regionOptions) || regionOptions.length === 0) return;
    const regionExists = regionOptions.some((entry) => entry?.id === region);
    if (regionExists) return;
    setRegion(regionOptions[0].id);
  }, [region, regionOptions, setRegion]);

  // Zwischenstand für den 2-stufigen Speichern-Flow („entnommen?“)
  const [pendingEntry, setPendingEntry] = useState(null);
  const isAutoDetectedSelection = Boolean(
    autoDetectedWaterbodyId
    && selectedWaterbodyId
    && selectedWaterbodyId === autoDetectedWaterbodyId
    && !waterbodyManuallySelected,
  );

  const handleWaterbodyChange = (value) => {
    setWaterbodyManuallySelected(true);
    const nextValue = value || "";
    setSelectedWaterbodyId(nextValue);
    if (typeof window !== "undefined") {
      try {
        if (nextValue) window.localStorage.setItem(WATERBODY_STORAGE_KEY, nextValue);
        else window.localStorage.removeItem(WATERBODY_STORAGE_KEY);
      } catch {
        /* ignore storage errors */
      }
    }
  };

  const buildWeatherFallbackFromCache = () => {
    const cached = cachedWeather?.data;
    const current = cached?.current;
    const firstWeather = Array.isArray(current?.weather) ? current.weather[0] : null;
    const firstDay = Array.isArray(cached?.daily) ? cached.daily[0] : null;
    if (!current) return {};
    return {
      temp: current.temp ?? null,
      description: firstWeather?.description ?? "",
      icon: firstWeather?.icon ?? "",
      wind: current.wind_speed ?? null,
      wind_deg: current.wind_deg ?? null,
      humidity: current.humidity ?? null,
      pressure: current.pressure ?? null,
      moon_phase: firstDay?.moon_phase ?? null,
    };
  };

  const getGpsRegionWarning = useCallback(() => {
    const userLat = Number(position?.lat);
    const userLon = Number(position?.lon);
    if (![userLat, userLon].every(Number.isFinite)) return null;

    if (isHomeWaterRegion) {
      if (!selectedWaterbody) return null;
    const waterLat = Number(selectedWaterbody?.lat);
    const waterLon = Number(selectedWaterbody?.lon);
    if (![userLat, userLon, waterLat, waterLon].every(Number.isFinite)) return null;

    const radius = Number(selectedWaterbody?.radius_m);
    const effectiveRadiusM = Number.isFinite(radius) && radius > 0 ? radius : 300;
    const maxDistanceWithoutWarningM = effectiveRadiusM + HOMEWATER_MISMATCH_TOLERANCE_M;
    const distanceM = getDistanceMeters(userLat, userLon, waterLat, waterLon);
    if (!Number.isFinite(distanceM) || distanceM <= maxDistanceWithoutWarningM) return null;

      return {
        kind: "outside_selected_homewater",
      waterbodyName: selectedWaterbody?.name || "ausgewähltes Vereinsgewässer",
      distanceM,
      radiusM: effectiveRadiusM,
      };
    }

    const match = getNearestMatchingWaterbody({
      waterbodies,
      lat: userLat,
      lon: userLon,
    });
    if (!match?.waterbody?.id) return null;

    const matchedWaterbody = match.waterbody;
    const matchedRadiusRaw = Number(matchedWaterbody?.radius_m);
    const matchedRadiusM = Number.isFinite(matchedRadiusRaw) && matchedRadiusRaw > 0 ? matchedRadiusRaw : 300;
    const matchedDistanceM = Number.isFinite(match.distance_m)
      ? match.distance_m
      : getDistanceMeters(userLat, userLon, Number(matchedWaterbody?.lat), Number(matchedWaterbody?.lon));
    if (!Number.isFinite(matchedDistanceM)) return null;

    return {
      kind: "inside_homewater_with_other_region",
      waterbodyId: matchedWaterbody.id,
      waterbodyName: matchedWaterbody?.name || "Vereinsgewässer",
      distanceM: matchedDistanceM,
      radiusM: matchedRadiusM,
    };
  }, [
    isHomeWaterRegion,
    position?.lat,
    position?.lon,
    selectedWaterbody,
    waterbodies,
  ]);

  // 1) Formular absenden → Daten sammeln, vorbereiten, Dialog „entnommen?“ anzeigen
  const handleSubmit = async ({ skipGpsMismatchCheck = false } = {}) => {
    if (loadingCatch || loadingBlank || savingCatch) return;

    const errorMessage = validateCatchForm({ fish, size, weight, position });
    if (errorMessage) {
      alert(errorMessage);
      return;
    }

    if (!skipGpsMismatchCheck) {
      const mismatchWarning = getGpsRegionWarning();
      if (mismatchWarning) {
        setGpsMismatchWarning(mismatchWarning);
        return;
      }
    }
    setGpsMismatchWarning(null);

    setLoadingCatch(true);
    try {
      // Wetter laden (mit Club-See-Koordinaten als Fallback)
      let currentWeather = {};
      const waterbodyWeatherLat = selectedWaterbody?.weather_lat;
      const waterbodyWeatherLon = selectedWaterbody?.weather_lon;
      const waterbodyLat = selectedWaterbody?.lat;
      const waterbodyLon = selectedWaterbody?.lon;
      const weatherFallbackCoords =
        isHomeWaterRegion && (waterbodyWeatherLat != null && waterbodyWeatherLon != null)
          ? { lat: waterbodyWeatherLat, lon: waterbodyWeatherLon }
          : isHomeWaterRegion && (waterbodyLat != null && waterbodyLon != null)
            ? { lat: waterbodyLat, lon: waterbodyLon }
            : null;
      try {
        currentWeather = await loadWeatherForPosition(
          position,
          weatherFallbackCoords,
          updateWeather
        );
      } catch (weatherError) {
        console.warn("⚠️ Live-Wetter fehlgeschlagen, nutze Cache/leer:", weatherError?.message || weatherError);
        currentWeather = buildWeatherFallbackFromCache();
      }

      // Foto verarbeiten/hochladen (optional)
      const photoUrl = photoFile ? await processAndUploadImage(photoFile, anglerName) : "";

      // Ort (best-effort)
      const locationName = await reverseGeocode(position?.lat, position?.lon).catch(() => null);

      if (isHomeWaterRegion) {
        try {
          const latestWaterTemperature = await fetchLatestWaterTemperature({
            days: 2,
            waterbodyId: selectedWaterbodyId || null,
            fallbackToClubDefault: true,
          });
          const waterTempRaw = latestWaterTemperature?.temperature_c;
          const normalizedWaterTempRaw =
            typeof waterTempRaw === "string" ? waterTempRaw.trim() : waterTempRaw;
          const waterTempValue =
            normalizedWaterTempRaw == null || normalizedWaterTempRaw === ""
              ? null
              : (typeof normalizedWaterTempRaw === "number"
                  ? normalizedWaterTempRaw
                  : Number(normalizedWaterTempRaw));
          if (Number.isFinite(waterTempValue)) {
            currentWeather = {
              ...currentWeather,
              water_temp: Math.round(waterTempValue * 10) / 10,
              water_temp_measured_at: latestWaterTemperature?.measured_at || null,
            };
          }
        } catch (waterTempError) {
          console.warn(
            "⚠️ Wassertemperatur konnte nicht geladen werden, speichere Fang ohne Wassertemperatur:",
            waterTempError?.message || waterTempError
          );
        }
      }

      // Zahlen robust parsen
      const sizeNumber = parseFloatLocale(size);
      const weightNumber = fish === "Karpfen" && weight ? parseFloatLocale(weight) : null;

      const newEntry = {
        fish,
        size: sizeNumber,
        weight: weightNumber,
        note,
        angler: anglerName,
        timestamp: new Date().toISOString(),
        weather: currentWeather,
        photo_url: photoUrl,
        blank: false,
        lat: position?.lat ?? null,
        lon: position?.lon ?? null,
        location_name: locationName || (isHomeWaterRegion ? selectedWaterbody?.name || null : null),
        waterbody_id: isHomeWaterRegion ? (selectedWaterbodyId || null) : null,
      };

      setPendingEntry(newEntry);
      setShowTakenDialog(true);
    } catch (err) {
      console.error(err);
      alert(err.message || "Fehler beim Speichern des Fangs.");
    } finally {
      setLoadingCatch(false);
    }
  };

  // 2) Finalisieren → mit „taken“-Flag wirklich speichern
  const finalizeCatch = async (taken) => {
    try {
      if (savingCatchRef.current || !pendingEntry) return;

      setSavingCatch(true);
      savingCatchRef.current = true;
      setStatusMessage("Fang wird gespeichert...");

      const entryToSave = pendingEntry;

      const inserted = await saveCatchEntry(
        entryToSave,
        taken,
        position,
        anglerName,
        { region }
      );

      // Achievements (optional)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? null;
        const lastCatch = inserted?.id ? { ...inserted } : { ...entryToSave, taken };
        if (typeof checkOnNewCatch === "function") {
          await checkOnNewCatch({ userId, lastCatch });
        }
      } catch {
        /* ignore */
      }

      navigate(`${clubBasePath}/catches`);
    } catch (err) {
      console.error(err);
      alert(err.message || "Fehler beim Speichern des Fangs.");
    } finally {
      setShowTakenDialog(false);
      setPendingEntry(null);
      setSavingCatch(false);
      savingCatchRef.current = false;
      setStatusMessage("");
    }
  };

  // Schneidersession speichern
  const handleBlankSubmit = async () => {
    setLoadingBlank(true);
    try {
      setStatusMessage("Schneidersession wird gespeichert...");
      await saveBlankDay(anglerName, hours, fishingType, position, {
        waterbody_id: isHomeWaterRegion ? (selectedWaterbodyId || null) : null,
      });
      setStatusMessage("Schneidersession gespeichert");
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigate(`${clubBasePath || '/'}`);
    } catch (err) {
      console.error(err);
      alert(err.message || "Fehler beim Speichern.");
    } finally {
      setLoadingBlank(false);
      setStatusMessage("");
    }
  };

  const inputClasses = "w-full rounded-lg border border-slate-300/70 dark:border-slate-700 bg-white/95 dark:bg-slate-900/70 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="mt-10 mb-10 max-w-2xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-950/70 backdrop-blur shadow-2xl shadow-slate-900/40">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10" aria-hidden="true" />
        <div className="relative p-6 sm:p-8 text-gray-800 dark:text-gray-100">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-blue-700 dark:text-blue-300">
              🎣 Fang eintragen
            </h2>
            
          </div>

          <div className="space-y-6">
            {/* Region + Gewässer + Fischart */}
            <RegionSelect value={region} onChange={setRegion} options={regionOptions} />
            {isHomeWaterRegion ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Gewässer
                </label>
                <select
                  ref={waterbodySelectRef}
                  value={selectedWaterbodyId}
                  onChange={(event) => handleWaterbodyChange(event.target.value)}
                  className={inputClasses}
                >
                  <option value="">Gewässer auswählen</option>
                  {waterbodies.map((waterbody) => (
                    <option key={waterbody.id} value={waterbody.id}>
                      {waterbody.name}
                    </option>
                  ))}
                </select>
                {isAutoDetectedSelection ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Automatisch erkannt{Number.isFinite(detectedDistanceM) ? ` (${Math.round(detectedDistanceM)} m)` : ''}.
                  </p>
                ) : null}
              </div>
            ) : null}
            <FishSelect fishList={fishList} value={fish} onChange={setFish} />

            {/* Größe */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Größe in Zentimeter
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="z. B. 35 cm"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={inputClasses}
              />
            </div>

            {/* Gewicht nur bei Karpfen */}
            {fish === "Karpfen" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Gewicht in Kilogramm (optional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="z. B. 12 kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className={inputClasses}
                />
              </div>
            )}

            {/* Kommentar */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Kommentar (optional)
              </label>
              <textarea
                placeholder="Besondere Umstände, Köder oder Notizen"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className={`${inputClasses} resize-none`}
              />
            </div>

            {/* Foto */}
            <PhotoPicker
              previewUrl={previewUrl}
              onPick={(file, url) => {
                setPhotoFile(file);
                setPreviewUrl(url);
              }}
              onRemove={() => {
                setPhotoFile(null);
                setPreviewUrl(null);
              }}
            />

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => void handleSubmit()}
                disabled={loadingCatch || loadingBlank || savingCatch || !!pendingEntry}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:from-emerald-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingCatch ? "Speichern..." : "✅ Fang speichern"}
              </button>

              <button
                onClick={() => setShowHourDialog(true)}
                disabled={loadingCatch || loadingBlank || savingCatch}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200/80 dark:bg-slate-800/70 px-4 py-3 text-base font-semibold text-slate-700 dark:text-slate-100 shadow-md shadow-slate-900/20 transition hover:bg-slate-300/90 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ❌ nichts gefangen
              </button>
            </div>

            {statusMessage && (
              <div
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                  statusMessage.toLowerCase().includes("gespeichert")
                    ? "border border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border border-blue-400/50 bg-blue-500/10 text-blue-700 dark:text-blue-200"
                }`}
              >
                {statusMessage.toLowerCase().includes("gespeichert") ? "✅" : "⏳"} {statusMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {gpsMismatchWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-300 bg-white p-5 shadow-2xl dark:border-amber-700 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {gpsMismatchWarning.kind === "inside_homewater_with_other_region"
                ? "Vereinsgewässer erkannt"
                : "Standort passt nicht zum Gewässer"}
            </h3>
            {gpsMismatchWarning.kind === "inside_homewater_with_other_region" ? (
              <>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Du hast aktuell die Region "{currentRegionLabel}" gewählt, befindest dich laut GPS aber innerhalb von
                  "{gpsMismatchWarning.waterbodyName}" (ca. {Math.round(gpsMismatchWarning.distanceM)} m, Radius {Math.round(gpsMismatchWarning.radiusM)} m).
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Region auf Vereinsgewässer umstellen oder trotzdem in der aktuellen Region speichern?
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Du bist ca. {Math.round(gpsMismatchWarning.distanceM)} m von "{gpsMismatchWarning.waterbodyName}" entfernt
                  (Radius {Math.round(gpsMismatchWarning.radiusM)} m).
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Möchtest du Region/Gewässer anpassen oder trotzdem speichern?
                </p>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {gpsMismatchWarning.kind === "inside_homewater_with_other_region" ? (
                <button
                  type="button"
                  onClick={() => {
                    setRegion("ferkensbruch");
                    if (gpsMismatchWarning.waterbodyId) {
                      handleWaterbodyChange(gpsMismatchWarning.waterbodyId);
                    }
                    setGpsMismatchWarning(null);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Auf Vereinsgewässer wechseln
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const fallbackRegionId = regionOptions.find((entry) => entry?.id && entry.id !== "ferkensbruch")?.id || "binnen";
                      setRegion(fallbackRegionId);
                      setGpsMismatchWarning(null);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Region wechseln
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGpsMismatchWarning(null);
                      setTimeout(() => waterbodySelectRef.current?.focus(), 0);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Anderes Gewässer wählen
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => void handleSubmit({ skipGpsMismatchCheck: true })}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Trotzdem speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Schneidersession-Dialog */}
      <HourDialog
        open={showHourDialog}
        hours={hours}
        setHours={setHours}
        fishingType={fishingType}
        setFishingType={setFishingType}
        onSave={() => {
          setShowHourDialog(false);
          handleBlankSubmit();
        }}
        onClose={() => setShowHourDialog(false)}
      />

      {/* Entnommen-Dialog */}
      <TakenDialog open={showTakenDialog} onPick={finalizeCatch} loading={savingCatch} />
    </div>
  );
}

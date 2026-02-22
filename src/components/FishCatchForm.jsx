// src/components/FishCatchForm.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// Utils
import { validateCatchForm } from "@/utils/validation";
import { reverseGeocode } from "@/utils/geo";
import { parseFloatLocale } from "@/utils/number";

// Services
import { processAndUploadImage } from "@/services/imageProcessing";
import { loadWeatherForPosition } from "@/services/weather";
import { saveBlankDay } from "@/services/blankService";
import { saveCatchEntry } from "@/services/catchService";

// Domain
import { fishListForRegion } from "@/constants/fishRegions";

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

const FERKENSBRUCH_LAT = 51.3135;
const FERKENSBRUCH_LON = 6.256;

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
  const { updateWeather } = useWeatherCache();

  // Achievement-Layer aus dem Router-Kontext, falls Prop nicht gesetzt ist
  const outletContext = useOutletContext() ?? {};
  const contextShowEffect = outletContext.showEffect;
  const effectiveShowEffect = typeof showEffect === "function"
    ? showEffect
    : (typeof contextShowEffect === "function" ? contextShowEffect : null);

  // Region mit Persistenz
  const [region, setRegion] = useLocalStorage("fishRegion", "ferkensbruch");
  const fishList = fishListForRegion(region);

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

  // Zwischenstand für den 2-stufigen Speichern-Flow („entnommen?“)
  const [pendingEntry, setPendingEntry] = useState(null);

  // 1) Formular absenden → Daten sammeln, vorbereiten, Dialog „entnommen?“ anzeigen
  const handleSubmit = async () => {
    if (loadingCatch || loadingBlank || savingCatch) return;

    const errorMessage = validateCatchForm({ fish, size, weight, position });
    if (errorMessage) {
      alert(errorMessage);
      return;
    }

    setLoadingCatch(true);
    try {
      // Wetter laden (mit Fallback auf Ferkensbruch)
      const currentWeather = await loadWeatherForPosition(
        position,
        { lat: FERKENSBRUCH_LAT, lon: FERKENSBRUCH_LON },
        updateWeather
      );

      // Foto verarbeiten/hochladen (optional)
      const photoUrl = photoFile ? await processAndUploadImage(photoFile, anglerName) : "";

      // Ort (best-effort)
      const locationName = await reverseGeocode(position?.lat, position?.lon).catch(() => null);

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
        location_name: locationName,
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
      await saveBlankDay(anglerName, hours, fishingType, position);
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
            {/* Region + Fischart */}
            <RegionSelect value={region} onChange={setRegion} />
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
                onClick={handleSubmit}
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

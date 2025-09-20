// src/components/FishCatchForm.jsx
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

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

// Achievements (optional/best-effort)
import { supabase } from "@/supabaseClient";
import { useAchievements } from "@/achievements/useAchievements";
import { localRemember } from "@/achievements/localRemember";

const FERKENSBRUCH_LAT = 51.3135;
const FERKENSBRUCH_LON = 6.256;

export default function FishCatchForm({
  setWeatherData,
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

  // Misc
  const navigate = useNavigate();
  const { position } = useGeoPosition();

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
        setWeatherData
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
      const inserted = await saveCatchEntry(
        pendingEntry,
        taken,
        position,
        anglerName,
        FERKENSBRUCH_LAT,
        FERKENSBRUCH_LON
      );

      // Achievements (optional)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? null;
        const lastCatch = inserted?.id ? { ...inserted } : { ...pendingEntry, taken };
        if (typeof checkOnNewCatch === "function") {
          await checkOnNewCatch({ userId, lastCatch });
        }
      } catch {
        /* ignore */
      }

      navigate("/catches");
    } catch (err) {
      console.error(err);
      alert(err.message || "Fehler beim Speichern des Fangs.");
    } finally {
      setShowTakenDialog(false);
      setPendingEntry(null);
    }
  };

  // Schneidertag speichern
  const handleBlankSubmit = async () => {
    setLoadingBlank(true);
    try {
      await saveBlankDay(anglerName, hours, fishingType, position);
      navigate("/");
    } catch (err) {
      console.error(err);
      alert(err.message || "Fehler beim Speichern.");
    } finally {
      setLoadingBlank(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl mt-10 mb-10 text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6 text-center">
        🎣 Fang eintragen
      </h2>

      <div className="space-y-4">
        {/* Region + Fischart */}
        <RegionSelect value={region} onChange={setRegion} />
        <FishSelect fishList={fishList} value={fish} onChange={setFish} />

        {/* Größe */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Größe (cm)"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800"
        />

        {/* Gewicht nur bei Karpfen */}
        {fish === "Karpfen" && (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Gewicht (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800"
          />
        )}

        {/* Kommentar */}
        <textarea
          placeholder="Kommentar (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800"
        />

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
        <button
          onClick={handleSubmit}
          disabled={loadingCatch || loadingBlank}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded"
        >
          {loadingCatch ? "Speichern..." : "✅ Fang speichern"}
        </button>

        <button
          onClick={() => setShowHourDialog(true)}
          disabled={loadingCatch || loadingBlank}
          className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded"
        >
          ❌ Heute nichts gefangen
        </button>
      </div>

      {/* Schneidertag-Dialog */}
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
      <TakenDialog open={showTakenDialog} onPick={finalizeCatch} />
    </div>
  );
}

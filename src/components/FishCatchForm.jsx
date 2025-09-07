// src/components/FishCatchForm.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

// Utils
import { validateCatchForm } from "../utils/validation";
import { reverseGeocode } from "../utils/geo";

// Services
import { processAndUploadImage } from "../services/imageProcessing";
import { loadWeatherForPosition } from "../services/weather";
import { saveBlankDay } from "../services/blankService";
import { saveCatchEntry } from "../services/catchService";

// ✅ NEU: Supabase + Achievements
import { supabase } from "../supabaseClient";
import { useAchievements } from "../achievements/useAchievements";
import { localRemember } from "../achievements/localRemember";

/* =========================
   Regionale Fischlisten (manuelle Auswahl, KEINE Auto-Erkennung)
   ========================= */

// Ferkensbruch (ASV-Rotauge)
const FERKENSBRUCH_FISH = [
  "Aal", "Barsch", "Brasse", "Güster", "Hecht", "Karausche", "Karpfen",
  "Rotauge", "Rotfeder", "Schleie", "Wels", "Zander"
];

// Binnengewässer (z. B. Deutschland)
const INLAND_FISH = [
  "Aal", "Barsch", "Brasse", "Forelle", "Güster", "Grundel", "Hecht", "Karausche", "Karpfen",
  "Rotauge", "Rotfeder", "Schleie", "Wels", "Zander"
];

// Mittelmeer (grob)
const MEDITERRANEAN_FISH = [
  "Dorade (Goldbrasse)", "Wolfsbarsch (Seebarsch)", "Makrele", "Sardine", "Barrakuda",
  "Amberjack (Bernsteinfisch)", "Bonito", "Tintenfisch", "Thunfisch", "Oktopus", "Rotbarbe",
  "Zackenbarsch", "Meeräsche"
];

// Norwegen/Salzwasser (grob)
const NORWAY_FISH = [
  "Dorsch (Kabeljau)", "Seelachs (Köhler)", "Leng", "Lumb", "Rotbarsch",
  "Heilbutt", "Seeteufel", "Makrele", "Scholle", "Steinbeißer", "Seehecht"
];

// Deutschland Nordsee
const NORTH_SEA_DE_FISH = [
  "Dorsch (Kabeljau)", "Wittling", "Seelachs (Köhler)", "Makrele",
  "Scholle", "Kliesche", "Flunder", "Steinbutt", "Seezunge",
  "Hering", "Meeräsche", "Seehecht", "Seeteufel"
];

// Deutschland Ostsee
const BALTIC_SEA_DE_FISH = [
  "Dorsch (Kabeljau)", "Hering", "Hornhecht", "Meerforelle",
  "Lachs", "Scholle", "Flunder", "Kliesche", "Steinbutt",
  "Aal", "Plattfisch (allg.)"
];

// Regions-IDs und Labels (nur manuelle Auswahl)
const REGION_LABELS = {
  ferkensbruch: "Ferkensbruch (ASV-Rotauge)",
  inland: "Binnen (Deutschland)",
  northsea_de: "Nordsee (DE)",
  baltic_de: "Ostsee (DE)",
  med: "Mittelmeer",
  norway: "Norwegen (Salzwasser)",
};

function fishListForRegion(region) {
  switch (region) {
    case "ferkensbruch": return FERKENSBRUCH_FISH;
    case "inland": return INLAND_FISH;
    case "northsea_de": return NORTH_SEA_DE_FISH;
    case "baltic_de": return BALTIC_SEA_DE_FISH;
    case "med": return MEDITERRANEAN_FISH;
    case "norway": return NORWAY_FISH;
    default: return FERKENSBRUCH_FISH;
  }
}

export default function FishCatchForm({
  setWeatherData,
  showEffect,          // ✅ NEU: von NewCatch übergeben
  anglerName: propAnglerName, // optional, falls du ihn schon als Prop bekommst
}) {
  const [fish, setFish] = useState("");
  const [size, setSize] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hours, setHours] = useState(4);
  const [fishingType, setFishingType] = useState("Allround");
  const [showHourDialog, setShowHourDialog] = useState(false);
  const [loadingCatch, setLoadingCatch] = useState(false);
  const [loadingBlank, setLoadingBlank] = useState(false);
  const [position, setPosition] = useState(null);
  const [showTakenDialog, setShowTakenDialog] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(null);

  // ✅ Achievements-Hook initialisieren
  const { checkOnNewCatch } = useAchievements({
    supabase,
    showEffect,
    remember: localRemember,
  });

  // ✅ Region nur manuell wählbar (persistiert in localStorage)
  const allowedRegions = Object.keys(REGION_LABELS);
  const [region, setRegion] = useState(() => {
    const stored = localStorage.getItem("fishRegion");
    return allowedRegions.includes(stored) ? stored : "ferkensbruch";
  });
  const fishList = fishListForRegion(region);

  const fileInputRef = useRef();
  const navigate = useNavigate();

  // Quelle für Namen: Prop > localStorage
  const anglerName = propAnglerName || localStorage.getItem("anglerName") || "Unbekannt";
  const FERKENSBRUCH_LAT = 51.3135;
  const FERKENSBRUCH_LON = 6.256;

  // Standort abrufen (nur für Wetter/Logging, NICHT für Region)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => console.warn("Standort konnte nicht abgerufen werden:", err)
    );
  }, []);

  // Wenn aktuelle Auswahl nicht in Liste vorkommt (z. B. nach Regionswechsel) → zurücksetzen
  useEffect(() => {
    if (fish && !fishList.includes(fish)) {
      setFish("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("Nur Bilddateien erlaubt!");
      return;
    }
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhoto(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async () => {
    const errorMessage = validateCatchForm({ fish, size, weight, position });
    if (errorMessage) {
      alert(errorMessage);
      return;
    }

    setLoadingCatch(true);

    try {
      const currentWeather = await loadWeatherForPosition(
        position,
        { lat: FERKENSBRUCH_LAT, lon: FERKENSBRUCH_LON },
        setWeatherData
      );

      const photoUrl = photo ? await processAndUploadImage(photo, anglerName) : "";

      const locationName = await reverseGeocode(position?.lat, position?.lon).catch(() => null);

      // 🔢 Zahlen sauber parsen (Komma/Zahlpunkt)
      const sizeNumber = parseFloat(String(size).replace(",", "."));
      const weightNumber =
        fish === "Karpfen" && weight ? parseFloat(String(weight).replace(",", ".")) : null;

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

  const finalizeCatch = async (taken) => {
    try {
      // Speichern (dein bestehender Service)
      const inserted = await saveCatchEntry(
        pendingEntry,
        taken,
        position,
        anglerName,
        FERKENSBRUCH_LAT,
        FERKENSBRUCH_LON
      );

      // ✅ ACHIEVEMENTS: userId + lastCatch bestimmen
      let userId = null;
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (!sessionErr) userId = sessionData?.session?.user?.id ?? null;
      } catch {
        // ignore
      }

      const lastCatch = inserted?.id
        ? { ...inserted }
        : { ...pendingEntry, id: undefined, taken };

      if (userId) {
        // Nach erfolgreichem Speichern prüfen
        await checkOnNewCatch({ userId, lastCatch });
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
        {/* Fischregion – manuelle Auswahl */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Region:</label>
          <select
            value={region}
            onChange={(e) => {
              const val = e.target.value;
              setRegion(val);
              localStorage.setItem("fishRegion", val);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
          >
            {Object.entries(REGION_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>

        {/* Fischart */}
        <select
          value={fish}
          onChange={(e) => setFish(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800"
        >
          <option value="">Fischart auswählen</option>
          {fishList.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

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
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
          >
            📷 Foto auswählen / aufnehmen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {/* Foto-Vorschau */}
        {previewUrl && (
          <div className="mt-4 text-center">
            <img
              src={previewUrl}
              alt="Vorschau"
              className="max-w-full max-h-64 mx-auto rounded shadow-md"
            />
            <button
              onClick={removePhoto}
              className="mt-2 text-sm text-red-600 hover:underline"
            >
              Foto entfernen
            </button>
          </div>
        )}

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
      {showHourDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-80">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              ⏱ Wie viele Stunden warst du angeln?
            </h3>
            <select
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mb-4 bg-white dark:bg-gray-700 dark:text-white"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => {
                const endTime = new Date();
                const startTime = new Date(endTime.getTime() - h * 60 * 60 * 1000);
                const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "Stunde" : "Stunden"} ({timeStr})
                  </option>
                );
              })}
            </select>

            {/* Angelart */}
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
              🎯 Angelart
            </h3>
            <select
              value={fishingType}
              onChange={(e) => setFishingType(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mb-4 bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="Friedfisch">Friedfisch</option>
              <option value="Raubfisch">Raubfisch</option>
              <option value="Allround">Allround</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowHourDialog(false);
                  handleBlankSubmit();
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
              >
                Speichern
              </button>
              <button
                onClick={() => setShowHourDialog(false)}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-2 rounded"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fang entnommen-Dialog */}
      {showTakenDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-80">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              🐟 Wurde der Fisch entnommen?
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => finalizeCatch(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
              >
                ✅ Ja
              </button>
              <button
                onClick={() => finalizeCatch(false)}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded"
              >
                🚫 Nein
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

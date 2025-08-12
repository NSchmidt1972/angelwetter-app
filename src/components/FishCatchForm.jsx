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

const FISH_TYPES = [
  "Aal", "Barsch", "Brasse", "Güster", "Hecht", "Karausche", "Karpfen",
  "Rotauge", "Rotfeder", "Schleie", "Wels", "Zander"
];

export default function FishCatchForm({ setWeatherData }) {
  const [fish, setFish] = useState("");
  const [size, setSize] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hours, setHours] = useState(4);
  const [fishingType, setFishingType] = useState("Allround"); // ✅ neu
  const [showHourDialog, setShowHourDialog] = useState(false);
  const [loadingCatch, setLoadingCatch] = useState(false);
  const [loadingBlank, setLoadingBlank] = useState(false);
  const [position, setPosition] = useState(null);
  const [showTakenDialog, setShowTakenDialog] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(null);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  const anglerName = localStorage.getItem("anglerName") || "Unbekannt";
  const FERKENSBRUCH_LAT = 51.3135;
  const FERKENSBRUCH_LON = 6.256;

  // Standort abrufen
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => console.warn("Standort konnte nicht abgerufen werden:", err)
    );
  }, []);

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

      const photoUrl = photo
        ? await processAndUploadImage(photo, anglerName)
        : "";

      const locationName = await reverseGeocode(position.lat, position.lon).catch(() => null);

      const newEntry = {
        fish,
        size: parseFloat(size.replace(",", ".")),
        weight: fish === "Karpfen" ? parseFloat(weight.replace(",", ".")) : null,
        note,
        angler: anglerName,
        timestamp: new Date().toISOString(),
        weather: currentWeather,
        photo_url: photoUrl,
        blank: false,
        lat: position.lat,
        lon: position.lon,
        location_name: locationName
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
      await saveCatchEntry(
        pendingEntry,
        taken,
        position,
        anglerName,
        FERKENSBRUCH_LAT,
        FERKENSBRUCH_LON
      );
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
      await saveBlankDay(anglerName, hours, fishingType, position); // ✅ fishingType mitgeben
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
        {/* Fischart */}
        <select
          value={fish}
          onChange={(e) => setFish(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800"
        >
          <option value="">Fischart auswählen</option>
          {FISH_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Größe */}
        <input
          type="text"
          placeholder="Größe (cm)"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800"
        />

        {/* Gewicht nur bei Karpfen */}
        {fish === "Karpfen" && (
          <input
            type="text"
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

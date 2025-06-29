import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { fetchWeather } from '../api/weather';
import { useNavigate } from 'react-router-dom';
import heic2any from "heic2any";

const FISH_TYPES = [
  'Aal', 'Barsch', 'Brasse', 'Güster', 'Hecht', 'Karausche', 'Karpfen',
  'Rotauge', 'Rotfeder', 'Schleie', 'Wels', 'Zander'
];

export default function FishCatchForm({ setWeatherData }) {
  const [fish, setFish] = useState('');
  const [size, setSize] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hours, setHours] = useState(4);
  const [showHourDialog, setShowHourDialog] = useState(false);
  const [loadingCatch, setLoadingCatch] = useState(false);
  const [loadingBlank, setLoadingBlank] = useState(false);
  const [position, setPosition] = useState(null);
  const [showTakenDialog, setShowTakenDialog] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(null);
  const navigate = useNavigate();

  const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';
  const isMarilou = anglerName?.trim().toLowerCase() === 'marilou';

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => console.warn("Standort konnte nicht abgerufen werden:", err)
    );
  }, []);

  function sanitizeFilename(name) {
    return name.normalize("NFD").replace(/[^a-zA-Z0-9_-]/g, "_");
  }

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

  async function optimizeImage(file, maxSize = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxSize) {
            height = height * (maxSize / width);
            width = maxSize;
          } else if (height > maxSize) {
            width = width * (maxSize / height);
            height = maxSize;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" }));
          }, "image/jpeg", quality);
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function loadWeather() {
    const data = await fetchWeather();
    const weather = {
      temp: data.current.temp ?? null,
      description: data.current.weather?.[0]?.description ?? '',
      icon: data.current.weather?.[0]?.icon ?? '',
      wind: data.current.wind_speed ?? null,
      wind_deg: data.current.wind_deg ?? null,
      humidity: data.current.humidity ?? null,
      pressure: data.current.pressure ?? null,
      moon_phase: data.daily?.[0]?.moon_phase ?? null
    };
    if (setWeatherData) setWeatherData({ data, savedAt: Date.now() });
    return weather;
  }

  const handleSubmit = async () => {
    if (!fish || !size) {
      alert("Bitte alles ausfüllen!");
      return;
    }

    const sizeNumber = parseFloat(size.replace(',', '.'));
    if (isNaN(sizeNumber) || sizeNumber <= 0) {
      alert("Bitte eine gültige Zahl größer als 0 für die Größe eingeben.");
      return;
    }

    let weightNumber = null;
    if (fish === 'Karpfen') {
      if (!weight) {
        alert("Bitte das Gewicht des Karpfens angeben.");
        return;
      }
      weightNumber = parseFloat(weight.replace(',', '.'));
      if (isNaN(weightNumber) || weightNumber <= 0) {
        alert("Bitte eine gültige Zahl größer als 0 für das Gewicht eingeben.");
        return;
      }
    }

    if (!position) {
      alert("Standortdaten fehlen. Bitte Standortfreigabe aktivieren.");
      return;
    }

    setLoadingCatch(true);
    let currentWeather;
    try {
      currentWeather = await loadWeather();
    } catch (err) {
      console.error('Wetterfehler:', err);
      alert("Fehler beim Abrufen der Wetterdaten.");
      setLoadingCatch(false);
      return;
    }

    let photoUrl = '';
    if (photo) {
      let file = photo;
      const extension = file.name.split('.').pop().toLowerCase();
      if (extension === "heic" || extension === "heif") {
        try {
          const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
          file = new File([convertedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
        } catch (err) {
          console.error("HEIC-Konvertierung fehlgeschlagen:", err);
          alert("HEIC konnte nicht konvertiert werden.");
          setLoadingCatch(false);
          return;
        }
      }

      try {
        file = await optimizeImage(file);
      } catch (err) {
        console.error("Optimierung fehlgeschlagen:", err);
        alert("Bild konnte nicht optimiert werden.");
        setLoadingCatch(false);
        return;
      }

      const safeName = sanitizeFilename(anglerName);
      const fileName = `${Date.now()}_${safeName}.jpg`;
      const { error: uploadError } = await supabase.storage.from('fischfotos').upload(fileName, file);
      if (uploadError) {
        console.error('Upload-Fehler:', uploadError);
        alert('Fehler beim Hochladen des Fotos.');
        setLoadingCatch(false);
        return;
      }
      const { data: publicUrl } = supabase.storage.from('fischfotos').getPublicUrl(fileName);
      photoUrl = publicUrl?.publicUrl || '';
    }

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
      lat: position.lat,
      lon: position.lon,
      is_marilou: isMarilou
    };

    setPendingEntry(newEntry);
    setShowTakenDialog(true);
    setLoadingCatch(false);
  };

  const finalizeCatch = async (taken) => {
    const entryToSave = { ...pendingEntry, taken };
    const { error } = await supabase.from('fishes').insert([entryToSave]);

    if (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Fangs.');
    } else {
      alert("Petri Heil! 🎣 Dein Fang ist gespeichert. ✅");

      if (!isMarilou) {
        try {
          const functionUrl = 'https://kirevrwmmthqgceprbhl.supabase.co/functions/v1/send-push-notification';
          await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ angler: anglerName, fish: pendingEntry.fish, size: pendingEntry.size })
          });
        } catch (pushError) {
          console.error('Fehler bei der Push-Benachrichtigung:', pushError);
        }

        if (window?.OneSignal) {
          window.OneSignal.push(() => {
            window.OneSignal.sendSelfNotification(
              `🎣 Neuer Fang: ${pendingEntry.fish} (${pendingEntry.size} cm)`,
              `${anglerName} hat einen neuen Fisch gefangen.`,
              null,
              { data: { fish: pendingEntry.fish, size: pendingEntry.size } }
            );
          });
        }
      }

      navigate('/catches');
    }

    setShowTakenDialog(false);
    setPendingEntry(null);
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl mt-10 mb-10 text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6 text-center">🎣 Fang eintragen</h2>

      <div className="space-y-4">
        <select value={fish} onChange={e => setFish(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Fischart auswählen</option>
          {FISH_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <input type="text" inputMode="decimal" placeholder="Größe (cm)" value={size} onChange={e => setSize(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />

        {fish === 'Karpfen' && (
          <input
            type="text"
            inputMode="decimal"
            placeholder="Gewicht (kg)"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <textarea placeholder="Kommentar (optional)" value={note} onChange={e => setNote(e.target.value)} rows={4} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />

        <input type="file" accept="image/*" onChange={handleFileChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none" />

        {previewUrl && (
          <div className="mt-4 text-center">
            <img src={previewUrl} alt="Vorschau" className="max-w-full max-h-64 mx-auto rounded shadow-md" />
            <button onClick={removePhoto} className="mt-2 text-sm text-red-600 hover:underline">Foto entfernen</button>
          </div>
        )}

        <button onClick={handleSubmit} disabled={loadingCatch || loadingBlank} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded transition">
          {loadingCatch ? 'Speichern...' : '✅ Fang speichern'}
        </button>

        <button onClick={() => setShowHourDialog(true)} disabled={loadingCatch || loadingBlank} className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded transition">
          ❌ Heute nichts gefangen
        </button>
      </div>

      {showTakenDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-80">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              🐟 Wurde der Fisch entnommen?
            </h3>
            <div className="flex justify-between gap-2">
              <button onClick={() => finalizeCatch(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition">
                ✅ Ja
              </button>
              <button onClick={() => finalizeCatch(false)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded transition">
                🚫 Nein
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

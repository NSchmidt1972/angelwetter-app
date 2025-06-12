import { useState } from 'react';
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
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingCatch, setLoadingCatch] = useState(false);
  const [loadingBlank, setLoadingBlank] = useState(false);
  const navigate = useNavigate();

  const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';

  function sanitizeFilename(name) {
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  async function optimizeImage(file, maxSize = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = height * (maxSize / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = width * (maxSize / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
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

  const handleSubmit = async () => {
    if (!fish || !size) {
      alert("Bitte alles ausfüllen!");
      return;
    }

    const rawSize = size.replace(',', '.');
    const sizeNumber = parseFloat(rawSize);

    if (isNaN(sizeNumber) || sizeNumber <= 0) {
      alert("Bitte eine gültige Zahl größer als 0 für die Größe eingeben.");
      return;
    }

    setLoadingCatch(true);

    let currentWeather;
    try {
      const data = await fetchWeather();
      currentWeather = {
        temp: data.current.temp ?? null,
        description: data.current.weather?.[0]?.description ?? '',
        icon: data.current.weather?.[0]?.icon ?? '',
        wind: data.current.wind_speed ?? null,
        wind_deg: data.current.wind_deg ?? null,
        humidity: data.current.humidity ?? null,
        pressure: data.current.pressure ?? null,
        moon_phase: data.daily?.[0]?.moon_phase ?? null
      };

      if (setWeatherData) {
        setWeatherData({ data, savedAt: Date.now() });
      }
    } catch (err) {
      console.error('❌ Fehler beim Abrufen des Wetters:', err);
      alert("Fehler beim Abrufen der aktuellen Wetterdaten.");
      setLoadingCatch(false);
      return;
    }

    let photoUrl = '';
    if (photo) {
      let file = photo;
      let extension = file.name.split('.').pop().toLowerCase();

      if (extension === "heic" || extension === "heif") {
        try {
          const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.9,
          });
          file = new File([convertedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
          extension = "jpg";
        } catch (err) {
          console.error("Fehler bei der HEIC-Konvertierung:", err);
          alert("HEIC konnte nicht konvertiert werden.");
          setLoadingCatch(false);
          return;
        }
      }

      // Optimierung für alle Bilder
      try {
        file = await optimizeImage(file, 1600, 0.85);
      } catch (err) {
        console.error("Fehler beim Optimieren:", err);
        alert("Bild konnte nicht optimiert werden.");
        setLoadingCatch(false);
        return;
      }

      const safeName = sanitizeFilename(anglerName);
      const fileName = `${Date.now()}_${safeName}.jpg`;

      const { error: uploadError } = await supabase
        .storage
        .from('fischfotos')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload-Fehler:', uploadError);
        alert('Fehler beim Hochladen des Fotos.');
        setLoadingCatch(false);
        return;
      }

      const { data: publicUrl } = supabase
        .storage
        .from('fischfotos')
        .getPublicUrl(fileName);

      photoUrl = publicUrl?.publicUrl || '';
    }

    const newEntry = {
      fish,
      size: sizeNumber,
      note,
      angler: anglerName,
      timestamp: new Date().toISOString(),
      weather: currentWeather,
      photo_url: photoUrl,
      blank: false
    };

    const { error } = await supabase.from('fishes').insert([newEntry]);
    setLoadingCatch(false);

    if (error) {
      console.error('❌ Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Fangs.');
    } else {
      setFish('');
      setSize('');
      setNote('');
      setPhoto(null);
      setPreviewUrl(null);
      alert("Petri Heil! 🎣 Dein Fang ist gespeichert. ✅");
      navigate('/catches');
    }
  };

  const handleBlankSubmit = async () => {
    setLoadingBlank(true);

    let currentWeather;
    try {
      const data = await fetchWeather();
      currentWeather = {
        temp: data.current.temp ?? null,
        description: data.current.weather?.[0]?.description ?? '',
        icon: data.current.weather?.[0]?.icon ?? '',
        wind: data.current.wind_speed ?? null,
        wind_deg: data.current.wind_deg ?? null,
        humidity: data.current.humidity ?? null,
        pressure: data.current.pressure ?? null,
        moon_phase: data.daily?.[0]?.moon_phase ?? null
      };

      if (setWeatherData) {
        setWeatherData({ data, savedAt: Date.now() });
      }
    } catch (err) {
      console.error('❌ Fehler beim Abrufen des Wetters:', err);
      alert("Fehler beim Abrufen der aktuellen Wetterdaten.");
      setLoadingBlank(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isoTodayStart = today.toISOString();
    const isoTodayEnd = new Date(today.getTime() + 86400000).toISOString();

    const { data: existing, error: checkError } = await supabase
      .from('fishes')
      .select('id, fish')
      .eq('angler', anglerName)
      .gte('timestamp', isoTodayStart)
      .lt('timestamp', isoTodayEnd);

    if (checkError) {
      console.error('Fehler bei der Prüfung des Tages:', checkError);
      alert("Fehler bei der Prüfung des Tages.");
      setLoadingBlank(false);
      return;
    }

    if (existing.length > 0) {
      const hatSchonFang = existing.some(entry => entry.fish);
      const hatSchonBlank = existing.some(entry => !entry.fish);

      if (hatSchonFang) {
        alert("Du hast heute bereits einen Fisch eingetragen. Kein Schneidertag mehr möglich.");
        setLoadingBlank(false);
        return;
      }

      if (hatSchonBlank) {
        alert("Du hast heute bereits einen Schneidertag eingetragen.");
        setLoadingBlank(false);
        return;
      }
    }

    const blankEntry = {
      fish: null,
      size: null,
      note: 'Schneidertag',
      angler: anglerName,
      timestamp: new Date().toISOString(),
      weather: currentWeather,
      blank: true
    };

    const { error } = await supabase.from('fishes').insert([blankEntry]);
    setLoadingBlank(false);

    if (error) {
      console.error('❌ Fehler beim Speichern des Schneidertags:', error);
      alert('Fehler beim Speichern.');
    } else {
      alert("Schneidertag gespeichert! 😩");
      navigate('/');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
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

  return (
    <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl mt-10 mb-10 text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-4 text-center">🎣 Fang eintragen</h2>

      <div className="space-y-4">
        <select value={fish} onChange={e => setFish(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Fischart auswählen</option>
          {FISH_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" placeholder="Größe (cm)" value={size} onChange={e => setSize(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />

        <textarea placeholder="Hier können (optional) Hinweise rein: Futter, Montage, Angelplatz, geheime Zutat 😉" value={note} onChange={e => setNote(e.target.value)} rows={5} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />

        <input type="file" accept="image/jpeg,image/jpg,image/png,image/heic,image/webp" onChange={handleFileChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />

        {previewUrl && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 mb-2">📸 Vorschau:</p>
            <img src={previewUrl} alt="Vorschau" className="max-w-full max-h-64 mx-auto rounded shadow-md" />
            <button onClick={removePhoto} className="mt-2 text-sm text-red-600 hover:underline">Foto entfernen</button>
          </div>
        )}

        <div className="space-y-8">
          <button onClick={handleSubmit} disabled={loadingCatch || loadingBlank} className={`w-full text-white py-2 rounded font-semibold transition ${loadingCatch ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loadingCatch ? 'Speichere...' : 'Fang speichern'}
          </button>

          <button onClick={handleBlankSubmit} disabled={loadingCatch || loadingBlank} className="w-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-black dark:text-gray-100 py-2 rounded font-semibold">
            {loadingBlank ? 'Speichere...' : '❌ Heute nichts gefangen 😩'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ✅ FishCatchForm.jsx
import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { fetchWeather } from '../api/weather';
import { useNavigate } from 'react-router-dom';

const FISH_TYPES = [
  'Aal', 'Barsch', 'Brasse', 'Hecht', 'Karausche', 'Karpfen',
  'Rotauge', 'Rotfeder', 'Schleie', 'Wels', 'Zander'
];

export default function FishCatchForm({ anglerName, setWeatherData }) {
  const [fish, setFish] = useState('');
  const [size, setSize] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!fish || !size) {
      alert("Bitte alles ausfüllen!");
      return;
    }

    setLoading(true);

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
        setWeatherData(data);
      }
    } catch (err) {
      console.error('❌ Fehler beim Abrufen des Wetters:', err);
      alert("Fehler beim Abrufen der aktuellen Wetterdaten.");
      setLoading(false);
      return;
    }

    const newEntry = {
      fish,
      size: parseFloat(size),
      note,
      angler: anglerName,
      timestamp: new Date().toISOString(),
      weather: currentWeather,
      blank: false
    };

    const { error } = await supabase.from('fishes').insert([newEntry]);
    setLoading(false);

    if (error) {
      console.error('❌ Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Fangs.');
    } else {
      setFish('');
      setSize('');
      setNote('');
      alert("✅ Fang erfolgreich gespeichert!");
      navigate('/catches');
    }
  };

  const handleBlankSubmit = async () => {
    setLoading(true);

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
        setWeatherData(data);
      }
    } catch (err) {
      console.error('❌ Fehler beim Abrufen des Wetters:', err);
      alert("Fehler beim Abrufen der aktuellen Wetterdaten.");
      setLoading(false);
      return;
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
    setLoading(false);

    if (error) {
      console.error('❌ Fehler beim Speichern des Schneidertags:', error);
      alert('Fehler beim Speichern.');
    } else {
      alert("❌ Schneidertag gespeichert!");
      navigate('/catches');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow-md rounded-xl mt-10">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">🎣 Fang eintragen</h2>

      <div className="space-y-4">
        <select
          value={fish}
          onChange={e => setFish(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Fischart auswählen</option>
          {FISH_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Größe (cm)"
          value={size}
          onChange={e => setSize(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <textarea
          placeholder="Hier können (optional) Hinweise rein: Futter, Montage, Angelplatz, geheime Zutat 😉"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={5}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />


        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full text-white py-2 rounded font-semibold transition ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {loading ? 'Speichere...' : 'Fang speichern'}
        </button>

        <button
          onClick={handleBlankSubmit}
          disabled={loading}
          className="w-full bg-gray-300 hover:bg-gray-400 text-black py-2 rounded font-semibold"
        >
          {loading ? 'Speichere...' : '❌ Heute nichts gefangen 😩'}
        </button>
      </div>
    </div>
  );
}

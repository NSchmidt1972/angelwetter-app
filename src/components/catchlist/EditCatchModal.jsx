import { useEffect, useState } from 'react';
import { FISH_TYPES } from '../../constants';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import { HOME_WATER_LABEL } from '@/utils/location';

const PRESET_LAT = 51.3110871;
const PRESET_LON = 6.2568567;
const FERKENSBRUCH_LABEL = HOME_WATER_LABEL;
const LOBBERICH_DB_VALUE = 'Lobberich';
const ASV_ROTAUGE_ID = '00000000-0000-0000-0000-000000000001';

export default function EditCatchModal({ entry, onCancel, onSave }) {
  const [fish, setFish] = useState(entry.fish);
  const [size, setSize] = useState(entry.size);
  const [note, setNote] = useState(entry.note || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [locationName, setLocationName] = useState(entry.location_name || '');
  const [lat, setLat] = useState(entry.lat ?? '');
  const [lon, setLon] = useState(entry.lon ?? '');
  const [presetLat, setPresetLat] = useState(PRESET_LAT);
  const [presetLon, setPresetLon] = useState(PRESET_LON);
  const [presetLocationLabel, setPresetLocationLabel] = useState(FERKENSBRUCH_LABEL);
  const [presetLocationValue, setPresetLocationValue] = useState(LOBBERICH_DB_VALUE);

  useEffect(() => {
    let active = true;
    async function loadPresetFromClub() {
      try {
        const clubId = getActiveClubId();
        const isRotauge = clubId === ASV_ROTAUGE_ID;
        const fallbackLabel = isRotauge ? FERKENSBRUCH_LABEL : HOME_WATER_LABEL;
        const fallbackValue = isRotauge ? LOBBERICH_DB_VALUE : HOME_WATER_LABEL;

        if (!clubId) {
          if (!active) return;
          setPresetLat(PRESET_LAT);
          setPresetLon(PRESET_LON);
          setPresetLocationLabel(fallbackLabel);
          setPresetLocationValue(fallbackValue);
          return;
        }

        const { data, error } = await withTimeout(
          supabase
            .from('clubs')
            .select('weather_lat, weather_lon')
            .eq('id', clubId)
            .maybeSingle(),
          10000,
          'EditCatchModal Club-Koordinaten timeout'
        );
        if (error) throw error;

        const nextLat = Number(data?.weather_lat);
        const nextLon = Number(data?.weather_lon);
        if (!active) return;
        setPresetLat(Number.isFinite(nextLat) ? nextLat : PRESET_LAT);
        setPresetLon(Number.isFinite(nextLon) ? nextLon : PRESET_LON);
        setPresetLocationLabel(fallbackLabel);
        setPresetLocationValue(fallbackValue);
      } catch (error) {
        if (!active) return;
        console.warn('EditCatchModal: Club-Koordinaten konnten nicht geladen werden:', error?.message || error);
        setPresetLat(PRESET_LAT);
        setPresetLon(PRESET_LON);
        setPresetLocationLabel(HOME_WATER_LABEL);
        setPresetLocationValue(HOME_WATER_LABEL);
      }
    }

    void loadPresetFromClub();
    return () => {
      active = false;
    };
  }, []);

  const handlePhoto = e => {
    const f = e.target.files?.[0]; setFile(f);
    if (f) { const r = new FileReader(); r.onloadend = () => setPreview(r.result); r.readAsDataURL(f); } else setPreview(null);
  };

  const toDisplayLocation = (value) => {
    if (!value?.trim()) return '';
    const lower = value.trim().toLowerCase();
    if (lower === 'lobberich') return HOME_WATER_LABEL;
    return value;
  };

  const handleLocationChange = (nextValue) => {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      setLocationName('');
      return;
    }
    if (trimmed.toLowerCase() === presetLocationLabel.toLowerCase()) {
      setLocationName(presetLocationValue);
      return;
    }
    setLocationName(nextValue);
  };

  const handlePresetLocation = () => {
    setLat(presetLat);
    setLon(presetLon);
    setLocationName(presetLocationValue);
  };

  const parseCoordinate = value => {
    if (value === '' || value == null) return null;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleSave = () => {
    const parsedLat = parseCoordinate(lat);
    const parsedLon = parseCoordinate(lon);

    if (lat !== '' && parsedLat == null) {
      alert('Ungültiger Breitengrad');
      return;
    }
    if (lon !== '' && parsedLon == null) {
      alert('Ungültiger Längengrad');
      return;
    }

    onSave({
      fish,
      size,
      note,
      file,
      lat: parsedLat,
      lon: parsedLon,
      locationName,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-400">🎣 Fang bearbeiten</h2>
        <div className="space-y-4">
          <select value={fish} onChange={e => setFish(e.target.value)} className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-700">
            <option value="">Fischart auswählen</option>
            {FISH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Größe (cm)" value={size} onChange={e => setSize(e.target.value)} className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-700" />
          <textarea placeholder="Kommentar (optional)" value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-700" />
          <div className="space-y-2 rounded border border-gray-200 dark:border-gray-600 px-3 py-3 bg-gray-50 dark:bg-gray-900/30">
            <div className="flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-200">
              <span>Fangort</span>
              <button type="button" onClick={handlePresetLocation} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                📍 Auf {presetLocationLabel} setzen
              </button>
            </div>
            <input
              type="text"
              placeholder="Ortsname (optional)"
              value={toDisplayLocation(locationName)}
              onChange={e => handleLocationChange(e.target.value)}
              className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-700"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                placeholder="Breitengrad"
                value={lat}
                onChange={e => setLat(e.target.value)}
                className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-700"
              />
              <input
                type="number"
                step="any"
                placeholder="Längengrad"
                value={lon}
                onChange={e => setLon(e.target.value)}
                className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Neues Foto hochladen (optional):</label>
            <input type="file" accept="image/*" onChange={handlePhoto} className="text-gray-900 dark:text-gray-100" />
            {preview && <div className="mt-3"><img src={preview} alt="Vorschau" className="rounded shadow max-h-48 mx-auto" /></div>}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700">Abbrechen</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}

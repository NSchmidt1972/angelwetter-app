import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase < 0.25) return '🌒 zunehmend';
  if (phase === 0.25) return '🌓 erstes Viertel';
  if (phase < 0.5) return '🌔 zunehmend';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase < 0.75) return '🌖 abnehmend';
  if (phase === 0.75) return '🌗 letztes Viertel';
  return '🌘 abnehmend';
}

function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

const FISH_TYPES = ['Aal', 'Barsch', 'Brasse', 'Hecht', 'Karpfen', 'Rotauge', 'Rotfeder', 'Schleie', 'Wels', 'Zander'];

export default function CatchList({ anglerName }) {
  const [catches, setCatches] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [formattedNames, setFormattedNames] = useState([]);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editFish, setEditFish] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});

  useEffect(() => {
    async function loadFishes() {
      let query = supabase.from('fishes').select('*').eq('blank', false).order('timestamp', { ascending: false });
      if (onlyMine && anglerName) {
        query = query.eq('angler', anglerName);
      }
      const { data: fishData, error: fishError } = await query;
      if (fishError) {
        console.error('Fehler beim Laden der Fänge:', fishError);
        return;
      }
      const PUBLIC_FROM = new Date('2025-06-01');
      const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];
      const istVertrauter = vertraute.includes(anglerName);
      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
      const filteredFishes = fishData.filter(f => {
        const fangDatum = new Date(f.timestamp);
        if (istVertrauter) {
          if (filterSetting === 'all') return true;
          return fangDatum >= PUBLIC_FROM;
        }
        return fangDatum >= PUBLIC_FROM;
      });
      const formatted = filteredFishes.map(f => f.angler);
      setCatches(filteredFishes);
      setFormattedNames(formatted);
    }
    loadFishes();
  }, [onlyMine, anglerName]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId) {
        const menuEl = menuRefs.current[openMenuId];
        if (menuEl && !menuEl.contains(e.target)) {
          setOpenMenuId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Diesen Fang wirklich löschen?");
    if (!confirmDelete) return;
    const { error } = await supabase.from('fishes').delete().eq('id', id);
    if (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Löschen fehlgeschlagen.");
    } else {
      setCatches(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleUpdate = async () => {
    if (!editFish || !editSize) {
      alert("Bitte Fischart und Größe angeben.");
      return;
    }

    let photoUrl = editingEntry.photo_url;
    if (editPhotoFile) {
      const fileExt = editPhotoFile.name.split('.').pop();
      const filePath = `${editingEntry.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('fischfotos').upload(filePath, editPhotoFile, { upsert: true });
      if (uploadError) {
        console.error("Fehler beim Hochladen des Bildes:", uploadError);
        alert("Fehler beim Hochladen des Bildes.");
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('fischfotos').getPublicUrl(filePath);
      photoUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.from('fishes').update({
      fish: editFish,
      size: parseFloat(editSize),
      note: editNote,
      photo_url: photoUrl
    }).eq('id', editingEntry.id);

    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      alert("Fehler beim Speichern.");
    } else {
      setCatches(prev => prev.map(c => c.id === editingEntry.id ? { ...c, fish: editFish, size: parseFloat(editSize), note: editNote, photo_url: photoUrl } : c));
      setEditingEntry(null);
      setPreviewUrl(null);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    setEditPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

 const handleShare = async (entry) => {
  const FISH_ARTICLES = {
    Aal: 'einen', Barsch: 'einen', Brasse: 'eine', Hecht: 'einen', Karpfen: 'einen', 
    Rotauge: 'ein', Rotfeder: 'eine', Schleie: 'eine', Wels: 'einen', Zander: 'einen'
  };
  const date = new Date(entry.timestamp).toLocaleDateString('de-DE');
  const weather = entry.weather;
  const article = FISH_ARTICLES[entry.fish] || 'einen';

  const shareText = `🎣 Ich habe am ${date} ${article} ${entry.fish} gefangen!\n📏 Größe: ${entry.size} cm\n🌡 Wetter: ${weather?.temp ?? '?'} °C, ${weather?.description ?? 'unbekannt'}\n💨 Wind: ${weather?.wind ?? '?'} m/s${weather?.wind_deg !== undefined ? ` aus ${windDirection(weather.wind_deg)}` : ''}\n🧪 Luftdruck: ${weather?.pressure ?? '?'} hPa • 💦 Feuchte: ${weather?.humidity ?? '?'} %\n🌙 Mond: ${getMoonDescription(weather?.moon_phase)}`;

  try {
    let files = [];
    if (entry.photo_url) {
      const response = await fetch(entry.photo_url);
      const blob = await response.blob();
      const file = new File([blob], 'fangfoto.jpg', { type: blob.type });
      files = [file];
    }

    await navigator.share({
      title: 'Mein Fang',
      text: shareText,
      files
    });
  } catch (err) {
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      console.log("Teilen wurde abgebrochen.");
      return;
    }
    console.warn('❌ Teilen nicht möglich:', err);
    try {
      await navigator.clipboard.writeText(shareText);
      alert('📋 Fanginfo kopiert! Jetzt z. B. in WhatsApp einfügen.');
    } catch {
      alert('Teilen nicht unterstützt. Bitte manuell kopieren.');
    }
  }
};

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700">🎣 Fangliste</h2>
      <div className="flex justify-end mb-4">
        <label className="text-sm">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} className="mr-2" />Nur meine
        </label>
      </div>

      {catches.length === 0 ? (
        <p className="text-center text-gray-500 mt-6">Keine Fänge gespeichert.</p>
      ) : (
        <ul className="space-y-6">
          {catches.map((entry, index) => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString('de-DE');
            const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            return (
              <li key={entry.id} className="p-5 border rounded-xl bg-white shadow-md">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-gray-500">{dateStr} – {timeStr}</p>
                  {entry.angler === anglerName && (
                    <div className="relative" ref={el => menuRefs.current[entry.id] = el}>
                      <button onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)} className="text-xl">⋮</button>
                      {openMenuId === entry.id && (
                        <div className="absolute right-0 mt-2 w-32 bg-white border rounded shadow z-10">
                          <button onClick={() => { setEditingEntry(entry); setEditFish(entry.fish); setEditSize(entry.size); setEditNote(entry.note || ''); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Bearbeiten</button>
                          <button onClick={() => { handleDelete(entry.id); setOpenMenuId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Löschen</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{formattedNames[index]}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 font-medium">{entry.fish}</span>
                  <span>{`${entry.size} cm`}</span>
                  {entry.photo_url && (
                    <button onClick={() => setModalPhoto(entry.photo_url)} className="ml-auto">
                      <img src={entry.photo_url} alt="Fangfoto" className="w-16 h-16 rounded-full object-cover shadow" />
                    </button>
                  )}
                </div>
                {entry.note && <p className="italic text-sm text-gray-600 mb-2">{entry.note}</p>}
                {entry.weather && (
                  <div className="text-sm text-gray-700 mt-2">
                    <div className="flex items-center gap-2">
                      <img src={`https://openweathermap.org/img/wn/${entry.weather.icon}@2x.png`} alt={entry.weather.description} className="w-12 h-12" />
                      <div>
                        <p>{`${entry.weather.temp} °C, ${entry.weather.description}`}</p>
                        <p>💨 {`${entry.weather.wind} m/s`} aus {windDirection(entry.weather.wind_deg)} ({entry.weather.wind_deg}°)</p>
                        <p>💦 {entry.weather.humidity}% • 🧪 {entry.weather.pressure} hPa</p>
                        <p>{getMoonDescription(entry.weather.moon_phase)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-3">
                  <button onClick={() => handleShare(entry)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    📤 Teilen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-blue-700">🎣 Fang bearbeiten</h2>
            <div className="space-y-4">
              <select value={editFish} onChange={e => setEditFish(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">Fischart auswählen</option>
                {FISH_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
              </select>
              <input type="number" placeholder="Größe (cm)" value={editSize} onChange={e => setEditSize(e.target.value)} className="w-full border rounded px-3 py-2" />
              <textarea placeholder="Kommentar (optional)" value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full border rounded px-3 py-2" />
              <div>
                <label className="block text-sm font-medium mb-1">Neues Foto hochladen (optional):</label>
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
                {previewUrl && (
                  <div className="mt-3">
                    <img src={previewUrl} alt="Vorschau" className="rounded shadow max-h-48 mx-auto" />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setEditingEntry(null); setPreviewUrl(null); }} className="px-4 py-2 border rounded">Abbrechen</button>
                <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 text-white rounded">Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setModalPhoto(null)}>
          <img src={modalPhoto} alt="Fangfoto groß" className="max-w-[90vw] max-h-[80vh] rounded-md shadow-lg cursor-pointer" />
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { FISH_TYPES } from '../../constants';

export default function EditCatchModal({ entry, onCancel, onSave }) {
  const [fish, setFish] = useState(entry.fish);
  const [size, setSize] = useState(entry.size);
  const [note, setNote] = useState(entry.note || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handlePhoto = e => {
    const f = e.target.files?.[0]; setFile(f);
    if (f) { const r = new FileReader(); r.onloadend = () => setPreview(r.result); r.readAsDataURL(f); } else setPreview(null);
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
          <div>
            <label className="block text-sm font-medium mb-1">Neues Foto hochladen (optional):</label>
            <input type="file" accept="image/*" onChange={handlePhoto} className="text-gray-900 dark:text-gray-100" />
            {preview && <div className="mt-3"><img src={preview} alt="Vorschau" className="rounded shadow max-h-48 mx-auto" /></div>}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700">Abbrechen</button>
            <button onClick={() => onSave({ fish, size, note, file })} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}

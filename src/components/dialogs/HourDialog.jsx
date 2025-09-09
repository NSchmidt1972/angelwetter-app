// src/components/dialogs/HourDialog.jsx
export default function HourDialog({ open, hours, setHours, fishingType, setFishingType, onSave, onClose }) {
if (!open) return null;

return (
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

<h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">🎯 Angelart</h3>
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
<button onClick={onSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">Speichern</button>
<button onClick={onClose} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-2 rounded">Abbrechen</button>
</div>
</div>
</div>
);
}
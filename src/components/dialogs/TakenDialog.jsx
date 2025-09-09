// src/components/dialogs/TakenDialog.jsx
export default function TakenDialog({ open, onPick }) {
if (!open) return null;
return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-80">
<h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">🐟 Wurde der Fisch entnommen?</h3>
<div className="flex gap-2">
<button onClick={() => onPick(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded">✅ Ja</button>
<button onClick={() => onPick(false)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded">🚫 Nein</button>
</div>
</div>
</div>
);
}
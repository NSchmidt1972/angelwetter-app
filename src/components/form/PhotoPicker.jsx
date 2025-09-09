// src/components/form/PhotoPicker.jsx
import { useRef } from "react";

export default function PhotoPicker({ previewUrl, onPick, onRemove }) {
const inputRef = useRef(null);

const handleFileChange = (e) => {
const file = e.target.files?.[0];
if (!file || !file.type?.startsWith("image/")) {
alert("Nur Bilddateien erlaubt!");
return;
}
const url = URL.createObjectURL(file);
onPick?.(file, url);
};

return (
<div>
<button
type="button"
onClick={() => inputRef.current?.click()}
className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
>
📷 Foto auswählen / aufnehmen
</button>
<input
ref={inputRef}
type="file"
accept="image/*"
onChange={handleFileChange}
style={{ display: "none" }}
/>

{previewUrl && (
<div className="mt-4 text-center">
<img src={previewUrl} alt="Vorschau" className="max-w-full max-h-64 mx-auto rounded shadow-md" />
<button onClick={onRemove} className="mt-2 text-sm text-red-600 hover:underline">
Foto entfernen
</button>
</div>
)}
</div>
);
}
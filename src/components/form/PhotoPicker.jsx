// src/components/form/PhotoPicker.jsx
import { useRef } from "react";

const buttonClasses = "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:from-blue-400 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-400";

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
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Foto (optional)
      </label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={buttonClasses}
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
        <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 text-center shadow-inner">
          <img
            src={previewUrl}
            alt="Vorschau"
            className="mx-auto max-h-64 w-full max-w-full rounded-md object-cover"
          />
          <button
            onClick={onRemove}
            className="mt-3 text-sm font-medium text-red-400 transition hover:text-red-300"
          >
            Foto entfernen
          </button>
        </div>
      )}
    </div>
  );
}

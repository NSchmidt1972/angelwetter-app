// src/components/form/PhotoPicker.jsx
import { useRef, useState } from "react";
import PhotoLightbox from "@/components/catchlist/PhotoLightbox";
import { markFilePickerIntent } from "@/hooks/useAppResumeSync";

const buttonClasses = "inline-flex items-center justify-center gap-2 rounded-lg border-2 border-blue-400/90 bg-transparent px-4 py-3 text-sm font-semibold text-blue-500 transition hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-400";

export default function PhotoPicker({ previewUrl, onPick, onRemove }) {
  const inputRef = useRef(null);
  const [showLightbox, setShowLightbox] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type?.startsWith("image/")) {
      alert("Nur Bilddateien erlaubt!");
      return;
    }

    const url = URL.createObjectURL(file);
    setShowLightbox(false);
    onPick?.(file, url);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Foto (optional)
      </label>
      <button
        type="button"
        onClick={() => {
          markFilePickerIntent();
          inputRef.current?.click();
        }}
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
        <>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-100/80 dark:bg-slate-900/40 px-4 py-3 shadow-inner">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLightbox(true)}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <img
                  src={previewUrl}
                  alt="Fangfoto Vorschau"
                  className="h-16 w-16 rounded-full object-cover shadow"
                />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Vorschau
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowLightbox(false);
                onRemove?.();
              }}
              className="text-sm font-semibold text-red-500 transition hover:text-red-400"
            >
              Entfernen
            </button>
          </div>

          <PhotoLightbox
            src={showLightbox ? previewUrl : null}
            onClose={() => setShowLightbox(false)}
          />
        </>
      )}
    </div>
  );
}

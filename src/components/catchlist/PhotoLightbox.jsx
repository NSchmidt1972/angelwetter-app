export default function PhotoLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <img src={src} alt="Fangfoto groß" className="max-w-[90vw] max-h-[80vh] rounded-md shadow-lg cursor-pointer" />
    </div>
  );
}

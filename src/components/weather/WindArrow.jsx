// src/components/weather/WindArrow.jsx
export default function WindArrow({ deg = 0, className = "" }) {
  return (
    <div className={`h-8 w-8 rounded-full border border-zinc-300 dark:border-zinc-700 grid place-items-center ${className}`}>
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 transition-transform"
        style={{ transform: `rotate(${deg}deg)` }}
        aria-label={`Windrichtung ${deg}°`}
      >
        <path d="M12 2l4 8h-3v12h-2V10H8l4-8z" />
      </svg>
    </div>
  );
}

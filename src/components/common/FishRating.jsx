// src/components/common/FishRating.jsx
export default function FishRating({ probability }) {
  const rating = Math.round((parseFloat(probability) / 100) * 5);
  const filled = isNaN(rating) ? 0 : Math.max(0, Math.min(rating, 5));
  const empty = 5 - filled;
  return (
    <span className="inline-flex gap-[2px] align-middle">
      {Array.from({ length: filled }).map((_, i) => (
        <span key={`f${i}`} className="text-green-700 dark:text-green-300">🐟</span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="text-gray-400 dark:text-gray-600" style={{ filter: 'grayscale(100%) brightness(0.6)' }}>
          🐟
        </span>
      ))}
    </span>
  );
}

// src/components/weather/SegmentedSpinner.jsx
export default function SegmentedSpinner({ className = "h-5 w-5" }) {
  const segments = 12;
  return (
    <span className={`relative inline-block animate-spin ${className}`} aria-hidden="true">
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 block h-[28%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-500 dark:bg-gray-300"
          style={{
            transform: `translate(-50%, -50%) rotate(${(360 / segments) * i}deg) translateY(-155%)`,
            opacity: (i + 1) / segments,
          }}
        />
      ))}
    </span>
  );
}

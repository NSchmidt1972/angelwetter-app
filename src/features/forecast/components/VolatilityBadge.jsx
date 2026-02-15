export default function VolatilityBadge({ value }) {
  if (value < 3) {
    return <span className="text-green-600 dark:text-green-400 font-semibold">✅ günstig</span>;
  }
  if (value < 6) {
    return <span className="text-yellow-600 dark:text-yellow-300 font-semibold">⚠️ wechselhaft</span>;
  }
  return <span className="text-red-600 dark:text-red-400 font-semibold">❌ ungünstig</span>;
}

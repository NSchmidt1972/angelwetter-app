import SegmentedSpinner from '@/components/weather/SegmentedSpinner';

export function LoadingPanel({ label }) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
        <SegmentedSpinner className="h-5 w-5" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function InitialForecastLoader() {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 mb-6">
      <div className="bg-gray-100 dark:bg-gray-700 p-5 rounded-lg shadow-inner">
        <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
          <SegmentedSpinner className="h-6 w-6" />
          <span className="font-medium">Wetterdaten werden geladen...</span>
        </div>
      </div>
    </div>
  );
}

export function FishChipsLoader() {
  return (
    <div className="flex items-center gap-2">
      <SegmentedSpinner className="h-4 w-4" />
      <span className="text-xs text-gray-600 dark:text-gray-300">wird geladen...</span>
    </div>
  );
}

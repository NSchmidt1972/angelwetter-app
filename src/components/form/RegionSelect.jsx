// src/components/form/RegionSelect.jsx
import { DEFAULT_REGION_OPTIONS } from "@/constants/fishRegions";

const baseSelectClasses = "w-full appearance-none rounded-lg border border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900/70 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

export default function RegionSelect({ value, onChange, options = DEFAULT_REGION_OPTIONS }) {
  const safeOptions = Array.isArray(options) && options.length > 0
    ? options
    : DEFAULT_REGION_OPTIONS;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Region
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseSelectClasses} pr-10`}
        >
          {safeOptions.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          ▾
        </span>
      </div>
    </div>
  );
}

// src/components/form/RegionSelect.jsx
import { REGION_LABELS } from "@/constants/fishRegions";

export default function RegionSelect({ value, onChange }) {
return (
<div className="flex items-center gap-2">
<label className="text-sm text-gray-600 dark:text-gray-300">Region:</label>
<select
value={value}
onChange={(e) => onChange(e.target.value)}
className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
>
{Object.entries(REGION_LABELS).map(([id, label]) => (
<option key={id} value={id}>{label}</option>
))}
</select>
</div>
);
}
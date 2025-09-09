// src/components/form/FishSelect.jsx
export default function FishSelect({ fishList, value, onChange }) {
return (
<select
value={value}
onChange={(e) => onChange(e.target.value)}
className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800"
>
<option value="">Fischart auswählen</option>
{fishList.map((type) => (
<option key={type} value={type}>{type}</option>
))}
</select>
);
}
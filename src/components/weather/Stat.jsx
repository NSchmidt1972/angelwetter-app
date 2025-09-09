// src/components/weather/Stat.jsx
export default function Stat({ label, value, icon = null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/60 dark:bg-zinc-900/40 backdrop-blur p-3">
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="flex flex-col">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="text-base font-semibold">{value}</span>
      </div>
    </div>
  );
}

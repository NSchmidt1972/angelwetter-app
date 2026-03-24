export default function OverviewTotalsSection({ stats, supportsWeatherMetrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded border border-indigo-100 bg-indigo-50 px-3 py-2 text-center">
        <div className="text-xs text-gray-500">Fänge (gesamt)</div>
        <div className="text-xl font-semibold text-indigo-700">{stats.totalFishes}</div>
      </div>
      <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-center">
        <div className="text-xs text-gray-500">Mitglieder (gesamt)</div>
        <div className="text-xl font-semibold text-blue-700">{stats.totalMembers}</div>
      </div>
      <div className="rounded border border-emerald-100 bg-emerald-50 px-3 py-2 text-center">
        <div className="text-xs text-gray-500">OpenWeather-Requests</div>
        <div className="text-xl font-semibold text-emerald-700">
          {supportsWeatherMetrics ? stats.totalRequests : '—'}
        </div>
      </div>
    </section>
  );
}

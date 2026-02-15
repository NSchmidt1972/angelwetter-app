export default function MetricsSection({ stats, formatNumber }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Kennzahlen</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
          <p className="text-sm font-medium uppercase tracking-wide">Whitelist</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(stats.totalWhitelist)}</p>
          <p className="text-xs text-blue-700/80 dark:text-blue-200/70">Freigegebene Adressen</p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
          <p className="text-sm font-medium uppercase tracking-wide">Neue Mitglieder</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(stats.newMembers30d)}</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-200/70">in den letzten 30 Tagen</p>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-100">
          <p className="text-sm font-medium uppercase tracking-wide">Mitglieder</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(stats.memberCount)}</p>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-200/70">Mitglied, Vorstand oder Admin</p>
        </div>
        <div className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-sky-800 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-100">
          <p className="text-sm font-medium uppercase tracking-wide">Tester</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(stats.testerCount)}</p>
          <p className="text-xs text-sky-700/80 dark:text-sky-200/70">Personen im Teststatus</p>
        </div>
        <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-4 text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-900/20 dark:text-cyan-100">
          <p className="text-sm font-medium uppercase tracking-wide">Gäste</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(stats.guestCount)}</p>
          <p className="text-xs text-cyan-700/80 dark:text-cyan-200/70">Nur Gastzugang</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-800 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-100">
          <p className="text-sm font-medium uppercase tracking-wide">Inaktive Mitglieder</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(stats.inactiveMembers)}</p>
          <p className="text-xs text-gray-600/80 dark:text-gray-300/70">Derzeit pausiert</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <p className="text-sm font-medium uppercase tracking-wide">Vorstand & Admin</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(stats.leadership)}</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-200/70">Mit erweiterten Rechten</p>
        </div>
      </div>
    </section>
  );
}

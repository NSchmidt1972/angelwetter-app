export default function LatestSensorLogCard({
  title,
  loading,
  error,
  hasData,
  valueText,
  timestampText,
  valueLabel = 'Wert',
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      {loading ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">Lade…</p>
      ) : null}
      {!loading && error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>
      ) : null}
      {!loading && !error && !hasData ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">Keine Daten vorhanden.</p>
      ) : null}
      {!loading && !error && hasData ? (
        <dl className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
          <div>
            <dt className="inline font-medium">{valueLabel}: </dt>
            <dd className="inline">{valueText}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Zeit: </dt>
            <dd className="inline">{timestampText}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

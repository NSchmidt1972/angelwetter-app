import OverviewSection from '@/features/adminOverview/components/OverviewSection';

function formatCount(value) {
  return Number.isInteger(value) ? value : '—';
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toFixed(digits);
}

export default function SensorLogsSection({
  telemetryLoading,
  telemetryError,
  battLatest,
  battCount,
  gpsLatest,
  gpsCount,
  temperatureLatest,
  temperatureCount,
  formatDateTimeLabel,
}) {
  const knownCounts = [battCount, gpsCount, temperatureCount].filter((value) => Number.isInteger(value));
  const totalCount = knownCounts.reduce((sum, value) => sum + value, 0);
  const valueLabel = telemetryLoading
    ? 'Lade…'
    : knownCounts.length > 0
      ? `${totalCount} Einträge gesamt`
      : 'Keine Daten';

  return (
    <OverviewSection title="📡 Sensor-Logs (Supabase)" value={valueLabel}>
      <div className="space-y-3">
        {telemetryError && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            {telemetryError}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">🔋 batt_log</h4>
            <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-200">
              <div>Einträge: {formatCount(battCount)}</div>
              <div>
                Zuletzt:{' '}
                {battLatest?.created_at ? formatDateTimeLabel(battLatest.created_at) : 'Keine Daten'}
              </div>
              <div>
                Wert:{' '}
                {battLatest
                  ? `${formatNumber(battLatest.percent, 0)}% · ${formatNumber(battLatest.voltage_v, 2)} V`
                  : 'Keine Daten'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">📍 gps_log</h4>
            <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-200">
              <div>Einträge: {formatCount(gpsCount)}</div>
              <div>
                Zuletzt:{' '}
                {gpsLatest?.fix_time_utc || gpsLatest?.created_at
                  ? formatDateTimeLabel(gpsLatest.fix_time_utc || gpsLatest.created_at)
                  : 'Keine Daten'}
              </div>
              <div>
                Gerät: {gpsLatest?.device_id?.trim() || '—'}
              </div>
              <div>
                Pos: {gpsLatest ? `${formatNumber(gpsLatest.lat, 5)}, ${formatNumber(gpsLatest.lon, 5)}` : 'Keine Daten'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">🌡️ temperature_log</h4>
            <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-200">
              <div>Einträge: {formatCount(temperatureCount)}</div>
              <div>
                Zuletzt:{' '}
                {temperatureLatest?.measured_at
                  ? formatDateTimeLabel(temperatureLatest.measured_at)
                  : 'Keine Daten'}
              </div>
              <div>
                Gerät: {temperatureLatest?.device_id?.trim() || '—'}
              </div>
              <div>
                Wert:{' '}
                {temperatureLatest
                  ? `${formatNumber(temperatureLatest.temperature_c, 2)} °C`
                  : 'Keine Daten'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </OverviewSection>
  );
}

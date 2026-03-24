import LatestSensorLogCard from '@/apps/superadmin/features/overview/components/LatestSensorLogCard';
import { formatLogTimestamp } from '@/apps/superadmin/features/overview/utils/overviewUtils';

export default function LatestSensorLogsSection({
  latestSensorLogsLoading,
  latestSensorLogsError,
  latestSensorLogErrors,
  latestSensorLogs,
  battValueText,
  gpsValueText,
  temperatureValueText,
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Neueste Sensor-Logs
      </div>

      {latestSensorLogsError ? (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {latestSensorLogsError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <LatestSensorLogCard
          title="🔋 batt_log"
          loading={latestSensorLogsLoading}
          error={latestSensorLogErrors.batt}
          hasData={Boolean(latestSensorLogs.batt)}
          valueText={battValueText}
          timestampText={formatLogTimestamp(
            latestSensorLogs.batt?.measured_at || latestSensorLogs.batt?.created_at
          )}
        />

        <LatestSensorLogCard
          title="📍 gps_log"
          loading={latestSensorLogsLoading}
          error={latestSensorLogErrors.gps}
          hasData={Boolean(latestSensorLogs.gps)}
          valueLabel="Ort"
          valueText={gpsValueText}
          timestampText={formatLogTimestamp(
            latestSensorLogs.gps?.fix_time_utc || latestSensorLogs.gps?.created_at
          )}
        />

        <LatestSensorLogCard
          title="🌡️ temperature_log"
          loading={latestSensorLogsLoading}
          error={latestSensorLogErrors.temperature}
          hasData={Boolean(latestSensorLogs.temperature)}
          valueText={temperatureValueText}
          timestampText={formatLogTimestamp(
            latestSensorLogs.temperature?.measured_at || latestSensorLogs.temperature?.created_at
          )}
        />
      </div>
    </section>
  );
}

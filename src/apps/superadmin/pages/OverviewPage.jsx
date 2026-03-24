import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import BuildUpdatePanel from '@/apps/superadmin/components/BuildUpdatePanel';
import ClubCardsGrid from '@/apps/superadmin/features/overview/components/ClubCardsGrid';
import ClubStatusFilterSection from '@/apps/superadmin/features/overview/components/ClubStatusFilterSection';
import LatestSensorLogsSection from '@/apps/superadmin/features/overview/components/LatestSensorLogsSection';
import OverviewTotalsSection from '@/apps/superadmin/features/overview/components/OverviewTotalsSection';
import { useLatestSensorLogs } from '@/apps/superadmin/features/overview/hooks/useLatestSensorLogs';
import { useOverviewCoreData } from '@/apps/superadmin/features/overview/hooks/useOverviewCoreData';
import { useSuperAdminHeaderTitle } from '@/apps/superadmin/context/headerTitleContext';
import {
  buildLatestClubActivityByClub,
  buildOverviewStats,
  buildStatusCounts,
  CLUB_STATUS_FILTER,
  filterClubsByStatus,
  PAGE_TITLE,
} from '@/apps/superadmin/features/overview/utils/overviewUtils';

export default function OverviewPage() {
  const setSuperAdminHeaderTitle = useSuperAdminHeaderTitle();
  const [clubFilter, setClubFilter] = useState(CLUB_STATUS_FILTER.ACTIVE);

  const {
    loading,
    error,
    clubs,
    memberships,
    fishes,
    weatherRequestRows,
    supportsWeatherMetrics,
  } = useOverviewCoreData();

  const {
    latestSensorLogsLoading,
    latestSensorLogsError,
    latestSensorLogs,
    latestSensorLogErrors,
    battValueText,
    gpsValueText,
    temperatureValueText,
  } = useLatestSensorLogs();

  useEffect(() => {
    setSuperAdminHeaderTitle(PAGE_TITLE);
  }, [setSuperAdminHeaderTitle]);

  const stats = useMemo(
    () => buildOverviewStats(memberships, fishes, weatherRequestRows),
    [memberships, fishes, weatherRequestRows],
  );
  const latestClubActivityByClub = useMemo(
    () => buildLatestClubActivityByClub(fishes),
    [fishes],
  );

  const statusCounts = useMemo(
    () => buildStatusCounts(clubs, stats),
    [clubs, stats],
  );

  const filteredClubs = useMemo(
    () => filterClubsByStatus(clubs, stats, clubFilter),
    [clubs, stats, clubFilter],
  );

  if (loading) {
    return <Card className="p-4 sm:p-6">Lade Superadmin-Daten…</Card>;
  }

  if (error) {
    return <Card className="p-4 text-red-600 sm:p-6">Fehler: {error}</Card>;
  }

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <BuildUpdatePanel />

      <p className="text-gray-600">Clubs, Mitgliederzahlen, Fänge (club_id-basiert).</p>

      <ClubStatusFilterSection
        clubFilter={clubFilter}
        onChange={setClubFilter}
        statusCounts={statusCounts}
      />

      <OverviewTotalsSection
        stats={stats}
        supportsWeatherMetrics={supportsWeatherMetrics}
      />

      <LatestSensorLogsSection
        latestSensorLogsLoading={latestSensorLogsLoading}
        latestSensorLogsError={latestSensorLogsError}
        latestSensorLogErrors={latestSensorLogErrors}
        latestSensorLogs={latestSensorLogs}
        battValueText={battValueText}
        gpsValueText={gpsValueText}
        temperatureValueText={temperatureValueText}
      />

      <ClubCardsGrid
        filteredClubs={filteredClubs}
        stats={stats}
        supportsWeatherMetrics={supportsWeatherMetrics}
        latestClubActivityByClub={latestClubActivityByClub}
      />
    </Card>
  );
}

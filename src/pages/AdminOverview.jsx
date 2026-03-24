import { useMemo } from 'react';
import { Card } from '@/components/ui';
import { getActiveClubId } from '@/utils/clubId';
import { formatDateOnly, formatDateTime, parseTimestamp } from '@/utils/dateUtils';
import ActiveUsersSection from '@/features/adminOverview/components/ActiveUsersSection';
import ExternalCatchesSection from '@/features/adminOverview/components/ExternalCatchesSection';
import LatestCatchSection from '@/features/adminOverview/components/LatestCatchSection';
import OneSignalDebugSection from '@/features/adminOverview/components/OneSignalDebugSection';
import PageViewsSection from '@/features/adminOverview/components/PageViewsSection';
import PushSubscribersSection from '@/features/adminOverview/components/PushSubscribersSection';
import RecentBlanksSection from '@/features/adminOverview/components/RecentBlanksSection';
import RegisteredUsersSection from '@/features/adminOverview/components/RegisteredUsersSection';
import SensorLogsSection from '@/features/adminOverview/components/SensorLogsSection';
import TakenCatchesSection from '@/features/adminOverview/components/TakenCatchesSection';
import { useAdminOverviewCoreData } from '@/features/adminOverview/hooks/useAdminOverviewCoreData';
import { useAdminPageViews } from '@/features/adminOverview/hooks/useAdminPageViews';
import { useAdminTelemetry } from '@/features/adminOverview/hooks/useAdminTelemetry';

export default function AdminOverview({
  clubIdOverride = null,
  title = '🔧 Adminbereich‑Übersicht',
  showTitle = true,
  embedded = false,
  collapseSections = false,
  sectionsDefaultOpen = true,
  showTelemetry = true,
  showPageViews = true,
  showOneSignalDebug = true,
} = {}) {
  const currentYear = new Date().getFullYear();
  const effectiveClubId = useMemo(() => {
    if (clubIdOverride && typeof clubIdOverride === 'string') return clubIdOverride;
    return getActiveClubId();
  }, [clubIdOverride]);

  const {
    activeUsers,
    latestCatch,
    nameShort,
    recentBlanks,
    allProfiles,
    externalCatches,
    takenCatches,
    pushByAngler,
    pushDeviceSummary,
  } = useAdminOverviewCoreData({ effectiveClubId });

  const {
    telemetryLoading,
    telemetryError,
    battLatest,
    battCount,
    gpsLatest,
    gpsCount,
    temperatureLatest,
    temperatureCount,
  } = useAdminTelemetry({ showTelemetry });

  const {
    pageViewTotal,
    pageViewRangeLabel,
    pageViewYearFilter,
    pageViewYearOptions,
    setPageViewYearFilter,
    pageViewAggregates,
    pageViewAverage,
    pageViewSectionLoading,
    pageViewSectionError,
    pageViewMonthlyStatsVisible,
    pageViewTopAnglers,
    pageViewUniqueOpenPath,
    uniqueAnglersForPath,
    setPageViewUniqueOpenPath,
    getBuildInfoForUser,
  } = useAdminPageViews({
    effectiveClubId,
    currentYear,
    enabled: showPageViews,
  });

  const formatDateTimeLabel = (value) => {
    const parsed = parseTimestamp(value);
    if (!parsed) return 'unbekannt';
    return formatDateTime(parsed);
  };

  const formatDateLabel = (value) => {
    const parsed = parseTimestamp(value);
    if (!parsed) return 'unbekannt';
    return formatDateOnly(parsed);
  };

  const listItemClass = 'list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-200';
  const fallbackTextClass = 'text-sm text-gray-700 dark:text-gray-300';
  const metaTextClass = 'text-xs text-gray-400 dark:text-gray-400';
  const cardClassName = embedded
    ? 'space-y-4 text-gray-800 dark:text-gray-100'
    : 'mx-auto max-w-4xl p-4 text-gray-800 dark:text-gray-100';
  const titleClassName = embedded
    ? 'mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100'
    : 'mb-6 text-2xl font-bold text-blue-700 dark:text-blue-400';
  const sectionCollapseProps = {
    collapsible: collapseSections,
    defaultOpen: sectionsDefaultOpen,
  };

  return (
    <Card className={cardClassName}>
      {showTitle ? <h2 className={titleClassName}>{title}</h2> : null}

      {showTelemetry ? (
        <SensorLogsSection
          telemetryLoading={telemetryLoading}
          telemetryError={telemetryError}
          battLatest={battLatest}
          battCount={battCount}
          gpsLatest={gpsLatest}
          gpsCount={gpsCount}
          temperatureLatest={temperatureLatest}
          temperatureCount={temperatureCount}
          formatDateTimeLabel={formatDateTimeLabel}
          {...sectionCollapseProps}
        />
      ) : null}

      <LatestCatchSection
        latestCatch={latestCatch}
        nameShort={nameShort}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
        {...sectionCollapseProps}
      />

      <RecentBlanksSection
        recentBlanks={recentBlanks}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
        {...sectionCollapseProps}
      />

      <ActiveUsersSection
        activeUsers={activeUsers}
        formatDateTimeLabel={formatDateTimeLabel}
        getBuildInfoForUser={getBuildInfoForUser}
        listItemClass={listItemClass}
        metaTextClass={metaTextClass}
        {...sectionCollapseProps}
      />

      <TakenCatchesSection
        takenCatches={takenCatches}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
        {...sectionCollapseProps}
      />

      <ExternalCatchesSection
        externalCatches={externalCatches}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
        {...sectionCollapseProps}
      />

      {showPageViews ? (
        <PageViewsSection
          pageViewLoading={pageViewSectionLoading}
          pageViewTotal={pageViewTotal}
          pageViewRangeLabel={pageViewRangeLabel}
          pageViewYearFilter={pageViewYearFilter}
          pageViewYearOptions={pageViewYearOptions}
          setPageViewYearFilter={setPageViewYearFilter}
          pageViewAggregates={pageViewAggregates}
          pageViewAverage={pageViewAverage}
          pageViewError={pageViewSectionError}
          pageViewMonthlyStats={pageViewMonthlyStatsVisible}
          pageViewTopAnglers={pageViewTopAnglers}
          fallbackTextClass={fallbackTextClass}
          formatDateTimeLabel={formatDateTimeLabel}
          pageViewUniqueOpenPath={pageViewUniqueOpenPath}
          uniqueAnglersForPath={uniqueAnglersForPath}
          setPageViewUniqueOpenPath={setPageViewUniqueOpenPath}
          {...sectionCollapseProps}
        />
      ) : null}

      <RegisteredUsersSection
        allProfiles={allProfiles}
        formatDateLabel={formatDateLabel}
        getBuildInfoForUser={getBuildInfoForUser}
        listItemClass={listItemClass}
        metaTextClass={metaTextClass}
        {...sectionCollapseProps}
      />

      <PushSubscribersSection
        pushByAngler={pushByAngler}
        pushDeviceSummary={pushDeviceSummary}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
        {...sectionCollapseProps}
      />

      {showOneSignalDebug ? <OneSignalDebugSection {...sectionCollapseProps} /> : null}
    </Card>
  );
}

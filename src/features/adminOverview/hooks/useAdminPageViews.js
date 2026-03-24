import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { navItemsFor } from '@/config/navItems';
import {
  PAGE_VIEW_MAX_FETCH_PAGES,
  PAGE_VIEW_PAGE_SIZE,
  PAGE_VIEW_YEAR_FILTER_ALL,
  buildPageViewAnglersByPath,
  buildPageViewMonthlyStats,
  buildPageViewTopAnglers,
  filterPageViewRows,
  filterPageViewRowsByYear,
  getPageViewAvailableYears,
  getUniqueAnglersForPath,
  groupPageViews,
  normalizeName,
  normalizePath,
} from '@/features/adminOverview/pageViewUtils';
import {
  PAGE_VIEW_EXCLUDED_ANGLER,
  buildMonthlyStatsFromDbCounts,
  formatBuildLabel,
  getPageViewRange,
  isMissingPageViewRpcError,
  parseBuildMetadata,
} from '@/features/adminOverview/utils/adminOverviewUtils';
import { parseTimestamp } from '@/utils/dateUtils';

export function useAdminPageViews({ effectiveClubId, currentYear, enabled = true }) {
  const currentYearFilter = String(currentYear);
  const [pageViewRows, setPageViewRows] = useState([]);
  const [pageViewYearFilter, setPageViewYearFilter] = useState(currentYearFilter);
  const [pageViewLoading, setPageViewLoading] = useState(false);
  const [pageViewError, setPageViewError] = useState('');
  const [pageViewStatsLoading, setPageViewStatsLoading] = useState(false);
  const [pageViewStatsError, setPageViewStatsError] = useState('');
  const [pageViewDbYears, setPageViewDbYears] = useState(null);
  const [pageViewDbMonthlyCounts, setPageViewDbMonthlyCounts] = useState(null);
  const [pageViewUniqueOpenPath, setPageViewUniqueOpenPath] = useState(null);

  const navLabelMap = useMemo(() => {
    const map = new Map();
    const addItem = (item) => {
      if (!item) return;
      if (item.path) map.set(normalizePath(item.path), item.label);
      if (Array.isArray(item.children)) item.children.forEach(addItem);
    };

    navItemsFor({
      hasFeatureForRole: () => true,
      hasAtLeastRole: () => true,
    }).forEach(addItem);

    [
      ['/settings', 'Einstellungen'],
    ].forEach(([path, label]) => {
      map.set(normalizePath(path), label);
    });

    return map;
  }, []);

  const labelForPath = useCallback(
    (value) => {
      if (!value) return '—';
      if (typeof value !== 'string') return String(value);
      if (value === '—') return value;
      if (value.includes('://')) return value;
      const normalized = normalizePath(value);
      return navLabelMap.get(normalized) || value;
    },
    [navLabelMap],
  );

  const filteredPageViewRows = useMemo(() => filterPageViewRows(pageViewRows), [pageViewRows]);
  const pageViewAvailableYearsFallback = useMemo(
    () => getPageViewAvailableYears(filteredPageViewRows),
    [filteredPageViewRows],
  );
  const pageViewAvailableYears = useMemo(
    () => Array.from(new Set([currentYear, ...(pageViewDbYears || pageViewAvailableYearsFallback)]))
      .sort((a, b) => b - a),
    [currentYear, pageViewDbYears, pageViewAvailableYearsFallback],
  );
  const pageViewRowsInScope = useMemo(
    () => filterPageViewRowsByYear(filteredPageViewRows, pageViewYearFilter),
    [filteredPageViewRows, pageViewYearFilter],
  );
  const pageViewYearOptions = useMemo(
    () => [
      { value: PAGE_VIEW_YEAR_FILTER_ALL, label: 'Alle' },
      ...pageViewAvailableYears.map((year) => ({ value: String(year), label: String(year) })),
    ],
    [pageViewAvailableYears],
  );
  const pageViewRangeLabel = pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL
    ? 'Alle Jahre'
    : `Gesamtjahr ${pageViewYearFilter}`;

  const pageViewAggregates = useMemo(
    () => groupPageViews(pageViewRowsInScope).map((entry) => ({
      ...entry,
      label: labelForPath(entry.path),
    })),
    [pageViewRowsInScope, labelForPath],
  );
  const pageViewAnglersByPath = useMemo(
    () => buildPageViewAnglersByPath(pageViewRowsInScope),
    [pageViewRowsInScope],
  );
  const uniqueAnglersForPath = useCallback((path) => {
    return getUniqueAnglersForPath(pageViewAnglersByPath, path);
  }, [pageViewAnglersByPath]);
  const pageViewMonthlyStatsFallback = useMemo(
    () => buildPageViewMonthlyStats(pageViewRowsInScope, pageViewYearFilter),
    [pageViewRowsInScope, pageViewYearFilter],
  );
  const pageViewMonthlyStatsFromDb = useMemo(
    () => buildMonthlyStatsFromDbCounts(pageViewDbMonthlyCounts, pageViewYearFilter),
    [pageViewDbMonthlyCounts, pageViewYearFilter],
  );
  const pageViewDbStatsActive = Array.isArray(pageViewMonthlyStatsFromDb);
  const pageViewMonthlyStats = pageViewDbStatsActive
    ? pageViewMonthlyStatsFromDb
    : pageViewMonthlyStatsFallback;
  const pageViewMonthlyStatsVisible = useMemo(
    () => pageViewMonthlyStats.filter((row) => (Number(row?.total) || 0) > 0),
    [pageViewMonthlyStats],
  );
  const pageViewTotal = pageViewDbStatsActive
    ? pageViewMonthlyStats.reduce((sum, row) => sum + (Number(row?.total) || 0), 0)
    : pageViewRowsInScope.length;
  const pageViewAverage = pageViewAggregates.length > 0
    ? (pageViewTotal / pageViewAggregates.length).toFixed(1)
    : '0.0';
  const pageViewTopAnglers = useMemo(
    () => buildPageViewTopAnglers(pageViewRowsInScope),
    [pageViewRowsInScope],
  );
  const pageViewSectionLoading = pageViewLoading || pageViewStatsLoading;
  const pageViewSectionError = pageViewError || pageViewStatsError;
  const latestBuildByAngler = useMemo(() => {
    const byAngler = new Map();

    (pageViewRows || []).forEach((entry) => {
      const key = normalizeName(entry?.angler);
      if (!key) return;

      const buildInfo = parseBuildMetadata(entry?.metadata);
      if (!buildInfo.build && !buildInfo.commit) return;
      const createdAt = parseTimestamp(entry?.created_at);
      if (!createdAt) return;

      const prev = byAngler.get(key);
      if (!prev || createdAt > prev.createdAt) {
        byAngler.set(key, {
          ...buildInfo,
          createdAt,
        });
      }
    });

    return byAngler;
  }, [pageViewRows]);
  const getBuildInfoForUser = useCallback(
    (rawName) => {
      const key = normalizeName(rawName);
      if (!key) return null;
      const info = latestBuildByAngler.get(key);
      if (!info) return null;
      const label = formatBuildLabel(info);
      if (!label) return null;
      return {
        label,
        createdAt: info.createdAt?.toISOString?.() || null,
      };
    },
    [latestBuildByAngler],
  );

  useEffect(() => {
    let active = true;

    async function loadPageViews() {
      if (!enabled) {
        setPageViewRows([]);
        setPageViewLoading(false);
        setPageViewError('');
        return;
      }
      if (!active) return;
      setPageViewLoading(true);
      setPageViewError('');

      const clubId = effectiveClubId;
      if (!clubId) {
        setPageViewRows([]);
        setPageViewLoading(false);
        return;
      }

      const snapshotIso = new Date().toISOString();
      const { fromIso, toIso, upperBoundOp } = getPageViewRange(pageViewYearFilter, snapshotIso);

      const allRows = [];
      let rangeStart = 0;
      let pagesLoaded = 0;
      let encounteredError = null;

      while (pagesLoaded < PAGE_VIEW_MAX_FETCH_PAGES) {
        const rangeEnd = rangeStart + PAGE_VIEW_PAGE_SIZE - 1;
        let query = supabase
          .from('page_views')
          .select('id, path, angler, created_at, metadata')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeEnd);

        if (fromIso) query = query.gte('created_at', fromIso);
        if (toIso) {
          query = upperBoundOp === 'lt'
            ? query.lt('created_at', toIso)
            : query.lte('created_at', toIso);
        }

        const { data, error } = await query;

        if (!active) return;

        if (error) {
          encounteredError = error;
          break;
        }

        if (Array.isArray(data) && data.length > 0) {
          allRows.push(...data);
          if (data.length < PAGE_VIEW_PAGE_SIZE) break;
        } else {
          break;
        }

        rangeStart += PAGE_VIEW_PAGE_SIZE;
        pagesLoaded += 1;
      }

      if (encounteredError) {
        console.error('PageViews: Laden fehlgeschlagen', encounteredError);
        setPageViewError(encounteredError.message || 'Page-Views konnten nicht geladen werden.');
        setPageViewRows([]);
      } else {
        setPageViewRows(allRows);
        if (pagesLoaded >= PAGE_VIEW_MAX_FETCH_PAGES) {
          setPageViewError('Page-Views wurden nur teilweise geladen (Maximalgrenze erreicht).');
        }
      }

      setPageViewLoading(false);
    }

    void loadPageViews();
    return () => {
      active = false;
    };
  }, [effectiveClubId, enabled, pageViewYearFilter]);

  useEffect(() => {
    let active = true;

    async function loadPageViewStats() {
      if (!enabled) {
        setPageViewDbYears(null);
        setPageViewDbMonthlyCounts(null);
        setPageViewStatsLoading(false);
        setPageViewStatsError('');
        return;
      }

      setPageViewStatsLoading(true);
      setPageViewStatsError('');

      const clubId = effectiveClubId;
      if (!clubId) {
        setPageViewDbYears(null);
        setPageViewDbMonthlyCounts(null);
        setPageViewStatsLoading(false);
        return;
      }

      const selectedYear = pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL
        ? null
        : Number(pageViewYearFilter);

      try {
        const [yearsResult, monthlyResult] = await Promise.all([
          supabase.rpc('admin_page_view_years', {
            p_club_id: clubId,
            p_excluded_angler: PAGE_VIEW_EXCLUDED_ANGLER,
          }),
          supabase.rpc('admin_page_view_monthly_counts', {
            p_club_id: clubId,
            p_year: Number.isInteger(selectedYear) ? selectedYear : null,
            p_excluded_angler: PAGE_VIEW_EXCLUDED_ANGLER,
          }),
        ]);

        if (!active) return;

        if (isMissingPageViewRpcError(yearsResult.error) || isMissingPageViewRpcError(monthlyResult.error)) {
          setPageViewDbYears(null);
          setPageViewDbMonthlyCounts(null);
          return;
        }

        if (yearsResult.error || monthlyResult.error) {
          setPageViewStatsError(
            yearsResult.error?.message
              || monthlyResult.error?.message
              || 'Page-View-Statistik konnte nicht vollständig geladen werden.',
          );
          setPageViewDbYears(null);
          setPageViewDbMonthlyCounts(null);
          return;
        }

        const years = (yearsResult.data || [])
          .map((row) => Number(row?.year))
          .filter((year) => Number.isInteger(year))
          .sort((a, b) => b - a);

        setPageViewDbYears(years);
        setPageViewDbMonthlyCounts(Array.isArray(monthlyResult.data) ? monthlyResult.data : []);
      } catch (error) {
        if (!active) return;
        setPageViewStatsError(error?.message || 'Page-View-Statistik konnte nicht geladen werden.');
        setPageViewDbYears(null);
        setPageViewDbMonthlyCounts(null);
      } finally {
        if (active) setPageViewStatsLoading(false);
      }
    }

    void loadPageViewStats();
    return () => {
      active = false;
    };
  }, [effectiveClubId, enabled, pageViewYearFilter]);

  useEffect(() => {
    if (pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL) return;
    const selectedYear = Number(pageViewYearFilter);
    if (!Number.isInteger(selectedYear)) {
      setPageViewYearFilter(currentYearFilter);
      return;
    }
    if (!pageViewAvailableYears.includes(selectedYear)) {
      setPageViewYearFilter(currentYearFilter);
    }
  }, [currentYearFilter, pageViewAvailableYears, pageViewYearFilter]);

  useEffect(() => {
    setPageViewUniqueOpenPath(null);
  }, [pageViewAggregates]);

  return {
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
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import ActivitySection from '@/features/boardOverview/components/ActivitySection';
import MetricsSection from '@/features/boardOverview/components/MetricsSection';
import FishTableSection from '@/features/boardOverview/components/FishTableSection';
import YearSelectorSection from '@/features/boardOverview/components/YearSelectorSection';
import { MonthlyCatchSection, SessionSection } from '@/features/boardOverview/components/FishTrendsSection';
import SeasonalSection from '@/features/boardOverview/components/SeasonalSection';
import CrayfishSection from '@/features/boardOverview/components/CrayfishSection';
import AdminMembersManage from '@/pages/AdminMembersManage';
import { Card } from '@/components/ui';
import { hasKnownFishName, normalizeFishName } from '@/utils/fishValidation';
import {
  fetchProfiles,
  fetchWhitelist,
  fetchFishAggregates,
  fetchCrayfishCatches,
} from '@/services/boardService';
import { isHomeWaterEntry } from '@/utils/location';
import {
  ACTIVITY_RANGE_OPTIONS,
  buildSizeDistribution,
  filterEntriesByRange,
  formatDate,
  formatDecimal,
  formatNumber,
  formatPercent,
  getColorStyleByFishName,
  getMonthsForAllYears,
  getMonthsForSelection,
  normalizeRoleValue,
} from '@/features/boardOverview/utils';
import { PUBLIC_FROM } from '@/constants/visibility';
import { withTimeout } from '@/utils/async';

export default function BoardOverview() {
  const currentYear = new Date().getFullYear();
  const [profiles, setProfiles] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [fishEntries, setFishEntries] = useState([]);
  const [activityFishEntries, setActivityFishEntries] = useState([]);
  const [fishStatsLoading, setFishStatsLoading] = useState(false);
  const [fishStatsError, setFishStatsError] = useState('');
  const [crayfishEntries, setCrayfishEntries] = useState([]);
  const [crayfishLoading, setCrayfishLoading] = useState(false);
  const [crayfishError, setCrayfishError] = useState('');
  const [showCrayfishAnglers, setShowCrayfishAnglers] = useState(false);
  const [showActiveAnglers, setShowActiveAnglers] = useState(false);
  const [selectedFishDetail, setSelectedFishDetail] = useState('');
  const [activeSeasonalFish, setActiveSeasonalFish] = useState([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activityRange, setActivityRange] = useState('30d');
  const [clubCoords, setClubCoords] = useState(null);
  const detailSectionRef = useRef(null);

  const loadClubCoords = useCallback(async () => {
    try {
      const clubId = getActiveClubId();
      if (!clubId) {
        setClubCoords(null);
        return;
      }
      const { data, error } = await withTimeout(
        supabase
          .from('clubs')
          .select('weather_lat, weather_lon')
          .eq('id', clubId)
          .maybeSingle(),
        10000,
        'BoardOverview Club-Koordinaten timeout'
      );
      if (error) throw error;

      const lat = Number(data?.weather_lat);
      const lon = Number(data?.weather_lon);
      setClubCoords(Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null);
    } catch (error) {
      setClubCoords(null);
      console.warn('BoardOverview: Club-Koordinaten konnten nicht geladen werden.', error);
    }
  }, []);

  useEffect(() => {
    void loadClubCoords();
  }, [loadClubCoords]);

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    fishEntries.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;
      years.add(ts.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, fishEntries]);

  const yearOptions = useMemo(() => ['all', ...availableYears], [availableYears]);
  const selectedYearLabel = selectedYear === 'all' ? 'Alle Jahre' : selectedYear;
  const activityRangeLabel = useMemo(() => {
    const option = ACTIVITY_RANGE_OPTIONS.find((item) => item.value === activityRange);
    return option?.label || 'Aktuelles Jahr';
  }, [activityRange]);

  useEffect(() => {
    if (availableYears.length === 0) {
      setSelectedYear(currentYear);
      return;
    }
    if (selectedYear == null) {
      setSelectedYear(currentYear);
      return;
    }
    if (selectedYear !== 'all' && !availableYears.includes(selectedYear)) {
      setSelectedYear(currentYear);
    }
  }, [availableYears, currentYear, selectedYear]);

  const filteredFishEntries = useMemo(() => {
    if (selectedYear === 'all') return fishEntries;
    if (!Number.isFinite(selectedYear)) return fishEntries;
    return fishEntries.filter((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return false;
      return ts.getFullYear() === selectedYear;
    });
  }, [fishEntries, selectedYear]);

  const yearScopedActivityEntries = useMemo(() => {
    if (selectedYear === 'all') return activityFishEntries;
    if (!Number.isFinite(selectedYear)) return activityFishEntries;
    return activityFishEntries.filter((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return false;
      return ts.getFullYear() === selectedYear;
    });
  }, [activityFishEntries, selectedYear]);

  const activityFilteredFishEntries = useMemo(() => {
    const latestTimestamp = yearScopedActivityEntries.reduce((max, entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
      if (!Number.isFinite(ts)) return max;
      return Math.max(max, ts);
    }, 0);
    const referenceTime = latestTimestamp || Date.now();
    return filterEntriesByRange(yearScopedActivityEntries, activityRange, referenceTime);
  }, [yearScopedActivityEntries, activityRange]);

  const diagramSessionEntries = useMemo(() => yearScopedActivityEntries, [yearScopedActivityEntries]);

  const stats = useMemo(() => {
    const totalWhitelist = whitelist.length;

    let memberCount = 0;
    let guestCount = 0;
    let testerCount = 0;
    let inactiveMembers = 0;
    let leadership = 0;
    let newMembers30d = 0;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    profiles.forEach((profile) => {
      const normalizedRole = normalizeRoleValue(profile?.role);
      const createdAt = profile?.created_at ? new Date(profile.created_at).getTime() : null;

      if (normalizedRole === 'inactive') {
        inactiveMembers += 1;
        return;
      }

      if (normalizedRole === 'gast') {
        guestCount += 1;
      } else if (normalizedRole === 'tester') {
        testerCount += 1;
      } else {
        memberCount += 1;
      }

      if (normalizedRole === 'vorstand' || normalizedRole === 'admin') {
        leadership += 1;
      }

      if (createdAt && !Number.isNaN(createdAt) && createdAt >= thirtyDaysAgo) {
        newMembers30d += 1;
      }
    });

    return {
      totalWhitelist,
      newMembers30d,
      memberCount,
      guestCount,
      testerCount,
      inactiveMembers,
      leadership,
    };
  }, [profiles, whitelist]);

  const fishStats = useMemo(() => {
    const grouped = filteredFishEntries.reduce((acc, entry) => {
      const fishName = normalizeFishName(entry?.fish);
      if (!hasKnownFishName(fishName) || entry?.blank === true) return acc;

      if (!acc[fishName]) acc[fishName] = { fish: fishName, total: 0, taken: 0, entries: [] };
      acc[fishName].total += 1;
      if (entry?.taken === true) acc[fishName].taken += 1;
      acc[fishName].entries.push({
        size: entry?.size ?? null,
        taken: entry?.taken === true,
      });
      return acc;
    }, {});

    return Object.values(grouped).sort(
      (a, b) => b.total - a.total || a.fish.localeCompare(b.fish)
    );
  }, [filteredFishEntries]);

  const fishOverviewTotals = useMemo(() => {
    if (!Array.isArray(fishStats) || fishStats.length === 0) {
      return { total: 0, taken: 0 };
    }

    return fishStats.reduce(
      (acc, item) => {
        acc.total += Number(item?.total) || 0;
        acc.taken += Number(item?.taken) || 0;
        return acc;
      },
      { total: 0, taken: 0 }
    );
  }, [fishStats]);

  const fishDetailData = useMemo(() => {
    if (!selectedFishDetail) return null;
    const entry = fishStats.find((item) => item.fish === selectedFishDetail);
    if (!entry) return null;
    const entries = Array.isArray(entry.entries) ? entry.entries : [];
    const distribution = buildSizeDistribution(entries, entry.fish);
    return {
      ...distribution,
      fish: entry.fish,
      total: entry.total,
      taken: entry.taken,
    };
  }, [selectedFishDetail, fishStats]);

  const activityStats = useMemo(() => {
    const months = getMonthsForAllYears();
    const monthlyMap = {};
    const catchSessionsMap = {};
    const blankSessionsMap = {};
    months.forEach((m) => {
      monthlyMap[m.key] = { total: 0, taken: 0 };
      catchSessionsMap[m.key] = new Set();
      blankSessionsMap[m.key] = 0;
    });

    const catchAnglersSet = new Set();
    const blankAnglersSet = new Set();
    const sessionSet = { catch: new Set(), blankCount: 0 };
    let totalCatchCount = 0;

    const weekdayCounts = Array(7).fill(0);
    const hourCounts = Array(24).fill(0);

    activityFilteredFishEntries.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;

      const monthKey = `all-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      const monthBucket = monthlyMap[monthKey];
      if (!monthBucket) return;

      const dateKey = ts.toISOString().slice(0, 10);
      const anglerKey = (entry?.angler || 'Unbekannt').trim() || 'Unbekannt';
      const isBlank = entry?.blank === true;
      const fishName = normalizeFishName(entry?.fish);
      const hasFish = hasKnownFishName(fishName) && entry.blank !== true;

      if (isBlank) {
        const hour = ts.getHours();
        const weekday = ts.getDay();
        hourCounts[hour] += 1;
        weekdayCounts[weekday] += 1;
        blankSessionsMap[monthKey] += 1;
        blankAnglersSet.add(anglerKey);
        sessionSet.blankCount += 1;
        return;
      }

      if (!hasFish) return;

      monthBucket.total += 1;
      if (entry?.taken === true) monthBucket.taken += 1;
      catchSessionsMap[monthKey].add(`${anglerKey}__${dateKey}`);
      catchAnglersSet.add(anglerKey);
      sessionSet.catch.add(`${anglerKey}__${dateKey}`);
      totalCatchCount += 1;

      const hour = ts.getHours();
      const weekday = ts.getDay();
      hourCounts[hour] += 1;
      weekdayCounts[weekday] += 1;
    });

    const monthlyCatchSeries = months.map((m) => ({
      label: m.label,
      total: monthlyMap[m.key].total,
      taken: monthlyMap[m.key].taken,
    }));

    const blankVsCatchSeries = months.map((m) => {
      const catchSessions = catchSessionsMap[m.key]?.size || 0;
      const blankSessions = blankSessionsMap[m.key] || 0;
      return {
        label: m.label,
        catchSessions,
        blankSessions,
        totalSessions: catchSessions + blankSessions,
      };
    });

    const weekdayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const topWeekdays = weekdayCounts
      .map((count, index) => ({ label: weekdayNames[index], count }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 3);

    const topHours = hourCounts
      .map((count, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, count }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 3);

    const catchSessions = sessionSet.catch.size;
    const blankSessions = sessionSet.blankCount;
    const totalSessions = catchSessions + blankSessions;
    const blankShare = totalSessions > 0 ? blankSessions / totalSessions : 0;
    const avgCatchesPerCatchDay = catchSessions > 0 ? totalCatchCount / catchSessions : 0;
    const activeAnglerNames = Array.from(new Set([...catchAnglersSet, ...blankAnglersSet])).sort(
      (a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' })
    );

    return {
      monthlyCatchSeries,
      blankVsCatchSeries,
      topWeekdays,
      topHours,
      activeAnglers: activeAnglerNames.length,
      activeAnglerNames,
      avgCatchesPerCatchDay,
      catchSessions,
      blankSessions,
      blankShare,
    };
  }, [activityFilteredFishEntries]);

  const diagramStats = useMemo(() => {
    const months = getMonthsForSelection(selectedYear);
    const allYearsMode = selectedYear === 'all';
    const monthlyMap = {};
    const catchSessionsMap = {};
    const blankSessionsMap = {};
    months.forEach((m) => {
      monthlyMap[m.key] = { total: 0, taken: 0 };
      catchSessionsMap[m.key] = new Set();
      blankSessionsMap[m.key] = new Set();
    });

    // Monatliche Fänge (nur Catches, keine Schneider)
    filteredFishEntries.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;

      const monthKey = allYearsMode
        ? `all-${String(ts.getMonth() + 1).padStart(2, '0')}`
        : `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      const monthBucket = monthlyMap[monthKey];
      if (!monthBucket) return;

      monthBucket.total += 1;
      if (entry?.taken === true) monthBucket.taken += 1;
    });

    // Sessions (Catch + Schneider) auf Basis der kombinierten Activity-Einträge
    diagramSessionEntries.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;

      const monthKey = allYearsMode
        ? `all-${String(ts.getMonth() + 1).padStart(2, '0')}`
        : `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      if (!catchSessionsMap[monthKey] || !blankSessionsMap[monthKey]) return;

      const dateKey = ts.toISOString().slice(0, 10);
      const anglerKey = (entry?.angler || 'Unbekannt').trim() || 'Unbekannt';
      const isBlank = entry?.blank === true;
      const fishName = normalizeFishName(entry?.fish);
      const hasFish = hasKnownFishName(fishName) && entry.blank !== true;

      if (isBlank) {
        blankSessionsMap[monthKey].add(`${anglerKey}__${dateKey}`);
        return;
      }

      if (!hasFish) return;
      catchSessionsMap[monthKey].add(`${anglerKey}__${dateKey}`);
    });

    const monthlyCatchSeries = months.map((m) => ({
      label: m.label,
      total: monthlyMap[m.key].total,
      taken: monthlyMap[m.key].taken,
    }));

    const blankVsCatchSeries = months.map((m) => {
      const catchSessions = catchSessionsMap[m.key]?.size || 0;
      const blankSessions = blankSessionsMap[m.key]?.size || 0;
      return {
        label: m.label,
        catchSessions,
        blankSessions,
        totalSessions: catchSessions + blankSessions,
      };
    });

    return { monthlyCatchSeries, blankVsCatchSeries };
  }, [filteredFishEntries, diagramSessionEntries, selectedYear]);

  const monthlyMaxTotal = useMemo(() => {
    if (!diagramStats?.monthlyCatchSeries?.length) return 1;
    return Math.max(1, ...diagramStats.monthlyCatchSeries.map((item) => item.total || 0));
  }, [diagramStats]);

  const sessionMaxTotal = useMemo(() => {
    if (!diagramStats?.blankVsCatchSeries?.length) return 1;
    return Math.max(
      1,
      ...diagramStats.blankVsCatchSeries.map((item) => item.totalSessions || 0)
    );
  }, [diagramStats]);

  const crayfishStats = useMemo(() => {
    if (!Array.isArray(crayfishEntries) || crayfishEntries.length === 0) {
      return {
        totalCount: 0,
        entriesCount: 0,
        bySpecies: [],
        last30d: 0,
        uniqueAnglers: 0,
        anglerNames: [],
      };
    }

    const bySpeciesMap = new Map();
    const anglers = new Set();
    let totalCount = 0;
    let entriesCount = 0;
    let last30d = 0;
    const now = Date.now();
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;

    crayfishEntries.forEach((entry) => {
      const species = entry?.species ? String(entry.species).trim() : 'Unbekannt';
      const count = Number(entry?.count) || 0;
      const ts = entry?.catch_timestamp ? new Date(entry.catch_timestamp).getTime() : null;
      const angler = entry?.angler ? String(entry.angler).trim() : 'Unbekannt';

      entriesCount += 1;
      totalCount += count;
      anglers.add(angler);

      bySpeciesMap.set(species, (bySpeciesMap.get(species) || 0) + count);

      if (Number.isFinite(ts) && ts >= cutoff) {
        last30d += count;
      }
    });

    const bySpecies = Array.from(bySpeciesMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'de'));

    return {
      totalCount,
      entriesCount,
      bySpecies,
      last30d,
      uniqueAnglers: anglers.size,
      anglerNames: Array.from(anglers).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' })),
    };
  }, [crayfishEntries]);

  const crayfishDateRange = useMemo(() => {
    if (!Array.isArray(crayfishEntries) || crayfishEntries.length === 0) return null;

    let minTs = null;
    let maxTs = null;

    crayfishEntries.forEach((entry) => {
      const ts = entry?.catch_timestamp ? new Date(entry.catch_timestamp).getTime() : null;
      if (!Number.isFinite(ts)) return;
      minTs = minTs == null ? ts : Math.min(minTs, ts);
      maxTs = maxTs == null ? ts : Math.max(maxTs, ts);
    });

    if (minTs == null || maxTs == null) return null;

    return {
      from: new Date(minTs),
      to: new Date(maxTs),
    };
  }, [crayfishEntries]);

  const seasonalStats = useMemo(() => {
    const months = getMonthsForSelection(selectedYear);
    const allYearsMode = selectedYear === 'all';
    const monthMap = months.reduce((map, m) => {
      map[m.key] = { total: 0, fish: {} };
      return map;
    }, {});

    const totalByFish = {};

    filteredFishEntries.forEach((entry) => {
      if (entry?.blank === true) return;
      const fishName = normalizeFishName(entry?.fish);
      if (!hasKnownFishName(fishName)) return;
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;
      const monthKey = allYearsMode
        ? `all-${String(ts.getMonth() + 1).padStart(2, '0')}`
        : `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[monthKey]) return;
      monthMap[monthKey].total += 1;
      monthMap[monthKey].fish[fishName] = (monthMap[monthKey].fish[fishName] || 0) + 1;
      totalByFish[fishName] = (totalByFish[fishName] || 0) + 1;
    });

    const fishList = Object.entries(totalByFish)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'de'))
      .map((fish) => {
        const color = getColorStyleByFishName(fish.name);
        return { ...fish, color };
      });

    const monthStacks = months.map((m) => {
      const bucket = monthMap[m.key];
      const total = bucket.total || 0;
      const parts = fishList.map((fish) => ({
        fish: fish.name,
        count: bucket.fish[fish.name] || 0,
        percent: total > 0 ? ((bucket.fish[fish.name] || 0) / total) * 100 : 0,
        color: fish.color,
      }));

      return { label: m.label, total, parts };
    });

    const legend = fishList.map((fish) => ({
      name: fish.name,
      color: fish.color,
    }));

    return { months: monthStacks, legend };
  }, [filteredFishEntries, selectedYear]);

  const seasonalMaxActiveTotal = useMemo(() => {
    if (!seasonalStats?.months?.length) return 1;
    return Math.max(
      1,
      ...seasonalStats.months.map((month) => {
        const activeParts = month.parts.filter((part) => activeSeasonalFish.includes(part.fish));
        return activeParts.reduce((sum, part) => sum + part.count, 0);
      })
    );
  }, [seasonalStats, activeSeasonalFish]);

  useEffect(() => {
    if (seasonalStats.legend.length === 0) {
      setActiveSeasonalFish([]);
      return;
    }
    setActiveSeasonalFish((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) {
        return seasonalStats.legend.map((item) => item.name);
      }
      const valid = new Set(seasonalStats.legend.map((item) => item.name));
      const next = prev.filter((name) => valid.has(name));
      return next.length > 0 ? next : seasonalStats.legend.map((item) => item.name);
    });
  }, [seasonalStats.legend]);

  const refreshProfiles = useCallback(async () => {
    try {
      const data = await fetchProfiles();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Profile konnten nicht geladen werden.', error);
    }
  }, []);

  const refreshWhitelist = useCallback(async () => {
    try {
      const data = await fetchWhitelist();
      setWhitelist(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Whitelist konnte nicht geladen werden.', error);
    }
  }, []);

  const refreshFishAggregates = useCallback(async () => {
    setFishStatsLoading(true);
    setFishStatsError('');
    try {
      const data = await fetchFishAggregates();
      const publicFromAnalysisTs = PUBLIC_FROM.getTime();
      const items = Array.isArray(data) ? data : [];

      // Analyse-Logik für Fang-/Schneidertage: keine Größenpflicht, kein count_in_stats-Filter
      const analysisCatchEntries = items.filter((entry) => {
        if (entry?.is_marilou === true) return false;
        if (!isHomeWaterEntry(entry, { clubCoords })) return false;

        const ts = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
        if (!Number.isFinite(ts) || ts < publicFromAnalysisTs) return false;

        if (entry?.blank === true) return false;

        if (!hasKnownFishName(entry?.fish)) return false;

        return true;
      });

      const analysisBlankEntries = items.filter((entry) => {
        if (entry?.is_marilou === true) return false;
        if (!isHomeWaterEntry(entry, { clubCoords })) return false;

        const ts = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
        if (!Number.isFinite(ts) || ts < publicFromAnalysisTs) return false;

        return entry?.blank === true;
      });

      setActivityFishEntries([...analysisCatchEntries, ...analysisBlankEntries]);
      setFishEntries(analysisCatchEntries); // Fischstatistik soll mit Analysis übereinstimmen
    } catch (error) {
      setFishStatsError(error.message || 'Fischübersicht konnte nicht geladen werden.');
    } finally {
      setFishStatsLoading(false);
    }
  }, [clubCoords]);

  const refreshCrayfish = useCallback(async () => {
    setCrayfishLoading(true);
    setCrayfishError('');
    try {
      const data = await fetchCrayfishCatches();
      setCrayfishEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      setCrayfishError(error.message || 'Krebsdaten konnten nicht geladen werden.');
    } finally {
      setCrayfishLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
    refreshWhitelist();
    refreshFishAggregates();
    refreshCrayfish();
  }, [refreshProfiles, refreshWhitelist, refreshFishAggregates, refreshCrayfish]);

  useEffect(() => {
    if (!selectedFishDetail) return;
    const stillExists = fishStats.some((item) => item.fish === selectedFishDetail);
    if (!stillExists) setSelectedFishDetail('');
  }, [selectedFishDetail, fishStats]);

  useEffect(() => {
    if (!selectedFishDetail) return;
    if (detailSectionRef.current) {
      detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedFishDetail, fishDetailData]);

  // Whitelist wird nur für Kennzahlen geladen; Aktionen erfolgen in AdminMembers.

  return (
    <Card className="space-y-8">
      <MetricsSection stats={stats} formatNumber={formatNumber} />

      <AdminMembersManage />

      <YearSelectorSection
        yearOptions={yearOptions}
        selectedYear={selectedYear}
        onSelectYear={(value) => setSelectedYear(value)}
        selectedYearLabel={selectedYearLabel}
      />

      <ActivitySection
        activityRange={activityRange}
        activityRangeLabel={activityRangeLabel}
        activityStats={activityStats}
        onSelectRange={(value) => setActivityRange(value)}
        showActiveAnglers={showActiveAnglers}
        onToggleActiveAnglers={() => setShowActiveAnglers((prev) => !prev)}
        formatNumber={formatNumber}
        formatDecimal={formatDecimal}
        formatPercent={formatPercent}
        rangeOptions={ACTIVITY_RANGE_OPTIONS}
      />

      <MonthlyCatchSection
        diagramStats={diagramStats}
        monthlyMaxTotal={monthlyMaxTotal}
        selectedYearLabel={selectedYearLabel}
        formatNumber={formatNumber}
      />

      <SessionSection
        diagramStats={diagramStats}
        sessionMaxTotal={sessionMaxTotal}
        selectedYearLabel={selectedYearLabel}
        formatNumber={formatNumber}
      />

      <SeasonalSection
        seasonalStats={seasonalStats}
        seasonalMaxActiveTotal={seasonalMaxActiveTotal}
        activeSeasonalFish={activeSeasonalFish}
        onToggleFish={(name, isActive) =>
          setActiveSeasonalFish((prev) => {
            const allSelected = prev.length === seasonalStats.legend.length;
            if (allSelected) {
              return [name];
            }
            if (!isActive) {
              return [...prev, name];
            }
            if (prev.length > 1) {
              return prev.filter((entry) => entry !== name);
            }
            return prev;
          })
        }
        onSelectAll={() => setActiveSeasonalFish(seasonalStats.legend.map((item) => item.name))}
        selectedYearLabel={selectedYearLabel}
        formatNumber={formatNumber}
      />

      <FishTableSection
        fishStats={fishStats}
        fishStatsLoading={fishStatsLoading}
        fishStatsError={fishStatsError}
        fishOverviewTotals={fishOverviewTotals}
        selectedYearLabel={selectedYearLabel}
        selectedFishDetail={selectedFishDetail}
        onSelectFishDetail={setSelectedFishDetail}
        fishDetailData={fishDetailData}
        detailSectionRef={detailSectionRef}
        formatNumber={formatNumber}
        formatPercent={formatPercent}
      />

      <CrayfishSection
        stats={crayfishStats}
        dateRange={crayfishDateRange}
        entries={crayfishEntries}
        loading={crayfishLoading}
        error={crayfishError}
        showAnglers={showCrayfishAnglers}
        onToggleAnglers={() => setShowCrayfishAnglers((prev) => !prev)}
        formatNumber={formatNumber}
        formatDate={formatDate}
      />

    </Card>
  );
}

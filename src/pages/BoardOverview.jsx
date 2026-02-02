import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActivitySection from '@/components/ActivitySection';
import FishTableSection from '@/components/FishTableSection';
import YearSelectorSection from '@/components/YearSelectorSection';
import { MonthlyCatchSection, SessionSection } from '@/components/FishTrendsSection';
import SeasonalSection from '@/components/SeasonalSection';
import CrayfishSection from '@/components/CrayfishSection';
import AdminMembersManage from '@/pages/AdminMembersManage';
import {
  fetchProfiles,
  fetchWhitelist,
  fetchFishAggregates,
  fetchCrayfishCatches,
} from '@/services/boardService';
import { isFerkensbruchLocation } from '@/utils/location';

const rangeBucket = (key, label, min, max, ageLabel = '') => ({ key, label, min, max, ageLabel });

const SIZE_BUCKETS = {
  Karpfen: [
    rangeBucket('karpfen-under', '< 35 cm', null, 35, 'ca. 1-2 Jahre'),
    rangeBucket('karpfen-35-44', '35 - 44 cm', 35, 45, 'ca. 2-3 Jahre'),
    rangeBucket('karpfen-45-54', '45 - 54 cm', 45, 55, 'ca. 3-4 Jahre'),
    rangeBucket('karpfen-55-64', '55 - 64 cm', 55, 65, 'ca. 4-5 Jahre'),
    rangeBucket('karpfen-65-74', '65 - 74 cm', 65, 75, 'ca. 5-6 Jahre'),
    rangeBucket('karpfen-75-84', '75 - 84 cm', 75, 85, 'ca. 6-7 Jahre'),
    rangeBucket('karpfen-85-94', '85 - 94 cm', 85, 95, 'ca. 7-9 Jahre'),
    rangeBucket('karpfen-95plus', '>= 95 cm', 95, null, '9+ Jahre'),
  ],
  Hecht: [
    rangeBucket('hecht-under', '< 50 cm', null, 50, 'ca. 1 Jahr'),
    rangeBucket('hecht-50-59', '50 - 59 cm', 50, 60, 'ca. 2 Jahre'),
    rangeBucket('hecht-60-74', '60 - 74 cm', 60, 75, 'ca. 3-4 Jahre'),
    rangeBucket('hecht-75-89', '75 - 89 cm', 75, 90, 'ca. 5-6 Jahre'),
    rangeBucket('hecht-90-109', '90 - 109 cm', 90, 110, 'ca. 7-9 Jahre'),
    rangeBucket('hecht-110plus', '>= 110 cm', 110, null, '10+ Jahre'),
  ],
  Zander: [
    rangeBucket('zander-under', '< 40 cm', null, 40, '< 1 Jahr'),
    rangeBucket('zander-40-49', '40 - 49 cm', 40, 50, 'ca. 1-2 Jahre'),
    rangeBucket('zander-50-59', '50 - 59 cm', 50, 60, 'ca. 2-3 Jahre'),
    rangeBucket('zander-60-69', '60 - 69 cm', 60, 70, 'ca. 3-4 Jahre'),
    rangeBucket('zander-70-79', '70 - 79 cm', 70, 80, 'ca. 4-5 Jahre'),
    rangeBucket('zander-80plus', '>= 80 cm', 80, null, '5+ Jahre'),
  ],
  Barsch: [
    rangeBucket('barsch-under', '< 20 cm', null, 20, '< 1 Jahr'),
    rangeBucket('barsch-20-24', '20 - 24 cm', 20, 25, 'ca. 1 Jahr'),
    rangeBucket('barsch-25-29', '25 - 29 cm', 25, 30, 'ca. 2 Jahre'),
    rangeBucket('barsch-30-34', '30 - 34 cm', 30, 35, 'ca. 3 Jahre'),
    rangeBucket('barsch-35plus', '>= 35 cm', 35, null, '4+ Jahre'),
  ],
  Aal: [
    rangeBucket('aal-under', '< 50 cm', null, 50, '< 2 Jahre'),
    rangeBucket('aal-50-59', '50 - 59 cm', 50, 60, 'ca. 2-3 Jahre'),
    rangeBucket('aal-60-69', '60 - 69 cm', 60, 70, 'ca. 3-4 Jahre'),
    rangeBucket('aal-70-79', '70 - 79 cm', 70, 80, 'ca. 4-5 Jahre'),
    rangeBucket('aal-80plus', '>= 80 cm', 80, null, '5+ Jahre'),
  ],
  Rotauge: [
    rangeBucket('rotauge-under', '< 18 cm', null, 18, '< 1 Jahr'),
    rangeBucket('rotauge-18-24', '18 - 24 cm', 18, 25, 'ca. 1-2 Jahre'),
    rangeBucket('rotauge-25-29', '25 - 29 cm', 25, 30, 'ca. 2-3 Jahre'),
    rangeBucket('rotauge-30plus', '>= 30 cm', 30, null, '3+ Jahre'),
  ],
  Rotfeder: [
    rangeBucket('rotfeder-under', '< 18 cm', null, 18, '< 1 Jahr'),
    rangeBucket('rotfeder-18-24', '18 - 24 cm', 18, 25, 'ca. 1-2 Jahre'),
    rangeBucket('rotfeder-25-29', '25 - 29 cm', 25, 30, 'ca. 2-3 Jahre'),
    rangeBucket('rotfeder-30plus', '>= 30 cm', 30, null, '3+ Jahre'),
  ],
  Schleie: [
    rangeBucket('schleie-under', '< 30 cm', null, 30, '< 2 Jahre'),
    rangeBucket('schleie-30-39', '30 - 39 cm', 30, 40, 'ca. 2-3 Jahre'),
    rangeBucket('schleie-40-49', '40 - 49 cm', 40, 50, 'ca. 3-4 Jahre'),
    rangeBucket('schleie-50-59', '50 - 59 cm', 50, 60, 'ca. 5-6 Jahre'),
    rangeBucket('schleie-60plus', '>= 60 cm', 60, null, '6+ Jahre'),
  ],
  Brasse: [
    rangeBucket('brasse-under', '< 25 cm', null, 25, '< 2 Jahre'),
    rangeBucket('brasse-25-34', '25 - 34 cm', 25, 35, 'ca. 2-3 Jahre'),
    rangeBucket('brasse-35-44', '35 - 44 cm', 35, 45, 'ca. 3-4 Jahre'),
    rangeBucket('brasse-45-54', '45 - 54 cm', 45, 55, 'ca. 4-5 Jahre'),
    rangeBucket('brasse-55plus', '>= 55 cm', 55, null, '5+ Jahre'),
  ],
  Wels: [
    rangeBucket('wels-under', '< 50 cm', null, 50, '< 1 Jahr'),
    rangeBucket('wels-50-79', '50 - 79 cm', 50, 80, 'ca. 1-2 Jahre'),
    rangeBucket('wels-80-99', '80 - 99 cm', 80, 100, 'ca. 2-3 Jahre'),
    rangeBucket('wels-100-149', '100 - 149 cm', 100, 150, 'ca. 3-5 Jahre'),
    rangeBucket('wels-150-199', '150 - 199 cm', 150, 200, 'ca. 5-8 Jahre'),
    rangeBucket('wels-200plus', '>= 200 cm', 200, null, '8+ Jahre'),
  ],
};

SIZE_BUCKETS.default = [
  rangeBucket('default-under', '< 20 cm', null, 20, '< 1 Jahr'),
  rangeBucket('default-20-29', '20 - 29 cm', 20, 30, 'ca. 1-2 Jahre'),
  rangeBucket('default-30-39', '30 - 39 cm', 30, 40, 'ca. 2-3 Jahre'),
  rangeBucket('default-40-49', '40 - 49 cm', 40, 50, 'ca. 3-4 Jahre'),
  rangeBucket('default-50plus', '>= 50 cm', 50, null, '4+ Jahre'),
];

function getBucketsForFish(fishName) {
  if (!fishName) return SIZE_BUCKETS.default;
  return SIZE_BUCKETS[fishName] || SIZE_BUCKETS.default;
}

function parseSizeValue(value) {
  if (value == null) return null;
  const normalized = Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
}

function buildSizeDistribution(entries = [], fishName = '') {
  const buckets = getBucketsForFish(fishName).map((bucket) => ({
    ...bucket,
    count: 0,
    takenCount: 0,
  }));
  let missingCount = 0;

  entries.forEach((entry) => {
    const numericSize = parseSizeValue(entry?.size);
    if (!Number.isFinite(numericSize)) {
      missingCount += 1;
      return;
    }

    const targetBucket = buckets.find((bucket) => {
      const meetsMin = bucket.min == null || numericSize >= bucket.min;
      const meetsMax = bucket.max == null || numericSize < bucket.max;
      return meetsMin && meetsMax;
    });

    const bucketToUpdate = targetBucket || (buckets.length > 0 ? buckets[buckets.length - 1] : null);
    if (bucketToUpdate) {
      bucketToUpdate.count += 1;
      if (entry?.taken === true) {
        bucketToUpdate.takenCount += 1;
      }
    }
  });

  const measuredCount = entries.length - missingCount;

  return {
    buckets,
    missingCount,
    measuredCount,
  };
}

function normalizeRoleValue(role) {
  if (!role) return 'mitglied';
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'mitglied') return 'mitglied';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'vorstand') return 'vorstand';
  if (normalized === 'gast') return 'gast';
  if (normalized === 'tester') return 'tester';
  if (normalized === 'inactive' || normalized === 'inaktiv') return 'inactive';
  return 'mitglied';
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.warn('formatDate failed', error);
    return '—';
  }
}

function formatNumber(value) {
  try {
    return new Intl.NumberFormat('de-DE').format(value ?? 0);
  } catch (error) {
    console.warn('formatNumber failed', error);
    return String(value ?? 0);
  }
}

function formatPercent(value) {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value ?? 0);
  } catch (error) {
    console.warn('formatPercent failed', error);
    const fallback = Number.isFinite(value) ? (value * 100).toFixed(0) : '0';
    return `${fallback}%`;
  }
}

function formatDecimal(value, fractionDigits = 1) {
  try {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value ?? 0);
  } catch (error) {
    console.warn('formatDecimal failed', error);
    return Number.isFinite(value) ? value.toFixed(fractionDigits) : '0';
  }
}

function getLastMonths(count = 12) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      date,
      label: date.toLocaleDateString('de-DE', { month: 'short' }),
    });
  }
  return months;
}

function getMonthsForYear(year) {
  if (!Number.isFinite(year)) return getLastMonths(12);
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(year, i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      date,
      label: date.toLocaleDateString('de-DE', { month: 'short' }),
    });
  }
  return months;
}

function getMonthsForAllYears() {
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(2000, i, 1);
    const key = `all-${String(i + 1).padStart(2, '0')}`;
    months.push({
      key,
      date,
      label: date.toLocaleDateString('de-DE', { month: 'short' }),
    });
  }
  return months;
}

function getMonthsForSelection(selection) {
  if (selection === 'all') return getMonthsForAllYears();
  if (!Number.isFinite(selection)) return getLastMonths(12);
  return getMonthsForYear(selection);
}

const ACTIVITY_RANGE_OPTIONS = [
  { value: 'current-week', label: 'Aktuelle Woche' },
  { value: 'current-month', label: 'Aktueller Monat' },
  { value: '30d', label: 'Letzte 30 Tage' },
  { value: '90d', label: 'Letzte 90 Tage' },
  { value: '180d', label: 'Letzte 180 Tage' },
];

function filterEntriesByRange(entries = [], range, referenceTime = Date.now()) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const now = new Date(referenceTime);
  let start = null;
  let end = null;

  switch (range) {
    case 'current-week': {
      // Woche beginnt am Montag
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1 - day) * 24 * 60 * 60 * 1000;
      start = new Date(now.getTime() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'current-month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '180d':
      start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'last-year': {
      const lastYear = now.getFullYear() - 1;
      start = new Date(lastYear, 0, 1);
      end = new Date(now.getFullYear(), 0, 1);
      break;
    }
    case 'current-year':
    default:
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return entries.filter((entry) => {
    const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
    if (!ts || Number.isNaN(ts.getTime())) return false;
    if (start && ts < start) return false;
    if (end && ts >= end) return false;
    return true;
  });
}

const FISH_COLOR_CLASSES = [
  'bg-blue-500 dark:bg-blue-400',
  'bg-emerald-500 dark:bg-emerald-400',
  'bg-amber-500 dark:bg-amber-400',
  'bg-indigo-500 dark:bg-indigo-400',
  'bg-rose-500 dark:bg-rose-400',
  'bg-cyan-500 dark:bg-cyan-400',
  'bg-lime-500 dark:bg-lime-400',
  'bg-fuchsia-500 dark:bg-fuchsia-400',
  'bg-orange-500 dark:bg-orange-400',
];

function getColorStyleByIndex(index) {
  if (index == null || Number.isNaN(index)) {
    return { className: FISH_COLOR_CLASSES[0], style: undefined };
  }
  if (index < FISH_COLOR_CLASSES.length) {
    return { className: FISH_COLOR_CLASSES[index], style: undefined };
  }
  // Fallback: generate distinct HSL so keine Farbe doppelt.
  const hue = (index * 47) % 360;
  return { className: '', style: { backgroundColor: `hsl(${hue}, 70%, 55%)` } };
}

export default function BoardOverview() {
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activityRange, setActivityRange] = useState('30d');
  const detailSectionRef = useRef(null);

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    fishEntries.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;
      years.add(ts.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [fishEntries]);

  const yearOptions = useMemo(() => ['all', ...availableYears], [availableYears]);
  const selectedYearLabel = selectedYear === 'all' ? 'Alle Jahre' : selectedYear;
  const activityRangeLabel = useMemo(() => {
    const option = ACTIVITY_RANGE_OPTIONS.find((item) => item.value === activityRange);
    return option?.label || 'Aktuelles Jahr';
  }, [activityRange]);

  useEffect(() => {
    if (availableYears.length === 0) {
      setSelectedYear('all');
      return;
    }
    if (selectedYear == null) {
      setSelectedYear('all');
      return;
    }
    if (selectedYear !== 'all' && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

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
    const grouped = fishEntries.reduce((acc, entry) => {
      const fishName = entry?.fish ? String(entry.fish).trim() : '';
      if (!fishName || entry?.blank === true) return acc;

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
  }, [fishEntries]);

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
      const fishName = entry?.fish ? String(entry.fish).trim() : '';
      const hasFish =
        fishName !== '' && fishName.toLowerCase() !== 'unbekannt' && entry.blank !== true;

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
      const fishName = entry?.fish ? String(entry.fish).trim() : '';
      const hasFish =
        fishName !== '' && fishName.toLowerCase() !== 'unbekannt' && entry.blank !== true;

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
      const fishName = entry?.fish ? String(entry.fish).trim() : '';
      if (!fishName) return;
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
      .map((fish, index) => {
        const color = getColorStyleByIndex(index);
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
    setProfilesLoading(true);
    try {
      const data = await fetchProfiles();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Profile konnten nicht geladen werden.', error);
    } finally {
      setProfilesLoading(false);
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
      const PUBLIC_FROM_ANALYSIS = new Date('2025-06-01').getTime();
      const items = Array.isArray(data) ? data : [];

      // Analyse-Logik für Fang-/Schneidertage: keine Größenpflicht, kein count_in_stats-Filter
      const analysisCatchEntries = items.filter((entry) => {
        if (entry?.is_marilou === true) return false;
        if (!isFerkensbruchLocation(entry?.location_name)) return false;

        const ts = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
        if (!Number.isFinite(ts) || ts < PUBLIC_FROM_ANALYSIS) return false;

        if (entry?.blank === true) return false;

        const fishName = entry?.fish ? String(entry.fish).trim() : '';
        if (!fishName || fishName.toLowerCase() === 'unbekannt') return false;

        return true;
      });

      const analysisBlankEntries = items.filter((entry) => {
        if (entry?.is_marilou === true) return false;
        if (!isFerkensbruchLocation(entry?.location_name)) return false;

        const ts = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
        if (!Number.isFinite(ts) || ts < PUBLIC_FROM_ANALYSIS) return false;

        return entry?.blank === true;
      });

      setActivityFishEntries([...analysisCatchEntries, ...analysisBlankEntries]);
      setFishEntries(analysisCatchEntries); // Fischstatistik soll mit Analysis übereinstimmen
    } catch (error) {
      setFishStatsError(error.message || 'Fischübersicht konnte nicht geladen werden.');
    } finally {
      setFishStatsLoading(false);
    }
  }, []);

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
    <div className="space-y-8">
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

    </div>
  );
}

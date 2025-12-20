import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addWhitelistEmail,
  fetchProfiles,
  fetchWhitelist,
  fetchFishAggregates,
  removeWhitelistEmail,
  updateProfileRole,
  deleteProfile,
} from '@/services/boardService';

const BASE_ROLE_OPTIONS = [
  { value: 'mitglied', label: 'Mitglied' },
  { value: 'gast', label: 'Gast' },
  { value: 'tester', label: 'Tester' },
  { value: 'vorstand', label: 'Vorstand' },
];

const ADMIN_OPTION = { value: 'admin', label: 'Admin (nur Nicol Schmidt)' };

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
  const [profilesError, setProfilesError] = useState('');
  const [roleMessage, setRoleMessage] = useState('');
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [deletingProfileId, setDeletingProfileId] = useState(null);

  const [whitelist, setWhitelist] = useState([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState('');
  const [whitelistMessage, setWhitelistMessage] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);

  const [search, setSearch] = useState('');
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [fishEntries, setFishEntries] = useState([]);
  const [fishStatsLoading, setFishStatsLoading] = useState(false);
  const [fishStatsError, setFishStatsError] = useState('');
  const [selectedFishDetail, setSelectedFishDetail] = useState('');
  const [activeSeasonalFish, setActiveSeasonalFish] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const detailSectionRef = useRef(null);

  const availableYears = useMemo(() => {
    const years = new Set();
    fishEntries.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;
      years.add(ts.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [fishEntries]);

  useEffect(() => {
    if (availableYears.length === 0) {
      setSelectedYear(null);
      return;
    }
    if (selectedYear == null || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const filteredFishEntries = useMemo(() => {
    if (!Number.isFinite(selectedYear)) return fishEntries;
    return fishEntries.filter((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return false;
      return ts.getFullYear() === selectedYear;
    });
  }, [fishEntries, selectedYear]);

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
    const months = getMonthsForYear(Number.isFinite(selectedYear) ? selectedYear : new Date().getFullYear());
    const monthlyMap = {};
    const catchSessionsMap = {};
    const blankSessionsMap = {};
    months.forEach((m) => {
      monthlyMap[m.key] = { total: 0, taken: 0 };
      catchSessionsMap[m.key] = new Set();
      blankSessionsMap[m.key] = new Set();
    });

    const latestTimestamp = filteredFishEntries.reduce((max, entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
      if (!Number.isFinite(ts)) return max;
      return Math.max(max, ts);
    }, 0);
    const referenceTime = latestTimestamp || Date.now();
    const thirtyDaysAgo = referenceTime - 30 * 24 * 60 * 60 * 1000;

    const activeAnglersSet = new Set();
    const session30d = { catch: new Set(), blank: new Set() };
    let catchesLast30d = 0;

    const weekdayCounts = Array(7).fill(0);
    const hourCounts = Array(24).fill(0);

    filteredFishEntries.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;

      const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      const monthBucket = monthlyMap[monthKey];
      if (!monthBucket) return;

      const dateKey = ts.toISOString().slice(0, 10);
      const angler = entry?.angler ? String(entry.angler).trim() || 'Unbekannt' : 'Unbekannt';
      const isBlank = entry?.blank === true;
      const hasFish = entry?.fish && String(entry.fish).trim() !== '' && entry.blank !== true;

      if (isBlank) {
        blankSessionsMap[monthKey].add(`${angler}__${dateKey}`);
        if (ts.getTime() >= thirtyDaysAgo) {
          activeAnglersSet.add(angler);
          session30d.blank.add(`${angler}__${dateKey}`);
        }
        return;
      }

      if (!hasFish) return;

      monthBucket.total += 1;
      if (entry?.taken === true) monthBucket.taken += 1;
      catchSessionsMap[monthKey].add(`${angler}__${dateKey}`);

      if (ts.getTime() >= thirtyDaysAgo) {
        activeAnglersSet.add(angler);
        catchesLast30d += 1;
        session30d.catch.add(`${angler}__${dateKey}`);
      }

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
      const blankSessions = blankSessionsMap[m.key]?.size || 0;
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

    const activeAnglersLast30d = activeAnglersSet.size;
    const avgCatchesPerActive = activeAnglersLast30d > 0 ? catchesLast30d / activeAnglersLast30d : 0;

    const catchSessions30d = session30d.catch.size;
    const blankSessions30d = session30d.blank.size;
    const totalSessions30d = catchSessions30d + blankSessions30d;
    const blankShare30d = totalSessions30d > 0 ? blankSessions30d / totalSessions30d : 0;

    return {
      monthlyCatchSeries,
      blankVsCatchSeries,
      topWeekdays,
      topHours,
      activeAnglersLast30d,
      avgCatchesPerActive,
      catchSessions30d,
      blankSessions30d,
      blankShare30d,
    };
  }, [filteredFishEntries, selectedYear]);

  const monthlyMaxTotal = useMemo(() => {
    if (!activityStats?.monthlyCatchSeries?.length) return 1;
    return Math.max(1, ...activityStats.monthlyCatchSeries.map((item) => item.total || 0));
  }, [activityStats]);

  const sessionMaxTotal = useMemo(() => {
    if (!activityStats?.blankVsCatchSeries?.length) return 1;
    return Math.max(
      1,
      ...activityStats.blankVsCatchSeries.map((item) => item.totalSessions || 0)
    );
  }, [activityStats]);

  const seasonalStats = useMemo(() => {
    const months = getMonthsForYear(Number.isFinite(selectedYear) ? selectedYear : new Date().getFullYear());
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
      const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
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

  const canAssignAdmin = useCallback((profile) => {
    if (!profile?.name) return false;
    return String(profile.name).trim().toLowerCase() === 'nicol schmidt';
  }, []);

  const refreshProfiles = useCallback(async () => {
    setProfilesLoading(true);
    setProfilesError('');
    try {
      const data = await fetchProfiles();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      setProfilesError(error.message || 'Profile konnten nicht geladen werden.');
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  const refreshWhitelist = useCallback(async () => {
    setWhitelistLoading(true);
    setWhitelistError('');
    try {
      const data = await fetchWhitelist();
      setWhitelist(Array.isArray(data) ? data : []);
    } catch (error) {
      setWhitelistError(error.message || 'Whitelist konnte nicht geladen werden.');
    } finally {
      setWhitelistLoading(false);
    }
  }, []);

  const refreshFishAggregates = useCallback(async () => {
    setFishStatsLoading(true);
    setFishStatsError('');
    try {
      const data = await fetchFishAggregates();
      const threshold = Date.UTC(2025, 5, 1); // 01.06.2025 00:00 UTC
      const filtered = (Array.isArray(data) ? data : []).filter((entry) => {
        const location = entry?.location_name ? String(entry.location_name).toLowerCase() : '';
        const timestampMs = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
        const isAfterThreshold = Number.isFinite(timestampMs) && timestampMs >= threshold;

        const isLobberich = location.includes('lobberich');
        const isUnknown = !entry?.location_name;
        if (!isAfterThreshold || (!isLobberich && !isUnknown)) return false;
        if (entry?.is_marilou === true) return false;
        return true;
      });

      setFishEntries(filtered);
    } catch (error) {
      setFishStatsError(error.message || 'Fischübersicht konnte nicht geladen werden.');
    } finally {
      setFishStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
    refreshWhitelist();
    refreshFishAggregates();
  }, [refreshProfiles, refreshWhitelist, refreshFishAggregates]);

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

  const filteredProfiles = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) return profiles;
    const needle = trimmed.toLowerCase();
    return profiles.filter((profile) => {
      const name = profile?.name ? String(profile.name).toLowerCase() : '';
      const rawRole = profile?.role ? String(profile.role).toLowerCase() : '';
      const normalizedRole = normalizeRoleValue(profile?.role);
      const localizedRole = normalizedRole === 'inactive' ? 'inaktiv' : normalizedRole;
      return (
        name.includes(needle) ||
        rawRole.includes(needle) ||
        normalizedRole.includes(needle) ||
        localizedRole.includes(needle)
      );
    });
  }, [profiles, search]);

  const handleAddEmail = async (event) => {
    event.preventDefault();
    if (!newEmail.trim()) return;

    setWhitelistMessage('');
    setWhitelistError('');
    setAddingEmail(true);

    try {
      const normalizedInput = newEmail.trim().toLowerCase();
      const exists = whitelist.some((entry) =>
        String(entry?.email || '').toLowerCase() === normalizedInput
      );
      if (exists) {
        setWhitelistError('E-Mail ist bereits auf der Whitelist.');
        setAddingEmail(false);
        return;
      }

      await addWhitelistEmail(newEmail);
      setWhitelistMessage('E-Mail wurde zur Whitelist hinzugefügt.');
      setNewEmail('');
      await refreshWhitelist();
    } catch (error) {
      if (error?.code === '23505' || /duplicate key value/i.test(error?.message || '')) {
        setWhitelistError('E-Mail ist bereits auf der Whitelist.');
      } else {
        setWhitelistError(error?.message || 'E-Mail konnte nicht hinzugefügt werden.');
      }
    } finally {
      setAddingEmail(false);
    }
  };

  const handleRemoveEmail = async (email) => {
    if (!email) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Soll ${email} wirklich von der Whitelist entfernt werden?`);
    if (!confirmed) return;

    setWhitelistMessage('');
    setWhitelistError('');
    try {
      await removeWhitelistEmail(email);
      setWhitelistMessage('E-Mail wurde entfernt.');
      await refreshWhitelist();
    } catch (error) {
      setWhitelistError(error.message || 'E-Mail konnte nicht entfernt werden.');
    }
  };

  const handleRoleChange = async (profileId, value) => {
    setRoleMessage('');
    setProfilesError('');
    setUpdatingRoleId(profileId);

    let nextRole = value;
    if (value === '') nextRole = null;

    const targetProfile = profiles.find((profile) => profile.id === profileId);
    if (nextRole === 'admin' && !canAssignAdmin(targetProfile)) {
      setProfilesError('Admin-Rolle ist nur für Nicol Schmidt zulässig.');
      setUpdatingRoleId(null);
      return;
    }

    try {
      await updateProfileRole(profileId, nextRole);
      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === profileId ? { ...profile, role: nextRole } : profile
        )
      );
      setRoleMessage('Rolle wurde aktualisiert.');
    } catch (error) {
      setProfilesError(error.message || 'Rolle konnte nicht gespeichert werden.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDeleteProfile = async (profile) => {
    if (!profile?.id) return;

    const displayName = profile.name ? `„${profile.name}“` : 'diesen Eintrag';
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Soll ${displayName} dauerhaft gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`);
    if (!confirmed) return;

    setRoleMessage('');
    setProfilesError('');

    setDeletingProfileId(profile.id);

    try {
      await deleteProfile(profile.id);
      setProfiles((prev) => prev.filter((item) => item.id !== profile.id));
      setRoleMessage('Mitglied wurde entfernt.');
    } catch (error) {
      setProfilesError(error.message || 'Mitglied konnte nicht gelöscht werden.');
    } finally {
      setDeletingProfileId(null);
    }
  };

  const handleMemberActionChange = async (profile, action) => {
    if (!profile?.id) return;

    const currentRole = normalizeRoleValue(profile.role);

    if (action === 'delete') {
      await handleDeleteProfile(profile);
      return;
    }

    if (action === 'inactive') {
      if (currentRole === 'inactive') return;
      await handleRoleChange(profile.id, 'inactive');
      return;
    }

    if (action === 'active') {
      if (currentRole === 'inactive' || profile.role == null) {
        await handleRoleChange(profile.id, 'mitglied');
      }
      return;
    }
  };

  const roleOptionsForProfile = useCallback(
    (profile) => {
      const options = [...BASE_ROLE_OPTIONS];
      if (canAssignAdmin(profile) || normalizeRoleValue(profile?.role) === 'admin') {
        options.push(ADMIN_OPTION);
      }
      return options;
    },
    [canAssignAdmin]
  );

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

      {availableYears.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Jahr wählen</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Alle Fang-Diagramme unten zeigen das ausgewählte Jahr.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedYear === year
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-gray-900'
                      : 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-900/30'
                  }`}
                  aria-pressed={selectedYear === year}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Aktivität & Nutzung</h2>
          {Number.isFinite(selectedYear) && (
            <span className="text-sm text-gray-600 dark:text-gray-300">Jahr: {selectedYear}</span>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
            <p className="text-sm font-medium uppercase tracking-wide">Aktive Angler</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatNumber(activityStats.activeAnglersLast30d)}
            </p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-200/70">
              letzte 30 Tage des gewählten Jahres
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
            <p className="text-sm font-medium uppercase tracking-wide">Ø Fänge / aktiver Angler</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatDecimal(activityStats.avgCatchesPerActive)}
            </p>
            <p className="text-xs text-blue-700/80 dark:text-blue-200/70">
              letzte 30 Tage des gewählten Jahres
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
            <p className="text-sm font-medium uppercase tracking-wide">Sessions (30 Tage)</p>
            <p className="mt-1 text-lg font-semibold">
              {formatNumber(activityStats.catchSessions30d)} Fang / {formatNumber(activityStats.blankSessions30d)} Schneider
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-200/70">
              Schneider-Anteil: {formatPercent(activityStats.blankShare30d)}
            </p>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-100">
            <p className="text-sm font-medium uppercase tracking-wide">Peak-Zeiten</p>
            {activityStats.topWeekdays.length === 0 && activityStats.topHours.length === 0 ? (
              <p className="mt-1 text-sm text-indigo-700/80 dark:text-indigo-200/70">Noch keine Daten.</p>
            ) : (
              <div className="mt-1 space-y-1 text-sm">
                {activityStats.topWeekdays.length > 0 && (
                  <div>Wochentag: {activityStats.topWeekdays.map((d) => d.label).join(', ')}</div>
                )}
                {activityStats.topHours.length > 0 && (
                  <div>Uhrzeit: {activityStats.topHours.map((h) => h.label).join(', ')}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              Zeitverlauf Fänge ({Number.isFinite(selectedYear) ? selectedYear : '12 Monate'})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Gesamtfänge und Entnahmen im Vergleich je Monat des gewählten Jahres.
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Skala relativ zum stärksten Monat.
          </div>
        </div>

        <div className="mt-6">
          {activityStats.monthlyCatchSeries.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
              Noch keine Daten vorhanden.
            </div>
          ) : (
            <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2">
              {activityStats.monthlyCatchSeries.map((item) => {
                const totalHeight = Math.max(0, (item.total / monthlyMaxTotal) * 100);
                const takenHeight =
                  item.total > 0 ? Math.max(0, (item.taken / monthlyMaxTotal) * 100) : 0;
                return (
                  <div
                    key={`monthly-${item.label}`}
                    className="flex min-w-[46px] flex-col items-center justify-end gap-2"
                  >
                    <div className="relative flex h-44 w-10 items-end rounded bg-blue-100/80 dark:bg-blue-900/40">
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t bg-blue-400/80 dark:bg-blue-500"
                        style={{ height: `${Math.min(100, totalHeight)}%` }}
                        aria-hidden
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t bg-blue-700 dark:bg-blue-400"
                        style={{ height: `${Math.min(100, takenHeight)}%` }}
                        aria-hidden
                      />
                    </div>
                    <div className="text-center text-xs text-gray-700 dark:text-gray-300">
                      <div className="font-semibold">{item.label}</div>
                      <div>{formatNumber(item.total)} / {formatNumber(item.taken)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              Fang vs. Schneidersession ({Number.isFinite(selectedYear) ? selectedYear : '12 Monate'})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Sessions pro Monat, unterschieden nach Fang- und Schneider-Tagen.
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Basis: je Angler und Tag nur eine Session.
          </div>
        </div>

        <div className="mt-6">
          {activityStats.blankVsCatchSeries.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
              Noch keine Daten vorhanden.
            </div>
          ) : (
            <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2">
              {activityStats.blankVsCatchSeries.map((item) => {
                const catchHeight =
                  item.totalSessions > 0
                    ? Math.max(0, (item.catchSessions / sessionMaxTotal) * 100)
                    : 0;
                const blankHeight =
                  item.totalSessions > 0
                    ? Math.max(0, (item.blankSessions / sessionMaxTotal) * 100)
                    : 0;
                return (
                  <div
                    key={`sessions-${item.label}`}
                    className="flex min-w-[46px] flex-col items-center justify-end gap-2"
                  >
                    <div className="flex h-44 w-10 flex-col justify-end overflow-hidden rounded bg-gray-200/80 dark:bg-gray-700/70">
                      <div
                        className="bg-red-500/80 dark:bg-red-400"
                        style={{ height: `${Math.min(100, blankHeight)}%` }}
                        aria-hidden
                      />
                      <div
                        className="bg-emerald-500/80 dark:bg-emerald-400"
                        style={{ height: `${Math.min(100, catchHeight)}%` }}
                        aria-hidden
                      />
                    </div>
                    <div className="text-center text-xs text-gray-700 dark:text-gray-300">
                      <div className="font-semibold">{item.label}</div>
                      <div>{formatNumber(item.catchSessions)} / {formatNumber(item.blankSessions)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              Saisonale Muster je Art ({Number.isFinite(selectedYear) ? selectedYear : '12 Monate'})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Stack je Monat zeigt die Verteilung der Top-Fischarten im gewählten Jahr.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            {seasonalStats.legend.length === 0 ? (
              <span className="text-gray-500 dark:text-gray-400">Noch keine Daten.</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSeasonalFish(seasonalStats.legend.map((item) => item.name))}
                  className={`rounded-full border px-3 py-1 font-semibold transition ${
                    activeSeasonalFish.length === seasonalStats.legend.length
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  Alle
                </button>
                {seasonalStats.legend.map((item) => {
                  const isActive = activeSeasonalFish.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() =>
                        setActiveSeasonalFish((prev) => {
                          const allSelected = prev.length === seasonalStats.legend.length;
                          const isAlready = prev.includes(item.name);
                          if (allSelected) {
                            return [item.name]; // Solo-Mode starten
                          }
                          if (!isAlready) {
                            return [...prev, item.name]; // hinzuwählen
                          }
                          if (prev.length > 1) {
                            return prev.filter((name) => name !== item.name); // abwählen
                          }
                          return prev; // nie leer werden lassen
                        })
                      }
                      className={`flex items-center gap-1 rounded-full border px-3 py-1 font-semibold transition ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-full ${item.color.className || ''}`}
                        style={item.color.style}
                        aria-hidden
                      />
                      {item.name}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {seasonalStats.months.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
              Noch keine Daten vorhanden.
            </div>
          ) : (
            seasonalStats.months.map((month) => (
              <div key={`season-${month.label}`} className="flex items-center gap-3">
                <div className="w-12 shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {month.label}
                </div>
                {(() => {
                  const activeParts = month.parts.filter(
                    (part) => activeSeasonalFish.includes(part.fish) && part.count > 0
                  );
                  const activeTotal = activeParts.reduce((sum, part) => sum + part.count, 0);
                  const scalePercent =
                    activeTotal > 0 ? (activeTotal / seasonalMaxActiveTotal) * 100 : 0;
                  const widthPercent = Math.min(100, Math.max(5, scalePercent));

                  return (
                    <>
                      <div className="flex h-6 flex-1 items-center rounded bg-gray-200/70 px-1 dark:bg-gray-700/70">
                        {month.total === 0 ? (
                          <div className="flex w-full items-center justify-center text-xs text-gray-500 dark:text-gray-300">
                            keine Fänge
                          </div>
                        ) : activeParts.length === 0 || activeTotal === 0 ? (
                          <div className="flex w-full items-center justify-center text-xs text-gray-500 dark:text-gray-300">
                            Auswahl ohne Fänge
                          </div>
                        ) : (
                          <div
                            className="flex h-4 overflow-hidden rounded"
                            style={{ width: `${widthPercent}%` }}
                          >
                            {activeParts.map((part) => {
                              const share = activeTotal > 0 ? (part.count / activeTotal) * 100 : 0;
                              return (
                                <div
                                  key={`${month.label}-${part.fish}`}
                                  className={part.color.className}
                                  style={{ width: `${Math.max(1, share)}%`, ...(part.color.style || {}) }}
                                  title={`${part.fish}: ${formatNumber(part.count)}`}
                                  aria-label={`${part.fish}: ${formatNumber(part.count)}`}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="w-14 text-right text-xs text-gray-600 dark:text-gray-300">
                        {formatNumber(activeTotal)}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Fänge nach Fischart</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Gegenüberstellung aller Fänge sowie entnommener Fische pro Art.
            </p>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <div className="text-right font-semibold text-gray-800 dark:text-gray-100">
              {formatNumber(fishOverviewTotals.total)} gesamt
            </div>
            <div className="text-right text-xs">
              {formatNumber(fishOverviewTotals.taken)} entnommen ({
                fishOverviewTotals.total > 0
                  ? formatPercent(fishOverviewTotals.taken / fishOverviewTotals.total)
                  : '—'
              })
            </div>
            {Number.isFinite(selectedYear) && (
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                Jahr: {selectedYear}
              </div>
            )}
          </div>
        </div>

        {fishStatsError && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
            {fishStatsError}
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Fischart</th>
                <th className="px-4 py-2 text-left font-semibold">Gefangen gesamt</th>
                <th className="px-4 py-2 text-left font-semibold">Davon entnommen</th>
                <th className="px-4 py-2 text-left font-semibold">Entnahmequote</th>
                <th className="px-4 py-2 text-left font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {fishStatsLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    Lädt Fangstatistik...
                  </td>
                </tr>
              ) : fishStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    Keine Fänge erfasst.
                  </td>
                </tr>
              ) : (
                fishStats.map((entry) => {
                  const total = Number(entry?.total) || 0;
                  const taken = Number(entry?.taken) || 0;
                  const ratio = total > 0 ? Math.max(0, Math.min(1, taken / total)) : 0;
                  const ratioPercent = Math.round(ratio * 100);
                  const isActive = selectedFishDetail === entry.fish;

                  return (
                    <tr key={entry.fish} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                      <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{entry.fish}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatNumber(total)}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatNumber(taken)}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {total > 0 ? formatPercent(ratio) : '—'}
                        {total > 0 && (
                          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className={`h-1.5 rounded-full ${
                                ratioPercent >= 66
                                  ? 'bg-red-500 dark:bg-red-400'
                                  : ratioPercent >= 33
                                    ? 'bg-amber-500 dark:bg-amber-400'
                                    : 'bg-emerald-500 dark:bg-emerald-400'
                              }`}
                              style={{ width: `${ratioPercent}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFishDetail((prev) => (prev === entry.fish ? '' : entry.fish))
                          }
                          className={`rounded border px-3 py-1 text-xs font-semibold transition ${
                            isActive
                              ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-gray-900'
                              : 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-900/30'
                          }`}
                          aria-pressed={isActive}
                        >
                          {isActive ? 'Schließen' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedFishDetail && (
          <div
            ref={detailSectionRef}
            className="mt-6 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-gray-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-gray-200"
          >
            {fishDetailData ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                      Detailansicht: {fishDetailData.fish}
                    </h3>
                   
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {formatNumber(fishDetailData.total)} Meldungen, davon {formatNumber(fishDetailData.taken)} entnommen.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Altersangaben sind grobe Erfahrungswerte je Art.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFishDetail('')}
                    className="self-start rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-900/30"
                  >
                    Schließen
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {fishDetailData.buckets.map((bucket) => {
                    const hasData = fishDetailData.measuredCount > 0;
                    const share = hasData && bucket.count > 0
                      ? formatPercent(bucket.count / fishDetailData.measuredCount)
                      : '—';
                    const takenShare =
                      bucket.count > 0 ? formatPercent((bucket.takenCount || 0) / bucket.count) : '—';
                    return (
                      <div
                        key={`${fishDetailData.fish}-${bucket.key}`}
                        className="rounded border border-white/60 bg-white/70 p-3 shadow-sm dark:border-blue-900/30 dark:bg-blue-900/30"
                      >
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {bucket.label}
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                          {formatNumber(bucket.count)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Anteil: {share}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Entnommen: {formatNumber(bucket.takenCount)} ({takenShare})
                        </div>
                        {bucket.ageLabel && (
                          <div className="mt-1 text-xs text-blue-700 dark:text-blue-200">
                            Alter: {bucket.ageLabel}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                  {fishDetailData.measuredCount > 0 ? (
                    <>
                      {formatNumber(fishDetailData.measuredCount)} Fänge mit Größenangabe bilden die Cluster.
                      {fishDetailData.missingCount > 0 && (
                        <> Zusätzlich {formatNumber(fishDetailData.missingCount)} ohne Größenwert.</>
                      )}
                    </>
                  ) : (
                    <>Noch keine Größenangaben verfügbar. Sobald Werte eingehen, erscheinen hier Cluster.</>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>Keine Details verfügbar.</div>
                <button
                  type="button"
                  onClick={() => setSelectedFishDetail('')}
                  className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-900/30"
                >
                  Schließen
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Whitelist verwalten</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Nur E-Mail-Adressen auf der Whitelist dürfen neue Accounts erstellen.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWhitelist((prev) => !prev)}
            aria-expanded={showWhitelist}
            className={`rounded px-4 py-2 text-sm font-semibold transition ${
              showWhitelist
                ? 'border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showWhitelist ? 'Liste verbergen' : 'Liste anzeigen'}
          </button>
        </div>

        {showWhitelist && (
          <>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleAddEmail}>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="E-Mail hinzufügen"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:w-60"
                required
              />
              <button
                type="submit"
                disabled={addingEmail}
                className={`rounded px-4 py-2 text-sm font-semibold text-white ${
                  addingEmail ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {addingEmail ? 'Speichert...' : 'Hinzufügen'}
              </button>
            </form>

            {(whitelistError || whitelistMessage) && (
              <div
                className={`mt-4 rounded border px-3 py-2 text-sm ${
                  whitelistError
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200'
                    : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/40 dark:bg-green-900/30 dark:text-green-200'
                }`}
              >
                {whitelistError || whitelistMessage}
              </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">E-Mail</th>
                    <th className="px-4 py-2 text-left font-semibold">Freigeschaltet seit</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {whitelistLoading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                        Lädt Whitelist...
                      </td>
                    </tr>
                  ) : whitelist.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                        Keine E-Mails gespeichert.
                      </td>
                    </tr>
                  ) : (
                    whitelist.map((entry) => (
                      <tr key={entry.email} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                        <td className="px-4 py-2 font-mono text-[13px] text-gray-800 dark:text-gray-200">
                          {entry.email}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatDate(entry.created_at)}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(entry.email)}
                            className="rounded px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
                          >
                            Entfernen
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Mitglieder & Rollen</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Weise Vorstand- oder Admin-Rechte zu. Änderungen wirken sofort.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMemberList((prev) => !prev)}
            aria-expanded={showMemberList}
            className={`rounded px-4 py-2 text-sm font-semibold transition ${
              showMemberList
                ? 'border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showMemberList ? 'Liste verbergen' : 'Liste anzeigen'}
          </button>
        </div>

        {showMemberList && (
          <>
            <div className="mt-4 flex justify-end">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name oder Rolle suchen"
                className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            {(profilesError || roleMessage) && (
              <div
                className={`mt-4 rounded border px-3 py-2 text-sm ${
                  profilesError
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200'
                    : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/40 dark:bg-green-900/30 dark:text-green-200'
                }`}
              >
                {profilesError || roleMessage}
              </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Name</th>
                    <th className="px-4 py-2 text-left font-semibold">Rolle</th>
                    <th className="px-4 py-2 text-left font-semibold">Angemeldet seit</th>
                    <th className="px-4 py-2 text-left font-semibold">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {profilesLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                        Lädt Profile...
                      </td>
                    </tr>
                  ) : filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                        Keine passenden Profile gefunden.
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((profile) => {
                      const normalizedRole = normalizeRoleValue(profile.role);
                      const selectValue = normalizedRole === 'inactive' ? 'mitglied' : normalizedRole;
                      const isInactive = normalizedRole === 'inactive';
                      return (
                        <tr key={profile.id} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                          <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                            <div className="flex items-center gap-2">
                              <span>{profile.name || '—'}</span>
                              {isInactive && (
                                <span className="rounded bg-gray-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                  Inaktiv
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                            <select
                              value={selectValue}
                              onChange={(event) => handleRoleChange(profile.id, event.target.value)}
                              disabled={updatingRoleId === profile.id || deletingProfileId === profile.id}
                              className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            >
                              {roleOptionsForProfile(profile).map((option) => (
                                <option key={option.value || 'none'} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatDate(profile.created_at)}</td>
                          <td className="px-4 py-2 text-right">
                            <select
                              value={isInactive ? 'inactive' : 'active'}
                              onChange={(event) => handleMemberActionChange(profile, event.target.value)}
                              disabled={updatingRoleId === profile.id || deletingProfileId === profile.id}
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            >
                              <option value="active">Aktiv</option>
                              <option value="inactive">Inaktiv</option>
                              <option value="delete">Löschen</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

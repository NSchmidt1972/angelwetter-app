import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { parseTimestamp } from '@/utils/dateUtils';
import {
  PAGE_VIEW_PAGE_SIZE,
  PAGE_VIEW_RECENT_LIMIT,
  normalizeName,
} from '@/features/adminOverview/pageViewUtils';
import {
  ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT,
  buildExternalCatches,
  buildLatestCatch,
  buildRecentBlanks,
} from '@/features/adminOverview/utils/adminOverviewUtils';
import { fetchClubCoordinates } from '@/services/clubCoordinatesService';

async function fetchRecentPageViewsForActiveUsers(clubId, sinceIso) {
  const rows = [];
  let rangeStart = 0;
  let encounteredError = null;

  while (rows.length < PAGE_VIEW_RECENT_LIMIT) {
    const rangeEnd = rangeStart + PAGE_VIEW_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('page_views')
      .select('id, angler, created_at')
      .eq('club_id', clubId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rangeStart, rangeEnd);

    if (error) {
      encounteredError = error;
      break;
    }

    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_VIEW_PAGE_SIZE) break;
    rangeStart += PAGE_VIEW_PAGE_SIZE;
  }

  return { rows, error: encounteredError };
}

export function useAdminOverviewCoreData({ effectiveClubId }) {
  const [activeUsers, setActiveUsers] = useState([]);
  const [latestCatch, setLatestCatch] = useState(null);
  const [nameShort, setNameShort] = useState(null);
  const [recentBlanks, setRecentBlanks] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [externalCatches, setExternalCatches] = useState([]);
  const [takenCatches, setTakenCatches] = useState([]);
  const [pushByAngler, setPushByAngler] = useState([]);
  const [pushDeviceSummary, setPushDeviceSummary] = useState([]);

  useEffect(() => {
    let active = true;
    const clubId = effectiveClubId;
    const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sinceIso = sinceDate.toISOString();

    if (!clubId) return () => { active = false; };

    const logSectionError = (section, error) => {
      console.error(`AdminOverview: ${section} konnten nicht geladen werden`, error);
    };

    const resolveQueryData = async (queryPromise, section) => {
      try {
        const { data, error } = await queryPromise;
        if (error) {
          logSectionError(section, error);
          return null;
        }
        return data;
      } catch (error) {
        logSectionError(section, error);
        return null;
      }
    };

    const allProfilesDataPromise = resolveQueryData(
      supabase
        .from('profiles')
        .select('id, name, created_at, role')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false }),
      'Profile',
    );
    const fishSnapshotPromise = resolveQueryData(
      supabase
        .from('fishes')
        .select('angler, fish, size, timestamp, lat, lon, waterbody_id, location_name, blank, taken')
        .eq('club_id', clubId)
        .order('timestamp', { ascending: false })
        .limit(ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT),
      'Fänge (Snapshot)',
    );
    const clubCoordsPromise = (async () => {
      try {
        return await fetchClubCoordinates(clubId, {
          timeoutLabel: 'AdminOverview Club-Koordinaten timeout',
        });
      } catch (error) {
        logSectionError('Club-Koordinaten', error);
        return null;
      }
    })();

    async function loadActiveUsers() {
      const [users, allProfilesData, fishSnapshot, recentPageViewsResult] = await Promise.all([
        resolveQueryData(
          supabase
            .from('user_activity')
            .select('user_id, angler_name, last_active')
            .eq('club_id', clubId),
          'Aktive Angler (user_activity)',
        ),
        allProfilesDataPromise,
        fishSnapshotPromise,
        fetchRecentPageViewsForActiveUsers(clubId, sinceIso),
      ]);

      if (!active) return;

      const safeUsers = Array.isArray(users) ? users : [];
      const profileById = new Map((allProfilesData || []).map((profile) => [profile.id, profile.name]));
      const activeByName = new Map();

      const upsertActive = (rawName, rawTimestamp) => {
        const name = String(rawName || '').trim();
        if (!name) return;
        const parsed = parseTimestamp(rawTimestamp);
        if (!parsed) return;
        const key = normalizeName(name);
        if (!key) return;
        const prev = activeByName.get(key);
        if (!prev || parsed > prev.lastActive) {
          activeByName.set(key, {
            name,
            lastActive: parsed,
          });
        }
      };

      safeUsers.forEach((entry) => {
        const profileName = entry?.user_id ? profileById.get(entry.user_id) : null;
        const resolvedName = profileName || entry?.angler_name || null;
        const parsedLastActive = parseTimestamp(entry?.last_active);
        if (parsedLastActive && parsedLastActive > sinceDate) {
          upsertActive(resolvedName, entry?.last_active);
        }
      });

      (fishSnapshot || []).forEach((entry) => {
        const ts = parseTimestamp(entry?.timestamp);
        if (!ts || ts <= sinceDate) return;
        upsertActive(entry?.angler, entry?.timestamp);
      });

      if (recentPageViewsResult?.error) {
        logSectionError('Aktive Angler (page_views)', recentPageViewsResult.error);
      } else {
        (recentPageViewsResult?.rows || []).forEach((entry) => {
          upsertActive(entry?.angler, entry?.created_at);
        });
      }

      setActiveUsers(
        [...activeByName.values()]
          .map((entry) => ({
            name: entry.name,
            last_active: entry.lastActive.toISOString(),
          }))
          .sort(
            (a, b) =>
              (parseTimestamp(b.last_active)?.getTime() || 0) -
              (parseTimestamp(a.last_active)?.getTime() || 0),
          ),
      );
    }

    async function loadTakenCatches() {
      const fishSnapshot = await fishSnapshotPromise;

      if (!active) return;
      const rows = Array.isArray(fishSnapshot) ? fishSnapshot : [];
      const takenFromSnapshot = rows.filter((entry) => entry?.taken === true).slice(0, 100);

      if (rows.length < ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT || takenFromSnapshot.length >= 100) {
        setTakenCatches(takenFromSnapshot);
        return;
      }

        const takenFallback = await resolveQueryData(
          supabase
            .from('fishes')
            .select('angler, fish, timestamp, waterbody_id')
            .eq('club_id', clubId)
          .eq('taken', true)
          .order('timestamp', { ascending: false })
          .limit(100),
        'Entnommene Fische',
      );
      if (!active) return;
      setTakenCatches(Array.isArray(takenFallback) ? takenFallback : takenFromSnapshot);
    }

    async function loadFishOverview() {
      const [fishSnapshot, clubCoords] = await Promise.all([
        fishSnapshotPromise,
        clubCoordsPromise,
      ]);
      if (!active) return;

      const rows = Array.isArray(fishSnapshot) ? fishSnapshot : [];
      const latest = buildLatestCatch(rows);
      setLatestCatch(latest);
      setNameShort(latest?.angler || null);

      setRecentBlanks(buildRecentBlanks(rows, sinceDate));

      let externals = buildExternalCatches(rows, 20, clubCoords);
      if (rows.length >= ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT && externals.length < 20) {
        const externalFallback = await resolveQueryData(
          supabase
            .from('fishes')
            .select('angler, fish, size, timestamp, lat, lon, waterbody_id, location_name, blank')
            .eq('club_id', clubId)
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .order('timestamp', { ascending: false })
            .limit(200),
          'Externe Fänge',
        );
        if (!active) return;
        if (Array.isArray(externalFallback)) {
          externals = buildExternalCatches(externalFallback, 20, clubCoords);
        }
      }

      setExternalCatches(externals);
    }

    async function loadProfiles() {
      const profiles = await allProfilesDataPromise;
      if (!active) return;
      setAllProfiles(Array.isArray(profiles) ? profiles : []);
    }

    async function loadPushSubscribers() {
      const [allProfilesData, pushSubs] = await Promise.all([
        allProfilesDataPromise,
        resolveQueryData(
          supabase
            .from('push_subscriptions')
            .select('user_id, angler_name, device_label, opted_in, revoked_at')
            .eq('club_id', clubId),
          'Push-Abonnenten',
        ),
      ]);

      if (!active) return;

      if (!Array.isArray(pushSubs)) {
        setPushByAngler([]);
        setPushDeviceSummary([]);
        return;
      }

      const profileNameById = (allProfilesData || []).reduce((acc, profile) => {
        if (profile?.id) acc[profile.id] = profile.name || null;
        return acc;
      }, {});

      const byAngler = pushSubs.reduce((acc, entry) => {
        const fallbackName = entry?.user_id ? profileNameById[entry.user_id] : null;
        const label = entry?.angler_name?.trim() || fallbackName || 'Unbekannt';
        if (!acc[label]) acc[label] = { total: 0, active: 0 };
        acc[label].total += 1;
        if (entry?.opted_in && !entry?.revoked_at) acc[label].active += 1;
        return acc;
      }, {});

      const byDevice = pushSubs.reduce((acc, entry) => {
        const label = entry?.device_label?.trim() || 'Unbekanntes Gerät';
        if (!acc[label]) acc[label] = { total: 0, active: 0 };
        acc[label].total += 1;
        if (entry?.opted_in && !entry?.revoked_at) acc[label].active += 1;
        return acc;
      }, {});

      const sortedAngler = Object.entries(byAngler)
        .map(([name, counts]) => ({ name, ...counts }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

      const sortedDevices = Object.entries(byDevice)
        .map(([device, counts]) => ({ device, ...counts }))
        .sort((a, b) => b.total - a.total || a.device.localeCompare(b.device));

      setPushByAngler(sortedAngler);
      setPushDeviceSummary(sortedDevices);
    }

    const runLoad = (section, loader) => {
      loader().catch((error) => {
        logSectionError(section, error);
      });
    };

    runLoad('Aktive Angler', loadActiveUsers);
    runLoad('Entnommene Fische', loadTakenCatches);
    runLoad('Fang-Übersicht', loadFishOverview);
    runLoad('Profile', loadProfiles);
    runLoad('Push-Abonnenten', loadPushSubscribers);

    return () => {
      active = false;
    };
  }, [effectiveClubId]);

  return {
    activeUsers,
    latestCatch,
    nameShort,
    recentBlanks,
    allProfiles,
    externalCatches,
    takenCatches,
    pushByAngler,
    pushDeviceSummary,
  };
}

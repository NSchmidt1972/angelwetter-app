import { useEffect, useMemo, useState } from 'react';
import { withTimeout } from '@/utils/async';
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES } from '@/permissions/features';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { listWaterbodyTemperatureSensorsByClub } from '@/services/waterbodySensorsService';

function toUniqueWaterbodyIds(rows) {
  const unique = new Set();
  const nowTs = Date.now();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (row?.is_active === false) return;
    const validToRaw = row?.valid_to;
    if (validToRaw) {
      const validToTs = new Date(validToRaw).getTime();
      if (Number.isFinite(validToTs) && validToTs <= nowTs) return;
    }
    const waterbodyId = String(row?.waterbody_id || '').trim();
    if (!waterbodyId) return;
    unique.add(waterbodyId);
  });
  return Array.from(unique);
}

export function useWaterTemperatureAccess() {
  const resumeTick = useAppResumeTick({ enabled: true });
  const { currentClub, hasFeatureForRole } = usePermissions();
  const [sensorWaterbodyIds, setSensorWaterbodyIds] = useState([]);

  const currentClubId = currentClub?.id ?? null;
  const hasWaterTemperatureFeature = Boolean(currentClubId) && hasFeatureForRole(FEATURES.WATER_TEMPERATURE);

  useEffect(() => {
    let active = true;

    async function loadSensorAssignments() {
      if (!hasWaterTemperatureFeature || !currentClubId) {
        setSensorWaterbodyIds([]);
        return;
      }

      try {
        const sensorRows = await withTimeout(
          listWaterbodyTemperatureSensorsByClub(currentClubId, { activeOnly: false }),
          8000,
          'Wassertemperatur-Sensorprüfung timeout',
        );
        if (!active) return;
        setSensorWaterbodyIds(toUniqueWaterbodyIds(sensorRows));
      } catch (error) {
        if (!active) return;
        setSensorWaterbodyIds([]);
        console.warn('Wassertemperatur-Sensorzuordnungen konnten nicht geladen werden:', error?.message || error);
      }
    }

    void loadSensorAssignments();
    return () => {
      active = false;
    };
  }, [currentClubId, hasWaterTemperatureFeature, resumeTick]);

  return useMemo(() => {
    const hasActiveTemperatureSensor = sensorWaterbodyIds.length > 0;
    return {
      currentClubId,
      hasWaterTemperatureFeature,
      hasActiveTemperatureSensor,
      canSeeWaterTemperature: hasWaterTemperatureFeature && hasActiveTemperatureSensor,
      sensorWaterbodyIds,
    };
  }, [currentClubId, hasWaterTemperatureFeature, sensorWaterbodyIds]);
}

export default useWaterTemperatureAccess;

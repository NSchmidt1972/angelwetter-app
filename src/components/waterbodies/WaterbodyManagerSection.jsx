import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createWaterbody,
  deactivateWaterbody,
  listWaterbodiesByClub,
  updateWaterbody,
} from '@/services/waterbodiesService';
import {
  listRecentTemperatureSensorCandidates,
  listWaterbodyTemperatureSensorsByClub,
  saveWaterbodyTemperatureSensorAssignment,
} from '@/services/waterbodySensorsService';
import { getActiveClubId } from '@/utils/clubId';

function toDraft(row) {
  return {
    id: row?.id ?? null,
    name: row?.name ?? '',
    description: row?.description ?? '',
    water_type: row?.water_type ?? '',
    lat: row?.lat != null ? String(row.lat) : '',
    lon: row?.lon != null ? String(row.lon) : '',
    radius_m: row?.radius_m != null ? String(row.radius_m) : '300',
    weather_lat: row?.weather_lat != null ? String(row.weather_lat) : '',
    weather_lon: row?.weather_lon != null ? String(row.weather_lon) : '',
    temperature_device_id: row?.temperature_device_id ?? '',
    temperature_topic: row?.temperature_topic ?? '',
    sort_order: row?.sort_order != null ? String(row.sort_order) : '0',
    is_active: row?.is_active !== false,
  };
}

function createEmptyDraft() {
  return {
    name: '',
    description: '',
    water_type: '',
    lat: '',
    lon: '',
    radius_m: '300',
    weather_lat: '',
    weather_lon: '',
    temperature_device_id: '',
    temperature_topic: '',
    sort_order: '0',
    is_active: true,
  };
}

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizePayload(row) {
  const name = String(row?.name || '').trim();
  if (!name) throw new Error('Name ist erforderlich.');

  const lat = toNumberOrNull(row?.lat);
  const lon = toNumberOrNull(row?.lon);
  if (lat == null || lon == null) {
    throw new Error('Lat/Lon sind erforderlich.');
  }

  const radius = toIntegerOrNull(row?.radius_m);
  if (radius == null || radius <= 0) {
    throw new Error('Radius muss > 0 sein.');
  }

  const sortOrder = toIntegerOrNull(row?.sort_order);
  if (sortOrder == null) {
    throw new Error('Sortierung muss eine ganze Zahl sein.');
  }

  return {
    name,
    description: String(row?.description || '').trim() || null,
    water_type: String(row?.water_type || '').trim() || null,
    lat,
    lon,
    radius_m: radius,
    weather_lat: toNumberOrNull(row?.weather_lat),
    weather_lon: toNumberOrNull(row?.weather_lon),
    sort_order: sortOrder,
    is_active: row?.is_active !== false,
  };
}

export default function WaterbodyManagerSection({
  clubId,
  title = 'Gewässer',
  sectionClassName = '',
  collapsible = true,
  allowSensorAssignment = true,
  onMessage,
  onError,
}) {
  const effectiveClubId = clubId || getActiveClubId();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDraft, setCreateDraft] = useState(() => createEmptyDraft());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const [deactivatingRowId, setDeactivatingRowId] = useState(null);
  const [temperatureSensorCandidates, setTemperatureSensorCandidates] = useState([]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const leftOrder = Number(a.sort_order) || 0;
        const rightOrder = Number(b.sort_order) || 0;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(a.name || '').localeCompare(String(b.name || ''), 'de', { sensitivity: 'base' });
      }),
    [rows],
  );

  const loadRows = useCallback(async () => {
    if (!effectiveClubId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (!allowSensorAssignment) {
        const waterbodyRows = await listWaterbodiesByClub(effectiveClubId, { activeOnly: false });
        setRows((Array.isArray(waterbodyRows) ? waterbodyRows : []).map((row) => toDraft(row)));
      } else {
        const [waterbodyRows, sensorRows] = await Promise.all([
          listWaterbodiesByClub(effectiveClubId, { activeOnly: false }),
          listWaterbodyTemperatureSensorsByClub(effectiveClubId, { activeOnly: true }),
        ]);
        const sensorByWaterbody = new Map(
          (Array.isArray(sensorRows) ? sensorRows : [])
            .filter((row) => row?.waterbody_id)
            .map((row) => [row.waterbody_id, row]),
        );

        setRows(
          (Array.isArray(waterbodyRows) ? waterbodyRows : []).map((row) => {
            const sensor = sensorByWaterbody.get(row.id);
            return toDraft({
              ...row,
              temperature_device_id: sensor?.device_id || '',
              temperature_topic: sensor?.topic || '',
            });
          }),
        );
      }
    } catch (error) {
      setRows([]);
      onError?.(error.message || 'Gewässer konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [effectiveClubId, allowSensorAssignment, onError]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!allowSensorAssignment) {
      setTemperatureSensorCandidates([]);
      return () => {};
    }
    let active = true;
    (async () => {
      try {
        const candidates = await listRecentTemperatureSensorCandidates({ limit: 300 });
        if (!active) return;
        setTemperatureSensorCandidates(Array.isArray(candidates) ? candidates : []);
      } catch {
        if (!active) return;
        setTemperatureSensorCandidates([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [effectiveClubId, allowSensorAssignment]);

  const temperatureDeviceCandidates = useMemo(() => {
    const set = new Set();
    temperatureSensorCandidates.forEach((entry) => {
      const deviceId = String(entry?.device_id || '').trim();
      if (!deviceId) return;
      set.add(deviceId);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }, [temperatureSensorCandidates]);

  const temperatureTopicCandidates = useMemo(() => {
    const set = new Set();
    temperatureSensorCandidates.forEach((entry) => {
      const topic = String(entry?.topic || '').trim();
      if (!topic) return;
      set.add(topic);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }, [temperatureSensorCandidates]);

  const temperatureDeviceDatalistId = 'waterbody-temperature-device-options';
  const temperatureTopicDatalistId = 'waterbody-temperature-topic-options';

  const updateLocalRow = useCallback((id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const handleAdd = async () => {
    if (!effectiveClubId || adding) return;
    setAdding(true);
    try {
      const payload = normalizePayload(createDraft);
      const created = await createWaterbody({
        club_id: effectiveClubId,
        ...payload,
      });
      setRows((prev) => [...prev, toDraft(created)]);
      if (allowSensorAssignment) {
        const savedSensor = await saveWaterbodyTemperatureSensorAssignment({
          clubId: effectiveClubId,
          waterbodyId: created.id,
          deviceId: createDraft.temperature_device_id,
          topic: createDraft.temperature_topic,
          isActive: true,
        });
        if (!savedSensor) {
          setCreateDraft(createEmptyDraft());
          setShowCreateForm(false);
          onMessage?.('Gewässer angelegt.');
          return;
        }
        setRows((prev) => prev.map((row) => (
          row.id === created.id
            ? {
              ...row,
              temperature_device_id: savedSensor.device_id || '',
              temperature_topic: savedSensor.topic || '',
            }
            : row
        )));
      }
      setCreateDraft(createEmptyDraft());
      setShowCreateForm(false);
      onMessage?.('Gewässer angelegt.');
    } catch (error) {
      onError?.(error.message || 'Gewässer konnte nicht angelegt werden.');
    } finally {
      setAdding(false);
    }
  };

  const handleSave = async (row) => {
    if (!effectiveClubId || !row?.id || savingRowId) return;
    setSavingRowId(row.id);
    try {
      const payload = normalizePayload(row);
      const updated = await updateWaterbody(row.id, {
        club_id: effectiveClubId,
        ...payload,
      });
      if (allowSensorAssignment) {
        const savedSensor = await saveWaterbodyTemperatureSensorAssignment({
          clubId: effectiveClubId,
          waterbodyId: row.id,
          deviceId: row.temperature_device_id,
          topic: row.temperature_topic,
          isActive: true,
        });
        setRows((prev) => prev.map((entry) => (
          entry.id === row.id
            ? {
              ...toDraft(updated),
              temperature_device_id: savedSensor?.device_id || '',
              temperature_topic: savedSensor?.topic || '',
            }
            : entry
        )));
      } else {
        setRows((prev) => prev.map((entry) => (entry.id === row.id ? toDraft(updated) : entry)));
      }
      onMessage?.('Gewässer gespeichert.');
    } catch (error) {
      onError?.(error.message || 'Gewässer konnte nicht gespeichert werden.');
    } finally {
      setSavingRowId(null);
    }
  };

  const tableColumnCount = allowSensorAssignment ? 13 : 11;

  const handleDeactivate = async (row) => {
    if (!effectiveClubId || !row?.id || deactivatingRowId) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Gewässer "${row.name || 'Unbekannt'}" deaktivieren?`);
    if (!confirmed) return;

    setDeactivatingRowId(row.id);
    try {
      const updated = await deactivateWaterbody(row.id, { club_id: effectiveClubId });
      setRows((prev) => prev.map((entry) => (entry.id === row.id ? toDraft(updated) : entry)));
      onMessage?.('Gewässer deaktiviert.');
    } catch (error) {
      onError?.(error.message || 'Gewässer konnte nicht deaktiviert werden.');
    } finally {
      setDeactivatingRowId(null);
    }
  };

  const content = (
    <div className="mt-4 space-y-4">
        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800/70">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Typ</th>
                <th className="p-2 text-left">Lat</th>
                <th className="p-2 text-left">Lon</th>
                <th className="p-2 text-left">Radius</th>
                <th className="p-2 text-left">Wetter-Lat</th>
                <th className="p-2 text-left">Wetter-Lon</th>
                {allowSensorAssignment ? (
                  <th className="p-2 text-left">Sensor-ID</th>
                ) : null}
                {allowSensorAssignment ? (
                  <th className="p-2 text-left">Sensor-Topic</th>
                ) : null}
                <th className="p-2 text-left">Sort</th>
                <th className="p-2 text-left">Aktiv</th>
                <th className="p-2 text-left">Beschreibung</th>
                <th className="p-2 text-left">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColumnCount} className="p-3 text-center text-gray-500">Lade Gewässer...</td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="p-3 text-center text-gray-500">Noch keine Gewässer vorhanden.</td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const isSaving = savingRowId === row.id;
                  const isDeactivating = deactivatingRowId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-gray-200 align-top dark:border-gray-700">
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(event) => updateLocalRow(row.id, { name: event.target.value })}
                          className="w-44 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.water_type}
                          onChange={(event) => updateLocalRow(row.id, { water_type: event.target.value })}
                          className="w-32 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.lat}
                          onChange={(event) => updateLocalRow(row.id, { lat: event.target.value })}
                          className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.lon}
                          onChange={(event) => updateLocalRow(row.id, { lon: event.target.value })}
                          className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={row.radius_m}
                          onChange={(event) => updateLocalRow(row.id, { radius_m: event.target.value })}
                          className="w-24 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.weather_lat}
                          onChange={(event) => updateLocalRow(row.id, { weather_lat: event.target.value })}
                          className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.weather_lon}
                          onChange={(event) => updateLocalRow(row.id, { weather_lon: event.target.value })}
                          className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      {allowSensorAssignment ? (
                        <td className="p-2">
                          <input
                            type="text"
                            list={temperatureDeviceDatalistId}
                            value={row.temperature_device_id}
                            onChange={(event) => updateLocalRow(row.id, { temperature_device_id: event.target.value })}
                            className="w-32 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                            placeholder="device_id"
                          />
                        </td>
                      ) : null}
                      {allowSensorAssignment ? (
                        <td className="p-2">
                          <input
                            type="text"
                            list={temperatureTopicDatalistId}
                            value={row.temperature_topic}
                            onChange={(event) => updateLocalRow(row.id, { temperature_topic: event.target.value })}
                            className="w-40 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                            placeholder="optional topic"
                          />
                        </td>
                      ) : null}
                      <td className="p-2">
                        <input
                          type="number"
                          value={row.sort_order}
                          onChange={(event) => updateLocalRow(row.id, { sort_order: event.target.value })}
                          className="w-20 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={row.is_active}
                          onChange={(event) => updateLocalRow(row.id, { is_active: event.target.checked })}
                        />
                      </td>
                      <td className="p-2">
                        <textarea
                          value={row.description}
                          onChange={(event) => updateLocalRow(row.id, { description: event.target.value })}
                          rows={2}
                          className="w-48 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSave(row)}
                            disabled={isSaving || isDeactivating}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving ? 'Speichert...' : 'Speichern'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(row)}
                            disabled={isSaving || isDeactivating || row.is_active === false}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeactivating ? 'Deaktiviert...' : 'Deaktivieren'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((prev) => !prev);
              if (!showCreateForm) setCreateDraft(createEmptyDraft());
            }}
            className="rounded border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            {showCreateForm ? 'Anlegen abbrechen' : 'Gewässer anlegen'}
          </button>
        </div>

        {showCreateForm ? (
          <div className="grid gap-2 rounded border border-gray-200 bg-gray-50 p-3 md:grid-cols-2 dark:border-gray-700 dark:bg-gray-800/40">
            <label className="text-sm">
              Name
              <input
                type="text"
                value={createDraft.name}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="z. B. Südsee"
              />
            </label>
            <label className="text-sm">
              Typ
              <input
                type="text"
                value={createDraft.water_type}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, water_type: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="z. B. See"
              />
            </label>
            <label className="text-sm">
              Lat
              <input
                type="text"
                inputMode="decimal"
                value={createDraft.lat}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, lat: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="text-sm">
              Lon
              <input
                type="text"
                inputMode="decimal"
                value={createDraft.lon}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, lon: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="text-sm">
              Radius (m)
              <input
                type="number"
                value={createDraft.radius_m}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, radius_m: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="text-sm">
              Sortierung
              <input
                type="number"
                value={createDraft.sort_order}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, sort_order: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="text-sm">
              Wetter-Lat
              <input
                type="text"
                inputMode="decimal"
                value={createDraft.weather_lat}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, weather_lat: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="text-sm">
              Wetter-Lon
              <input
                type="text"
                inputMode="decimal"
                value={createDraft.weather_lon}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, weather_lon: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            {allowSensorAssignment ? (
              <label className="text-sm">
                Sensor-ID (Temperatur)
                <input
                  type="text"
                  list={temperatureDeviceDatalistId}
                  value={createDraft.temperature_device_id}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, temperature_device_id: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  placeholder="device_id"
                />
              </label>
            ) : null}
            {allowSensorAssignment ? (
              <label className="text-sm">
                Sensor-Topic (optional)
                <input
                  type="text"
                  list={temperatureTopicDatalistId}
                  value={createDraft.temperature_topic}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, temperature_topic: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  placeholder="z. B. sensors/club-a/temp"
                />
              </label>
            ) : null}
            <label className="text-sm md:col-span-2">
              Beschreibung
              <textarea
                value={createDraft.description}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, description: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                rows={2}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createDraft.is_active}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Aktiv
            </label>
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={adding}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding ? 'Legt an...' : '+ Gewässer'}
              </button>
            </div>
            {allowSensorAssignment && temperatureDeviceCandidates.length > 0 ? (
              <p className="text-xs text-gray-500 md:col-span-2">
                Vorschläge aus Sensor-Logs verfügbar ({temperatureDeviceCandidates.length} Geräte).
              </p>
            ) : null}
          </div>
        ) : null}
        {allowSensorAssignment ? (
          <datalist id={temperatureDeviceDatalistId}>
            {temperatureDeviceCandidates.map((deviceId) => (
              <option key={deviceId} value={deviceId} />
            ))}
          </datalist>
        ) : null}
        {allowSensorAssignment ? (
          <datalist id={temperatureTopicDatalistId}>
            {temperatureTopicCandidates.map((topic) => (
              <option key={topic} value={topic} />
            ))}
          </datalist>
        ) : null}
    </div>
  );

  if (collapsible) {
    return (
      <details className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 ${sectionClassName}`}>
        <summary className="cursor-pointer list-none text-lg font-semibold">
          {title} ({rows.length})
        </summary>
        {content}
      </details>
    );
  }

  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 ${sectionClassName}`}>
      {title ? (
        <h2 className="text-lg font-semibold">
          {title} ({rows.length})
        </h2>
      ) : null}
      {content}
    </section>
  );
}

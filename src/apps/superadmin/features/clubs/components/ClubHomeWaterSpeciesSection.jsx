import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';

function mapRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id || null,
    species: String(row?.species || '').trim(),
    is_active: row?.is_active !== false,
    min_size_cm: row?.min_size_cm != null ? Number(row.min_size_cm) : null,
    season_start_md: row?.season_start_md || null,
    season_end_md: row?.season_end_md || null,
  }));
}

function sortRows(rows) {
  return [...rows].sort((a, b) => String(a.species || '').localeCompare(String(b.species || ''), 'de', { sensitivity: 'base' }));
}

function buildUpdatePayload(row) {
  const species = String(row?.species || '').trim();
  if (!species) throw new Error('Fischart darf nicht leer sein.');
  return {
    species,
    is_active: row?.is_active !== false,
  };
}

export default function ClubHomeWaterSpeciesSection({ clubId, onMessage, onError }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState(null);
  const [deletingRowId, setDeletingRowId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [newSpecies, setNewSpecies] = useState('');

  const sortedRows = useMemo(() => sortRows(rows), [rows]);

  const loadRows = useCallback(async () => {
    if (!clubId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('club_fish_rules')
        .select('id, species, is_active, min_size_cm, season_start_md, season_end_md')
        .eq('club_id', clubId)
        .is('waterbody_id', null)
        .order('species', { ascending: true });
      if (error) throw error;
      setRows(mapRows(data));
    } catch (error) {
      onError?.(error?.message || 'Vereinsgewässer-Fischarten konnten nicht geladen werden.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [clubId, onError]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const updateLocalRow = useCallback((id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const addRow = async () => {
    if (!clubId || adding) return;
    const species = String(newSpecies || '').trim();
    if (!species) {
      onError?.('Bitte eine Fischart eingeben.');
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('club_fish_rules')
        .insert({
          club_id: clubId,
          waterbody_id: null,
          species,
          is_active: true,
        })
        .select('id, species, is_active, min_size_cm, season_start_md, season_end_md')
        .single();
      if (error) throw error;
      const created = mapRows([data])[0];
      setRows((prev) => sortRows([...prev, created]));
      setNewSpecies('');
      onMessage?.('Fischart hinzugefügt.');
    } catch (error) {
      if (String(error?.code || '') === '23505') {
        onError?.('Diese Fischart existiert bereits für das Vereinsgewässer.');
      } else {
        onError?.(error?.message || 'Fischart konnte nicht erstellt werden.');
      }
    } finally {
      setAdding(false);
    }
  };

  const saveRow = async (row) => {
    if (!clubId || !row?.id || savingRowId) return;
    setSavingRowId(row.id);
    try {
      const payload = buildUpdatePayload(row);
      const { data, error } = await supabase
        .from('club_fish_rules')
        .update(payload)
        .eq('id', row.id)
        .eq('club_id', clubId)
        .select('id, species, is_active, min_size_cm, season_start_md, season_end_md')
        .single();
      if (error) throw error;
      const updated = mapRows([data])[0];
      setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      onMessage?.('Fischart gespeichert.');
    } catch (error) {
      if (String(error?.code || '') === '23505') {
        onError?.('Diese Fischart existiert bereits für das Vereinsgewässer.');
      } else {
        onError?.(error?.message || 'Fischart konnte nicht gespeichert werden.');
      }
    } finally {
      setSavingRowId(null);
    }
  };

  const removeRow = async (row) => {
    if (!clubId || !row?.id || deletingRowId) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Soll "${row.species || 'diese Fischart'}" gelöscht werden?`);
    if (!confirmed) return;

    setDeletingRowId(row.id);
    try {
      const { error } = await supabase
        .from('club_fish_rules')
        .delete()
        .eq('id', row.id)
        .eq('club_id', clubId);
      if (error) throw error;
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      onMessage?.('Fischart gelöscht.');
    } catch (error) {
      onError?.(error?.message || 'Fischart konnte nicht gelöscht werden.');
    } finally {
      setDeletingRowId(null);
    }
  };

  const seedDefaultRules = async () => {
    if (!clubId || seedingDefaults) return;
    setSeedingDefaults(true);
    try {
      const { error } = await supabase.rpc('seed_default_club_fish_rules', {
        p_club_id: clubId,
      });
      if (error) throw error;
      await loadRows();
      onMessage?.('Standard-Fischarten übernommen.');
    } catch (error) {
      onError?.(error?.message || 'Standard-Fischarten konnten nicht übernommen werden.');
    } finally {
      setSeedingDefaults(false);
    }
  };

  return (
    <details className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <summary className="cursor-pointer list-none text-lg font-semibold">
        5. Vereinsgewässer-Fischarten ({rows.length})
      </summary>

      <div className="mt-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Diese Liste steuert die Fischarten-Auswahl für die Region "Vereinsgewässer" in diesem Club.
        </p>

        <div className="flex flex-wrap items-end gap-2 rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <label className="min-w-[220px] flex-1 text-sm">
            Neue Fischart
            <input
              type="text"
              value={newSpecies}
              onChange={(event) => setNewSpecies(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="z. B. Schleie"
              disabled={adding}
            />
          </label>
          <button
            type="button"
            onClick={() => void addRow()}
            disabled={adding}
            className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200"
          >
            {adding ? 'Legt an...' : '+ Fischart'}
          </button>
          <button
            type="button"
            onClick={() => void seedDefaultRules()}
            disabled={seedingDefaults}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          >
            {seedingDefaults ? 'Lädt...' : 'Standards laden'}
          </button>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800/80">
              <tr>
                <th className="p-2 text-left">Fischart</th>
                <th className="p-2 text-left">Aktiv</th>
                <th className="p-2 text-left">Hinweis</th>
                <th className="p-2 text-left">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-500">Lade Fischarten...</td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-500">Noch keine Einträge vorhanden.</td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const isSaving = savingRowId === row.id;
                  const isDeleting = deletingRowId === row.id;
                  const detailLabel = [
                    row.min_size_cm != null ? `Mindestmaß ${row.min_size_cm} cm` : null,
                    row.season_start_md && row.season_end_md ? `Schonzeit ${row.season_start_md}–${row.season_end_md}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <tr key={row.id} className="border-t border-gray-200 align-top dark:border-gray-700">
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.species}
                          onChange={(event) => updateLocalRow(row.id, { species: event.target.value })}
                          className="w-56 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={row.is_active}
                          onChange={(event) => updateLocalRow(row.id, { is_active: event.target.checked })}
                        />
                      </td>
                      <td className="p-2 text-xs text-gray-600 dark:text-gray-400">
                        {detailLabel || 'Keine Zusatzregel'}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveRow(row)}
                            disabled={isSaving || isDeleting}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving ? 'Speichert...' : 'Speichern'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeRow(row)}
                            disabled={isSaving || isDeleting}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeleting ? 'Löscht...' : 'Löschen'}
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
      </div>
    </details>
  );
}

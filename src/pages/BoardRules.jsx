import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import BoardSubmenu from '@/components/BoardSubmenu';
import {
  createBoardRule,
  deleteBoardRule,
  fetchBoardRules,
  updateBoardRule,
} from '@/services/rulesService';

function createEmptyDraft() {
  return {
    id: null,
    species: '',
    min_size_cm: '',
    season_start: '',
    season_end: '',
    protected: false,
    daily_limit: '',
    notes: '',
    is_active: true,
    isNew: true,
  };
}

function toDraft(rule) {
  const fallbackId = rule?.species ? `fallback-${String(rule.species).toLowerCase()}` : `fallback-${Date.now()}`;
  return {
    id: rule?.id ?? fallbackId,
    species: rule?.species ?? '',
    min_size_cm: rule?.min_size_cm != null ? String(rule.min_size_cm) : '',
    season_start: rule?.season_start ?? '',
    season_end: rule?.season_end ?? '',
    protected: rule?.protected === true,
    daily_limit: rule?.daily_limit != null ? String(rule.daily_limit) : '',
    notes: rule?.notes ?? '',
    is_active: rule?.is_active !== false,
    isNew: false,
  };
}

export default function BoardRules() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');
  const [savingRowId, setSavingRowId] = useState(null);
  const [deletingRowId, setDeletingRowId] = useState(null);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (a.species || '').localeCompare(b.species || '', 'de', { sensitivity: 'base' })),
    [rows]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchBoardRules();
      setRows(Array.isArray(data) ? data.map(toDraft) : []);
    } catch (error) {
      setLoadError(error.message || 'Regeln konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateRow = useCallback((id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const addRow = () => {
    setMessage('');
    setSaveError('');
    setRows((prev) => [{ ...createEmptyDraft(), id: `new-${Date.now()}` }, ...prev]);
  };

  const removeUnsavedRow = (id) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const saveRow = async (row) => {
    setMessage('');
    setSaveError('');
    setSavingRowId(row.id);
    try {
      if (String(row.id).startsWith('new-')) {
        const created = await createBoardRule(row);
        setRows((prev) => prev.map((item) => (item.id === row.id ? toDraft(created) : item)));
        setMessage('Regel gespeichert.');
      } else {
        const updated = await updateBoardRule(row.id, row);
        setRows((prev) => prev.map((item) => (item.id === row.id ? toDraft(updated) : item)));
        setMessage('Regel gespeichert.');
      }
    } catch (error) {
      setSaveError(error.message || 'Regel konnte nicht gespeichert werden.');
    } finally {
      setSavingRowId(null);
    }
  };

  const removeRow = async (row) => {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Soll die Regel für "${row?.species || 'diese Fischart'}" gelöscht werden?`);
    if (!confirmed) return;

    setMessage('');
    setSaveError('');
    if (String(row.id).startsWith('new-')) {
      removeUnsavedRow(row.id);
      setMessage('Entwurf entfernt.');
      return;
    }

    setDeletingRowId(row.id);
    try {
      await deleteBoardRule(row.id);
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setMessage('Regel gelöscht.');
    } catch (error) {
      setSaveError(error.message || 'Regel konnte nicht gelöscht werden.');
    } finally {
      setDeletingRowId(null);
    }
  };

  return (
    <Card className="space-y-4 text-gray-800 dark:text-gray-100">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold">Regeln verwalten</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Vorstand/Admin kann hier Mindestmaß, Schonzeit und Zusatzhinweise pro Fischart pflegen.
          </p>
        </div>
        <BoardSubmenu activeKey="rules" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Neu laden
          </button>
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            + Regel
          </button>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {loadError}
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
          {saveError}
        </div>
      ) : null}

      {message ? (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800/40 dark:bg-green-900/30 dark:text-green-200">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900/60">
            <tr>
              <th className="p-2 text-left">Fischart</th>
              <th className="p-2 text-left">Mindestmaß (cm)</th>
              <th className="p-2 text-left">Schonzeit Start (MM-DD)</th>
              <th className="p-2 text-left">Schonzeit Ende (MM-DD)</th>
              <th className="p-2 text-left">Ganzjährig geschützt</th>
              <th className="p-2 text-left">Tageslimit</th>
              <th className="p-2 text-left">Aktiv</th>
              <th className="p-2 text-left">Hinweise</th>
              <th className="p-2 text-left">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500">
                  Lade Regeln...
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500">
                  Keine Regeln vorhanden. Lege die erste Regel über "+ Regel" an.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isSaving = savingRowId === row.id;
                const isDeleting = deletingRowId === row.id;
                return (
                  <tr key={row.id} className="border-t border-gray-200 align-top dark:border-gray-800">
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.species}
                        onChange={(e) => updateRow(row.id, { species: e.target.value })}
                        className="w-40 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        placeholder="z. B. Hecht"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.min_size_cm}
                        onChange={(e) => updateRow(row.id, { min_size_cm: e.target.value })}
                        className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        placeholder="z. B. 60"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.season_start}
                        onChange={(e) => updateRow(row.id, { season_start: e.target.value })}
                        className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        placeholder="02-15"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.season_end}
                        onChange={(e) => updateRow(row.id, { season_end: e.target.value })}
                        className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        placeholder="05-31"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.protected}
                        onChange={(e) => updateRow(row.id, { protected: e.target.checked })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.daily_limit}
                        onChange={(e) => updateRow(row.id, { daily_limit: e.target.value })}
                        className="w-20 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        placeholder="z. B. 2"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={(e) => updateRow(row.id, { is_active: e.target.checked })}
                      />
                    </td>
                    <td className="p-2">
                      <textarea
                        value={row.notes}
                        onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                        className="min-h-16 w-52 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        placeholder="Optionaler Hinweis"
                      />
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
    </Card>
  );
}

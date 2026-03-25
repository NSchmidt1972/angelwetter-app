import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { useSuperAdminHeaderTitle } from '@/apps/superadmin/context/headerTitleContext';
import {
  createFishRegion,
  createFishRegionSpecies,
  deleteFishRegion,
  deleteFishRegionSpecies,
  fetchFishRegionCatalogForSuperadmin,
  updateFishRegion,
  updateFishRegionSpecies,
} from '@/services/fishRegionsService';

const PAGE_TITLE = 'Regionen & Fischarten';

function sortRegions(rows) {
  return [...rows].sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
}

function sortSpecies(rows) {
  return [...rows].sort((a, b) => a.species.localeCompare(b.species, 'de', { sensitivity: 'base' }));
}

export default function RegionsPage() {
  const setSuperAdminHeaderTitle = useSuperAdminHeaderTitle();
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState([]);
  const [speciesRows, setSpeciesRows] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingRegionId, setSavingRegionId] = useState('');
  const [savingSpeciesId, setSavingSpeciesId] = useState('');
  const [deletingRegionId, setDeletingRegionId] = useState('');
  const [deletingSpeciesId, setDeletingSpeciesId] = useState('');
  const [addingRegion, setAddingRegion] = useState(false);
  const [addingSpecies, setAddingSpecies] = useState(false);
  const [newRegion, setNewRegion] = useState({
    id: '',
    label: '',
    is_active: true,
  });
  const [newSpecies, setNewSpecies] = useState({
    species: '',
    is_active: true,
  });

  const sortedRegions = useMemo(() => sortRegions(regions), [regions]);
  const selectedRegion = useMemo(
    () => sortedRegions.find((row) => row.id === selectedRegionId) || null,
    [selectedRegionId, sortedRegions],
  );
  const isHomeWaterRegionSelected = selectedRegion?.id === 'ferkensbruch';
  const speciesForSelectedRegion = useMemo(() => {
    if (!selectedRegionId) return [];
    const filtered = speciesRows.filter((row) => row.region_id === selectedRegionId);
    return sortSpecies(filtered);
  }, [selectedRegionId, speciesRows]);

  const applyCatalog = useCallback((catalog) => {
    const nextRegions = Array.isArray(catalog?.regions) ? catalog.regions : [];
    const nextSpecies = Array.isArray(catalog?.species) ? catalog.species : [];
    setRegions(nextRegions);
    setSpeciesRows(nextSpecies);
    setSelectedRegionId((prev) => {
      if (prev && nextRegions.some((row) => row.id === prev)) return prev;
      return nextRegions[0]?.id || '';
    });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const catalog = await fetchFishRegionCatalogForSuperadmin();
      applyCatalog(catalog);
    } catch (err) {
      setError(err?.message || 'Regionen konnten nicht geladen werden.');
      setRegions([]);
      setSpeciesRows([]);
      setSelectedRegionId('');
    } finally {
      setLoading(false);
    }
  }, [applyCatalog]);

  useEffect(() => {
    setSuperAdminHeaderTitle(PAGE_TITLE);
  }, [setSuperAdminHeaderTitle]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateRegionLocal = (regionId, patch) => {
    setRegions((prev) => prev.map((row) => (row.id === regionId ? { ...row, ...patch } : row)));
  };

  const updateSpeciesLocal = (speciesId, patch) => {
    setSpeciesRows((prev) => prev.map((row) => (row.id === speciesId ? { ...row, ...patch } : row)));
  };

  const handleCreateRegion = async (event) => {
    event.preventDefault();
    if (addingRegion) return;

    setAddingRegion(true);
    setError('');
    setMessage('');
    try {
      const created = await createFishRegion(newRegion);
      setRegions((prev) => sortRegions([...prev, created]));
      setSelectedRegionId(created.id);
      setNewRegion({ id: '', label: '', is_active: true });
      setMessage('Region erstellt.');
    } catch (err) {
      setError(err?.message || 'Region konnte nicht erstellt werden.');
    } finally {
      setAddingRegion(false);
    }
  };

  const handleSaveRegion = async (row) => {
    if (!row?.id || savingRegionId) return;
    setSavingRegionId(row.id);
    setError('');
    setMessage('');
    try {
      const updated = await updateFishRegion(row.id, {
        label: row.label,
        is_active: row.is_active,
      });
      setRegions((prev) => prev.map((entry) => (entry.id === row.id ? updated : entry)));
      setMessage('Region gespeichert.');
    } catch (err) {
      setError(err?.message || 'Region konnte nicht gespeichert werden.');
    } finally {
      setSavingRegionId('');
    }
  };

  const handleDeleteRegion = async (row) => {
    if (!row?.id || deletingRegionId) return;
    if (row.id === 'ferkensbruch') {
      setError('Die Region "Vereinsgewässer" ist fix und kann nicht gelöscht werden.');
      setMessage('');
      return;
    }
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Soll die Region "${row.label || row.id}" inkl. Fischarten gelöscht werden?`);
    if (!confirmed) return;

    setDeletingRegionId(row.id);
    setError('');
    setMessage('');
    try {
      await deleteFishRegion(row.id);
      setRegions((prev) => prev.filter((entry) => entry.id !== row.id));
      setSpeciesRows((prev) => prev.filter((entry) => entry.region_id !== row.id));
      if (selectedRegionId === row.id) {
        const nextRegion = sortedRegions.find((entry) => entry.id !== row.id);
        setSelectedRegionId(nextRegion?.id || '');
      }
      setMessage('Region gelöscht.');
    } catch (err) {
      setError(err?.message || 'Region konnte nicht gelöscht werden.');
    } finally {
      setDeletingRegionId('');
    }
  };

  const handleCreateSpecies = async (event) => {
    event.preventDefault();
    if (!selectedRegionId || addingSpecies) return;
    if (selectedRegionId === 'ferkensbruch') {
      setError('Vereinsgewässer-Fischarten werden pro Club in den Club-Details gepflegt.');
      setMessage('');
      return;
    }

    setAddingSpecies(true);
    setError('');
    setMessage('');
    try {
      const created = await createFishRegionSpecies({
        region_id: selectedRegionId,
        species: newSpecies.species,
        is_active: newSpecies.is_active,
      });
      setSpeciesRows((prev) => sortSpecies([...prev, created]));
      setNewSpecies({ species: '', is_active: true });
      setMessage('Fischart erstellt.');
    } catch (err) {
      setError(err?.message || 'Fischart konnte nicht erstellt werden.');
    } finally {
      setAddingSpecies(false);
    }
  };

  const handleSaveSpecies = async (row) => {
    if (!row?.id || savingSpeciesId) return;
    if (row.region_id === 'ferkensbruch') {
      setError('Vereinsgewässer-Fischarten werden pro Club verwaltet.');
      setMessage('');
      return;
    }
    setSavingSpeciesId(row.id);
    setError('');
    setMessage('');
    try {
      const updated = await updateFishRegionSpecies(row.id, {
        species: row.species,
        is_active: row.is_active,
      });
      setSpeciesRows((prev) => prev.map((entry) => (entry.id === row.id ? updated : entry)));
      setMessage('Fischart gespeichert.');
    } catch (err) {
      setError(err?.message || 'Fischart konnte nicht gespeichert werden.');
    } finally {
      setSavingSpeciesId('');
    }
  };

  const handleDeleteSpecies = async (row) => {
    if (!row?.id || deletingSpeciesId) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Soll die Fischart "${row.species}" gelöscht werden?`);
    if (!confirmed) return;

    setDeletingSpeciesId(row.id);
    setError('');
    setMessage('');
    try {
      await deleteFishRegionSpecies(row.id);
      setSpeciesRows((prev) => prev.filter((entry) => entry.id !== row.id));
      setMessage('Fischart gelöscht.');
    } catch (err) {
      setError(err?.message || 'Fischart konnte nicht gelöscht werden.');
    } finally {
      setDeletingSpeciesId('');
    }
  };

  if (loading) return <Card className="p-4 sm:p-6">Regionen werden geladen...</Card>;

  return (
    <Card className="space-y-6 p-4 sm:p-6">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Globale Regionen und Fischarten für das Fangformular verwalten.
      </p>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800/40 dark:bg-green-900/30 dark:text-green-200">
          {message}
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-700">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Regionen</h2>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            Neu laden
          </button>
        </div>

        <form className="mb-4 grid gap-2 md:grid-cols-3" onSubmit={handleCreateRegion}>
          <input
            type="text"
            value={newRegion.id}
            onChange={(event) => setNewRegion((prev) => ({ ...prev, id: event.target.value }))}
            className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="region-id (z. B. denmark)"
          />
          <input
            type="text"
            value={newRegion.label}
            onChange={(event) => setNewRegion((prev) => ({ ...prev, label: event.target.value }))}
            className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Region-Name"
          />
          <button
            type="submit"
            disabled={addingRegion}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addingRegion ? 'Erstellt...' : '+ Region'}
          </button>
        </form>

        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800/80">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Aktiv</th>
                <th className="p-2 text-left">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedRegions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-500">Keine Regionen vorhanden.</td>
                </tr>
              ) : (
                sortedRegions.map((row) => {
                  const isSaving = savingRegionId === row.id;
                  const isDeleting = deletingRegionId === row.id;
                  const isSelected = selectedRegionId === row.id;

                  return (
                    <tr key={row.id} className={`border-t border-gray-200 dark:border-gray-700 ${isSelected ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}>
                      <td className="p-2 font-mono text-xs">{row.id}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.label}
                          onFocus={() => setSelectedRegionId(row.id)}
                          onChange={(event) => updateRegionLocal(row.id, { label: event.target.value })}
                          className="w-52 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={row.is_active}
                          onChange={(event) => updateRegionLocal(row.id, { is_active: event.target.checked })}
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRegionId(row.id);
                              void handleSaveRegion(row);
                            }}
                            disabled={isSaving || isDeleting}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving ? 'Speichert...' : 'Speichern'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRegion(row)}
                            disabled={isSaving || isDeleting || row.id === 'ferkensbruch'}
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
      </section>

      <section className="rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-700">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">
            Fischarten {selectedRegion ? `(${selectedRegion.label})` : ''}
          </h2>
        </div>

        {!selectedRegion ? (
          <p className="text-sm text-gray-500">Bitte zuerst eine Region auswählen.</p>
        ) : isHomeWaterRegionSelected ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
            Fischarten für <strong>Vereinsgewässer</strong> werden ausschließlich clubspezifisch gepflegt:
            im jeweiligen Club unter „Fischregel-Kontext je Gewässer“.
          </div>
        ) : (
          <>
            <form className="mb-4 grid gap-2 md:grid-cols-3" onSubmit={handleCreateSpecies}>
              <input
                type="text"
                value={newSpecies.species}
                onChange={(event) => setNewSpecies((prev) => ({ ...prev, species: event.target.value }))}
                className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Neue Fischart"
              />
              <label className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={newSpecies.is_active}
                  onChange={(event) => setNewSpecies((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Aktiv
              </label>
              <button
                type="submit"
                disabled={addingSpecies}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addingSpecies ? 'Erstellt...' : '+ Fischart'}
              </button>
            </form>

            <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800/80">
                  <tr>
                    <th className="p-2 text-left">Fischart</th>
                    <th className="p-2 text-left">Aktiv</th>
                    <th className="p-2 text-left">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {speciesForSelectedRegion.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-3 text-center text-gray-500">Keine Fischarten für diese Region.</td>
                    </tr>
                  ) : (
                    speciesForSelectedRegion.map((row) => {
                      const isSaving = savingSpeciesId === row.id;
                      const isDeleting = deletingSpeciesId === row.id;
                      return (
                        <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.species}
                              onChange={(event) => updateSpeciesLocal(row.id, { species: event.target.value })}
                              className="w-64 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={row.is_active}
                              onChange={(event) => updateSpeciesLocal(row.id, { is_active: event.target.checked })}
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSaveSpecies(row)}
                                disabled={isSaving || isDeleting}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSaving ? 'Speichert...' : 'Speichern'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteSpecies(row)}
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
          </>
        )}
      </section>
    </Card>
  );
}

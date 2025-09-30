import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addWhitelistEmail,
  fetchProfiles,
  fetchWhitelist,
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

  useEffect(() => {
    refreshProfiles();
    refreshWhitelist();
  }, [refreshProfiles, refreshWhitelist]);

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Whitelist verwalten</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Nur E-Mail-Adressen auf der Whitelist dürfen neue Accounts erstellen.
            </p>
          </div>
          <form className="flex gap-2" onSubmit={handleAddEmail}>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="E-Mail hinzufügen"
              className="w-60 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
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
        </div>

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
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Mitglieder & Rollen</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Weise Vorstand- oder Admin-Rechte zu. Änderungen wirken sofort.
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name oder Rolle suchen"
            className="w-60 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
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
      </section>
    </div>
  );
}

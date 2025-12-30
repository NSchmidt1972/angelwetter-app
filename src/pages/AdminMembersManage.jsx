import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WhitelistSection from '@/components/WhitelistSection';
import MembersSection from '@/components/MembersSection';
import {
  addWhitelistEmail,
  fetchProfiles,
  fetchWhitelist,
  updateProfileRole,
  deleteProfile,
  removeWhitelistEmail,
} from '@/services/boardService';
import { supabase } from '@/supabaseClient';

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

const BASE_ROLE_OPTIONS = [
  { value: 'mitglied', label: 'Mitglied' },
  { value: 'gast', label: 'Gast' },
  { value: 'tester', label: 'Tester' },
  { value: 'vorstand', label: 'Vorstand' },
];
const ADMIN_OPTION = { value: 'admin', label: 'Admin (nur Nicol Schmidt)' };

export default function AdminMembersManage() {
  const detailSectionRef = useRef(null);

  // Whitelist
  const [whitelist, setWhitelist] = useState([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState('');
  const [whitelistMessage, setWhitelistMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [showWhitelist, setShowWhitelist] = useState(true);

  // Mitglieder
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState('');
  const [roleMessage, setRoleMessage] = useState('');
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [deletingProfileId, setDeletingProfileId] = useState(null);
  const [showMemberList, setShowMemberList] = useState(true);
  const [search, setSearch] = useState('');
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'mitglied' });
  const [savingMember, setSavingMember] = useState(false);
  const [newMemberMessage, setNewMemberMessage] = useState('');
  const [newMemberError, setNewMemberError] = useState('');

  useEffect(() => {
    refreshProfiles();
    refreshWhitelist();
  }, []);

  const canAssignAdmin = useCallback((profile) => {
    if (!profile?.name) return false;
    return String(profile.name).trim().toLowerCase() === 'nicol schmidt';
  }, []);

  const roleOptionsForProfile = useCallback(
    (profile) => {
      const options = [...BASE_ROLE_OPTIONS];
      if (canAssignAdmin(profile) || normalizeRoleValue(profile?.role) === 'admin') {
        options.push(ADMIN_OPTION);
      }
      return options;
    },
    [canAssignAdmin],
  );

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
      const exists = whitelist.some((entry) => String(entry?.email || '').toLowerCase() === normalizedInput);
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
    const confirmed = typeof window === 'undefined' ? true : window.confirm(`Soll ${email} wirklich von der Whitelist entfernt werden?`);
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
      setProfiles((prev) => prev.map((profile) => (profile.id === profileId ? { ...profile, role: nextRole } : profile)));
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
    const confirmed =
      typeof window === 'undefined'
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

  const handleCreateMember = async () => {
    setNewMemberMessage('');
    setNewMemberError('');
    const name = newMember.name.trim();
    const email = newMember.email.trim().toLowerCase();
    if (!name) {
      setNewMemberError('Bitte Name angeben.');
      return;
    }
    setSavingMember(true);
    try {
      const payload = {
        name,
        email: email || null,
        role: normalizeRoleValue(newMember.role),
      };
      const { error: insertError } = await supabase.from('profiles').insert([payload]);
      if (insertError) throw insertError;
      setNewMemberMessage('Mitglied angelegt.');
      setNewMember({ name: '', email: '', role: 'mitglied' });
      refreshProfiles();
    } catch (error) {
      setNewMemberError(error.message || 'Mitglied konnte nicht angelegt werden.');
    } finally {
      setSavingMember(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="rounded-xl bg-white p-6 shadow-sm shadow-gray-200 dark:bg-gray-900 dark:shadow-black/20">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Mitgliederverwaltung</p>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Schnellanlage</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Legt sofort einen neuen Datensatz in der Tabelle „profiles“ an. Felder sind optional, außer dem Namen.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">Name*</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                value={newMember.name}
                onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Max Mustermann"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">E-Mail</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                value={newMember.email}
                onChange={(e) => setNewMember((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="max@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">Rolle</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                value={newMember.role}
                onChange={(e) => setNewMember((prev) => ({ ...prev, role: e.target.value }))}
              >
                {BASE_ROLE_OPTIONS.concat(ADMIN_OPTION).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                onClick={handleCreateMember}
                disabled={savingMember}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {savingMember ? 'Speichert...' : 'Mitglied anlegen'}
              </button>
              {newMemberMessage ? <span className="text-sm text-emerald-700 dark:text-emerald-300">{newMemberMessage}</span> : null}
              {newMemberError ? <span className="text-sm text-red-600 dark:text-red-300">{newMemberError}</span> : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-blue-700 text-white p-6 shadow-md shadow-blue-900/20">
          <h2 className="text-lg font-semibold">Hinweis</h2>
          <p className="mt-2 text-sm text-blue-100">
            Name ist Pflicht. E-Mail und Rolle sind optional (Standard: Mitglied). Nach dem Speichern kannst du in der Liste Rollen ändern,
            sperren/aktivieren oder löschen.
          </p>
          <p className="mt-3 text-xs text-blue-100/80">
            Admin-Rolle ist nur für Nicol Schmidt zulässig (wie in der Vorstandsansicht).
          </p>
        </div>
      </section>

      <section ref={detailSectionRef} className="space-y-6">
        <WhitelistSection
          showWhitelist={showWhitelist}
          onToggleWhitelist={() => setShowWhitelist((prev) => !prev)}
          newEmail={newEmail}
          onChangeNewEmail={setNewEmail}
          addingEmail={addingEmail}
          whitelist={whitelist}
          whitelistLoading={whitelistLoading}
          whitelistError={whitelistError}
          whitelistMessage={whitelistMessage}
          onAddEmail={handleAddEmail}
          onRemoveEmail={handleRemoveEmail}
          formatDate={formatDate}
        />

        <MembersSection
          showMemberList={showMemberList}
          onToggleMemberList={() => setShowMemberList((prev) => !prev)}
          search={search}
          onChangeSearch={setSearch}
          profilesError={profilesError}
          roleMessage={roleMessage}
          profilesLoading={profilesLoading}
          filteredProfiles={filteredProfiles}
          updatingRoleId={updatingRoleId}
          deletingProfileId={deletingProfileId}
          onChangeRole={handleRoleChange}
          onMemberActionChange={handleMemberActionChange}
          roleOptionsForProfile={roleOptionsForProfile}
          formatDate={formatDate}
        />
      </section>
    </div>
  );
}

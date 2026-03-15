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
import { Card } from '@/components/ui';
import { ROLES, normalizeRole } from '@/permissions/roles';

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
  return normalizeRole(role, ROLES.MEMBER);
}

const BASE_ROLE_OPTIONS = [
  { value: ROLES.MEMBER, label: 'Mitglied' },
  { value: ROLES.GUEST, label: 'Gast' },
  { value: ROLES.TESTER, label: 'Tester' },
  { value: ROLES.BOARD, label: 'Vorstand' },
  { value: ROLES.ADMIN, label: 'Admin' },
];

export default function AdminMembersManage() {
  const detailSectionRef = useRef(null);

  // Whitelist
  const [whitelist, setWhitelist] = useState([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState('');
  const [whitelistMessage, setWhitelistMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [showWhitelist, setShowWhitelist] = useState(false);

  // Mitglieder
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState('');
  const [roleMessage, setRoleMessage] = useState('');
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [deletingProfileId, setDeletingProfileId] = useState(null);
  const [showMemberList, setShowMemberList] = useState(false);
  const [search, setSearch] = useState('');

  const roleOptionsForProfile = useCallback(
    () => BASE_ROLE_OPTIONS,
    [],
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

    try {
      await updateProfileRole(profileId, nextRole);
      await refreshProfiles();
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
      await refreshProfiles();
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
      if (currentRole === ROLES.INACTIVE) return;
      await handleRoleChange(profile.id, ROLES.INACTIVE);
      return;
    }

    if (action === 'active') {
      if (currentRole === ROLES.INACTIVE || profile.role == null) {
        await handleRoleChange(profile.id, ROLES.MEMBER);
      }
      return;
    }
  };

  useEffect(() => {
    refreshProfiles();
    refreshWhitelist();
  }, [refreshProfiles, refreshWhitelist]);

  return (
    <Card className="space-y-8">
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
    </Card>
  );
}

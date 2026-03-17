import { ROLES, normalizeRole } from '@/permissions/roles';

export default function MembersSection({
  sectionId,
  showMemberList,
  onToggleMemberList,
  showToggle = true,
  search,
  onChangeSearch,
  profilesError,
  roleMessage,
  profilesLoading,
  filteredProfiles,
  updatingRoleId,
  deletingProfileId,
  onChangeRole,
  onMemberActionChange,
  roleOptionsForProfile,
  formatDate,
}) {
  const isOpen = showToggle ? showMemberList : true;

  return (
    <section id={sectionId} className="scroll-mt-24 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Mitglieder & Rollen</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Weise Vorstand- oder Admin-Rechte zu. Änderungen wirken sofort.
          </p>
        </div>
        {showToggle ? (
          <button
            type="button"
            onClick={onToggleMemberList}
            aria-expanded={showMemberList}
            className={`rounded px-4 py-2 text-sm font-semibold transition ${
              showMemberList
                ? 'border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showMemberList ? 'Liste verbergen' : 'Liste anzeigen'}
          </button>
        ) : null}
      </div>

      {isOpen && (
        <>
          <div className="mt-4 flex justify-end">
            <input
              type="search"
              value={search}
              onChange={(event) => onChangeSearch(event.target.value)}
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
                    const currentRole = normalizeRole(profile?.role, ROLES.MEMBER);
                    const selectValue =
                      currentRole === ROLES.INACTIVE
                        ? ROLES.MEMBER
                        : currentRole;
                    const isInactive = currentRole === ROLES.INACTIVE;
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
                            onChange={(event) => onChangeRole(profile.id, event.target.value)}
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
                            onChange={(event) => onMemberActionChange(profile, event.target.value)}
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
  );
}

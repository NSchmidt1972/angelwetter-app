import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function RegisteredUsersSection({
  allProfiles,
  formatDateLabel,
  listItemClass,
  metaTextClass,
}) {
  return (
    <OverviewSection title="🗓 Registrierte User" value={`${allProfiles.length} registrierte Nutzer`}>
      <div className="max-h-60 overflow-y-auto">
        <ul className={listItemClass}>
          {allProfiles
            .slice()
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map((profile, index) => (
              <li key={index}>
                {profile.name}{' '}
                <span className={metaTextClass}>(seit {formatDateLabel(profile.created_at)})</span>
              </li>
            ))}
        </ul>
      </div>
    </OverviewSection>
  );
}

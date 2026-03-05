import OverviewSection from '@/features/adminOverview/components/OverviewSection';
import { APP_VERSION, GIT_COMMIT } from '@/utils/buildInfo';

function isCurrentBuildLabel(label) {
  const buildLabel = String(label || '').trim();
  if (!buildLabel) return false;

  const currentVersion = String(APP_VERSION || '').trim();
  const currentCommit = String(GIT_COMMIT || '').trim();
  const shortCommit = currentCommit ? currentCommit.slice(0, 7) : '';

  if (shortCommit && buildLabel.includes(`#${shortCommit}`)) return true;
  if (currentVersion && (buildLabel === currentVersion || buildLabel.startsWith(`${currentVersion} ·`))) return true;
  return false;
}

export default function RegisteredUsersSection({
  allProfiles,
  formatDateLabel,
  getBuildInfoForUser,
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
            .map((profile, index) => {
              const buildInfo = getBuildInfoForUser?.(profile.name);
              const hasCurrentBuild = isCurrentBuildLabel(buildInfo?.label);
              return (
                <li key={index}>
                  <span className={hasCurrentBuild ? 'text-green-700 dark:text-green-400 font-semibold' : undefined}>
                    {profile.name}
                  </span>{' '}
                  <span className={metaTextClass}>
                    (seit {formatDateLabel(profile.created_at)} ·{' '}
                    {buildInfo ? (
                      <span className={hasCurrentBuild ? 'text-green-700 dark:text-green-400 font-semibold' : undefined}>
                        Build {buildInfo.label}
                      </span>
                    ) : 'Build unbekannt'})
                  </span>
                </li>
              );
            })}
        </ul>
      </div>
    </OverviewSection>
  );
}

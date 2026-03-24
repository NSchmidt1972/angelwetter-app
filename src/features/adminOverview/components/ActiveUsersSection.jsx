import { parseTimestamp } from '@/utils/dateUtils';
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

export default function ActiveUsersSection({
  activeUsers,
  formatDateTimeLabel,
  getBuildInfoForUser,
  listItemClass,
  metaTextClass,
  collapsible = false,
  defaultOpen = true,
}) {
  return (
    <OverviewSection
      title="👥 Aktive Angler (7 Tage)"
      value={`${activeUsers.length} aktive Angler`}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      <div className="max-h-60 overflow-y-auto">
        <ul className={listItemClass}>
          {activeUsers
            .slice()
            .sort(
              (a, b) =>
                (parseTimestamp(b.last_active)?.getTime() || 0) -
                (parseTimestamp(a.last_active)?.getTime() || 0)
            )
            .map((entry, index) => {
              const buildInfo = getBuildInfoForUser?.(entry.name);
              const hasCurrentBuild = isCurrentBuildLabel(buildInfo?.label);
              return (
                <li key={index}>
                  <span className={hasCurrentBuild ? 'text-green-700 dark:text-green-400 font-semibold' : undefined}>
                    {entry.name}
                  </span>{' '}
                  <span className={metaTextClass}>
                    (aktiv am {formatDateTimeLabel(entry.last_active)} ·{' '}
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

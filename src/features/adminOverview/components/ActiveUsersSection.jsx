import { parseTimestamp } from '@/utils/dateUtils';
import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function ActiveUsersSection({
  activeUsers,
  formatDateTimeLabel,
  listItemClass,
  metaTextClass,
}) {
  return (
    <OverviewSection title="👥 Aktive Angler (7 Tage)" value={`${activeUsers.length} aktive Angler`}>
      <div className="max-h-60 overflow-y-auto">
        <ul className={listItemClass}>
          {activeUsers
            .slice()
            .sort(
              (a, b) =>
                (parseTimestamp(b.last_active)?.getTime() || 0) -
                (parseTimestamp(a.last_active)?.getTime() || 0)
            )
            .map((entry, index) => (
              <li key={index}>
                {entry.name}{' '}
                <span className={metaTextClass}>(aktiv am {formatDateTimeLabel(entry.last_active)})</span>
              </li>
            ))}
        </ul>
      </div>
    </OverviewSection>
  );
}

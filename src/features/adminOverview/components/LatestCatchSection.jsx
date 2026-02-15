import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function LatestCatchSection({
  latestCatch,
  nameShort,
  formatDateTimeLabel,
  listItemClass,
  fallbackTextClass,
  metaTextClass,
}) {
  return (
    <OverviewSection title="🐟 Letzter Fang (7 Tage)">
      {latestCatch ? (
        <div className="max-h-60 overflow-y-auto">
          <ul className={listItemClass}>
            <li>
              {nameShort} – {latestCatch.fish} ({latestCatch.size} cm)
              <span className={metaTextClass}>
                {' am '}
                {formatDateTimeLabel(latestCatch.timestamp)}
              </span>
            </li>
          </ul>
        </div>
      ) : (
        <div className={fallbackTextClass}>Keine Daten</div>
      )}
    </OverviewSection>
  );
}

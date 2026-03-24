import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function RecentBlanksSection({
  recentBlanks,
  formatDateTimeLabel,
  listItemClass,
  fallbackTextClass,
  metaTextClass,
  collapsible = false,
  defaultOpen = true,
}) {
  return (
    <OverviewSection
      title="❌ Letzte Schneidersessions (7 Tage)"
      value={recentBlanks.length > 0 ? `${recentBlanks.length} Einträge` : 'Keine Schneidertage'}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      {recentBlanks.length > 0 ? (
        <div className="max-h-60 overflow-y-auto">
          <ul className={listItemClass}>
            {recentBlanks.map((entry, index) => (
              <li key={index}>
                {entry.angler}
                <span className={metaTextClass}>
                  {' am '}
                  {formatDateTimeLabel(entry.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={fallbackTextClass}>Keine Schneidersessions</div>
      )}
    </OverviewSection>
  );
}

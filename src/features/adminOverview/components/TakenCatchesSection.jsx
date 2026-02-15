import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function TakenCatchesSection({
  takenCatches,
  formatDateTimeLabel,
  listItemClass,
  fallbackTextClass,
  metaTextClass,
}) {
  return (
    <OverviewSection title="🧺 Entnommene Fische" value={`${takenCatches.length} Einträge`}>
      {takenCatches.length > 0 ? (
        <div className="max-h-60 overflow-y-auto">
          <ul className={listItemClass}>
            {takenCatches.map((entry, index) => (
              <li key={index}>
                {entry.angler} – {entry.fish}
                <span className={metaTextClass}>
                  {' am '}
                  {entry.timestamp ? formatDateTimeLabel(entry.timestamp) : 'unbekannt'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={fallbackTextClass}>Keine entnommenen Fische</div>
      )}
    </OverviewSection>
  );
}

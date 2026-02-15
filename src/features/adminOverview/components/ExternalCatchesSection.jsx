import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function ExternalCatchesSection({
  externalCatches,
  formatDateTimeLabel,
  listItemClass,
  fallbackTextClass,
  metaTextClass,
}) {
  return (
    <OverviewSection title="🌍 Externe Fänge (außer Lobberich)">
      {externalCatches.length > 0 ? (
        <div className="max-h-60 overflow-y-auto">
          <ul className={listItemClass}>
            {externalCatches.map((entry, index) => (
              <li key={index}>
                {entry.angler} – {entry.fish} ({entry.size} cm)
                <span className={metaTextClass}>
                  {' am '}
                  {formatDateTimeLabel(entry.timestamp)}
                  {' bei '}
                  {entry.location_name || 'unbekannt'} ({entry.lat.toFixed(4)}, {entry.lon.toFixed(4)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={fallbackTextClass}>Keine externen Fänge</div>
      )}
    </OverviewSection>
  );
}

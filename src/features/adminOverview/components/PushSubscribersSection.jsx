import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function PushSubscribersSection({
  pushByAngler,
  pushDeviceSummary,
  listItemClass,
  fallbackTextClass,
  metaTextClass,
  collapsible = false,
  defaultOpen = true,
}) {
  const totalPushSubscriptions = pushDeviceSummary.reduce((sum, entry) => sum + entry.total, 0);
  const activePushSubscriptions = pushDeviceSummary.reduce((sum, entry) => sum + entry.active, 0);
  const pushSectionLabelBase = totalPushSubscriptions === 1
    ? '1 gespeichertes Abo'
    : `${totalPushSubscriptions} gespeicherte Abos`;
  const pushSectionLabel = `${pushSectionLabelBase} (${activePushSubscriptions} aktiv)`;
  const anglerGroupCount = pushByAngler.length;
  const deviceGroupCount = pushDeviceSummary.length;

  return (
    <OverviewSection
      title="📣 Push-Abonnenten"
      value={pushSectionLabel}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      {pushByAngler.length > 0 || pushDeviceSummary.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Angler ({anglerGroupCount})
            </h4>
            {pushByAngler.length > 0 ? (
              <div className="max-h-60 overflow-y-auto">
                <ul className={listItemClass}>
                  {pushByAngler.map((entry) => (
                    <li key={entry.name}>
                      {entry.name}
                      <span className={metaTextClass}>
                        {` – ${entry.total} Gerät${entry.total !== 1 ? 'e' : ''} (${entry.active} aktiv)`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className={fallbackTextClass}>Keine Anglerdaten</div>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Geräte ({deviceGroupCount})
            </h4>
            {pushDeviceSummary.length > 0 ? (
              <div className="max-h-60 overflow-y-auto">
                <ul className={listItemClass}>
                  {pushDeviceSummary.map((entry) => (
                    <li key={entry.device}>
                      {entry.total}x {entry.device}
                      <span className={metaTextClass}>{` (${entry.active} aktiv)`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className={fallbackTextClass}>Keine Gerätedaten</div>
            )}
          </div>
        </div>
      ) : (
        <div className={fallbackTextClass}>Keine Push-Daten</div>
      )}
    </OverviewSection>
  );
}

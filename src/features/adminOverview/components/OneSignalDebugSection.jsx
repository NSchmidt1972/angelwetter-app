import OneSignalHealthCheck from '@/components/OneSignalHealthCheck';
import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function OneSignalDebugSection({
  collapsible = false,
  defaultOpen = true,
} = {}) {
  return (
    <OverviewSection
      title="🔔 OneSignal Debug"
      value="Statuscheck"
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      <OneSignalHealthCheck />
    </OverviewSection>
  );
}

import OneSignalHealthCheck from '@/components/OneSignalHealthCheck';
import OverviewSection from '@/features/adminOverview/components/OverviewSection';

export default function OneSignalDebugSection() {
  return (
    <OverviewSection title="🔔 OneSignal Debug">
      <OneSignalHealthCheck />
    </OverviewSection>
  );
}

import CatchMap from '../components/CatchMap';
import { Card } from '@/components/ui';

export default function MapView() {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold text-center text-blue-700 mb-4">🗺️ Fangorte</h2>
      <CatchMap />
    </Card>
  );
}

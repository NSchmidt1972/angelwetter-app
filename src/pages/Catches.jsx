// src/pages/Catches.jsx
import CatchList from '../components/CatchList';
import { Card } from '@/components/ui';

export default function Catches({ name }) {
  return (
    <Card>
      <CatchList anglerName={name} />
    </Card>
  );
}

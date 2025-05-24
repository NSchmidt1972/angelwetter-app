// src/pages/Catches.jsx
import CatchList from '../components/CatchList';

export default function Catches({ name }) {
  return (
    <div>
      <CatchList anglerName={name} />
    </div>
  );
}

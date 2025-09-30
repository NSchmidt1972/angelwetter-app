// src/AppLayout.jsx
import Navbar from './components/Navbar';
import { Outlet } from 'react-router-dom';
import AchievementLayer from '@/achievements/AchievementLayer';

export default function AppLayout({ name, isAdmin, canAccessBoard }) {
  return (
    <>
      <Navbar name={name} isAdmin={isAdmin} canAccessBoard={canAccessBoard} />
      <div className="container mx-auto px-3 py-4">
        <AchievementLayer>
          {(showEffect) => <Outlet context={{ showEffect }} />}
        </AchievementLayer>
      </div>
    </>
  );
}

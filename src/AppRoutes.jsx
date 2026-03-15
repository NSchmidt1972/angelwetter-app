import { lazy } from 'react';

const PublicRoutes = lazy(() => import('@/routes/PublicRoutes'));
const ProtectedRoutes = lazy(() => import('@/routes/ProtectedRoutes'));

export default function AppRoutes({ isLoggedIn, anglerName }) {
  if (!isLoggedIn) {
    return <PublicRoutes />;
  }

  return <ProtectedRoutes anglerName={anglerName} />;
}

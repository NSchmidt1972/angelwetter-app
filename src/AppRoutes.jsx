import { lazy } from 'react';

const PublicRoutes = lazy(() => import('@/routes/PublicRoutes'));
const ProtectedRoutes = lazy(() => import('@/routes/ProtectedRoutes'));

export default function AppRoutes({ isLoggedIn, isAdmin, canAccessBoard, isSuperAdmin, anglerName }) {
  if (!isLoggedIn) {
    return <PublicRoutes />;
  }

  return (
    <ProtectedRoutes
      isAdmin={isAdmin}
      canAccessBoard={canAccessBoard}
      isSuperAdmin={isSuperAdmin}
      anglerName={anglerName}
    />
  );
}

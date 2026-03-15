import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { usePermissions } from '@/permissions/usePermissions';

const SuperAdmin = lazy(() => import('@/pages/SuperAdmin'));
const SuperAdminClubsPage = lazy(() => import('@/pages/SuperAdminClubsPage'));
const SuperAdminClubDetailPage = lazy(() => import('@/pages/SuperAdminClubDetailPage'));

function RequireSuperAdmin({ children }) {
  const { loading, error, isSuperAdmin } = usePermissions();

  if (loading) return <div className="p-6 text-center">Berechtigungen werden geladen...</div>;
  if (error) return <div className="p-6 text-center text-red-600">Berechtigungsfehler: {error}</div>;
  if (!isSuperAdmin) return <div className="p-6 text-center text-red-600">Kein Zugriff. Nur für Superadmins.</div>;

  return children;
}

export default function ControlPlaneRoutes() {
  return (
    <RequireSuperAdmin>
      <Routes>
        <Route index element={<SuperAdmin />} />
        <Route path="clubs" element={<SuperAdminClubsPage />} />
        <Route path="clubs/:clubId" element={<SuperAdminClubDetailPage />} />
        <Route path="*" element={<Navigate to="/superadmin" replace />} />
      </Routes>
    </RequireSuperAdmin>
  );
}


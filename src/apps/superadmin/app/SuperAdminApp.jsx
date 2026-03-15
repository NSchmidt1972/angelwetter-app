import { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { PermissionProvider } from '@/permissions/PermissionContext';
import ControlPlaneRoutes from '@/apps/superadmin/routes/ControlPlaneRoutes';
import SuperAdminLoginForm from '@/apps/superadmin/features/auth/SuperAdminLoginForm';

function SuperAdminShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-center">Authentifizierung wird geladen...</div>;
  }

  if (!user) {
    return <SuperAdminLoginForm />;
  }

  return (
    <PermissionProvider>
      <Suspense fallback={<div className="p-6 text-center">Lädt...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/superadmin" replace />} />
          <Route path="/superadmin/*" element={<ControlPlaneRoutes />} />
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Routes>
      </Suspense>
    </PermissionProvider>
  );
}

export default function SuperAdminApp() {
  return (
    <HashRouter>
      <SuperAdminShell />
    </HashRouter>
  );
}

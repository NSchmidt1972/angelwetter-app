import { Outlet } from 'react-router-dom';
import { usePermissions } from '@/permissions/usePermissions';

function DefaultLoading() {
  return <div className="p-6 text-center">Berechtigungen werden geladen...</div>;
}

function DefaultDenied({ role }) {
  return <div className="p-6 text-center text-red-600">Kein Zugriff. Benötigte Rolle: {role}</div>;
}

function DefaultError({ message }) {
  return <div className="p-6 text-center text-red-600">Berechtigungsfehler: {message}</div>;
}

export default function RequireRole({
  role,
  children,
  allowSuperAdmin = true,
  loadingFallback = <DefaultLoading />,
  deniedFallback,
  errorFallback,
}) {
  const { loading, error, isSuperAdmin, hasAtLeastRole } = usePermissions();

  if (loading) return loadingFallback;
  if (error) return errorFallback || <DefaultError message={error} />;

  const allowed = (allowSuperAdmin && isSuperAdmin) || hasAtLeastRole(role);
  if (!allowed) return deniedFallback || <DefaultDenied role={role} />;

  return children || <Outlet />;
}


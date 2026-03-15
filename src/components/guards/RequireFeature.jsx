import { Outlet } from 'react-router-dom';
import { usePermissions } from '@/permissions/usePermissions';

function DefaultLoading() {
  return <div className="p-6 text-center">Berechtigungen werden geladen...</div>;
}

function DefaultDenied({ feature }) {
  return <div className="p-6 text-center text-red-600">Feature deaktiviert: {feature}</div>;
}

function DefaultError({ message }) {
  return <div className="p-6 text-center text-red-600">Berechtigungsfehler: {message}</div>;
}

export default function RequireFeature({
  feature,
  minRole = null,
  children,
  allowSuperAdmin = true,
  loadingFallback = <DefaultLoading />,
  deniedFallback,
  errorFallback,
}) {
  const { loading, error, isSuperAdmin, hasAtLeastRole, hasFeatureForRole } = usePermissions();

  if (loading) return loadingFallback;
  if (error) return errorFallback || <DefaultError message={error} />;

  if (allowSuperAdmin && isSuperAdmin) {
    return children || <Outlet />;
  }

  if (minRole && !hasAtLeastRole(minRole)) {
    return deniedFallback || <DefaultDenied feature={feature} />;
  }

  if (!hasFeatureForRole(feature)) {
    return deniedFallback || <DefaultDenied feature={feature} />;
  }

  return children || <Outlet />;
}


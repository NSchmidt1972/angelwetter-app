import { usePermissionContext } from '@/permissions/PermissionContext';

export function usePermissions() {
  return usePermissionContext();
}

export default usePermissions;


import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '@/components/ui';
import BoardSubmenu from '@/components/BoardSubmenu';
import AdminMembersManage from '@/pages/AdminMembersManage';

export default function BoardSettings() {
  const location = useLocation();
  const activeKey = useMemo(
    () => (String(location.hash || '').toLowerCase() === '#vorstand-members' ? 'members' : 'whitelist'),
    [location.hash]
  );
  const sectionMode = activeKey === 'members' ? 'members' : 'whitelist';

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Vorstand: Einstellungen</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Whitelist und Rollenverwaltung sind hier getrennt von der Statistik.
            </p>
          </div>
          <div className="ml-auto">
            <BoardSubmenu activeKey={activeKey} />
          </div>
        </div>
      </Card>

      <AdminMembersManage sectionMode={sectionMode} />
    </div>
  );
}

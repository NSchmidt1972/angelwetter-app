// src/components/SubscribeBell.jsx
import { Bell, BellOff } from 'lucide-react';
import usePushStatus from '@/hooks/usePushStatus';
import { useAuth } from '@/AuthContext';

export default function SubscribeBell() {
  const { user } = useAuth();
  const { sdk, supported, permission, optedIn, subId, loading, subscribe, unsubscribe, error } = usePushStatus(user);

  if (!sdk || loading || supported === false) return null; // nicht anzeigen, wenn nicht unterstützt
  const enabled = !!(permission && optedIn && subId);

  return (
    <button
      onClick={enabled ? unsubscribe : subscribe}
      title={enabled ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren'}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl shadow
        ${enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
    >
      {enabled ? <Bell /> : <BellOff />}
      <span className="text-sm">{enabled ? 'Aktiv' : 'Aktivieren'}</span>
    </button>
  );
}

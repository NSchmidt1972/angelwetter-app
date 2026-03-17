import { Link, useParams } from 'react-router-dom';

function itemClass(isActive) {
  if (isActive) {
    return 'rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-semibold text-white';
  }
  return 'rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800';
}

export default function BoardSubmenu({ activeKey = 'stats' }) {
  const { clubSlug } = useParams();
  const boardBasePath = clubSlug ? `/${clubSlug}/vorstand` : '/vorstand';

  const items = [
    { key: 'stats', label: '📊 Kennzahlen', to: boardBasePath },
    { key: 'whitelist', label: '📨 Whitelist', to: `${boardBasePath}/einstellungen#vorstand-whitelist` },
    { key: 'members', label: '👥 Mitglieder & Rollen', to: `${boardBasePath}/einstellungen#vorstand-members` },
    { key: 'rules', label: '📜 Regeln', to: `${boardBasePath}/regeln` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <Link key={item.key} to={item.to} className={itemClass(item.key === activeKey)}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

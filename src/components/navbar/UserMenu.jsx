// src/components/navbar/UserMenu.jsx
import { forwardRef } from 'react';
import PushMenuButton from '@/components/navbar/PushMenuButton';
import VersionInfo from '@/components/VersionInfo';

const UserMenu = forwardRef(function UserMenu(
  {
    dark,
    onToggleDark,
    displayName,
    showMenu,
    onToggleMenu,
    onNavigateAdmin,
    showAdminLink = false,
    showDataFilter = false,
    dataFilterValue = 'recent',
    onToggleDataFilter,
    onLogout,
    shouldShowUpdateBanner,
    onApplyUpdate,
    updating,
  },
  ref
) {
  return (
    <div className="flex items-center gap-3 text-base relative" ref={ref}>
      <button
        type="button"
        onClick={onToggleDark}
        className="px-3 py-2 rounded hover:text-blue-600 dark:hover:text-blue-300"
      >
        {dark ? "☀️ Tageslicht" : "🌙 Nachtangeln"}
      </button>

      <button
        type="button"
        onClick={onToggleMenu}
        className="px-3 py-2 rounded"
        aria-expanded={showMenu}
        aria-haspopup="menu"
      >
        👤 {displayName}
      </button>

      {showMenu && (
        <div
          className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg z-[1400] text-base"
          role="menu"
        >
          <div className="px-4 pt-3 pb-2 space-y-3">
            {showDataFilter && (
              <div className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-800 shadow-inner dark:bg-gray-700/60 dark:text-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold">
                    <span aria-hidden="true">📅</span>
                    Datenfilter
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={dataFilterValue === 'all'}
                      onChange={onToggleDataFilter}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-gray-600 peer-checked:bg-blue-600"></div>
                    <span className="sr-only">Datenfilter umschalten</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {dataFilterValue === 'all' ? 'Alle Daten' : 'Nur ab 01.06.25'}
                </p>
              </div>
            )}
            {showAdminLink && (
              <button
                type="button"
                onClick={onNavigateAdmin}
                className="w-full rounded px-3 py-2 text-left text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-900/30"
              >
                🔧 Admin2
              </button>
            )}
          </div>

          <div className="px-4 py-2">
            <PushMenuButton />
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
          >
            Abmelden
          </button>

          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 px-4 py-2">
            <VersionInfo />

            {shouldShowUpdateBanner ? (
              <button
                type="button"
                onClick={onApplyUpdate}
                disabled={updating}
                className="mt-2 w-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 px-3 py-2 rounded disabled:opacity-60"
                title="Neue Version verfügbar – jetzt anwenden"
              >
                {updating ? "⏳ Aktualisiere…" : "⤴️ App aktualisieren"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 w-full text-xs text-blue-600 dark:text-blue-400"
              >
                🔄 App neu starten
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default UserMenu;

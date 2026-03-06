import { useMemo } from 'react';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { APP_VERSION, BUILD_DATE, GIT_COMMIT } from '@/utils/buildInfo';
import VersionInfo from '@/components/VersionInfo';

export default function UpdateSection() {
  const {
    updateReady,
    updating,
    updateStatusText,
    applyUpdateNow,
    restartApp,
    waitingBuild,
    waitingBuildResolved,
  } = useServiceWorkerUpdate();

  const currentBuildInfo = useMemo(() => ({
    version: (APP_VERSION || '').trim(),
    date: (BUILD_DATE || '').trim(),
    commit: (GIT_COMMIT || '').trim(),
  }), []);

  const waitingBuildInfo = useMemo(() => (
    waitingBuild && typeof waitingBuild === 'object'
      ? {
          version: String(waitingBuild.version || '').trim(),
          date: String(waitingBuild.date || '').trim(),
          commit: String(waitingBuild.commit || '').trim(),
        }
      : null
  ), [waitingBuild]);

  const hasDifferentWaitingBuild = useMemo(() => {
    if (!updateReady || !waitingBuildResolved || !waitingBuildInfo) return false;

    if (currentBuildInfo.commit && waitingBuildInfo.commit) {
      return currentBuildInfo.commit !== waitingBuildInfo.commit;
    }

    if (currentBuildInfo.version && waitingBuildInfo.version) {
      return currentBuildInfo.version !== waitingBuildInfo.version;
    }

    if (currentBuildInfo.date && waitingBuildInfo.date) {
      return currentBuildInfo.date !== waitingBuildInfo.date;
    }

    return false;
  }, [currentBuildInfo, updateReady, waitingBuildInfo, waitingBuildResolved]);

  const shouldShowUpdateBanner = hasDifferentWaitingBuild && !updating;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-1 px-4 py-2">
      <VersionInfo />

      {shouldShowUpdateBanner ? (
        <>
          <button
            type="button"
            onClick={applyUpdateNow}
            disabled={updating}
            className="mt-2 w-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 px-3 py-2 rounded disabled:opacity-60"
            title="Neue Version verfügbar – jetzt anwenden"
          >
            {updating ? '⏳ Aktualisiere…' : '⤴️ App aktualisieren'}
          </button>
          {updating && updateStatusText ? (
            <p className="mt-1 text-[11px] text-yellow-700 dark:text-yellow-300">
              {updateStatusText}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={restartApp}
            disabled={updating}
            className="mt-2 w-full text-xs text-blue-600 dark:text-blue-400 disabled:opacity-60"
          >
            {updating ? '⏳ Starte neu…' : '🔄 App neu starten'}
          </button>
          {updating && updateStatusText ? (
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
              {updateStatusText}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

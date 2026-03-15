import { useMemo } from 'react';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { APP_VERSION, BUILD_DATE, GIT_COMMIT } from '@/utils/buildInfo';
import { formatDateTime, parseTimestamp } from '@/utils/dateUtils';

function normalizeBuildInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    version: String(raw.version || '').trim(),
    date: String(raw.date || '').trim(),
    commit: String(raw.commit || '').trim(),
  };
}

function hasDifferentBuild(currentBuild, waitingBuild) {
  if (!currentBuild || !waitingBuild) return false;

  if (currentBuild.commit && waitingBuild.commit) {
    return currentBuild.commit !== waitingBuild.commit;
  }

  if (currentBuild.version && waitingBuild.version) {
    return currentBuild.version !== waitingBuild.version;
  }

  if (currentBuild.date && waitingBuild.date) {
    return currentBuild.date !== waitingBuild.date;
  }

  return false;
}

function formatBuildSummary(info) {
  if (!info) return 'Unbekannt';

  const buildParts = [];
  if (info.version) buildParts.push(`Version ${info.version}`);
  if (info.commit) buildParts.push(`Commit ${info.commit.slice(0, 7)}`);
  if (info.date) {
    const parsedDate = parseTimestamp(info.date);
    buildParts.push(parsedDate ? formatDateTime(parsedDate) : info.date);
  }

  return buildParts.join(' · ') || 'Unbekannt';
}

export default function BuildUpdatePanel() {
  const { updateReady, updating, updateStatusText, restartApp, waitingBuild, waitingBuildResolved } =
    useServiceWorkerUpdate();

  const currentBuild = useMemo(
    () => normalizeBuildInfo({ version: APP_VERSION, date: BUILD_DATE, commit: GIT_COMMIT }),
    [],
  );
  const waitingBuildInfo = useMemo(() => normalizeBuildInfo(waitingBuild), [waitingBuild]);

  const showWaitingBuild =
    updateReady && waitingBuildResolved && hasDifferentBuild(currentBuild, waitingBuildInfo);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-blue-900">Build-Stand</h2>
          <p className="text-xs text-blue-800">{formatBuildSummary(currentBuild)}</p>
          {showWaitingBuild ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Neues Build verfügbar: {formatBuildSummary(waitingBuildInfo)}
            </p>
          ) : null}
          {updating && updateStatusText ? (
            <p className="mt-1 text-xs text-blue-700">{updateStatusText}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={restartApp}
          disabled={updating}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {updating ? 'Aktualisiere…' : 'Aktualisieren'}
        </button>
      </div>
    </div>
  );
}

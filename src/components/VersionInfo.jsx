// src/components/VersionInfo.jsx
export default function VersionInfo() {
  const BUILD_INFO = (typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__) || null;

  const version = BUILD_INFO?.version || import.meta.env?.VITE_APP_VERSION || 'dev';
  const date    = BUILD_INFO?.date    || import.meta.env?.VITE_BUILD_DATE  || '';
  const commit  = BUILD_INFO?.commit  || import.meta.env?.VITE_GIT_COMMIT  || '';

  return (
    <div className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">
      <div>
        <span className="font-semibold">Build:</span>{' '}
        <span className="font-mono">{date || version}</span>
      </div>
      {commit && (
        <div className="truncate">
          <span className="font-semibold">Commit:</span>{' '}
          <span className="font-mono">{commit.slice(0,7)}</span>
        </div>
      )}
    </div>
  );
}

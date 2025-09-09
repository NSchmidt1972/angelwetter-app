import { BUILD_DATE, GIT_COMMIT } from "@/utils/buildInfo";

export default function VersionInfo({ className = "" }) {
  return (
    <div className={`text-[11px] leading-tight text-gray-500 dark:text-gray-400 ${className}`}>
      {BUILD_DATE && (
        <div>
          <span className="font-semibold">Build:</span>{" "}
          <span className="font-mono">{BUILD_DATE}</span>
        </div>
      )}
      {GIT_COMMIT && (
        <div className="truncate">
          <span className="font-semibold">Commit:</span>{" "}
          <span className="font-mono">{GIT_COMMIT.slice(0, 7)}</span>
        </div>
      )}
    </div>
  );
}

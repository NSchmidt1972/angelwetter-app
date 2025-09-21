// src/components/VersionInfo.jsx
import { useMemo } from 'react';

export default function VersionInfo() {
  const BUILD_INFO = (typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__) || null;

  const version = BUILD_INFO?.version || import.meta.env?.VITE_APP_VERSION || 'dev';
  const date    = BUILD_INFO?.date    || import.meta.env?.VITE_BUILD_DATE  || '';
  const commit  = BUILD_INFO?.commit  || import.meta.env?.VITE_GIT_COMMIT  || '';

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    []
  );

  const parseDate = (raw) => {
    if (!raw) return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;

    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const tzMatch = normalized.match(/([zZ]|[+-]\d{2}:?\d{2})$/);
    if (tzMatch) {
      const tz = tzMatch[1];
      const candidate = tz === 'Z' || tz === 'z'
        ? normalized
        : normalized.replace(tz, tz.includes(':') ? tz : `${tz.slice(0, 3)}:${tz.slice(3)}`);
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const parts = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (parts) {
      const [, y, m, d, hh = '00', mm = '00', ss = '00'] = parts;
      const parsed = new Date(Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss)
      ));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
  };

  const formatBerlin = (dateObj) => {
    const parts = formatter.formatToParts(dateObj);
    const lookup = parts.reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    const day = lookup.day?.padStart(2, '0');
    const month = lookup.month?.padStart(2, '0');
    const year = lookup.year;
    const hour = lookup.hour?.padStart(2, '0');
    const minute = lookup.minute?.padStart(2, '0');
    if (!day || !month || !year || !hour || !minute) return formatter.format(dateObj);
    return `${day}.${month}.${year} ${hour}:${minute}`;
  };

  const buildLabel = useMemo(() => {
    const parsed = parseDate(date);
    if (!parsed) return date || version;
    return formatBerlin(parsed);
  }, [date, version, formatter]);

  return (
    <div className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">
      <div>
        <span className="font-semibold">Build:</span>{' '}
        <span className="font-mono">{buildLabel}</span>
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

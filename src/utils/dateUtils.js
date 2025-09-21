// src/utils/dateUtils.js

const TZ = 'Europe/Berlin';

const DTFULL = new Intl.DateTimeFormat('de-DE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
});

const DTDAY = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: TZ,
});

const DDATE = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeZone: TZ,
});

const DTIME = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});

export function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const numDate = new Date(value);
    return Number.isNaN(numDate.getTime()) ? null : numDate;
  }

  const str = String(value).trim();
  if (!str) return null;

  const normalized = str.includes('T') ? str : str.replace(' ', 'T');
  const tzMatch = normalized.match(/([zZ]|[+-]\d{2}(?::?\d{2})?)$/);
  if (tzMatch) {
    const tz = tzMatch[1];
    let formattedTz = tz;
    if (tz !== 'Z' && tz !== 'z') {
      if (tz.includes(':')) {
        formattedTz = tz;
      } else if (tz.length === 3) {
        formattedTz = `${tz}:00`;
      } else if (tz.length === 5) {
        formattedTz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
      }
    }
    const base = normalized.slice(0, normalized.length - tz.length);
    const candidate = (tz === 'Z' || tz === 'z') ? normalized : `${base}${formattedTz}`;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parts = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?$/);
  if (parts) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00', fraction = '0'] = parts;
    const parsed = new Date(Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
      Number(fraction.padEnd(3, '0'))
    ));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

export function localDayKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function monthKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
}

export function formatDateTime(d) {
  const date = parseTimestamp(d);
  if (!date) return '–';
  const parts = DTFULL.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const day = parts.day?.padStart(2, '0');
  const month = parts.month?.padStart(2, '0');
  const year = parts.year;
  const hour = parts.hour?.padStart(2, '0');
  const minute = parts.minute?.padStart(2, '0');
  if (!day || !month || !year || !hour || !minute) {
    return DTFULL.format(date);
  }
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

export function formatDayLabel(dayKeyStr) {
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  return DTDAY.format(new Date(y, m - 1, d));
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export function formatDateOnly(value) {
  const date = parseTimestamp(value);
  if (!date) return '–';
  return DDATE.format(date);
}

export function formatTimeOnly(value) {
  const date = parseTimestamp(value);
  if (!date) return '–';
  return DTIME.format(date);
}

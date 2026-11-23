// No `@/` imports and no JSX: `node --test` loads this file directly.
//
// Calendar dates ('YYYY-MM-DD') are parsed as LOCAL dates. Never `new Date('YYYY-MM-DD')`:
// that is UTC midnight, which `toLocaleDateString` shows as the previous day west of UTC.
// Trips from the API come as UTC-midnight datetimes ('2026-11-20T00:00:00.000Z'); only their
// date part is used, because the server stores date-only values.

const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const LOCALE = 'en-US';
const RANGE_SEPARATOR = ' — ';

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' or 'YYYY-MM-DDT…' → [y, m, d] if it is a real calendar date, else null. */
const dateParts = (value) => {
  if (typeof value !== 'string') return null;
  const match = DATE_PART.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  // Rejects overflow (2026-02-30 → Mar 2) and years < 100 (Date.UTC maps them to 19xx)
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    return null;
  }
  return [y, m, d];
};

/** → 'YYYY-MM-DD' (the date part, validated), or null. */
export const toDateOnly = (value) => {
  const parts = dateParts(value);
  return parts && `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
};

/** → a Date at LOCAL midnight of that calendar date, or null. */
export const parseDateOnly = (value) => {
  const parts = dateParts(value);
  return parts && new Date(parts[0], parts[1] - 1, parts[2]);
};

/** Date → its LOCAL calendar date as 'YYYY-MM-DD'. */
export const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The user's LOCAL calendar date as 'YYYY-MM-DD' (not the UTC date from toISOString). */
export const todayISO = (now = new Date()) => toISODate(now);

/** 'YYYY-MM-DD' + n calendar days → 'YYYY-MM-DD', or null. Unaffected by DST. */
export const addDaysISO = (value, n) => {
  const parts = dateParts(value);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + n));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const format = (value, options) => {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString(LOCALE, options) : '';
};

/** 'Fri' */
export const formatWeekday = (value) => format(value, { weekday: 'short' });

/** 'Nov 20' */
export const formatMonthDay = (value) => format(value, { month: 'short', day: 'numeric' });

/** 'Nov 20, 2026' */
export const formatFullDate = (value) =>
  format(value, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * A trip's dates, e.g.
 *   same day     Nov 20, 2026
 *   same year    Nov 20 — Nov 27, 2026
 *   cross-year   Dec 28, 2026 — Jan 3, 2027
 * Returns '' if either date is invalid.
 */
export const fmtRange = (start, end) => {
  const s = toDateOnly(start);
  const e = toDateOnly(end);
  if (!s || !e) return '';
  if (s === e) return formatFullDate(s);
  const startText = s.slice(0, 4) === e.slice(0, 4) ? formatMonthDay(s) : formatFullDate(s);
  return `${startText}${RANGE_SEPARATOR}${formatFullDate(e)}`;
};

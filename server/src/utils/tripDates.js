/**
 * Trip date rules. Pure functions, independent of the server's time zone:
 * dates are 'YYYY-MM-DD' calendar dates, compared as UTC midnights, and "today"
 * is the UTC calendar date of `now`.
 *
 * Why "yesterday (UTC)" as the earliest start: a user in UTC-12 can still be on
 * the previous calendar day, so rejecting anything before UTC today would block
 * them from planning a trip that starts on their own today.
 */

export const MAX_TRIP_DAYS = 30; // inclusive: Nov 1 → Nov 30 is 30 days
export const MAX_YEARS_AHEAD = 2;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → UTC ms of that midnight, or null if it isn't a real calendar date. */
export const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const date = new Date(ms);
  // Rejects overflow (2026-02-30 → Mar 2) and years < 100 (Date.UTC maps them to 19xx)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return ms;
};

const utcToday = (now) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

/** @returns an error message, or null if the start date is allowed. */
export const checkStartDate = (startDate, now = new Date()) => {
  const start = parseDateOnly(startDate);
  if (start === null) return 'startDate must be a valid date (YYYY-MM-DD)';

  const today = utcToday(now);
  if (start < today - DAY_MS) return 'startDate cannot be in the past';

  const latest = Date.UTC(
    now.getUTCFullYear() + MAX_YEARS_AHEAD,
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  if (start > latest) return `startDate can be at most ${MAX_YEARS_AHEAD} years ahead`;

  return null;
};

/** @returns an error message, or null if the end date is allowed for this start date. */
export const checkEndDate = (startDate, endDate) => {
  const end = parseDateOnly(endDate);
  if (end === null) return 'endDate must be a valid date (YYYY-MM-DD)';

  const start = parseDateOnly(startDate);
  if (start === null) return null; // reported on startDate

  if (end < start) return 'endDate must be on or after startDate';
  const days = (end - start) / DAY_MS + 1;
  if (days > MAX_TRIP_DAYS) return `Trip can be at most ${MAX_TRIP_DAYS} days long`;

  return null;
};

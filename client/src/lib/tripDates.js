// No `@/` imports and no JSX: `node --test` loads this file directly.
//
// The trip date limits the server enforces on "Save trip" (server/src/utils/tripDates.js),
// shown in the search form. The server is the source of truth:
// client/test/tripDates.parity.test.js checks these boundaries against the server's rules.
//
// - Earliest start: the user's LOCAL today. The server accepts anything from UTC yesterday,
//   and a local date is never earlier than that, so it always passes.
// - Latest start: UTC today + MAX_YEARS_AHEAD years, the same Date.UTC expression as the server
//   (so Feb 29 → Mar 1). Not local today: east of UTC that can be a day ahead of the server.
// - Latest end: start + MAX_TRIP_DAYS - 1 days (the trip length is inclusive).
import { addDaysISO, toDateOnly, todayISO } from './dates.js';

export const MAX_TRIP_DAYS = 30;
export const MAX_YEARS_AHEAD = 2;

const pad = (n) => String(n).padStart(2, '0');

/** The latest allowed start date, 'YYYY-MM-DD'. */
export const maxStartISO = (now = new Date()) => {
  const latest = new Date(
    Date.UTC(now.getUTCFullYear() + MAX_YEARS_AHEAD, now.getUTCMonth(), now.getUTCDate()),
  );
  return `${latest.getUTCFullYear()}-${pad(latest.getUTCMonth() + 1)}-${pad(latest.getUTCDate())}`;
};

/** The latest allowed end date for this start date, 'YYYY-MM-DD', or null. */
export const maxEndISO = (startDate) => addDaysISO(startDate, MAX_TRIP_DAYS - 1);

/** @returns an error message for the search form, or null if the start date is allowed. */
export const startDateError = (startDate, now = new Date()) => {
  const start = toDateOnly(startDate);
  if (!start) return 'Enter a valid date';
  if (start < todayISO(now)) return 'Start date is in the past';
  if (start > maxStartISO(now)) return `At most ${MAX_YEARS_AHEAD} years ahead`;
  return null;
};

/** @returns an error message for the search form, or null if the end date is allowed. */
export const endDateError = (startDate, endDate) => {
  const end = toDateOnly(endDate);
  if (!end) return 'Enter a valid date';
  const start = toDateOnly(startDate);
  if (!start) return null; // reported on the start date
  if (end < start) return 'End must be after start';
  if (end > maxEndISO(start)) return `Trips are at most ${MAX_TRIP_DAYS} days`;
  return null;
};

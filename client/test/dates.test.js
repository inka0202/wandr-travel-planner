import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process'; // the client ESLint config only knows browser globals
import {
  toDateOnly,
  parseDateOnly,
  toISODate,
  todayISO,
  addDaysISO,
  formatWeekday,
  formatMonthDay,
  formatFullDate,
  fmtRange,
} from '../src/lib/dates.js';

// Calendar dates must look the same in every browser time zone. Same approach as
// server/test/tripDates.test.js: switch TZ in-process and check it really applies.
// Offsets are for January (no DST), in Date#getTimezoneOffset minutes (UTC - local).
const ZONES = {
  UTC: 0,
  'America/Los_Angeles': 480,
  'Pacific/Honolulu': 600,
  'Asia/Tokyo': -540,
  'Europe/Warsaw': -60,
  'Pacific/Kiritimati': -840, // UTC+14
};

// "now" just after and just before UTC midnight, and the local date each zone sees then.
const AFTER_UTC_MIDNIGHT = new Date('2026-11-21T02:00:00Z');
const BEFORE_UTC_MIDNIGHT = new Date('2026-11-20T23:30:00Z');
const LOCAL_TODAY = {
  UTC: ['2026-11-21', '2026-11-20'],
  'America/Los_Angeles': ['2026-11-20', '2026-11-20'],
  'Pacific/Honolulu': ['2026-11-20', '2026-11-20'],
  'Asia/Tokyo': ['2026-11-21', '2026-11-21'],
  'Europe/Warsaw': ['2026-11-21', '2026-11-21'],
  'Pacific/Kiritimati': ['2026-11-21', '2026-11-21'],
};

// Trips from the API: UTC-midnight datetimes. Search URLs: plain dates.
const api = (date) => `${date}T00:00:00.000Z`;

const originalTz = process.env.TZ;
after(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

for (const [zone, januaryOffset] of Object.entries(ZONES)) {
  describe(`dates in TZ=${zone}`, () => {
    it('really runs in that zone', () => {
      process.env.TZ = zone;
      assert.equal(new Date(2026, 0, 15).getTimezoneOffset(), januaryOffset);
    });

    it('toDateOnly / parseDateOnly accept real dates only', () => {
      process.env.TZ = zone;
      assert.equal(toDateOnly('2026-11-20'), '2026-11-20');
      assert.equal(toDateOnly(api('2026-11-20')), '2026-11-20');
      assert.equal(toDateOnly('2028-02-29'), '2028-02-29'); // leap year
      for (const bad of [
        '2027-02-29', // not a leap year
        '2026-02-30',
        '2026-13-45',
        '2026-00-10',
        '0099-01-01',
        '2026-1-5',
        'Nov 20 2026',
        '',
        20261120,
        null,
        undefined,
      ]) {
        assert.equal(toDateOnly(bad), null, String(bad));
        assert.equal(parseDateOnly(bad), null, String(bad));
      }
    });

    it('parseDateOnly gives LOCAL midnight of that calendar date', () => {
      process.env.TZ = zone;
      for (const value of ['2026-11-20', api('2026-11-20')]) {
        const date = parseDateOnly(value);
        assert.deepEqual(
          [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()],
          [2026, 10, 20, 0],
          value,
        );
      }
    });

    it('toISODate and todayISO use the LOCAL date, not the UTC one', () => {
      process.env.TZ = zone;
      assert.equal(toISODate(new Date(2026, 10, 20, 23, 59)), '2026-11-20');
      assert.equal(toISODate(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
      assert.deepEqual(
        [todayISO(AFTER_UTC_MIDNIGHT), todayISO(BEFORE_UTC_MIDNIGHT)],
        LOCAL_TODAY[zone],
      );
    });

    it('addDaysISO counts calendar days (DST, leap day, year end)', () => {
      process.env.TZ = zone;
      assert.equal(addDaysISO('2026-11-20', 7), '2026-11-27');
      assert.equal(addDaysISO('2026-10-24', 1), '2026-10-25'); // EU DST ends Oct 25
      assert.equal(addDaysISO('2026-10-31', 2), '2026-11-02'); // US DST ends Nov 1
      assert.equal(addDaysISO('2026-03-07', 2), '2026-03-09'); // US DST starts Mar 8
      assert.equal(addDaysISO('2028-02-28', 1), '2028-02-29');
      assert.equal(addDaysISO('2027-02-28', 1), '2027-03-01');
      assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01');
      assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28');
      assert.equal(addDaysISO(api('2026-11-20'), 1), '2026-11-21');
      assert.equal(addDaysISO('2026-02-30', 1), null);
    });

    it('formatWeekday / formatMonthDay / formatFullDate (en-US)', () => {
      process.env.TZ = zone;
      assert.equal(formatWeekday('2026-11-20'), 'Fri');
      assert.equal(formatWeekday('2026-11-22'), 'Sun');
      assert.equal(formatMonthDay('2026-11-20'), 'Nov 20');
      assert.equal(formatMonthDay('2027-01-01'), 'Jan 1');
      assert.equal(formatFullDate(api('2026-11-20')), 'Nov 20, 2026');
      assert.equal(formatWeekday('nope'), '');
      assert.equal(formatMonthDay(undefined), '');
    });

    it('fmtRange: same day, same month, cross-month, cross-year', () => {
      process.env.TZ = zone;
      const cases = [
        ['2026-11-20', '2026-11-20', 'Nov 20, 2026'],
        ['2026-11-20', '2026-11-27', 'Nov 20 — Nov 27, 2026'],
        ['2026-11-28', '2026-12-03', 'Nov 28 — Dec 3, 2026'],
        ['2026-12-28', '2027-01-03', 'Dec 28, 2026 — Jan 3, 2027'],
        ['2026-12-31', '2027-01-01', 'Dec 31, 2026 — Jan 1, 2027'],
      ];
      for (const [start, end, expected] of cases) {
        assert.equal(fmtRange(start, end), expected, `${start}..${end}`);
        assert.equal(fmtRange(api(start), api(end)), expected, `API ${start}..${end}`);
      }
    });

    it('fmtRange returns "" for invalid input', () => {
      process.env.TZ = zone;
      assert.equal(fmtRange('2026-11-20', 'nope'), '');
      assert.equal(fmtRange(undefined, '2026-11-20'), '');
      assert.equal(fmtRange('2026-02-30', '2026-03-02'), '');
    });
  });
}

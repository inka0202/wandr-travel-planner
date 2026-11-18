import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateOnly,
  checkStartDate,
  checkEndDate,
  MAX_TRIP_DAYS,
} from '../src/utils/tripDates.js';

// The rules must give identical answers whatever the server's time zone.
// Offsets are for January (no DST), in Date#getTimezoneOffset minutes (UTC - local).
const ZONES = {
  UTC: 0,
  'Europe/Warsaw': -60,
  'America/New_York': 300,
  'America/Los_Angeles': 480,
  'Asia/Kolkata': -330,
  'Pacific/Kiritimati': -840, // UTC+14
  'Pacific/Pago_Pago': 660, // UTC-11
};

// "now" values just after and just before UTC midnight: local dates differ
// from the UTC date in most zones above, which is where TZ bugs show up.
const JUST_AFTER_MIDNIGHT = new Date('2026-11-18T00:30:00Z');
const JUST_BEFORE_MIDNIGHT = new Date('2026-11-18T23:30:00Z');

const originalTz = process.env.TZ;
after(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

for (const [zone, januaryOffset] of Object.entries(ZONES)) {
  describe(`tripDates in TZ=${zone}`, () => {
    it('really runs in that zone', () => {
      process.env.TZ = zone;
      assert.equal(new Date(2026, 0, 15).getTimezoneOffset(), januaryOffset);
    });

    it('parseDateOnly accepts real dates only', () => {
      process.env.TZ = zone;
      assert.equal(parseDateOnly('2026-11-20'), Date.UTC(2026, 10, 20));
      assert.equal(parseDateOnly('2028-02-29'), Date.UTC(2028, 1, 29)); // leap year
      assert.equal(parseDateOnly('2027-02-29'), null); // not a leap year
      assert.equal(parseDateOnly('2026-02-30'), null);
      assert.equal(parseDateOnly('2026-13-45'), null);
      assert.equal(parseDateOnly('2026-00-10'), null);
      assert.equal(parseDateOnly('0099-01-01'), null); // Date.UTC would map it to 1999
      assert.equal(parseDateOnly('2026-11-20T00:00:00Z'), null);
      assert.equal(parseDateOnly('2026-1-5'), null);
      assert.equal(parseDateOnly(''), null);
      assert.equal(parseDateOnly(20261120), null);
      assert.equal(parseDateOnly(undefined), null);
    });

    it('checkStartDate: earliest allowed start is yesterday (UTC)', () => {
      process.env.TZ = zone;
      for (const now of [JUST_AFTER_MIDNIGHT, JUST_BEFORE_MIDNIGHT]) {
        assert.equal(checkStartDate('2026-11-18', now), null, 'today');
        assert.equal(checkStartDate('2026-11-17', now), null, 'yesterday');
        assert.equal(checkStartDate('2026-11-16', now), 'startDate cannot be in the past');
      }
    });

    it('checkStartDate: latest allowed start is today + 2 years (UTC)', () => {
      process.env.TZ = zone;
      for (const now of [JUST_AFTER_MIDNIGHT, JUST_BEFORE_MIDNIGHT]) {
        assert.equal(checkStartDate('2028-11-18', now), null);
        assert.equal(checkStartDate('2028-11-19', now), 'startDate can be at most 2 years ahead');
      }
      // Leap day "now": 2 years later is Feb 29 2030, which doesn't exist → Mar 1 2030
      const leapNow = new Date('2028-02-29T12:00:00Z');
      assert.equal(checkStartDate('2030-03-01', leapNow), null);
      assert.equal(checkStartDate('2030-03-02', leapNow), 'startDate can be at most 2 years ahead');
    });

    it('checkStartDate rejects invalid dates', () => {
      process.env.TZ = zone;
      assert.equal(
        checkStartDate('2026-13-45', JUST_AFTER_MIDNIGHT),
        'startDate must be a valid date (YYYY-MM-DD)',
      );
    });

    it(`checkEndDate: order and ${MAX_TRIP_DAYS}-day limit (inclusive)`, () => {
      process.env.TZ = zone;
      assert.equal(checkEndDate('2026-11-20', '2026-11-20'), null, 'same-day trip = 1 day');
      assert.equal(checkEndDate('2026-11-20', '2026-11-19'), 'endDate must be on or after startDate');
      assert.equal(checkEndDate('2026-11-01', '2026-11-30'), null, '30 days');
      assert.equal(checkEndDate('2026-11-01', '2026-12-01'), 'Trip can be at most 30 days long');
      // Across a DST change (US: Nov 1 2026, EU: Oct 25 2026) days are still whole
      assert.equal(checkEndDate('2026-10-20', '2026-11-18'), null, '30 days over DST');
      assert.equal(checkEndDate('2026-10-20', '2026-11-19'), 'Trip can be at most 30 days long');
      // Across Feb 29
      assert.equal(checkEndDate('2028-02-15', '2028-03-15'), null, '30 days over leap day');
      assert.equal(checkEndDate('2028-02-15', '2028-03-16'), 'Trip can be at most 30 days long');
    });

    it('checkEndDate reports its own invalid date, defers an invalid start', () => {
      process.env.TZ = zone;
      assert.equal(checkEndDate('2026-11-20', '2026-11-31'), 'endDate must be a valid date (YYYY-MM-DD)');
      assert.equal(checkEndDate('nope', '2026-11-20'), null);
    });
  });
}

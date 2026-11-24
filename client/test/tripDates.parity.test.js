// The search form's date limits (src/lib/tripDates.js) must match what the server accepts on
// "Save trip" (server/src/utils/tripDates.js). The server is the source of truth: this test runs
// the client's boundaries through the server's own checks, so a change on either side fails here.
// The server file is imported by relative path, so it must stay pure (no env, no npm imports).
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process'; // the client ESLint config only knows browser globals
import * as server from '../../server/src/utils/tripDates.js';
import {
  MAX_TRIP_DAYS,
  MAX_YEARS_AHEAD,
  maxStartISO,
  maxEndISO,
  startDateError,
  endDateError,
} from '../src/lib/tripDates.js';
import { addDaysISO, todayISO } from '../src/lib/dates.js';

const ZONES = {
  UTC: 0,
  'America/Los_Angeles': 480,
  'Pacific/Honolulu': 600,
  'Asia/Tokyo': -540,
  'Europe/Warsaw': -60,
  'Pacific/Kiritimati': -840, // UTC+14
  'Pacific/Pago_Pago': 660, // UTC-11
};

// Around UTC midnight the local date differs from the UTC date in most zones above.
const NOWS = [
  new Date('2026-11-18T00:30:00Z'), // just after UTC midnight
  new Date('2026-11-18T23:30:00Z'), // just before UTC midnight
  new Date('2026-11-18T12:00:00Z'),
  new Date('2028-02-29T12:00:00Z'), // leap day: 2 years later is Mar 1 2030
  new Date('2027-12-31T23:30:00Z'), // year end
];

// Trip starts for the end-date limit: plain, over EU/US DST changes, over Feb 29, over year end.
const STARTS = ['2026-11-20', '2026-10-20', '2027-03-01', '2028-02-15', '2026-12-15'];

const TOO_FAR = 'startDate can be at most 2 years ahead';
const TOO_LONG = 'Trip can be at most 30 days long';

const originalTz = process.env.TZ;
after(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('client/server trip date parity', () => {
  it('same constants', () => {
    assert.equal(MAX_TRIP_DAYS, server.MAX_TRIP_DAYS);
    assert.equal(MAX_YEARS_AHEAD, server.MAX_YEARS_AHEAD);
  });

  for (const [zone, januaryOffset] of Object.entries(ZONES)) {
    describe(`TZ=${zone}`, () => {
      it('really runs in that zone', () => {
        process.env.TZ = zone;
        assert.equal(new Date(2026, 0, 15).getTimezoneOffset(), januaryOffset);
      });

      it('start: the client range is exactly what the server accepts at the top, inside it at the bottom', () => {
        process.env.TZ = zone;
        for (const now of NOWS) {
          const label = `now=${now.toISOString()}`;
          const today = todayISO(now);
          const max = maxStartISO(now);

          // Latest start: the server accepts it and rejects the next day.
          assert.equal(server.checkStartDate(max, now), null, label);
          assert.equal(server.checkStartDate(addDaysISO(max, 1), now), TOO_FAR, label);
          assert.equal(startDateError(max, now), null, label);
          assert.equal(startDateError(addDaysISO(max, 1), now), 'At most 2 years ahead', label);

          // Earliest start (local today): the server always accepts it.
          assert.equal(server.checkStartDate(today, now), null, label);
          assert.equal(startDateError(today, now), null, label);
          assert.equal(startDateError(addDaysISO(today, -1), now), 'Start date is in the past');
        }
      });

      it('end: the client range is exactly what the server accepts', () => {
        process.env.TZ = zone;
        for (const start of STARTS) {
          const max = maxEndISO(start);
          for (const end of [addDaysISO(start, -1), start, max, addDaysISO(max, 1)]) {
            const serverOk = server.checkEndDate(start, end) === null;
            const clientOk = endDateError(start, end) === null;
            assert.equal(clientOk, serverOk, `${start}..${end}`);
          }
          assert.equal(server.checkEndDate(start, addDaysISO(max, 1)), TOO_LONG, start);
        }
      });
    });
  }

  it('leap day: the latest start overflows to Mar 1, like the server', () => {
    assert.equal(maxStartISO(new Date('2028-02-29T12:00:00Z')), '2030-03-01');
  });

  it('client messages for invalid input', () => {
    const now = NOWS[0];
    assert.equal(startDateError('2026-02-30', now), 'Enter a valid date');
    assert.equal(startDateError('', now), 'Enter a valid date');
    assert.equal(endDateError('2026-11-20', 'nope'), 'Enter a valid date');
    assert.equal(endDateError('nope', '2026-11-20'), null); // reported on the start date
    assert.equal(endDateError('2026-11-20', '2026-11-19'), 'End must be after start');
    assert.equal(endDateError('2026-11-01', '2026-12-01'), 'Trips are at most 30 days');
    assert.equal(maxEndISO('nope'), null);
  });
});

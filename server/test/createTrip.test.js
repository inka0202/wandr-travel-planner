import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { createTripValidator } from '../src/validators/trip.validators.js';
import { pickCreateTripFields } from '../src/controllers/trip.controller.js';
import Trip from '../src/models/Trip.js';

// Dates relative to the real "today" (UTC), because the validator uses new Date()
const isoDay = (offsetDays) => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  )
    .toISOString()
    .slice(0, 10);
};

const attraction = (overrides = {}) => ({
  xid: 'N123',
  name: 'Old Town',
  latitude: 52.25,
  longitude: 21.01,
  kind: 'historic',
  ...overrides,
});

const validBody = (overrides = {}) => ({
  destination: { name: 'Warsaw', country: 'Poland', latitude: 52.23, longitude: 21.01 },
  startDate: isoDay(7),
  endDate: isoDay(10),
  notes: '',
  savedAttractions: [attraction()],
  ...overrides,
});

const validate = async (body) => {
  const req = { body: structuredClone(body) };
  for (const chain of createTripValidator) await chain.run(req);
  return validationResult(req)
    .array()
    .map((e) => e.msg);
};

describe('createTripValidator', () => {
  it('accepts a valid trip', async () => {
    assert.deepEqual(await validate(validBody()), []);
  });

  it('accepts a trip without attractions or notes', async () => {
    const body = validBody();
    delete body.savedAttractions;
    delete body.notes;
    assert.deepEqual(await validate(body), []);
  });

  it('requires xid and name on each attraction', async () => {
    const errors = await validate(
      validBody({ savedAttractions: [{ latitude: 1, longitude: 1 }] }),
    );
    assert.ok(errors.includes('Attraction xid is required'), errors.join(' | '));
    assert.ok(errors.includes('Attraction name is required'), errors.join(' | '));
  });

  it('rejects blank xid after trimming', async () => {
    const errors = await validate(validBody({ savedAttractions: [attraction({ xid: '   ' })] }));
    assert.ok(errors.includes('Attraction xid is required'));
  });

  it('enforces attraction length limits', async () => {
    const errors = await validate(
      validBody({
        savedAttractions: [
          attraction({
            xid: 'x'.repeat(65),
            name: 'n'.repeat(201),
            kind: 'k'.repeat(61),
            address: 'a'.repeat(301),
          }),
        ],
      }),
    );
    for (const msg of [
      'Attraction xid too long',
      'Attraction name too long',
      'Attraction kind too long',
      'Attraction address too long',
    ]) {
      assert.ok(errors.includes(msg), `${msg} missing in: ${errors.join(' | ')}`);
    }
  });

  it('rejects non-object attractions and more than 50', async () => {
    assert.ok(
      (await validate(validBody({ savedAttractions: ['N123'] }))).includes(
        'Each saved attraction must be an object',
      ),
    );
    const many = Array.from({ length: 51 }, (_, i) => attraction({ xid: `N${i}` }));
    assert.ok(
      (await validate(validBody({ savedAttractions: many }))).includes(
        'Maximum 50 attractions per trip',
      ),
    );
  });

  it('rejects impossible and non-date-only dates', async () => {
    const year = isoDay(0).slice(0, 4);
    assert.deepEqual(await validate(validBody({ startDate: `${year}-13-45` })), [
      'startDate must be a valid date (YYYY-MM-DD)',
    ]);
    assert.deepEqual(await validate(validBody({ startDate: `${isoDay(7)}T10:00:00Z` })), [
      'startDate must be a valid date (YYYY-MM-DD)',
    ]);
    assert.deepEqual(await validate(validBody({ endDate: `${year}-02-30` })), [
      'endDate must be a valid date (YYYY-MM-DD)',
    ]);
  });

  it('applies the trip date rules', async () => {
    assert.deepEqual(await validate(validBody({ startDate: isoDay(-2), endDate: isoDay(1) })), [
      'startDate cannot be in the past',
    ]);
    assert.deepEqual(await validate(validBody({ startDate: isoDay(5), endDate: isoDay(4) })), [
      'endDate must be on or after startDate',
    ]);
    assert.deepEqual(await validate(validBody({ startDate: isoDay(1), endDate: isoDay(31) })), [
      'Trip can be at most 30 days long',
    ]);
    assert.deepEqual(await validate(validBody({ startDate: isoDay(1), endDate: isoDay(30) })), []);
  });
});

describe('pickCreateTripFields (mass assignment)', () => {
  const attackerId = new mongoose.Types.ObjectId().toString();

  const hostile = validBody({
    _id: attackerId,
    user: attackerId,
    createdAt: '2000-01-01T00:00:00Z',
    __v: 99,
    isAdmin: true,
    destination: {
      name: 'Warsaw',
      latitude: 52.23,
      longitude: 21.01,
      injected: 'x',
    },
    savedAttractions: [attraction({ _id: attackerId, rate: 7, html: '<b>x</b>' })],
  });

  it('copies only the validated fields', () => {
    const picked = pickCreateTripFields(hostile);
    assert.deepEqual(Object.keys(picked).sort(), [
      'destination',
      'endDate',
      'notes',
      'savedAttractions',
      'startDate',
    ]);
    assert.deepEqual(Object.keys(picked.destination).sort(), [
      'country',
      'latitude',
      'longitude',
      'name',
    ]);
    assert.deepEqual(Object.keys(picked.savedAttractions[0]).sort(), [
      'address',
      'kind',
      'latitude',
      'longitude',
      'name',
      'xid',
    ]);
  });

  it('a Trip built from it ignores client _id, user and timestamps', () => {
    const ownerId = new mongoose.Types.ObjectId();
    const trip = new Trip({ ...pickCreateTripFields(hostile), user: ownerId });
    assert.equal(trip.validateSync(), undefined);
    assert.notEqual(trip._id.toString(), attackerId);
    assert.equal(trip.user.toString(), ownerId.toString());
    assert.equal(trip.createdAt, undefined); // set by Mongoose on save, not by the client
    assert.notEqual(trip.savedAttractions[0]._id.toString(), attackerId);
    assert.equal(trip.toObject().isAdmin, undefined);
  });
});

describe('Trip schema limits (defense in depth)', () => {
  const base = () => ({
    user: new mongoose.Types.ObjectId(),
    destination: { name: 'Warsaw', latitude: 52.23, longitude: 21.01 },
    startDate: new Date('2026-12-01'),
    endDate: new Date('2026-12-03'),
  });

  it('rejects over-long attraction fields with messages that hide the value', () => {
    const err = new Trip({
      ...base(),
      savedAttractions: [attraction({ xid: 'x'.repeat(65) })],
    }).validateSync();
    assert.match(err.message, /xid too long/);
    assert.ok(!err.message.includes('x'.repeat(65)));
  });

  it('rejects more than 50 attractions', () => {
    const many = Array.from({ length: 51 }, (_, i) => attraction({ xid: `N${i}` }));
    const err = new Trip({ ...base(), savedAttractions: many }).validateSync();
    assert.match(err.message, /Maximum 50 attractions per trip/);
  });
});

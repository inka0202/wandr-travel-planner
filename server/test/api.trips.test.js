import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startTestApp, assertNoRealFetch, ipFactory } from './helpers/testApp.js';

const ctx = await startTestApp();
const nextIp = ipFactory(2);

after(() => ctx.stop());
afterEach(() => assertNoRealFetch());

// Dates relative to the real "today" (UTC), because the validator uses new Date()
const isoDay = (offsetDays) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays))
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

const tripBody = (overrides = {}) => ({
  destination: { name: 'Warsaw', country: 'Poland', latitude: 52.23, longitude: 21.01 },
  startDate: isoDay(7),
  endDate: isoDay(10),
  notes: '',
  savedAttractions: [attraction()],
  ...overrides,
});

let userNo = 0;
/** Registers a user and returns an api client that sends their token. */
const newUser = async () => {
  const ip = nextIp();
  const res = await ctx
    .api(ip)
    .post('/api/auth/register')
    .send({ email: `trips${++userNo}@example.com`, password: 'correct-horse-battery' });
  assert.equal(res.status, 201);
  const auth = `Bearer ${res.body.token}`;
  const api = ctx.api(ip);
  return {
    id: res.body.user._id,
    get: (url) => api.get(url).set('Authorization', auth),
    post: (url, body) => api.post(url).set('Authorization', auth).send(body),
    patch: (url, body) => api.patch(url).set('Authorization', auth).send(body),
    delete: (url) => api.delete(url).set('Authorization', auth),
  };
};

describe('trip ownership', () => {
  let alice;
  let bob;
  let tripId;
  before(async () => {
    alice = await newUser();
    bob = await newUser();
    const res = await alice.post('/api/trips', tripBody({ notes: 'alice private notes' }));
    assert.equal(res.status, 201);
    tripId = res.body.trip._id;
  });

  it('the owner can read the trip', async () => {
    const res = await alice.get(`/api/trips/${tripId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.trip.notes, 'alice private notes');
  });

  it("another user gets 404 on GET, PATCH and DELETE of someone else's trip", async () => {
    const get = await bob.get(`/api/trips/${tripId}`);
    const patch = await bob.patch(`/api/trips/${tripId}`, { notes: 'hijacked' });
    const del = await bob.delete(`/api/trips/${tripId}`);
    for (const res of [get, patch, del]) {
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'TRIP_NOT_FOUND');
      assert.ok(!JSON.stringify(res.body).includes('alice private notes'));
    }
  });

  it("the owner's trip is unchanged after those attempts", async () => {
    const res = await alice.get(`/api/trips/${tripId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.trip.notes, 'alice private notes');
  });

  it("another user's list doesn't include the trip", async () => {
    const bobs = await bob.get('/api/trips');
    assert.equal(bobs.status, 200);
    assert.deepEqual(bobs.body.trips, []);
    const alices = await alice.get('/api/trips');
    assert.deepEqual(
      alices.body.trips.map((t) => t._id),
      [tripId],
    );
  });

  it('the owner can update notes and delete the trip', async () => {
    const patch = await alice.patch(`/api/trips/${tripId}`, { notes: 'updated' });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.trip.notes, 'updated');
    const del = await alice.delete(`/api/trips/${tripId}`);
    assert.equal(del.status, 204);
    assert.equal((await alice.get(`/api/trips/${tripId}`)).status, 404);
  });

  it('404 for a well-formed id that does not exist, 400 for a malformed id', async () => {
    const missing = new mongoose.Types.ObjectId().toString();
    assert.equal((await alice.get(`/api/trips/${missing}`)).status, 404);
    for (const res of [
      await alice.get('/api/trips/not-an-id'),
      await alice.patch('/api/trips/not-an-id', { notes: 'x' }),
      await alice.delete('/api/trips/not-an-id'),
    ]) {
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });
});

describe('POST /api/trips saves only validated fields', () => {
  it('ignores _id, user, timestamps, unknown fields and unknown attraction subfields', async () => {
    const alice = await newUser();
    const bob = await newUser();
    const forcedId = new mongoose.Types.ObjectId().toString();
    const forcedAttractionId = new mongoose.Types.ObjectId().toString();
    const res = await alice.post(
      '/api/trips',
      tripBody({
        _id: forcedId,
        user: bob.id,
        createdAt: '2000-01-01T00:00:00.000Z',
        updatedAt: '2000-01-01T00:00:00.000Z',
        __v: 99,
        isAdmin: true,
        destination: {
          name: 'Warsaw',
          latitude: 52.23,
          longitude: 21.01,
          secret: 'x',
        },
        savedAttractions: [attraction({ _id: forcedAttractionId, rating: 5, html: '<b>' })],
      }),
    );
    assert.equal(res.status, 201);
    const { trip } = res.body;
    assert.notEqual(trip._id, forcedId);
    assert.equal(trip.user, alice.id);
    assert.ok(new Date(trip.createdAt).getFullYear() > 2000);
    assert.ok(new Date(trip.updatedAt).getFullYear() > 2000);
    assert.equal(trip.isAdmin, undefined);
    assert.equal(trip.destination.secret, undefined);
    assert.notEqual(trip.savedAttractions[0]._id, forcedAttractionId);
    assert.equal(trip.savedAttractions[0].rating, undefined);
    assert.equal(trip.savedAttractions[0].html, undefined);

    // And what's stored matches what was returned
    const stored = await mongoose.connection
      .collection('trips')
      .findOne({ _id: new mongoose.Types.ObjectId(trip._id) });
    assert.equal(stored.user.toString(), alice.id);
    assert.equal(stored.isAdmin, undefined);
    assert.equal((await bob.get('/api/trips')).body.trips.length, 0);
  });

  it('returns 400 VALIDATION_ERROR for invalid bodies', async () => {
    const alice = await newUser();
    const cases = {
      'missing destination': tripBody({ destination: undefined }),
      'empty destination name': tripBody({
        destination: { name: '  ', latitude: 1, longitude: 1 },
      }),
      'latitude out of range': tripBody({
        destination: { name: 'X', latitude: 91, longitude: 1 },
      }),
      'impossible date': tripBody({ startDate: '2026-13-45' }),
      'not a date-only string': tripBody({ startDate: 'tomorrow' }),
      'start in the past': tripBody({ startDate: isoDay(-2) }),
      'end before start': tripBody({ startDate: isoDay(10), endDate: isoDay(7) }),
      'more than 50 attractions': tripBody({
        savedAttractions: Array.from({ length: 51 }, (_, i) => attraction({ xid: `N${i}` })),
      }),
      'attraction without xid': tripBody({ savedAttractions: [attraction({ xid: undefined })] }),
      'attraction name too long': tripBody({
        savedAttractions: [attraction({ name: 'x'.repeat(201) })],
      }),
      'notes too long': tripBody({ notes: 'x'.repeat(1001) }),
    };
    for (const [label, body] of Object.entries(cases)) {
      const res = await alice.post('/api/trips', body);
      assert.equal(res.status, 400, label);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR', label);
    }
    assert.equal((await alice.get('/api/trips')).body.trips.length, 0);
  });

  it('PATCH rejects notes that are too long or not a string', async () => {
    const alice = await newUser();
    const { trip } = (await alice.post('/api/trips', tripBody())).body;
    for (const notes of ['x'.repeat(1001), 42, undefined]) {
      const res = await alice.patch(`/api/trips/${trip._id}`, { notes });
      assert.equal(res.status, 400, JSON.stringify(notes));
    }
  });
});

describe('trip routes require a valid token', () => {
  it('401 without a token on every route', async () => {
    const api = ctx.api(nextIp());
    const id = new mongoose.Types.ObjectId().toString();
    for (const res of [
      await api.get('/api/trips'),
      await api.post('/api/trips').send(tripBody()),
      await api.get(`/api/trips/${id}`),
      await api.patch(`/api/trips/${id}`).send({ notes: 'x' }),
      await api.delete(`/api/trips/${id}`),
    ]) {
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'NO_TOKEN');
    }
  });
});

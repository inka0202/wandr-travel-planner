// Runs the app with NODE_ENV=production, as on Render.
import { describe, it, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Trip from '../src/models/Trip.js';
import { startTestApp, assertNoRealFetch, ipFactory } from './helpers/testApp.js';

const ctx = await startTestApp({ nodeEnv: 'production' });
const nextIp = ipFactory(4);

after(() => ctx.stop());
afterEach(() => {
  mock.restoreAll();
  assertNoRealFetch();
});

const INTERNAL_DETAIL = 'db exploded at mongodb://admin:hunter2@internal';

/** Asserts the body is the generic production 5xx and leaks nothing internal. */
const assertGeneric500 = (res) => {
  assert.equal(res.status, 500);
  assert.equal(res.body.error.message, 'Internal Server Error');
  assert.equal(res.body.error.stack, undefined);
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes('hunter2'), raw);
  assert.ok(!raw.includes('at '), raw); // no stack frames
};

describe('5xx in production', () => {
  it('an unexpected database error returns the generic message, no stack', async (t) => {
    t.mock.method(console, 'error', () => {}); // the handler logs 5xx; keep test output clean
    const api = ctx.api(nextIp());
    const reg = await api
      .post('/api/auth/register')
      .send({ email: 'errors@example.com', password: 'correct-horse-battery' });
    assert.equal(reg.status, 201);

    mock.method(Trip, 'find', () => {
      throw new Error(INTERNAL_DETAIL);
    });
    const res = await api.get('/api/trips').set('Authorization', `Bearer ${reg.body.token}`);
    assertGeneric500(res);
    assert.equal(res.body.error.code, undefined);
  });

  it('a malformed upstream body (TypeError while normalizing) returns the generic message', async (t) => {
    t.mock.method(console, 'error', () => {});
    mock.method(
      globalThis,
      'fetch',
      async () => new Response(JSON.stringify({ current: {} }), { status: 200 }),
    );
    const res = await ctx.api(nextIp()).get('/api/weather?lat=1&lng=1');
    assertGeneric500(res);
  });
});

describe('4xx in production', () => {
  it('malformed JSON → 400 INVALID_JSON without echoing the body', async () => {
    const res = await ctx
      .api(nextIp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "secret-input-123", ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
    assert.ok(!JSON.stringify(res.body).includes('secret-input-123'));
    assert.equal(res.body.error.stack, undefined);
  });

  it('unknown routes → 404 with the standard error shape', async () => {
    const res = await ctx.api(nextIp()).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error.message, 'string');
    assert.equal(res.body.error.stack, undefined);
  });

  it('one health route: GET /health is up, /api/health does not exist', async () => {
    const health = await ctx.api(nextIp()).get('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const apiHealth = await ctx.api(nextIp()).get('/api/health');
    assert.equal(apiHealth.status, 404);
    assert.equal(apiHealth.body.error.code, 'NOT_FOUND');
  });

  it('helmet removes X-Powered-By', async () => {
    const res = await ctx.api(nextIp()).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

// Upstream failures are logged as one `[upstream]` line (status, Retry-After,
// reason) without the URL, API key or request values, and what the client
// sees does not change.
import { describe, it, after, afterEach, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, assertNoRealFetch, ipFactory, TEST_OTM_KEY } from './helpers/testApp.js';

const ctx = await startTestApp();
const nextIp = ipFactory(5);

after(() => ctx.stop());
beforeEach(() => {
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {}); // the handler logs 5xx; keep test output clean
});
afterEach(() => {
  mock.restoreAll();
  assertNoRealFetch();
});

const stubFetch = (impl) => mock.method(globalThis, 'fetch', impl);

const jsonResponse = (data, status, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** The `[upstream]` lines logged so far, parsed. */
const upstreamLogs = () =>
  console.warn.mock.calls
    .filter((c) => c.arguments[0] === '[upstream]')
    .map((c) => ({ raw: c.arguments[1], parsed: JSON.parse(c.arguments[1]) }));

const LAT = '52.22977';
const LNG = '21.01178';
const TZ = 'Europe/Warsaw';
const weatherPath = `/api/weather?lat=${LAT}&lng=${LNG}&tz=${encodeURIComponent(TZ)}`;

describe('[upstream] logging', () => {
  it('weather 429: logs status, Retry-After and reason; response unchanged', async () => {
    const reason = 'Minutely API request limit exceeded. Please try again in one minute.';
    stubFetch(async () => jsonResponse({ error: true, reason }, 429, { 'Retry-After': '60' }));

    const res = await ctx.api(nextIp()).get(weatherPath);
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'WEATHER_UPSTREAM');
    assert.equal(res.body.error.message, 'Internal Server Error');

    const logs = upstreamLogs();
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0].parsed, {
      service: 'open-meteo-forecast',
      status: 429,
      retryAfter: '60',
      reason,
    });
  });

  it('weather 400: request values echoed in the reason are redacted', async () => {
    const reason = `Cannot use timezone ${TZ} at ${LAT}, ${LNG}`;
    stubFetch(async () => jsonResponse({ error: true, reason }, 400));

    const res = await ctx.api(nextIp()).get(`${weatherPath}&x=1`);
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'WEATHER_UPSTREAM');

    const [log] = upstreamLogs();
    assert.equal(log.parsed.status, 400);
    assert.equal(log.parsed.reason, 'Cannot use timezone [redacted] at [redacted], [redacted]');
    for (const secret of [LAT, LNG, TZ, 'open-meteo.com', 'latitude=']) {
      assert.ok(!log.raw.includes(secret), secret);
    }
  });

  it('weather 500 with an HTML body: logs a non-JSON marker', async () => {
    stubFetch(
      async () =>
        new Response('<html>Bad gateway</html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }),
    );

    const res = await ctx.api(nextIp()).get('/api/weather?lat=30.5&lng=30.5');
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'WEATHER_UPSTREAM');

    const [log] = upstreamLogs();
    assert.deepEqual(log.parsed, {
      service: 'open-meteo-forecast',
      status: 500,
      reason: '(non-JSON body, text/html)',
    });
  });

  it('cuts a long reason to 200 characters', async () => {
    stubFetch(async () => jsonResponse({ error: true, reason: 'x'.repeat(500) }, 400));
    await ctx.api(nextIp()).get('/api/weather?lat=30.6&lng=30.6');
    const [log] = upstreamLogs();
    assert.equal(log.parsed.reason, `${'x'.repeat(200)}…`);
  });

  it('OpenTripMap 403: never logs the key or the URL', async () => {
    stubFetch(async () => jsonResponse({ error: `Invalid API key ${TEST_OTM_KEY}` }, 403));

    const res = await ctx.api(nextIp()).get('/api/attractions?lat=40.5&lng=40.5');
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'ATTRACTIONS_UPSTREAM');

    const [log] = upstreamLogs();
    assert.deepEqual(log.parsed, {
      service: 'opentripmap',
      status: 403,
      reason: 'Invalid API key [redacted]',
    });
    for (const secret of [TEST_OTM_KEY, 'opentripmap.com', 'apikey']) {
      assert.ok(!log.raw.includes(secret), secret);
    }
  });

  it('geocode failure is logged without the search query', async () => {
    stubFetch(async () => jsonResponse({ error: true, reason: 'No match for Krakow' }, 400));
    const res = await ctx.api(nextIp()).get('/api/geocode?q=Krakow');
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'GEOCODE_UPSTREAM');
    const [log] = upstreamLogs();
    assert.equal(log.parsed.service, 'open-meteo-geocode');
    assert.ok(!log.raw.includes('Krakow'));
  });

  it('a 200 OK response logs nothing', async () => {
    stubFetch(async () => jsonResponse([], 200));
    const res = await ctx.api(nextIp()).get('/api/attractions?lat=40.6&lng=40.6');
    assert.equal(res.status, 200);
    assert.equal(upstreamLogs().length, 0);
  });
});

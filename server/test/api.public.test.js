import { describe, it, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestApp,
  assertNoRealFetch,
  ipFactory,
  ALLOWED_ORIGIN,
  TEST_OTM_KEY,
} from './helpers/testApp.js';

const ctx = await startTestApp();
const nextIp = ipFactory(3);

after(() => ctx.stop());
afterEach(() => {
  mock.restoreAll();
  assertNoRealFetch();
});

// --- canned upstream responses ------------------------------------------------

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const GEOCODE_OK = {
  results: [
    {
      name: 'Warsaw',
      country: 'Poland',
      country_code: 'PL',
      admin1: 'Masovia',
      latitude: 52.23,
      longitude: 21.01,
      timezone: 'Europe/Warsaw',
    },
  ],
};

const days = ['2026-11-20', '2026-11-21'];
const FORECAST_OK = {
  timezone: 'Europe/Warsaw',
  current: {
    temperature_2m: 4.4,
    apparent_temperature: 1.2,
    weather_code: 3,
    wind_speed_10m: 12.6,
    relative_humidity_2m: 80,
  },
  daily: {
    time: days,
    temperature_2m_max: [5.4, 6.6],
    temperature_2m_min: [-1.2, 0.4],
    weather_code: [3, 61],
    precipitation_probability_max: [10, null],
    wind_speed_10m_max: [14.2, 20.5],
  },
};

const ATTRACTIONS_OK = [
  {
    xid: 'N1',
    name: 'Old Town',
    kinds: 'historic_districts,interesting_places',
    point: { lat: 52.25, lon: 21.01 },
    dist: 120.4,
    rate: 3,
  },
  { xid: 'N2', name: '', kinds: 'other', point: { lat: 1, lon: 1 }, dist: 1, rate: 1 },
];

/** Stubs fetch with a fixed response and returns the mock (for call counts and URLs). */
const stubFetch = (impl) => mock.method(globalThis, 'fetch', impl);

// --- weather --------------------------------------------------------------------

describe('GET /api/weather', () => {
  it('returns the normalized forecast', async () => {
    const fetchMock = stubFetch(async () => json(FORECAST_OK));
    const res = await ctx.api(nextIp()).get('/api/weather?lat=52.23&lng=21.01&tz=Europe/Warsaw');
    assert.equal(res.status, 200);
    assert.equal(res.body.current.temp, 4);
    assert.equal(res.body.daily.length, 2);
    assert.equal(res.body.daily[1].precipitationProb, 0);
    assert.equal(fetchMock.mock.callCount(), 1);
    const url = new URL(fetchMock.mock.calls[0].arguments[0]);
    assert.equal(url.hostname, 'api.open-meteo.com');
    assert.equal(url.searchParams.get('timezone'), 'Europe/Warsaw');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      latitude: '52.23',
      longitude: '21.01',
      timezone: 'Europe/Warsaw',
      forecast_days: '7',
      current:
        'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
      daily:
        'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max',
    });
  });

  it('a second identical request is served from the cache', async () => {
    const fetchMock = stubFetch(async () => json(FORECAST_OK));
    const api = ctx.api(nextIp());
    const first = await api.get('/api/weather?lat=10.5&lng=20.5&tz=auto');
    const second = await api.get('/api/weather?lat=10.5&lng=20.5&tz=auto');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, first.body);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it('400 INVALID_TZ for an unknown tz, without calling upstream', async () => {
    const fetchMock = stubFetch(async () => json(FORECAST_OK));
    const api = ctx.api(nextIp());
    for (const tz of ['Mars/Olympus', '../../etc', 'x'.repeat(200)]) {
      const res = await api.get(`/api/weather?lat=1&lng=1&tz=${encodeURIComponent(tz)}`);
      assert.equal(res.status, 400, tz);
      assert.equal(res.body.error.code, 'INVALID_TZ');
      assert.ok(!res.body.error.message.includes(tz));
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('400 INVALID_COORD for empty, missing or out-of-range coords', async () => {
    const fetchMock = stubFetch(async () => json(FORECAST_OK));
    const api = ctx.api(nextIp());
    for (const qs of ['lat=&lng=', 'lng=1', 'lat=1', 'lat=91&lng=1', 'lat=1&lng=abc']) {
      const res = await api.get(`/api/weather?${qs}`);
      assert.equal(res.status, 400, qs);
      assert.equal(res.body.error.code, 'INVALID_COORD');
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('504 UPSTREAM_TIMEOUT when the upstream call times out', async () => {
    stubFetch(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    const res = await ctx.api(nextIp()).get('/api/weather?lat=30.1&lng=30.1');
    assert.equal(res.status, 504);
    assert.equal(res.body.error.code, 'UPSTREAM_TIMEOUT');
  });

  it('502 UPSTREAM_UNAVAILABLE on a network error', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const res = await ctx.api(nextIp()).get('/api/weather?lat=30.2&lng=30.2');
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'UPSTREAM_UNAVAILABLE');
  });

  it('503 WEATHER_RATE_LIMITED on an upstream 429, without retrying', async () => {
    const fetchMock = stubFetch(async () =>
      json({ error: true, reason: 'Daily API request limit exceeded.' }, 429),
    );
    const res = await ctx.api(nextIp()).get('/api/weather?lat=30.4&lng=30.4');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'WEATHER_RATE_LIMITED');
    assert.equal(res.body.error.message, 'Internal Server Error'); // generic 5xx outside dev
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it('502 WEATHER_UPSTREAM on an upstream error status, and errors are not cached', async () => {
    const fetchMock = stubFetch(async () => json({ reason: 'boom' }, 500));
    const api = ctx.api(nextIp());
    const res = await api.get('/api/weather?lat=30.3&lng=30.3');
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'WEATHER_UPSTREAM');
    await api.get('/api/weather?lat=30.3&lng=30.3');
    assert.equal(fetchMock.mock.callCount(), 2);
  });
});

// --- geocode --------------------------------------------------------------------

describe('GET /api/geocode', () => {
  it('returns matches, and caches by lower-cased query', async () => {
    const fetchMock = stubFetch(async () => json(GEOCODE_OK));
    const api = ctx.api(nextIp());
    const first = await api.get('/api/geocode?q=Warsaw');
    const second = await api.get('/api/geocode?q=warsaw');
    assert.equal(first.status, 200);
    assert.equal(first.body.results[0].timezone, 'Europe/Warsaw');
    assert.deepEqual(second.body, first.body);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it('404 GEOCODE_NO_RESULTS when nothing matches', async () => {
    stubFetch(async () => json({}));
    const res = await ctx.api(nextIp()).get('/api/geocode?q=Qwxzzy');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'GEOCODE_NO_RESULTS');
  });

  it('400 for a missing or too long query, without calling upstream', async () => {
    const fetchMock = stubFetch(async () => json(GEOCODE_OK));
    const api = ctx.api(nextIp());
    assert.equal((await api.get('/api/geocode')).body.error.code, 'MISSING_QUERY');
    assert.equal((await api.get('/api/geocode?q=%20%20')).body.error.code, 'MISSING_QUERY');
    const long = await api.get(`/api/geocode?q=${'a'.repeat(101)}`);
    assert.equal(long.status, 400);
    assert.equal(long.body.error.code, 'QUERY_TOO_LONG');
    assert.equal(fetchMock.mock.callCount(), 0);
  });
});

// --- attractions ----------------------------------------------------------------

describe('GET /api/attractions', () => {
  it('uses the configured key, filters unnamed places, and caches', async () => {
    const fetchMock = stubFetch(async () => json(ATTRACTIONS_OK));
    const api = ctx.api(nextIp());
    const res = await api.get('/api/attractions?lat=52.23&lng=21.01');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.attractions.map((a) => a.name),
      ['Old Town'],
    );
    assert.equal(res.body.attractions[0].kind, 'historic districts');
    assert.ok(!JSON.stringify(res.body).includes(TEST_OTM_KEY));

    const url = new URL(fetchMock.mock.calls[0].arguments[0]);
    assert.equal(url.hostname, 'api.opentripmap.com');
    assert.equal(url.searchParams.get('apikey'), TEST_OTM_KEY);

    await api.get('/api/attractions?lat=52.23&lng=21.01');
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it('502 ATTRACTIONS_UPSTREAM without leaking the upstream URL or key', async () => {
    stubFetch(async () => json({ error: 'Invalid API key' }, 403));
    const res = await ctx.api(nextIp()).get('/api/attractions?lat=40.1&lng=40.1');
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'ATTRACTIONS_UPSTREAM');
    assert.ok(!JSON.stringify(res.body).includes(TEST_OTM_KEY));
  });
});

// --- rate limit -----------------------------------------------------------------

describe('public API rate limit', () => {
  it('blocks the 31st request from one IP in the window, not other IPs', async () => {
    stubFetch(async () => json(GEOCODE_OK));
    const api = ctx.api(nextIp());
    for (let i = 1; i <= 30; i++) {
      assert.equal((await api.get('/api/geocode?q=Warsaw')).status, 200, `request #${i}`);
    }
    const blocked = await api.get('/api/geocode?q=Warsaw');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'RATE_LIMITED');
    assert.equal((await ctx.api(nextIp()).get('/api/geocode?q=Warsaw')).status, 200);
  });
});

// --- CORS -----------------------------------------------------------------------

describe('CORS', () => {
  it('echoes an allowed origin', async () => {
    const res = await ctx.api(nextIp()).get('/health').set('Origin', ALLOWED_ORIGIN);
    assert.equal(res.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  it('sends no allow-origin header for a foreign origin', async () => {
    for (const origin of ['https://evil.example', `${ALLOWED_ORIGIN}.evil.example`, 'null']) {
      const res = await ctx.api(nextIp()).get('/health').set('Origin', origin);
      assert.equal(res.headers['access-control-allow-origin'], undefined, origin);
    }
  });

  it('preflight: allowed origin gets the allowed methods and headers, foreign does not', async () => {
    const preflight = (origin) =>
      ctx
        .api(nextIp())
        .options('/api/trips')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'DELETE')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

    const ok = await preflight(ALLOWED_ORIGIN);
    assert.equal(ok.status, 204);
    assert.equal(ok.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
    assert.match(ok.headers['access-control-allow-methods'], /DELETE/);
    assert.match(ok.headers['access-control-allow-headers'], /Authorization/);

    const foreign = await preflight('https://evil.example');
    assert.equal(foreign.headers['access-control-allow-origin'], undefined);
  });
});

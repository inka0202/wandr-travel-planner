// lib/openMeteo.js: the browser's direct Open-Meteo forecast call (decision 0003).
// fetch is always stubbed; an unstubbed call fails the test, so tests never reach Open-Meteo.
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getForecast, normalizeForecast, WeatherError } from '../src/lib/openMeteo.js';

const unexpectedFetches = [];
beforeEach(() => {
  globalThis.fetch = async (url) => {
    unexpectedFetches.push(String(url));
    throw new TypeError('Real network access is blocked in tests: stub fetch');
  };
});
afterEach(() => {
  mock.restoreAll();
  if (unexpectedFetches.length) {
    throw new Error(`Unstubbed fetch call(s): ${unexpectedFetches.splice(0).join(', ')}`);
  }
});

const stubFetch = (impl) => mock.method(globalThis, 'fetch', impl);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const RAW = {
  timezone: 'Europe/Warsaw',
  current: {
    temperature_2m: 4.5,
    apparent_temperature: -1.5,
    weather_code: 3,
    wind_speed_10m: 12.6,
    relative_humidity_2m: 80,
  },
  daily: {
    time: ['2026-11-22', '2026-11-23'],
    temperature_2m_max: [5.4, 6.6],
    temperature_2m_min: [-1.2, 0.4],
    weather_code: [61, 42],
    precipitation_probability_max: [35, null],
    wind_speed_10m_max: [14.2, 20.5],
  },
};

const LAT = 52.22977;
const LNG = 21.01178;

/** Calls getForecast and returns the WeatherError it throws. */
const failure = async (args, opts) => {
  try {
    await getForecast(args, opts);
  } catch (err) {
    return err;
  }
  assert.fail('expected getForecast to throw');
};

describe('normalizeForecast', () => {
  it('maps to the UI shape: rounding, null precipitation → 0, unknown code → Unknown', () => {
    assert.deepEqual(normalizeForecast(RAW), {
      current: {
        temp: 5,
        feelsLike: -1,
        weatherCode: 3,
        weatherText: 'Overcast',
        wind: 13,
        humidity: 80,
      },
      daily: [
        {
          date: '2026-11-22',
          tempMax: 5,
          tempMin: -1,
          weatherCode: 61,
          weatherText: 'Slight rain',
          precipitationProb: 35,
          windMax: 14,
        },
        {
          date: '2026-11-23',
          tempMax: 7,
          tempMin: 0,
          weatherCode: 42,
          weatherText: 'Unknown',
          precipitationProb: 0,
          windMax: 21,
        },
      ],
      timezone: 'Europe/Warsaw',
    });
  });
});

describe('getForecast', () => {
  it('calls Open-Meteo with the exact params, no referrer, no credentials, no auth header', async () => {
    const fetchMock = stubFetch(async () => json(RAW));
    const result = await getForecast({ lat: LAT, lng: LNG, tz: 'Europe/Warsaw' });
    assert.deepEqual(result, normalizeForecast(RAW));

    assert.equal(fetchMock.mock.callCount(), 1);
    const [urlArg, options] = fetchMock.mock.calls[0].arguments;
    const url = new URL(urlArg);
    assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      latitude: '52.22977',
      longitude: '21.01178',
      timezone: 'Europe/Warsaw',
      forecast_days: '7',
      current:
        'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
      daily:
        'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max',
    });
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("defaults the timezone to 'auto'", async () => {
    for (const tz of [undefined, '']) {
      const fetchMock = stubFetch(async () => json(RAW));
      await getForecast({ lat: 1, lng: 2, tz });
      const url = new URL(fetchMock.mock.calls[0].arguments[0]);
      assert.equal(url.searchParams.get('timezone'), 'auto', String(tz));
      mock.restoreAll();
    }
  });

  const cases = [
    {
      name: '429 → WEATHER_RATE_LIMITED',
      impl: async () => json({ error: true, reason: 'Daily API request limit exceeded.' }, 429),
      code: 'WEATHER_RATE_LIMITED',
      status: 429,
    },
    {
      name: '500 JSON → WEATHER_UPSTREAM',
      impl: async () => json({ error: true, reason: 'boom' }, 500),
      code: 'WEATHER_UPSTREAM',
      status: 500,
    },
    {
      name: '400 → WEATHER_UPSTREAM',
      impl: async () => json({ error: true, reason: `Bad timezone at ${LAT}` }, 400),
      code: 'WEATHER_UPSTREAM',
      status: 400,
    },
    {
      name: '200 with an HTML body → WEATHER_UPSTREAM',
      impl: async () => new Response('<html>blocked</html>', { status: 200 }),
      code: 'WEATHER_UPSTREAM',
      status: 200,
    },
    {
      name: '200 without daily → WEATHER_BAD_RESPONSE',
      impl: async () => json({ current: RAW.current }),
      code: 'WEATHER_BAD_RESPONSE',
      status: 200,
    },
    {
      name: 'network error → WEATHER_NETWORK',
      impl: async () => {
        throw new TypeError('fetch failed');
      },
      code: 'WEATHER_NETWORK',
      status: undefined,
    },
  ];

  for (const { name, impl, code, status } of cases) {
    it(name, async () => {
      stubFetch(impl);
      const err = await failure({ lat: LAT, lng: LNG, tz: 'Europe/Warsaw' });
      assert.ok(err instanceof WeatherError);
      assert.equal(err.code, code);
      assert.equal(err.status, status);
      for (const secret of [String(LAT), String(LNG), 'Europe/Warsaw', 'open-meteo.com']) {
        assert.ok(!err.message.includes(secret), `message leaks ${secret}`);
      }
    });
  }

  it('times out → WEATHER_TIMEOUT', async () => {
    // AbortSignal.timeout's timer doesn't keep Node alive on its own; this one does.
    const keepAlive = setTimeout(() => {}, 5000);
    try {
      stubFetch(
        (url, { signal }) =>
          new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason));
          }),
      );
      const err = await failure({ lat: LAT, lng: LNG }, { timeoutMs: 50 });
      assert.ok(err instanceof WeatherError);
      assert.equal(err.code, 'WEATHER_TIMEOUT');
    } finally {
      clearTimeout(keepAlive);
    }
  });

  it('a body that stalls past the timeout → WEATHER_TIMEOUT too', async () => {
    const keepAlive = setTimeout(() => {}, 5000);
    try {
      stubFetch(async (url, { signal }) => ({
        ok: true,
        status: 200,
        text: () =>
          new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason));
          }),
      }));
      const err = await failure({ lat: LAT, lng: LNG }, { timeoutMs: 50 });
      assert.equal(err.code, 'WEATHER_TIMEOUT');
    } finally {
      clearTimeout(keepAlive);
    }
  });
});

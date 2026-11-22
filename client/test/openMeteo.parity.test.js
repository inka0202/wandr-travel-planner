// The browser's forecast mapping (src/lib/openMeteo.js) is a deliberate copy of the server's
// (decision 0003). This test fails if the copies drift apart: change both sides together.
// The server files are imported by relative path, so they must stay pure (no env, no npm imports).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../src/lib/openMeteo.js';
import * as serverForecast from '../../server/src/utils/forecast.js';
import * as serverCodes from '../../server/src/utils/weatherCodeMap.js';

const day = (date, code, precip) => ({ date, code, precip });

/** Builds a raw Open-Meteo response from a compact description. */
const raw = ({ timezone, current, days }) => ({
  timezone,
  current,
  daily: {
    time: days.map((d) => d.date),
    temperature_2m_max: days.map((_, i) => 10.5 - i * 1.25),
    temperature_2m_min: days.map((_, i) => -0.5 - i),
    weather_code: days.map((d) => d.code),
    precipitation_probability_max: days.map((d) => d.precip),
    wind_speed_10m_max: days.map((_, i) => 5.5 + i * 3.3),
  },
});

const FIXTURES = [
  raw({
    timezone: 'Europe/Warsaw',
    current: {
      temperature_2m: 4.5,
      apparent_temperature: -0.5,
      weather_code: 3,
      wind_speed_10m: 12.6,
      relative_humidity_2m: 80,
    },
    days: [day('2026-11-22', 61, 35), day('2026-11-23', 0, null), day('2026-11-24', 99, 0)],
  }),
  raw({
    timezone: 'America/Los_Angeles',
    current: {
      temperature_2m: -12.49,
      apparent_temperature: -20.51,
      weather_code: 42, // not a WMO code
      wind_speed_10m: 0,
      relative_humidity_2m: 100,
    },
    days: Object.keys(serverCodes.WMO_CODES).map((code, i) =>
      day(`2026-12-${String(i + 1).padStart(2, '0')}`, Number(code), i % 2 ? null : i * 3),
    ),
  }),
];

describe('client/server forecast parity', () => {
  it('same fixed query params', () => {
    assert.deepEqual(client.FORECAST_PARAMS, serverForecast.FORECAST_PARAMS);
  });

  it('same WMO code table', () => {
    assert.deepEqual(client.WMO_CODES, serverCodes.WMO_CODES);
  });

  it('same normalized output', () => {
    for (const fixture of FIXTURES) {
      assert.deepEqual(
        client.normalizeForecast(fixture),
        serverForecast.normalizeForecast(fixture),
        fixture.timezone,
      );
    }
  });
});

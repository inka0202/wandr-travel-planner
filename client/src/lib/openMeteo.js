// Open-Meteo forecast, called straight from the browser (decision 0003): Open-Meteo limits
// per IP, and the server's IP on Render is shared with other apps.
//
// FORECAST_PARAMS, WMO_CODES and normalizeForecast are deliberate copies of
// server/src/utils/forecast.js and server/src/utils/weatherCodeMap.js.
// test/openMeteo.parity.test.js fails if they drift apart, so change both sides together.
//
// No `@/` imports and no JSX here, so node:test can import this file.

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
export const DEFAULT_TIMEOUT_MS = 10000;

export const FORECAST_PARAMS = {
  forecast_days: '7',
  current: [
    'temperature_2m',
    'apparent_temperature',
    'weather_code',
    'wind_speed_10m',
    'relative_humidity_2m',
  ].join(','),
  daily: [
    'temperature_2m_max',
    'temperature_2m_min',
    'weather_code',
    'precipitation_probability_max',
    'wind_speed_10m_max',
  ].join(','),
};

// WMO weather interpretation codes → text. https://open-meteo.com/en/docs#weathervariables
export const WMO_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export const wmoCodeToText = (code) => WMO_CODES[code] ?? 'Unknown';

/**
 * Raw Open-Meteo forecast → the shape the UI uses: { current, daily, timezone }.
 * Open-Meteo returns parallel arrays for `daily`; they are flattened into objects.
 */
export const normalizeForecast = (data) => {
  const daily = data.daily.time.map((date, i) => ({
    date,
    tempMax: Math.round(data.daily.temperature_2m_max[i]),
    tempMin: Math.round(data.daily.temperature_2m_min[i]),
    weatherCode: data.daily.weather_code[i],
    weatherText: wmoCodeToText(data.daily.weather_code[i]),
    precipitationProb: data.daily.precipitation_probability_max[i] ?? 0,
    windMax: Math.round(data.daily.wind_speed_10m_max[i]),
  }));

  return {
    current: {
      temp: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      weatherCode: data.current.weather_code,
      weatherText: wmoCodeToText(data.current.weather_code),
      wind: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
    },
    daily,
    timezone: data.timezone,
  };
};

/** Thrown by getForecast. `code` is the contract; messages are generic (no URL, no coords). */
export class WeatherError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'WeatherError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Fetch current weather + the 7-day forecast for a place, straight from Open-Meteo.
 * Plain fetch on purpose: the shared axios instance (api/axios.js) attaches the user's JWT,
 * which must never be sent to a third party. No retry and no cache: each user has their own
 * per-IP limit.
 *
 * @throws {WeatherError} WEATHER_TIMEOUT | WEATHER_NETWORK | WEATHER_RATE_LIMITED |
 *   WEATHER_UPSTREAM | WEATHER_BAD_RESPONSE
 */
export const getForecast = async (
  { lat, lng, tz = 'auto' },
  { timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) => {
  const url = new URL(FORECAST_BASE);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('timezone', tz || 'auto');
  for (const [name, value] of Object.entries(FORECAST_PARAMS)) {
    url.searchParams.set(name, value);
  }

  let res;
  let text;
  try {
    // The timeout signal also covers reading the body.
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      referrerPolicy: 'no-referrer', // the page URL holds the destination and dates
      credentials: 'omit',
    });
    text = await res.text();
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new WeatherError('WEATHER_TIMEOUT', 'Weather request timed out');
    }
    throw new WeatherError('WEATHER_NETWORK', 'Weather service unreachable');
  }

  if (res.status === 429) {
    throw new WeatherError('WEATHER_RATE_LIMITED', 'Weather is unavailable right now', 429);
  }

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // non-JSON body, handled below
  }
  if (!res.ok || data === null) {
    throw new WeatherError('WEATHER_UPSTREAM', 'Weather service unavailable', res.status);
  }

  try {
    return normalizeForecast(data);
  } catch {
    // missing `current` / `daily` arrays: a response shape we don't understand
    throw new WeatherError('WEATHER_BAD_RESPONSE', 'Unexpected weather response', res.status);
  }
};

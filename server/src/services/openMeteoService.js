import { ApiError } from '../utils/ApiError.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';
import { FORECAST_PARAMS, normalizeForecast } from '../utils/forecast.js';

const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Geocode a city name → array of matches with coords + timezone.
 * Open-Meteo returns up to 10 matches; we return all and let UI pick.
 */
export const geocodeCity = async (query, count = 5) => {
  const url = new URL(GEOCODE_BASE);
  url.searchParams.set('name', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const { ok, data } = await fetchWithTimeout(url, undefined, {
    service: 'open-meteo-geocode',
    redact: [query],
  });
  if (!ok || !data) {
    throw new ApiError(502, 'Geocoding service unavailable', 'GEOCODE_UPSTREAM');
  }

  // Open-Meteo returns { results: [...] } on hits, { results: undefined } on misses
  if (!data.results?.length) {
    throw new ApiError(404, 'No results for this search', 'GEOCODE_NO_RESULTS');
  }

  return data.results.map((r) => ({
    name: r.name,
    country: r.country,
    countryCode: r.country_code,
    admin1: r.admin1, // state/province for disambiguation
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone, // critical — passed to forecast endpoint
  }));
};

/**
 * Fetch current weather + 7-day daily forecast.
 * Returns a normalized shape, NOT the raw Open-Meteo response.
 */
export const getForecast = async ({ latitude, longitude, timezone = 'auto' }) => {
  const url = new URL(FORECAST_BASE);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('timezone', timezone);
  for (const [name, value] of Object.entries(FORECAST_PARAMS)) {
    url.searchParams.set(name, value);
  }

  const { ok, status, data } = await fetchWithTimeout(url, undefined, {
    service: 'open-meteo-forecast',
    redact: [String(latitude), String(longitude), timezone],
  });
  // Open-Meteo limits per IP, and Render shares outbound IPs, so this is usually the
  // daily limit used up by other apps. No retry: it would only spend more of the limit.
  if (status === 429) {
    throw new ApiError(503, 'Weather is unavailable right now', 'WEATHER_RATE_LIMITED');
  }
  if (!ok || !data) {
    throw new ApiError(502, 'Weather service unavailable', 'WEATHER_UPSTREAM');
  }

  return normalizeForecast(data);
};

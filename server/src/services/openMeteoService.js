import { ApiError } from '../utils/ApiError.js';
import { wmoCodeToText } from '../utils/weatherCodeMap.js';

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

  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(502, 'Geocoding service unavailable', 'GEOCODE_UPSTREAM');
  }
  const data = await res.json();

  // Open-Meteo returns { results: [...] } on hits, { results: undefined } on misses
  if (!data.results?.length) {
    throw new ApiError(404, `No results for "${query}"`, 'GEOCODE_NO_RESULTS');
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
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'wind_speed_10m',
      'relative_humidity_2m',
    ].join(','),
  );
  url.searchParams.set(
    'daily',
    [
      'temperature_2m_max',
      'temperature_2m_min',
      'weather_code',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(','),
  );

  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(502, 'Weather service unavailable', 'WEATHER_UPSTREAM');
  }
  const data = await res.json();

  // Open-Meteo returns parallel arrays — flatten into objects
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

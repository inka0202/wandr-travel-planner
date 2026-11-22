// Open-Meteo forecast: request params and response mapping.
// The browser has a deliberate copy in client/src/lib/openMeteo.js (decision 0003).
// client/test/openMeteo.parity.test.js fails if the two drift apart, so change both together.
// Keep this file pure (no env, no npm imports, only ./weatherCodeMap.js): the client parity
// test imports it by relative path, outside the server package.
import { wmoCodeToText } from './weatherCodeMap.js';

/** Fixed query params for /v1/forecast (latitude, longitude and timezone are added per call). */
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

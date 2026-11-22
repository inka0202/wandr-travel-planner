import { getForecast } from '@/lib/openMeteo';

// The forecast comes straight from Open-Meteo in the browser, not from /api/weather
// (decision 0003). Same signature and return shape as before: { current, daily, timezone }.
export const getWeather = ({ lat, lng, tz }) => getForecast({ lat, lng, tz });

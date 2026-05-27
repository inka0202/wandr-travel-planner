import { api } from './axios';

export const getWeather = async ({ lat, lng, tz }) => {
  const { data } = await api.get('/weather', { params: { lat, lng, tz } });
  return data; // { current, daily, timezone }
};

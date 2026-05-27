import { api } from './axios';

export const geocodeCity = async (query) => {
  const { data } = await api.get('/geocode', { params: { q: query } });
  return data.results;
};

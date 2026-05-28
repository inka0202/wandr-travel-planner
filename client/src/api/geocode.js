import { api } from './axios';

export const geocodeCity = async (query) => {
  const { data } = await api.get('/geocode', {
    params: { q: query },
    timeout: 90_000, // 90s — tolerates Render cold start
  });
  return data.results;
};

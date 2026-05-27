import { api } from './axios';

export const getAttractions = async ({ lat, lng, radius = 5000 }) => {
  const { data } = await api.get('/attractions', { params: { lat, lng, radius } });
  return data.attractions;
};

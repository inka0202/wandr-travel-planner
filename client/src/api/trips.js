import { api } from './axios';

export const listTrips = async () => {
  const { data } = await api.get('/trips');
  return data.trips;
};

export const getTrip = async (id) => {
  const { data } = await api.get(`/trips/${id}`);
  return data.trip;
};

export const createTrip = async (payload) => {
  const { data } = await api.post('/trips', payload);
  return data.trip;
};

export const updateTripNotes = async (id, notes) => {
  const { data } = await api.patch(`/trips/${id}`, { notes });
  return data.trip;
};

export const deleteTrip = async (id) => {
  await api.delete(`/trips/${id}`);
};

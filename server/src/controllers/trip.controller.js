import Trip from '../models/Trip.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const createTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.create({
    ...req.body,
    user: req.user._id, // ALWAYS scope to authenticated user
  });
  res.status(201).json({ trip });
});

export const listTrips = asyncHandler(async (req, res) => {
  // Newest first, no need to populate user — it's always req.user
  const trips = await Trip.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean(); // .lean() = plain objects, ~5x faster reads
  res.json({ trips });
});

export const getTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({
    _id: req.params.id,
    user: req.user._id, // critical — prevents reading other users' trips
  });
  if (!trip) throw new ApiError(404, 'Trip not found', 'TRIP_NOT_FOUND');
  res.json({ trip });
});

export const updateNotes = asyncHandler(async (req, res) => {
  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { notes: req.body.notes },
    { new: true, runValidators: true },
  );
  if (!trip) throw new ApiError(404, 'Trip not found', 'TRIP_NOT_FOUND');
  res.json({ trip });
});

export const deleteTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!trip) throw new ApiError(404, 'Trip not found', 'TRIP_NOT_FOUND');
  res.status(204).end();
});

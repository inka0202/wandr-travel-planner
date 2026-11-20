import Trip from '../models/Trip.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Copy only the fields createTripValidator checks. Never spread req.body into a
 * model: it would let clients set _id, user, timestamps or unvalidated subfields.
 * (Not matchedData(): validating the parent `savedAttractions` array makes it
 * return the raw array with every unvalidated subfield.)
 */
export const pickCreateTripFields = (body) => {
  const { destination = {}, startDate, endDate, notes, savedAttractions = [] } = body;
  return {
    destination: {
      name: destination.name,
      country: destination.country,
      latitude: destination.latitude,
      longitude: destination.longitude,
    },
    startDate,
    endDate,
    notes,
    savedAttractions: savedAttractions.map(({ xid, name, latitude, longitude, kind, address }) => ({
      xid,
      name,
      latitude,
      longitude,
      kind,
      address,
    })),
  };
};

export const createTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.create({
    ...pickCreateTripFields(req.body),
    user: req.user._id, // ALWAYS scope to authenticated user
  });
  res.status(201).json({ trip });
});

export const listTrips = asyncHandler(async (req, res) => {
  // Newest first, no need to populate user — it's always req.user
  const trips = await Trip.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(); // .lean() = plain objects, ~5x faster reads
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

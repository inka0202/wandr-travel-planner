import { asyncHandler } from '../utils/asyncHandler.js';
import { withCache } from '../utils/cache.js';
import { parseCoord } from '../utils/parseCoord.js';
import { getAttractionsNearby } from '../services/openTripMapService.js';

export const attractions = asyncHandler(async (req, res) => {
  const lat = parseCoord(req.query.lat, 'lat', -90, 90);
  const lng = parseCoord(req.query.lng, 'lng', -180, 180);
  const radius = Math.min(Math.max(Number(req.query.radius) || 5000, 500), 20000);

  const key = `attractions:${lat.toFixed(2)},${lng.toFixed(2)}:${radius}`;
  const results = await withCache(key, 24 * 60 * 60, () =>
    getAttractionsNearby({ latitude: lat, longitude: lng, radius }),
  );

  res.json({ attractions: results });
});

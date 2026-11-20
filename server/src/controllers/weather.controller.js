import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { withCache } from '../utils/cache.js';
import { parseCoord } from '../utils/parseCoord.js';
import { isValidTimeZone } from '../utils/timezone.js';
import { getForecast } from '../services/openMeteoService.js';

export const weather = asyncHandler(async (req, res) => {
  const lat = parseCoord(req.query.lat, 'lat', -90, 90);
  const lng = parseCoord(req.query.lng, 'lng', -180, 180);
  const tz = req.query.tz || 'auto';
  if (tz !== 'auto' && !isValidTimeZone(tz)) {
    throw new ApiError(400, 'Invalid tz', 'INVALID_TZ');
  }

  const key = `weather:${lat.toFixed(2)},${lng.toFixed(2)}:${tz}`;
  const data = await withCache(key, 30 * 60, () =>
    getForecast({ latitude: lat, longitude: lng, timezone: tz }),
  );

  res.json(data);
});

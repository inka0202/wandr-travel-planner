import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { withCache } from '../utils/cache.js';
import { geocodeCity } from '../services/openMeteoService.js';

export const geocode = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) throw new ApiError(400, 'Query "q" is required', 'MISSING_QUERY');
  if (q.length > 100) throw new ApiError(400, 'Query too long', 'QUERY_TOO_LONG');

  const key = `geocode:${q.toLowerCase()}`;
  const results = await withCache(key, 7 * 24 * 60 * 60, () => geocodeCity(q));

  res.json({ results });
});

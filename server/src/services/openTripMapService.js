import { ApiError } from '../utils/ApiError.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';
import { env } from '../config/env.js';

const BASE = 'https://api.opentripmap.com/0.1/en';

/**
 * Fetch attractions within `radius` meters of (lat, lng).
 * Returns normalized list; we deliberately skip the per-XID details call
 * (which would multiply API usage by 30x) since list data has what we need.
 */
export const getAttractionsNearby = async ({ latitude, longitude, radius = 5000, limit = 30 }) => {
  if (!env.OPENTRIPMAP_API_KEY) {
    throw new ApiError(500, 'OpenTripMap API key not configured', 'CONFIG_MISSING');
  }

  const url = new URL(`${BASE}/places/radius`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('kinds', 'interesting_places');
  url.searchParams.set('rate', '2'); // 1=any, 2=good, 3=excellent
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('apikey', env.OPENTRIPMAP_API_KEY);

  const { ok, data } = await fetchWithTimeout(url);
  if (!ok || !Array.isArray(data)) {
    throw new ApiError(502, 'Attractions service unavailable', 'ATTRACTIONS_UPSTREAM');
  }

  // Filter out entries without coords or names (OpenTripMap occasionally returns these)
  return data
    .filter((p) => p.point && p.name)
    .map((p) => ({
      xid: p.xid,
      name: p.name,
      kind: p.kinds?.split(',')[0]?.replace(/_/g, ' ') ?? 'place',
      latitude: p.point.lat,
      longitude: p.point.lon,
      distance: Math.round(p.dist), // meters from search center
      rate: p.rate,
      address: '', // not in list response; would need /xid/:id call
    }));
};

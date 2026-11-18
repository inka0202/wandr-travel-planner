/**
 * Trivial in-memory TTL cache. Reset on every server restart, which is fine —
 * partial caching still cuts external API usage dramatically.
 *
 * Not safe across multiple server instances (would need Redis), but Wandr runs
 * on a single Render free-tier dyno, so single-process is fine.
 */
const store = new Map();

// Keys come from user input (geocode `q`), so cap the size. When full, evict
// the oldest insertion (FIFO via Map insertion order). Stopgap until the
// MongoDB-backed cache (audit §8 Group 4).
export const MAX_ENTRIES = 1000;

export const getCached = (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
};

export const setCached = (key, value, ttlSeconds) => {
  // Re-inserting moves the key to the end, so it counts as newest.
  store.delete(key);
  if (store.size >= MAX_ENTRIES) {
    store.delete(store.keys().next().value);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
};

/**
 * Wrapper: if cached, return it. Otherwise, run the fetch fn, cache, return.
 */
export const withCache = async (key, ttlSeconds, fetchFn) => {
  const cached = getCached(key);
  if (cached !== null) return cached;
  const value = await fetchFn();
  setCached(key, value, ttlSeconds);
  return value;
};

/**
 * Periodic cleanup so the Map doesn't grow forever
 * (Express server is long-lived; without this, expired entries accumulate)
 */
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.expiresAt) store.delete(key);
    }
  },
  10 * 60 * 1000,
).unref();

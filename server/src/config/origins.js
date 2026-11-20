// Pure parser for CLIENT_ORIGIN, kept out of env.js so it can be tested without process.exit.

/**
 * Parse a comma-separated list of allowed CORS origins.
 *
 * Each entry is trimmed and normalized to its URL origin (so a trailing slash
 * or uppercase host still matches what browsers send). Wildcards and anything
 * that isn't a bare http(s) origin are rejected, so a typo fails at startup
 * instead of silently breaking CORS.
 *
 * Returns { origins } or { error }.
 */
export const parseOrigins = (raw) => {
  if (typeof raw !== 'string') return { error: 'CLIENT_ORIGIN is missing' };

  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!entries.length) return { error: 'CLIENT_ORIGIN is empty' };

  const origins = [];
  for (const entry of entries) {
    if (entry.includes('*')) {
      return { error: `CLIENT_ORIGIN must not contain wildcards: ${entry}` };
    }
    let url;
    try {
      url = new URL(entry);
    } catch {
      return { error: `CLIENT_ORIGIN entry is not a URL: ${entry}` };
    }
    const isBareOrigin =
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash;
    if (!isBareOrigin) {
      return {
        error: `CLIENT_ORIGIN entry must be a bare http(s) origin like https://example.com: ${entry}`,
      };
    }
    if (!origins.includes(url.origin)) origins.push(url.origin);
  }
  return { origins };
};

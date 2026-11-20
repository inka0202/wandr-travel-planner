import { ApiError } from './ApiError.js';

export const DEFAULT_TIMEOUT_MS = 8000;

/**
 * GET a JSON upstream API with a hard timeout.
 *
 * The body is read inside the same timeout: the abort signal also covers
 * streaming the body, so reading it outside this try would turn a slow body
 * into an unhandled 500.
 *
 * Returns { ok, status, data }. `data` is null when the body isn't JSON.
 * Throws ApiError 504 UPSTREAM_TIMEOUT on timeout, 502 UPSTREAM_UNAVAILABLE on
 * network failure. Messages are generic: URLs may hold API keys.
 */
export const fetchWithTimeout = async (url, ms = DEFAULT_TIMEOUT_MS) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON body (e.g. an HTML error page); callers check `ok` first
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new ApiError(504, 'Upstream service timed out', 'UPSTREAM_TIMEOUT');
    }
    throw new ApiError(502, 'Upstream service unavailable', 'UPSTREAM_UNAVAILABLE');
  }
};

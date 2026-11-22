import { ApiError } from './ApiError.js';

export const DEFAULT_TIMEOUT_MS = 8000;
export const MAX_REASON_LENGTH = 200;

/**
 * Builds the log summary for a failed upstream response. Pure, so it can be
 * tested on its own.
 *
 * It never receives the URL (it may hold an API key) or anything from the
 * request. Upstream error texts can echo request params, so every value in
 * `redact` (user input, keys) is masked before the reason is cut to length.
 */
export const describeUpstreamFailure = ({
  service,
  status,
  retryAfter,
  contentType,
  data,
  redact = [],
}) => {
  let reason;
  if (data === null) {
    reason = `(non-JSON body, ${contentType || 'no content-type'})`;
  } else if (typeof data?.reason === 'string') {
    reason = data.reason; // Open-Meteo: { error: true, reason }
  } else if (typeof data?.error === 'string') {
    reason = data.error; // OpenTripMap: { error }
  }

  if (reason !== undefined) {
    for (const value of redact) {
      if (typeof value === 'string' && value) reason = reason.replaceAll(value, '[redacted]');
    }
    if (reason.length > MAX_REASON_LENGTH) reason = `${reason.slice(0, MAX_REASON_LENGTH)}…`;
  }

  return {
    service,
    status,
    ...(retryAfter && { retryAfter }),
    ...(reason !== undefined && { reason }),
  };
};

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
 *
 * With `service` set, a non-2xx or non-JSON response is logged as one
 * `[upstream]` line (status, Retry-After, upstream reason). See
 * describeUpstreamFailure for what is and isn't logged.
 */
export const fetchWithTimeout = async (
  url,
  ms = DEFAULT_TIMEOUT_MS,
  { service, redact = [] } = {},
) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON body (e.g. an HTML error page); callers check `ok` first
    }
    if (service && (!res.ok || data === null)) {
      const summary = describeUpstreamFailure({
        service,
        status: res.status,
        retryAfter: res.headers.get('retry-after'),
        contentType: res.headers.get('content-type'),
        data,
        redact,
      });
      console.warn('[upstream]', JSON.stringify(summary));
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new ApiError(504, 'Upstream service timed out', 'UPSTREAM_TIMEOUT');
    }
    throw new ApiError(502, 'Upstream service unavailable', 'UPSTREAM_UNAVAILABLE');
  }
};

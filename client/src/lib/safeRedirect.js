// No `@/` imports and no JSX: `node --test` loads this file directly.

// C0 control characters and DEL. Browsers strip tabs/newlines from URLs,
// so '/\t/evil.com' would otherwise become '//evil.com'.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * Turn a `?next=` value into a same-origin path that is safe to navigate to.
 * Anything else (absolute URLs, protocol-relative '//host', '/\host',
 * 'javascript:', control characters) falls back to `fallback`.
 *
 * @param {unknown} raw     the untrusted value, e.g. from URLSearchParams#get
 * @param {string}  origin  the app's origin, usually window.location.origin
 * @param {string}  fallback
 * @returns {string} a path starting with '/', with search and hash
 */
export const safeNext = (raw, origin, fallback = '/trips') => {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.includes('\\') || CONTROL_CHARS.test(raw)) return fallback;

  try {
    const url = new URL(raw, origin);
    if (url.origin !== new URL(origin).origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};

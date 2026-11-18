export const MAX_TZ_LENGTH = 64;

/**
 * True if `tz` is an IANA time zone name the runtime knows (e.g. 'Europe/Paris').
 * 'auto' is Open-Meteo's own value, not a zone, so callers handle it themselves.
 */
export const isValidTimeZone = (tz) => {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > MAX_TZ_LENGTH) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

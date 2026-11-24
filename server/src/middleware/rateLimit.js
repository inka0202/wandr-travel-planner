import rateLimit from 'express-rate-limit';

// One instance per route group: instances share nothing, so each group
// gets its own counter (audit §6.7). All limits are per IP.

const limited = (message) => ({
  error: { message, code: 'RATE_LIMITED' },
});

// 10 failed logins per 15 minutes. Successful logins (status < 400) don't count,
// so a user who logs in and out repeatedly is never blocked.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: limited('Too many failed login attempts. Try again in 15 minutes.'),
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false, // disable X-RateLimit-* (deprecated)
});

// 5 registrations per hour.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: limited('Too many accounts created. Try again in an hour.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// 100 trip requests per 15 minutes. Mounted before verifyJWT, so requests with
// bad tokens are counted too and can't hammer the DB user lookup.
export const tripLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: limited('Too many requests. Try again in 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// For endpoints that proxy external paid APIs.
// 30 requests per 15 minutes per IP — generous enough for real users,
// low enough to cap accidental or malicious hammering.
export const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    error: {
      message: 'Too many requests. Try again in 15 minutes.',
      code: 'RATE_LIMITED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

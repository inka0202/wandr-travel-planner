import rateLimit from 'express-rate-limit';

// Aggressive: 5 attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: {
      message: 'Too many auth attempts. Try again in 15 minutes.',
      code: 'RATE_LIMITED',
    },
  },
  standardHeaders: true,  // RateLimit-* headers
  legacyHeaders: false,   // disable X-RateLimit-* (deprecated)
});

// Moderate: 100 requests per 15 minutes per IP
// Apply in Week 3/4 for defense-in-depth on all routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

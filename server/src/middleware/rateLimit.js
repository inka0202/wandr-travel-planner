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

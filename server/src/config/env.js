import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_ORIGIN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  // True only when NODE_ENV is explicitly "development". Use this (not
  // NODE_ENV !== 'production') for anything that exposes internals.
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  PORT: Number(process.env.PORT ?? 5000),
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  OPENTRIPMAP_API_KEY: process.env.OPENTRIPMAP_API_KEY, // undefined until Day 2, validated lazily in openTripMapService.js
};

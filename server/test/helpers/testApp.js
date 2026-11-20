// Starts the real Express app against an in-memory MongoDB, with test-only env vars.
//
// Rules for test files that use this helper:
// - Call startTestApp() BEFORE importing anything that loads src/config/env.js
//   (app, db, auth middleware, generateToken, services). env.js reads process.env
//   once at import time. Use the modules returned here, or import them dynamically
//   after startTestApp() has resolved. Models don't load env.js and can be imported
//   statically.
// - Every file runs in its own process (node --test), so env vars, the cache and
//   rate-limit counters never leak between files.
// - Send each test's requests from its own fake IP via api(ip). The app trusts
//   one proxy hop, so X-Forwarded-For becomes req.ip and each IP gets its own
//   rate-limit counters. The limiters stay exactly as in production.
// - fetch is replaced by a guard. Stub it per test with
//   mock.method(globalThis, 'fetch', impl) and call mock.restoreAll() in afterEach.

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ALLOWED_ORIGIN = 'http://localhost:5173';
export const TEST_OTM_KEY = 'test-opentripmap-key';

/** URLs the app tried to fetch without a stub. Checked by assertNoRealFetch(). */
const unexpectedFetches = [];

const fetchGuard = async (url) => {
  unexpectedFetches.push(String(url));
  throw new TypeError('Real network access is blocked in tests: stub fetch with mock.method');
};

/** Call in afterEach: fails if any request reached the fetch guard. */
export const assertNoRealFetch = () => {
  if (unexpectedFetches.length) {
    const urls = unexpectedFetches.splice(0);
    throw new Error(`Unstubbed fetch call(s): ${urls.join(', ')}`);
  }
};

/**
 * @param {object} [options]
 * @param {string} [options.nodeEnv='test']  NODE_ENV for this test process
 * @param {Record<string,string>} [options.env]  extra env vars (override the defaults)
 */
export const startTestApp = async ({ nodeEnv = 'test', env = {} } = {}) => {
  // Never load server/.env (it has the dev database URI and real API keys).
  // dotenv/config reads these options from the environment.
  process.env.DOTENV_CONFIG_PATH = path.join(here, 'no-such-file.env');
  process.env.DOTENV_CONFIG_QUIET = 'true';

  const mongod = await MongoMemoryServer.create();

  Object.assign(process.env, {
    NODE_ENV: nodeEnv,
    MONGODB_URI: mongod.getUri(),
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_EXPIRES_IN: '1h',
    CLIENT_ORIGIN: ALLOWED_ORIGIN,
    OPENTRIPMAP_API_KEY: TEST_OTM_KEY,
    ...env,
  });

  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(process.env.MONGODB_URI)) {
    await mongod.stop();
    throw new Error('Refusing to run tests against a non-local database');
  }

  const { default: app } = await import('../../src/app.js');
  const { connectDB, disconnectDB } = await import('../../src/config/db.js');
  await connectDB();
  // autoIndex is off when NODE_ENV=production, so build indexes explicitly
  // (the unique email index matters for the duplicate-registration tests).
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));

  // Installed after mongod has started, so the binary download is not affected.
  globalThis.fetch = fetchGuard;

  const api = (ip = '10.255.255.1') => {
    const agent = supertest(app);
    const withIp =
      (method) =>
      (...args) =>
        agent[method](...args).set('X-Forwarded-For', ip);
    return {
      get: withIp('get'),
      post: withIp('post'),
      patch: withIp('patch'),
      delete: withIp('delete'),
      options: withIp('options'),
    };
  };

  const clearDb = async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  };

  const stop = async () => {
    await disconnectDB();
    await mongod.stop();
  };

  return { app, api, clearDb, stop, env: process.env };
};

/** A fresh fake client IP per call, so each test gets its own rate-limit counters. */
export const ipFactory = (fileNo) => {
  let n = 0;
  return () => `10.0.${fileNo}.${++n}`;
};

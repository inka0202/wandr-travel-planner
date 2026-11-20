import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  checkJwtSecret,
  JWT_SECRET_PLACEHOLDER,
  MIN_JWT_SECRET_LENGTH,
} from '../src/config/jwtSecret.js';

const SECRET = crypto.randomBytes(32).toString('hex');

// env.js reads these at import time and exits if they're missing or weak.
// dotenv never overrides variables that are already set.
process.env.JWT_SECRET = SECRET;
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/unused';
process.env.CLIENT_ORIGIN ||= 'http://localhost:5173';

describe('checkJwtSecret', () => {
  it('rejects a missing secret', () => {
    assert.equal(checkJwtSecret(undefined), 'JWT_SECRET is missing');
    assert.equal(checkJwtSecret(''), 'JWT_SECRET is missing');
  });

  it('rejects a short secret', () => {
    assert.match(checkJwtSecret('a'.repeat(MIN_JWT_SECRET_LENGTH - 1)), /at least 32/);
  });

  it('rejects the .env.example placeholder, even padded to length', () => {
    assert.match(checkJwtSecret(JWT_SECRET_PLACEHOLDER), /placeholder/);
    assert.match(checkJwtSecret(`${JWT_SECRET_PLACEHOLDER}_padding_padding`), /placeholder/);
  });

  it('accepts a long random secret, and never echoes any secret', () => {
    assert.equal(checkJwtSecret('a'.repeat(MIN_JWT_SECRET_LENGTH)), null);
    assert.equal(checkJwtSecret(SECRET), null);
    const short = 'shortsecret';
    assert.ok(!checkJwtSecret(short).includes(short));
  });
});

describe('JWT algorithm pinning', () => {
  let verifyJWT;
  let generateToken;

  before(async () => {
    ({ verifyJWT } = await import('../src/middleware/auth.js'));
    ({ generateToken } = await import('../src/utils/generateToken.js'));
  });

  // verifyJWT is wrapped in asyncHandler, so a rejected token arrives at next(err).
  const runVerify = (token) =>
    new Promise((resolve) => {
      const req = { headers: { authorization: `Bearer ${token}` } };
      verifyJWT(req, {}, resolve);
    });

  it('signs with HS256', () => {
    const token = generateToken('507f1f77bcf86cd799439011');
    assert.equal(jwt.decode(token, { complete: true }).header.alg, 'HS256');
  });

  it('rejects an HS512 token signed with the right secret', async () => {
    const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, SECRET, { algorithm: 'HS512' });
    const err = await runVerify(token);
    assert.ok(err instanceof jwt.JsonWebTokenError, String(err));
    assert.equal(err.message, 'invalid algorithm');
  });

  it("rejects an unsigned alg: 'none' token", async () => {
    const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, null, { algorithm: 'none' });
    const err = await runVerify(token);
    assert.ok(err instanceof jwt.JsonWebTokenError, String(err));
  });
});

describe('loginLimiter', () => {
  let server;
  let base;

  before(async () => {
    const { loginLimiter } = await import('../src/middleware/rateLimit.js');
    const app = express();
    app.post('/login', loginLimiter, (req, res) =>
      req.query.ok ? res.json({ ok: true }) : res.status(401).json({ ok: false }),
    );
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  it('never blocks successful logins, blocks the 11th failure', async () => {
    for (let i = 0; i < 15; i++) {
      assert.equal((await fetch(`${base}/login?ok=1`, { method: 'POST' })).status, 200);
    }
    for (let i = 0; i < 10; i++) {
      assert.equal((await fetch(`${base}/login`, { method: 'POST' })).status, 401);
    }
    const blocked = await fetch(`${base}/login`, { method: 'POST' });
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  });
});

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { startTestApp, assertNoRealFetch, ipFactory } from './helpers/testApp.js';

const ctx = await startTestApp();
const nextIp = ipFactory(1);

after(() => ctx.stop());
afterEach(() => assertNoRealFetch());

let emailNo = 0;
const newEmail = () => `user${++emailNo}@example.com`;
const PASSWORD = 'correct-horse-battery';

const register = (api, email = newEmail(), password = PASSWORD) =>
  api.post('/api/auth/register').send({ email, password, displayName: 'Tester' });

describe('POST /api/auth/register', () => {
  it('creates the user and returns a token, never the password hash', async () => {
    const email = newEmail();
    const res = await register(ctx.api(nextIp()), email);
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.displayName, 'Tester');
    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.passwordHash, undefined);
    assert.ok(!JSON.stringify(res.body).includes(PASSWORD));
  });

  it('rejects a duplicate email with 409 EMAIL_EXISTS', async () => {
    const api = ctx.api(nextIp());
    const email = newEmail();
    assert.equal((await register(api, email)).status, 201);
    const res = await register(api, email.toUpperCase());
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_EXISTS');
  });

  it('rejects invalid input with 400 VALIDATION_ERROR', async () => {
    const api = ctx.api(nextIp());
    for (const body of [
      { email: 'not-an-email', password: PASSWORD },
      { email: newEmail(), password: 'short' },
      { email: newEmail(), password: 'x'.repeat(129) },
      { email: newEmail(), password: PASSWORD, displayName: 'x'.repeat(61) },
    ]) {
      const res = await api.post('/api/auth/register').send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });
});

describe('POST /api/auth/login', () => {
  const email = newEmail();
  before(async () => {
    assert.equal((await register(ctx.api(nextIp()), email)).status, 201);
  });

  it('logs in with the right password', async () => {
    const res = await ctx.api(nextIp()).post('/api/auth/login').send({ email, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.passwordHash, undefined);
    assert.equal(typeof res.body.token, 'string');
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const api = ctx.api(nextIp());
    const wrongPassword = await api
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' });
    const unknownEmail = await api
      .post('/api/auth/login')
      .send({ email: newEmail(), password: PASSWORD });
    for (const res of [wrongPassword, unknownEmail]) {
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
      assert.equal(res.body.token, undefined);
    }
    assert.equal(wrongPassword.body.error.message, unknownEmail.body.error.message);
  });

  it('never blocks successful logins (12 in a row from one IP)', async () => {
    const api = ctx.api(nextIp());
    for (let i = 1; i <= 12; i++) {
      const res = await api.post('/api/auth/login').send({ email, password: PASSWORD });
      assert.equal(res.status, 200, `login #${i}`);
    }
  });

  it('blocks the 11th failed login from one IP, but not other IPs', async () => {
    const attacker = ctx.api(nextIp());
    for (let i = 1; i <= 10; i++) {
      const res = await attacker.post('/api/auth/login').send({ email, password: 'wrong' });
      assert.equal(res.status, 401, `failure #${i}`);
    }
    const blocked = await attacker.post('/api/auth/login').send({ email, password: PASSWORD });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'RATE_LIMITED');

    const other = await ctx
      .api(nextIp())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    assert.equal(other.status, 200);
  });
});

describe('GET /api/auth/me', () => {
  let token;
  let userId;
  before(async () => {
    const res = await register(ctx.api(nextIp()));
    token = res.body.token;
    userId = res.body.user._id;
  });

  it('returns the user for a valid token', async () => {
    const res = await ctx.api(nextIp()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user._id, userId);
    assert.equal(res.body.user.passwordHash, undefined);
  });

  it('401 NO_TOKEN without a token or with a non-Bearer header', async () => {
    const api = ctx.api(nextIp());
    for (const header of [undefined, token, `Basic ${token}`]) {
      const req = api.get('/api/auth/me');
      if (header) req.set('Authorization', header);
      const res = await req;
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'NO_TOKEN');
    }
  });

  it('401 for a garbage token', async () => {
    const res = await ctx
      .api(nextIp())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.jwt');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });

  it('401 TOKEN_EXPIRED for an expired token', async () => {
    const expired = jwt.sign({ sub: userId }, ctx.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    const res = await ctx
      .api(nextIp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
  });

  it('401 for a token signed with another secret', async () => {
    const forged = jwt.sign({ sub: userId }, 'x'.repeat(64), { algorithm: 'HS256' });
    const res = await ctx
      .api(nextIp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forged}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });

  it('401 for an HS512 token signed with the real secret', async () => {
    const hs512 = jwt.sign({ sub: userId }, ctx.env.JWT_SECRET, { algorithm: 'HS512' });
    const res = await ctx.api(nextIp()).get('/api/auth/me').set('Authorization', `Bearer ${hs512}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });

  it("401 for an unsigned alg: 'none' token", async () => {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: userId })}.`;
    const res = await ctx.api(nextIp()).get('/api/auth/me').set('Authorization', `Bearer ${none}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });

  it('401 USER_NOT_FOUND for a valid token of a deleted user', async () => {
    const res1 = await register(ctx.api(nextIp()));
    await mongoose.connection.collection('users').deleteOne({
      _id: new mongoose.Types.ObjectId(res1.body.user._id),
    });
    const res = await ctx
      .api(nextIp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res1.body.token}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'USER_NOT_FOUND');
  });
});

describe('POST /api/auth/logout', () => {
  it('requires a token and returns 200 with one', async () => {
    const api = ctx.api(nextIp());
    const { token } = (await register(api)).body;
    assert.equal((await api.post('/api/auth/logout')).status, 401);
    const res = await api.post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
  });
});

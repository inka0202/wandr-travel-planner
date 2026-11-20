import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseOrigins } from '../src/config/origins.js';

describe('parseOrigins', () => {
  it('parses a single origin', () => {
    assert.deepEqual(parseOrigins('http://localhost:5173'), { origins: ['http://localhost:5173'] });
  });

  it('splits on commas, trims, skips empty entries and duplicates', () => {
    assert.deepEqual(
      parseOrigins(' https://wandr.vercel.app , http://localhost:5173,,https://wandr.vercel.app '),
      { origins: ['https://wandr.vercel.app', 'http://localhost:5173'] },
    );
  });

  it('normalizes a trailing slash and host case to what browsers send', () => {
    assert.deepEqual(parseOrigins('https://Wandr.Vercel.app/'), {
      origins: ['https://wandr.vercel.app'],
    });
  });

  it('rejects missing or empty values', () => {
    assert.ok(parseOrigins(undefined).error);
    assert.ok(parseOrigins('').error);
    assert.ok(parseOrigins(' , ,').error);
  });

  it('rejects wildcards anywhere in the list', () => {
    assert.match(parseOrigins('*').error, /wildcard/);
    assert.match(parseOrigins('http://localhost:5173, *').error, /wildcard/);
    assert.match(parseOrigins('https://*.vercel.app').error, /wildcard/);
  });

  it('rejects anything that is not a bare http(s) origin', () => {
    for (const bad of [
      'wandr.vercel.app', // no scheme
      'ftp://wandr.vercel.app',
      'https://wandr.vercel.app/app',
      'https://wandr.vercel.app?x=1',
      'https://wandr.vercel.app#x',
      'https://user:pass@wandr.vercel.app',
      'null',
    ]) {
      assert.ok(parseOrigins(bad).error, bad);
    }
  });
});

describe('CORS on the real app', () => {
  const ALLOWED = 'https://wandr.example';
  let server;
  let base;

  before(async () => {
    // env.js reads these at import time; dotenv never overrides variables already set.
    process.env.CLIENT_ORIGIN = `${ALLOWED}/, http://localhost:5173`;
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/unused';
    process.env.NODE_ENV = 'test'; // quiet morgan's dev format a bit; no DB is touched
    const { default: app } = await import('../src/app.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  const allowOrigin = async (origin, method = 'GET') => {
    const res = await fetch(`${base}/health`, {
      method,
      headers: {
        Origin: origin,
        ...(method === 'OPTIONS' && { 'Access-Control-Request-Method': 'POST' }),
      },
    });
    return res.headers.get('access-control-allow-origin');
  };

  it('echoes each allowed origin', async () => {
    assert.equal(await allowOrigin(ALLOWED), ALLOWED);
    assert.equal(await allowOrigin('http://localhost:5173'), 'http://localhost:5173');
    assert.equal(await allowOrigin(ALLOWED, 'OPTIONS'), ALLOWED);
  });

  it('sends no allow-origin header for a foreign origin', async () => {
    assert.equal(await allowOrigin('https://evil.example'), null);
    assert.equal(await allowOrigin('https://evil.example', 'OPTIONS'), null);
    // exact match only: no prefix/suffix tricks
    assert.equal(await allowOrigin(`${ALLOWED}.evil.example`), null);
    assert.equal(await allowOrigin('https://sub.wandr.example'), null);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../src/lib/safeRedirect.js';

const ORIGIN = 'https://wandr.example';
const FALLBACK = '/trips';

describe('safeNext', () => {
  it('rejects open-redirect payloads', () => {
    for (const raw of [
      '//evil.com',
      '/\\evil.com',
      '\\\\evil.com',
      'https://evil.com',
      'http://evil.com/trips',
      `${ORIGIN}.evil.com/`,
      '/\t/evil.com', // browsers strip the tab → '//evil.com'
      '/\n/evil.com',
      '/\r/evil.com',
      '/\u0000/evil.com',
      'javascript:alert(1)',
      ' /trips', // leading space: doesn't start with '/'
      'trips',
    ]) {
      assert.equal(safeNext(raw, ORIGIN), FALLBACK, JSON.stringify(raw));
    }
  });

  it('keeps encoded slashes on our own origin', () => {
    // Stays a same-origin path (at worst our 404 page); never becomes '//evil.com'.
    const result = safeNext('/%2F%2Fevil.com', ORIGIN);
    assert.ok(result.startsWith('/') && !result.startsWith('//'), result);
    assert.equal(new URL(result, ORIGIN).origin, ORIGIN);
  });

  it('falls back on empty or missing values', () => {
    for (const raw of ['', null, undefined, 42, ['/trips']]) {
      assert.equal(safeNext(raw, ORIGIN), FALLBACK, String(raw));
    }
  });

  it('allows same-origin paths with search and hash', () => {
    assert.equal(safeNext('/search?x=1', ORIGIN), '/search?x=1');
    assert.equal(
      safeNext('/search?name=Paris&lat=48.85&lng=2.35&tz=Europe%2FParis', ORIGIN),
      '/search?name=Paris&lat=48.85&lng=2.35&tz=Europe%2FParis',
    );
    assert.equal(safeNext('/trips/abc123#notes', ORIGIN), '/trips/abc123#notes');
    assert.equal(safeNext('/', ORIGIN), '/');
  });

  it('uses the given fallback, and falls back if origin is unusable', () => {
    assert.equal(safeNext('//evil.com', ORIGIN, '/'), '/');
    assert.equal(safeNext('/trips/1', 'not a url'), FALLBACK);
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parseCoord } from '../src/utils/parseCoord.js';
import { isValidTimeZone, MAX_TZ_LENGTH } from '../src/utils/timezone.js';
import { getCached, setCached, MAX_ENTRIES } from '../src/utils/cache.js';
import {
  fetchWithTimeout,
  describeUpstreamFailure,
  MAX_REASON_LENGTH,
} from '../src/utils/fetchWithTimeout.js';

const rejectsCoord = (val) =>
  assert.throws(
    () => parseCoord(val, 'lat', -90, 90),
    (err) =>
      err.statusCode === 400 && err.message === 'Invalid lat' && err.code === 'INVALID_COORD',
    `should reject ${JSON.stringify(val)}`,
  );

describe('parseCoord', () => {
  it('rejects empty, whitespace and non-numbers without echoing them', () => {
    for (const val of ['', ' ', '\t', 'abc', '12abc', '0x10', '1e1', 'Infinity', 'NaN', '.', '-']) {
      rejectsCoord(val);
    }
  });

  it('rejects non-string input (missing or repeated query params)', () => {
    for (const val of [undefined, null, ['1', '2'], 12]) rejectsCoord(val);
  });

  it('rejects out-of-bounds values', () => {
    rejectsCoord('90.0001');
    rejectsCoord('-90.5');
    assert.throws(() => parseCoord('180.1', 'lng', -180, 180), { message: 'Invalid lng' });
  });

  it('accepts valid values, including the bounds', () => {
    assert.equal(parseCoord('52.2297', 'lat', -90, 90), 52.2297);
    assert.equal(parseCoord('-33.9', 'lat', -90, 90), -33.9);
    assert.equal(parseCoord('+10', 'lat', -90, 90), 10);
    assert.equal(parseCoord('0', 'lat', -90, 90), 0);
    assert.equal(parseCoord('.5', 'lat', -90, 90), 0.5);
    assert.equal(parseCoord('90', 'lat', -90, 90), 90);
    assert.equal(parseCoord('-180', 'lng', -180, 180), -180);
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones', () => {
    for (const tz of ['Europe/Paris', 'America/New_York', 'Asia/Kolkata', 'UTC']) {
      assert.equal(isValidTimeZone(tz), true, tz);
    }
  });

  it("does not treat 'auto' as a zone (the caller handles it)", () => {
    assert.equal(isValidTimeZone('auto'), false);
  });

  it('rejects junk, empty, non-strings and very long strings', () => {
    for (const tz of ['Mars/Olympus', 'not a zone', '../../etc', '', undefined, null, ['UTC']]) {
      assert.equal(isValidTimeZone(tz), false, String(tz));
    }
    assert.equal(isValidTimeZone('A'.repeat(MAX_TZ_LENGTH + 1)), false);
    assert.equal(isValidTimeZone(`Europe/Paris${'x'.repeat(10_000)}`), false);
  });
});

describe('cache size cap', () => {
  it('evicts the oldest entry when full', () => {
    for (let i = 0; i <= MAX_ENTRIES; i++) setCached(`cap:${i}`, i, 60);
    assert.equal(getCached('cap:0'), null, 'oldest evicted');
    assert.equal(getCached('cap:1'), 1);
    assert.equal(getCached(`cap:${MAX_ENTRIES}`), MAX_ENTRIES);
  });

  it('re-setting a key makes it the newest', () => {
    setCached('cap:1', 'again', 60); // cap:1 was the oldest; now cap:2 is
    setCached('cap:new', 'x', 60);
    assert.equal(getCached('cap:1'), 'again');
    assert.equal(getCached('cap:2'), null);
  });
});

describe('fetchWithTimeout', () => {
  let server;
  let base;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/json') {
        res.setHeader('content-type', 'application/json');
        res.end('{"a":1}');
      } else if (req.url === '/html500') {
        res.statusCode = 500;
        res.end('<html>oops</html>');
      } else if (req.url === '/slow-body') {
        res.write('{"a":'); // headers sent, body never finishes
      }
      // '/hang': never responds
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  it('returns parsed JSON', async () => {
    assert.deepEqual(await fetchWithTimeout(`${base}/json`), {
      ok: true,
      status: 200,
      data: { a: 1 },
    });
  });

  it('returns data: null for a non-JSON error body', async () => {
    assert.deepEqual(await fetchWithTimeout(`${base}/html500`), {
      ok: false,
      status: 500,
      data: null,
    });
  });

  it('maps a hanging response to 504 UPSTREAM_TIMEOUT', async () => {
    await assert.rejects(fetchWithTimeout(`${base}/hang`, 100), {
      statusCode: 504,
      code: 'UPSTREAM_TIMEOUT',
    });
  });

  it('maps a body that stalls mid-stream to 504 too', async () => {
    await assert.rejects(fetchWithTimeout(`${base}/slow-body`, 100), {
      statusCode: 504,
      code: 'UPSTREAM_TIMEOUT',
    });
  });

  it('does not log without a service label, even on failure', async (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    await fetchWithTimeout(`${base}/html500`);
    assert.equal(warn.mock.callCount(), 0);
  });

  it('maps a network failure to 502 UPSTREAM_UNAVAILABLE', async () => {
    // Port 1 on loopback: connection refused.
    await assert.rejects(fetchWithTimeout('http://127.0.0.1:1/', 2000), {
      statusCode: 502,
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });
});

describe('describeUpstreamFailure', () => {
  const base = { service: 's', status: 429 };

  it('prefers `reason`, falls back to a string `error`, else no reason', () => {
    assert.equal(
      describeUpstreamFailure({ ...base, data: { reason: 'r', error: true } }).reason,
      'r',
    );
    assert.equal(describeUpstreamFailure({ ...base, data: { error: 'e' } }).reason, 'e');
    assert.deepEqual(describeUpstreamFailure({ ...base, data: { error: true } }), base);
    assert.deepEqual(describeUpstreamFailure({ ...base, data: [] }), base);
  });

  it('marks a non-JSON body with its content type', () => {
    assert.equal(
      describeUpstreamFailure({ ...base, data: null, contentType: 'text/html' }).reason,
      '(non-JSON body, text/html)',
    );
    assert.equal(
      describeUpstreamFailure({ ...base, data: null }).reason,
      '(non-JSON body, no content-type)',
    );
  });

  it('includes Retry-After only when present', () => {
    assert.equal(describeUpstreamFailure({ ...base, data: {}, retryAfter: '30' }).retryAfter, '30');
    assert.ok(!('retryAfter' in describeUpstreamFailure({ ...base, data: {}, retryAfter: null })));
  });

  it('redacts every given value (ignoring empty ones) before cutting to length', () => {
    const out = describeUpstreamFailure({
      ...base,
      data: { reason: 'key=SECRET lat=1.5 SECRET' },
      redact: ['SECRET', '1.5', '', undefined],
    });
    assert.equal(out.reason, 'key=[redacted] lat=[redacted] [redacted]');

    // A secret straddling the cut point must not survive half-cut.
    const long = describeUpstreamFailure({
      ...base,
      data: { reason: `${'a'.repeat(MAX_REASON_LENGTH - 3)}SECRET` },
      redact: ['SECRET'],
    });
    assert.ok(!long.reason.includes('SEC'));
    assert.equal(long.reason.length, MAX_REASON_LENGTH + 1);
  });
});

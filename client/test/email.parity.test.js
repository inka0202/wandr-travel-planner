// The Register form's email pattern (src/lib/email.js) is a copy of the server's
// (server/src/utils/email.js, used by the User model). The server is the source of truth: this test
// fails if the copies drift. The server file is imported by relative path, so it must stay pure.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_RE as client } from '../src/lib/email.js';
import { EMAIL_RE as server } from '../../server/src/utils/email.js';

// Edge cases from the Group 3 comparison with express-validator's isEmail (audit §8).
// The regex is looser than isEmail: the rows marked "isEmail rejects" pass here and are
// refused by the server on register. Login has no client pattern.
const CASES = [
  ['a@b.co', true],
  ['ab@gmail.com', true],
  ['ä@b.com', true],
  ['a@bücher.de', true],
  ['a@b.c', true], // isEmail rejects (TLD too short)
  ['a@b.123', true], // isEmail rejects (numeric TLD)
  ['a@b.com.', true], // isEmail rejects (trailing dot)
  ['.a@b.com', true], // isEmail rejects
  ['a..b@b.com', true], // isEmail rejects
  ['a<b>@b.com', true], // isEmail rejects
  ['a@[1.2.3.4]', true], // isEmail rejects (IP domain)
  ['"a b"@b.com', false], // isEmail accepts, the User model refuses: no such account can exist
  ['"a@b"@c.com', false], // same
  ['a b@b.com', false],
  [' a@b.com', false],
  ['a@b.com ', false],
  ['a@localhost', false],
  ['a@@b.com', false],
  ['@b.com', false],
  ['a@', false],
  ['', false],
];

describe('client/server email regex parity', () => {
  it('same pattern and flags', () => {
    assert.equal(client.source, server.source);
    assert.equal(client.flags, server.flags);
  });

  it('same answers on the edge cases', () => {
    for (const [input, expected] of CASES) {
      assert.equal(server.test(input), expected, `server: ${JSON.stringify(input)}`);
      assert.equal(client.test(input), expected, `client: ${JSON.stringify(input)}`);
    }
  });
});

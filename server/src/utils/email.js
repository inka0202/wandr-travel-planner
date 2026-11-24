// The one email regex: a loose shape check (something@something.something, no spaces).
// The real rule for new accounts is express-validator's isEmail() in auth.validators.js; this
// regex only backs it up on the User model. The browser has a copy in client/src/lib/email.js.
// Keep this file pure (no env, no npm imports): client/test/email.parity.test.js imports it
// by relative path, outside the server package.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

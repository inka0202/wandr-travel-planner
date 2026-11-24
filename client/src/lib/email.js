// No `@/` imports and no JSX: `node --test` loads this file directly.
//
// Copy of EMAIL_RE in server/src/utils/email.js; the server is the source of truth.
// client/test/email.parity.test.js fails if the copies drift: change both sides together.
// It's a loose shape check for the Register form. The server's isEmail() is stricter and has the
// final say (e.g. 'a@b.c' passes here and is rejected there). Login uses no pattern on purpose:
// it must never be stricter than what existing accounts were registered with.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

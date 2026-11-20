import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createErrorHandler } from '../src/middleware/errorHandler.js';
import { ApiError } from '../src/utils/ApiError.js';

const prod = createErrorHandler({ isDevelopment: false });
const dev = createErrorHandler({ isDevelopment: true });

const run = (handler, err) => {
  const res = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  handler(err, {}, res, () => {});
  return { status: res.statusCode, error: res.body.error };
};

// A throwaway model for producing real Mongoose ValidationErrors (no DB needed)
const Probe = mongoose.model(
  'ErrorHandlerProbe',
  new mongoose.Schema({
    title: { type: String, maxlength: 5 }, // built-in message includes the value
    kind: { type: String, enum: ['park'] }, // built-in message includes the value
    count: Number, // cast error
    note: { type: String, maxlength: [3, 'note too long'] }, // custom message
    name: { type: String, required: true }, // built-in, no value
  }),
);

const SECRET_INPUT = 'evil<script>';

beforeEach(() => {
  mock.restoreAll();
  mock.method(console, 'error', () => {}); // silence the [5xx] log
});

describe('errorHandler: 5xx', () => {
  it('hides the raw message and stack of an unexpected error in production', () => {
    const { status, error } = run(prod, new Error('connect ECONNREFUSED 10.0.0.5:27017'));
    assert.equal(status, 500);
    assert.deepEqual(error, { message: 'Internal Server Error' });
  });

  it('hides operational 5xx messages in production but keeps our code', () => {
    const err = new ApiError(500, 'OpenTripMap API key not configured', 'CONFIG_MISSING');
    const { status, error } = run(prod, err);
    assert.equal(status, 500);
    assert.deepEqual(error, { message: 'Internal Server Error', code: 'CONFIG_MISSING' });
  });

  it('keeps 502 status for upstream ApiErrors', () => {
    const err = new ApiError(502, 'Weather service unavailable', 'WEATHER_UPSTREAM');
    assert.equal(run(prod, err).status, 502);
  });

  it('does not forward library error codes', () => {
    const err = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    assert.equal(run(prod, err).error.code, undefined);
  });

  it('shows the real message and stack only in development', () => {
    const { error } = run(dev, new Error('boom'));
    assert.equal(error.message, 'boom');
    assert.match(error.stack, /boom/);
  });

  it('logs every 5xx', () => {
    run(prod, new Error('boom'));
    assert.equal(console.error.mock.callCount(), 1);
  });
});

describe('errorHandler: 4xx', () => {
  it('passes ApiError 4xx messages and codes through', () => {
    const { status, error } = run(prod, new ApiError(404, 'Trip not found', 'TRIP_NOT_FOUND'));
    assert.equal(status, 404);
    assert.deepEqual(error, { message: 'Trip not found', code: 'TRIP_NOT_FOUND' });
  });

  it('never sends a stack outside development, even for 4xx', () => {
    assert.equal(run(prod, new ApiError(400, 'bad', 'X')).error.stack, undefined);
  });

  it('CastError does not echo the value', () => {
    const err = new mongoose.Error.CastError('ObjectId', SECRET_INPUT, '_id');
    const { status, error } = run(prod, err);
    assert.equal(status, 400);
    assert.deepEqual(error, { message: 'Invalid _id', code: 'INVALID_ID' });
  });

  it('ValidationError hides values in built-in messages, keeps custom ones', () => {
    const err = new Probe({
      title: SECRET_INPUT,
      kind: SECRET_INPUT,
      count: SECRET_INPUT,
      note: 'abcd', // must not appear in "note too long", or it is redacted too (by design)
    }).validateSync();
    const { status, error } = run(prod, err);
    assert.equal(status, 400);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.ok(!error.message.includes(SECRET_INPUT), error.message);
    assert.match(error.message, /Invalid title/);
    assert.match(error.message, /Invalid kind/);
    assert.match(error.message, /Invalid count/);
    assert.match(error.message, /note too long/);
    assert.match(error.message, /Path `name` is required/);
  });

  it('duplicate key reports the field, not the value', () => {
    const err = { code: 11000, keyValue: { email: 'victim@example.com' } };
    const { status, error } = run(prod, err);
    assert.equal(status, 409);
    assert.deepEqual(error, { message: 'email already in use', code: 'DUPLICATE_KEY' });
  });

  it('maps JWT errors to 401', () => {
    const expired = run(prod, new jwt.TokenExpiredError('jwt expired', new Date()));
    assert.equal(expired.status, 401);
    assert.equal(expired.error.code, 'TOKEN_EXPIRED');

    const invalid = run(prod, new jwt.JsonWebTokenError('invalid signature'));
    assert.equal(invalid.status, 401);
    assert.equal(invalid.error.code, 'INVALID_TOKEN');
  });

  it('malformed JSON body does not echo the body', () => {
    // Shape of the error express.json() / body-parser throws
    const err = Object.assign(new SyntaxError(`Unexpected token 'e', "${SECRET_INPUT}" is not valid JSON`), {
      type: 'entity.parse.failed',
      status: 400,
      statusCode: 400,
    });
    const { status, error } = run(prod, err);
    assert.equal(status, 400);
    assert.deepEqual(error, { message: 'Malformed JSON body', code: 'INVALID_JSON' });
  });
});

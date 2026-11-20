import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';

const GENERIC_5XX = 'Internal Server Error';

// Never echo user input: cast errors, and any sub-error whose message contains
// the submitted value (built-in maxlength/enum/match messages do), are reduced
// to the path. Custom messages without the value pass through.
const describeValidationError = (e) => {
  if (e instanceof mongoose.Error.CastError) return `Invalid ${e.path}`;
  const value = e.value == null ? '' : String(e.value);
  return value && e.message.includes(value) ? `Invalid ${e.path}` : e.message;
};

/**
 * Global error handler. MUST be registered last in app.js.
 *
 * isDevelopment must be true only when NODE_ENV is explicitly "development".
 * Otherwise (production, test, unset) 5xx messages are generic and stacks are
 * never sent, so a missing NODE_ENV on the host can't leak internals.
 */
export const createErrorHandler =
  ({ isDevelopment = false } = {}) =>
  // eslint-disable-next-line no-unused-vars
  (err, req, res, next) => {
    let status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
    let message = err.message || GENERIC_5XX;
    // Only our own codes are sent; raw codes from libraries (ECONNRESET, etc.) are internal.
    let code = err instanceof ApiError ? err.code : undefined;

    if (err instanceof mongoose.Error.ValidationError) {
      status = 400;
      code = 'VALIDATION_ERROR';
      message = Object.values(err.errors).map(describeValidationError).join('; ');
    } else if (err instanceof mongoose.Error.CastError) {
      status = 400;
      code = 'INVALID_ID';
      message = `Invalid ${err.path}`;
    } else if (err.code === 11000) {
      status = 409;
      code = 'DUPLICATE_KEY';
      const field = Object.keys(err.keyValue || {})[0] ?? 'field';
      message = `${field} already in use`;
    } else if (err instanceof jwt.TokenExpiredError) {
      status = 401;
      code = 'TOKEN_EXPIRED';
      message = 'Session expired, please log in again';
    } else if (err instanceof jwt.JsonWebTokenError) {
      status = 401;
      code = 'INVALID_TOKEN';
      message = 'Invalid or malformed token';
    } else if (err.type === 'entity.parse.failed') {
      // express.json(): the SyntaxError message quotes part of the request body
      status = 400;
      code = 'INVALID_JSON';
      message = 'Malformed JSON body';
    }

    if (status >= 500) {
      console.error('[5xx]', err);
      if (!isDevelopment) message = GENERIC_5XX;
    }

    res.status(status).json({
      error: {
        message,
        ...(code && { code }),
        ...(isDevelopment && { stack: err.stack }),
      },
    });
  };

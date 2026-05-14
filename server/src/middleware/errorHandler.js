import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400; code = 'VALIDATION_ERROR';
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; code = 'INVALID_ID'; message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {})[0] ?? 'field';
    message = `${field} already in use`;
  } else if (err instanceof jwt.TokenExpiredError) {
    status = 401; code = 'TOKEN_EXPIRED'; message = 'Session expired, please log in again';
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = 401; code = 'INVALID_TOKEN'; message = 'Invalid or malformed token';
  }

  if (status >= 500) console.error('[5xx]', err);

  res.status(status).json({
    error: {
      message,
      ...(code && { code }),
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};

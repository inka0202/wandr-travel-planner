import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  // Only the first error's message is returned (code VALIDATION_ERROR); the full list is not sent.
  const first = errors.array()[0];
  throw new ApiError(400, first.msg, 'VALIDATION_ERROR');
};

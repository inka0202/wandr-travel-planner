import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  // First error's message; full array on `details` for debugging
  const first = errors.array()[0];
  throw new ApiError(400, first.msg, 'VALIDATION_ERROR');
};

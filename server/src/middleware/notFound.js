import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, res, next) => {
  // Don't echo req.originalUrl: it is user input
  next(new ApiError(404, 'Not found', 'NOT_FOUND'));
};

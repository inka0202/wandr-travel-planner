import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required', 'NO_TOKEN');
  }
  const token = header.slice(7); // strip "Bearer "

  // jwt.verify throws TokenExpiredError or JsonWebTokenError;
  // the global errorHandler from Week 1 already maps these to 401
  const decoded = jwt.verify(token, env.JWT_SECRET);

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'User no longer exists', 'USER_NOT_FOUND');
  }
  req.user = user;
  next();
});

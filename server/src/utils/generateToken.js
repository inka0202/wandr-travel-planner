import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Pinned on both sign and verify, so a token can't pick its own algorithm.
export const JWT_ALGORITHM = 'HS256';

export const generateToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  });

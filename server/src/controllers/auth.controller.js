import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const SALT_ROUNDS = 12;

export const register = asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body;

  // Pre-check before expensive bcrypt hash; also gives a specific EMAIL_EXISTS code
  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'Email already in use', 'EMAIL_EXISTS');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, passwordHash, displayName });

  const token = generateToken(user._id);
  // user.toJSON() strips passwordHash via the schema transform
  res.status(201).json({ user, token });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // +passwordHash because the schema has select: false on it
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const token = generateToken(user._id);
  res.json({ user, token });
});

export const me = asyncHandler(async (req, res) => {
  // verifyJWT already attached req.user
  res.json({ user: req.user });
});

export const logout = asyncHandler(async (req, res) => {
  // localStorage auth: logout is client-side (clear token). Server returns 200
  // so the client has a consistent flow and a hook for a future blacklist.
  res.json({ message: 'Logged out' });
});

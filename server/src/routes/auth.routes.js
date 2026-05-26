import { Router } from 'express';
import { register, login, me, logout } from '../controllers/auth.controller.js';
import { registerValidator, loginValidator } from '../validators/auth.validators.js';
import { validate } from '../middleware/validate.js';
import { verifyJWT } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Public, rate-limited
router.post('/register', authLimiter, registerValidator, validate, register);
router.post('/login',    authLimiter, loginValidator,    validate, login);

// Protected
router.get('/me',      verifyJWT, me);
router.post('/logout', verifyJWT, logout);

export default router;

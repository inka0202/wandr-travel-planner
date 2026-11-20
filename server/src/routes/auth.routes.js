import { Router } from 'express';
import { register, login, me, logout } from '../controllers/auth.controller.js';
import { registerValidator, loginValidator } from '../validators/auth.validators.js';
import { validate } from '../middleware/validate.js';
import { verifyJWT } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Public, rate-limited
router.post('/register', registerLimiter, registerValidator, validate, register);
router.post('/login', loginLimiter, loginValidator, validate, login);

// Protected
router.get('/me', verifyJWT, me);
router.post('/logout', verifyJWT, logout);

export default router;

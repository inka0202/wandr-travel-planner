import { Router } from 'express';
import { weather } from '../controllers/weather.controller.js';
import { publicApiLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(publicApiLimiter);
router.get('/', weather);
export default router;

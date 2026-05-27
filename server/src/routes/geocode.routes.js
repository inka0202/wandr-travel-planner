import { Router } from 'express';
import { geocode } from '../controllers/geocode.controller.js';
import { publicApiLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(publicApiLimiter);
router.get('/', geocode);
export default router;

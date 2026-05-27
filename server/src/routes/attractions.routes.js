import { Router } from 'express';
import { attractions } from '../controllers/attractions.controller.js';
import { publicApiLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(publicApiLimiter);
router.get('/', attractions);
export default router;

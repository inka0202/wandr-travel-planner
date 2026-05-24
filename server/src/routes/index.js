import { Router } from 'express';
import authRoutes from './auth.routes.js';
import tripRoutes from './trip.routes.js';
import weatherRoutes from './weather.routes.js';
import attractionsRoutes from './attractions.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/trips', tripRoutes);
router.use('/weather', weatherRoutes);
router.use('/attractions', attractionsRoutes);

export default router;

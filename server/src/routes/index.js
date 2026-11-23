import { Router } from 'express';
import authRoutes from './auth.routes.js';
import geocodeRoutes from './geocode.routes.js';
import weatherRoutes from './weather.routes.js';
import attractionsRoutes from './attractions.routes.js';
import tripRoutes from './trip.routes.js';

// The health check is GET /health in app.js (Render health check + UptimeRobot), not under /api.
const router = Router();

router.use('/auth', authRoutes);
router.use('/geocode', geocodeRoutes);
router.use('/weather', weatherRoutes);
router.use('/attractions', attractionsRoutes);
router.use('/trips', tripRoutes);

export default router;

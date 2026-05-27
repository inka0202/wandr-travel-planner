import { Router } from 'express';
import authRoutes from './auth.routes.js';
import geocodeRoutes from './geocode.routes.js';
import weatherRoutes from './weather.routes.js';
import attractionsRoutes from './attractions.routes.js';
// import tripRoutes from './trip.routes.js'; // Week 3 Day 3

const router = Router();

router.get('/health', (req, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }),
);

router.use('/auth', authRoutes);
router.use('/geocode', geocodeRoutes);
router.use('/weather', weatherRoutes);
router.use('/attractions', attractionsRoutes);
// router.use('/trips', tripRoutes);

export default router;

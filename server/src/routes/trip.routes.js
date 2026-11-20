import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { tripLimiter } from '../middleware/rateLimit.js';
import {
  createTrip,
  listTrips,
  getTrip,
  updateNotes,
  deleteTrip,
} from '../controllers/trip.controller.js';
import {
  createTripValidator,
  tripIdValidator,
  updateNotesValidator,
} from '../validators/trip.validators.js';

const router = Router();

// Rate limit first (also counts bad tokens), then require authentication
router.use(tripLimiter);
router.use(verifyJWT);

router.get('/', listTrips);
router.post('/', createTripValidator, validate, createTrip);
router.get('/:id', tripIdValidator, validate, getTrip);
router.patch('/:id', updateNotesValidator, validate, updateNotes);
router.delete('/:id', tripIdValidator, validate, deleteTrip);

export default router;

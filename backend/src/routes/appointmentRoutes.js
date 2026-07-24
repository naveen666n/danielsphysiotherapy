import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { publicBookingSchema, appointmentUpdateSchema } from '../validators/appointmentValidators.js';
import { bookingLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/public', bookingLimiter, validate(publicBookingSchema), appointmentController.createPublic);
router.get('/', authenticate, authorize('admin', 'staff'), appointmentController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), appointmentController.getOne);
router.patch('/:id', authenticate, authorize('admin', 'staff'), validate(appointmentUpdateSchema), appointmentController.update);
router.delete('/:id', authenticate, authorize('admin'), appointmentController.remove);

export default router;

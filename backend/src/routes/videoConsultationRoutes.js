import { Router } from 'express';
import * as videoConsultationController from '../controllers/videoConsultationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import {
  createOrderSchema,
  verifyPaymentSchema,
  updateConsultationSchema,
} from '../validators/videoConsultationValidators.js';
import { videoConsultationLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/orders', videoConsultationLimiter, validate(createOrderSchema), videoConsultationController.createOrder);
router.post('/:id/verify', videoConsultationLimiter, validate(verifyPaymentSchema), videoConsultationController.verifyPayment);
router.get('/', authenticate, authorize('admin', 'staff'), videoConsultationController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), videoConsultationController.getOne);
router.patch(
  '/:id',
  authenticate,
  authorize('admin', 'staff'),
  validate(updateConsultationSchema),
  videoConsultationController.update
);

export default router;

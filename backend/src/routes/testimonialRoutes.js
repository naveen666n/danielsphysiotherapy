import { Router } from 'express';
import * as testimonialController from '../controllers/testimonialController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { testimonialSchema } from '../validators/testimonialValidators.js';
import { uploadTestimonialPhoto } from '../middlewares/uploadTestimonialPhoto.js';

const router = Router();

router.get('/public', testimonialController.listPublic);
router.get('/', authenticate, authorize('admin', 'staff'), testimonialController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), testimonialController.getOne);
router.post('/', authenticate, authorize('admin'), uploadTestimonialPhoto, validate(testimonialSchema), testimonialController.create);
router.put('/:id', authenticate, authorize('admin'), uploadTestimonialPhoto, validate(testimonialSchema), testimonialController.update);
router.delete('/:id', authenticate, authorize('admin'), testimonialController.remove);

export default router;

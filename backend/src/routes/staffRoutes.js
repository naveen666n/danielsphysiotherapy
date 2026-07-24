import { Router } from 'express';
import * as staffController from '../controllers/staffController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { createStaffSchema, updateStaffSchema } from '../validators/staffValidators.js';

const router = Router();

router.get('/', authenticate, authorize('admin'), staffController.list);
router.get('/:id', authenticate, authorize('admin'), staffController.getOne);
router.post('/', authenticate, authorize('admin'), validate(createStaffSchema), staffController.create);
router.put('/:id', authenticate, authorize('admin'), validate(updateStaffSchema), staffController.update);

export default router;

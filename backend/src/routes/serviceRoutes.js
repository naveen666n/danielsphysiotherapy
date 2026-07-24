import { Router } from 'express';
import * as serviceController from '../controllers/serviceController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { serviceSchema } from '../validators/serviceValidators.js';
import { uploadServicePhoto } from '../middlewares/uploadServicePhoto.js';

const router = Router();

router.get('/public', serviceController.listPublic);
router.get('/', authenticate, authorize('admin', 'staff'), serviceController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), serviceController.getOne);
router.post('/', authenticate, authorize('admin'), uploadServicePhoto, validate(serviceSchema), serviceController.create);
router.put('/:id', authenticate, authorize('admin'), uploadServicePhoto, validate(serviceSchema), serviceController.update);
router.delete('/:id', authenticate, authorize('admin'), serviceController.remove);

export default router;

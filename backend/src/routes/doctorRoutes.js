import { Router } from 'express';
import * as doctorController from '../controllers/doctorController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { doctorSchema } from '../validators/doctorValidators.js';
import { uploadDoctorPhoto } from '../middlewares/uploadPhoto.js';

const router = Router();

router.get('/public', doctorController.listPublic);
router.get('/', authenticate, authorize('admin', 'staff'), doctorController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), doctorController.getOne);
router.post('/', authenticate, authorize('admin'), uploadDoctorPhoto, validate(doctorSchema), doctorController.create);
router.put('/:id', authenticate, authorize('admin'), uploadDoctorPhoto, validate(doctorSchema), doctorController.update);
router.delete('/:id', authenticate, authorize('admin'), doctorController.remove);

export default router;

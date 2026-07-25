import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { settingsSchema } from '../validators/settingsValidators.js';
import { uploadSettingsLogo } from '../middlewares/uploadSettingsLogo.js';

const router = Router();

router.get('/public', settingsController.getPublicSettings);
router.get('/', authenticate, authorize('admin', 'staff'), settingsController.getSettings);
router.put('/', authenticate, authorize('admin'), uploadSettingsLogo, validate(settingsSchema), settingsController.updateSettings);

export default router;

import { Router } from 'express';
import * as contentController from '../controllers/contentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { contentSchema } from '../validators/contentValidators.js';
import { uploadHeroImage } from '../middlewares/uploadHeroImage.js';

const router = Router();

router.get('/public', contentController.getPublicContent);
router.get('/', authenticate, authorize('admin', 'staff'), contentController.getContent);
router.put(
  '/',
  authenticate,
  authorize('admin'),
  uploadHeroImage,
  validate(contentSchema),
  contentController.updateContent
);

export default router;

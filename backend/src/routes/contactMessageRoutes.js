import { Router } from 'express';
import * as contactMessageController from '../controllers/contactMessageController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { markReadSchema } from '../validators/contactMessageValidators.js';

const router = Router();

router.get('/', authenticate, authorize('admin', 'staff'), contactMessageController.list);
router.patch('/:id', authenticate, authorize('admin', 'staff'), validate(markReadSchema), contactMessageController.markRead);
router.delete('/:id', authenticate, authorize('admin'), contactMessageController.remove);

export default router;

import { Router } from 'express';
import { login, me, logout } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema } from '../validators/authValidators.js';
import { loginLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', authenticate, me);
router.post('/logout', logout);

export default router;

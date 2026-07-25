import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import testimonialRoutes from './testimonialRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import contactMessageRoutes from './contactMessageRoutes.js';
import * as contactMessageController from '../controllers/contactMessageController.js';
import { validate } from '../middlewares/validate.js';
import { contactMessageSchema } from '../validators/contactMessageValidators.js';
import { contactLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/settings', settingsRoutes);
router.post('/contact', contactLimiter, validate(contactMessageSchema), contactMessageController.create);
router.use('/contact-messages', contactMessageRoutes);

export default router;

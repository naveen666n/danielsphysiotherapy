import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);

export default router;

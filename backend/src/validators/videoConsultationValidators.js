import { z } from 'zod';

export const createOrderSchema = z.object({
  patient_name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().min(7, 'Enter a valid mobile number'),
  email: z.string().email().optional(),
  doctor_id: z.coerce.number().int(),
  consultation_date: z.string().refine((val) => {
    if (Number.isNaN(Date.parse(val))) return false;
    const today = new Date().toISOString().slice(0, 10);
    return val >= today;
  }, 'Consultation date must be today or later.'),
  consultation_time: z.string().min(1, 'Consultation time is required'),
  problem_description: z.string().optional(),
});

export const verifyPaymentSchema = z.object({
  gatewayOrderId: z.string().min(1),
  gatewayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const updateConsultationSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'failed', 'cancelled']).optional(),
});

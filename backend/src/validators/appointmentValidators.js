import { z } from 'zod';

export const publicBookingSchema = z.object({
  patient_name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().min(7, 'Enter a valid mobile number'),
  email: z.string().email().optional(),
  gender: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  doctor_id: z.coerce.number().int().optional(),
  appointment_date: z.string().refine((val) => {
    if (Number.isNaN(Date.parse(val))) return false;
    const today = new Date().toISOString().slice(0, 10);
    return val >= today;
  }, 'Appointment date must be today or later.'),
  appointment_time: z.string().min(1, 'Appointment time is required'),
  problem_description: z.string().optional(),
});

export const appointmentUpdateSchema = z.object({
  patient_name: z.string().min(2).optional(),
  mobile: z.string().min(7).optional(),
  email: z.string().email().nullable().optional(),
  gender: z.string().nullable().optional(),
  age: z.coerce.number().int().min(0).nullable().optional(),
  doctor_id: z.coerce.number().int().nullable().optional(),
  appointment_date: z.string().optional(),
  appointment_time: z.string().optional(),
  problem_description: z.string().nullable().optional(),
  status: z.enum(['pending', 'approved', 'cancelled', 'completed']).optional(),
});

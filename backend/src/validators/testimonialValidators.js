import { z } from 'zod';

export const testimonialSchema = z.object({
  patient_name: z.string().min(2, 'Name must be at least 2 characters'),
  review: z.string().min(5, 'Review must be at least 5 characters'),
  rating: z.coerce.number().int().min(1).max(5),
});

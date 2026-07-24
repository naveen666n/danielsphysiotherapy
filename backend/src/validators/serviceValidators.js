import { z } from 'zod';

export const serviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

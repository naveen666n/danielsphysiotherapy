import { z } from 'zod';

const booleanFromString = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}, z.boolean().optional());

export const doctorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  experience_years: z.coerce.number().int().min(0).optional(),
  consultation_fee: z.coerce.number().min(0).optional(),
  video_consultation_fee: z.coerce.number().min(0).optional(),
  video_consultation_zoom_link: z.string().url('Enter a valid URL').optional(),
  working_days: z.string().optional(),
  available_time: z.string().optional(),
  active: booleanFromString,
});

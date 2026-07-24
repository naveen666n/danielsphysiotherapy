import { z } from 'zod';

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const booleanFromString = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}, z.boolean().optional());

export const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional().or(z.literal('')),
  active: booleanFromString,
});

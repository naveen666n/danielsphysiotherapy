import { z } from 'zod';

const socialLinksFromString = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val; // let the record() check below fail validation naturally
  }
}, z.record(z.string(), z.string()).optional());

export const settingsSchema = z.object({
  hospital_name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  google_map_link: z.string().optional(),
  opening_hours: z.string().optional(),
  social_links: socialLinksFromString,
});

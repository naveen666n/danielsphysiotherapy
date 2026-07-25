import { z } from 'zod';

export const CONTENT_KEYS = [
  'hero_title', 'hero_subtitle',
  'trust_line_1', 'trust_line_2', 'trust_line_3',
  'home_about_heading', 'home_about_body',
  'why_title_1', 'why_body_1', 'why_title_2', 'why_body_2',
  'why_title_3', 'why_body_3', 'why_title_4', 'why_body_4',
  'home_services_heading', 'home_doctors_heading',
  'home_testimonials_heading', 'home_contact_heading',
  'services_page_heading', 'services_page_subheading',
  'doctors_page_heading', 'doctors_page_subheading',
  'testimonials_page_heading', 'testimonials_page_subheading',
  'contact_page_heading', 'contact_page_subheading',
  'footer_tagline',
];

export const contentSchema = z
  .object(Object.fromEntries(CONTENT_KEYS.map((key) => [key, z.string().min(1).max(2000).optional()])))
  .strict();

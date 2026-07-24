import { makeUploadMiddleware } from './upload.js';

export const uploadTestimonialPhoto = makeUploadMiddleware('testimonials', 'photo');

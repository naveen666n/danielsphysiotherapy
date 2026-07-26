import { makeUploadMiddleware } from './upload.js';

export const uploadHeroImage = makeUploadMiddleware('content', 'hero_image');

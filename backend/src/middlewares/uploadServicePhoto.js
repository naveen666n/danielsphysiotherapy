import { makeUploadMiddleware } from './upload.js';

export const uploadServicePhoto = makeUploadMiddleware('services', 'image');

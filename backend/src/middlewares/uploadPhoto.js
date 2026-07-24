import { makeUploadMiddleware } from './upload.js';

export const uploadDoctorPhoto = makeUploadMiddleware('doctors', 'photo');

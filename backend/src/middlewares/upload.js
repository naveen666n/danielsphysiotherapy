import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function makeUploadMiddleware(subdir, fieldName) {
  const uploadDir = path.join(UPLOADS_ROOT, subdir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${MIME_EXTENSIONS[file.mimetype]}`);
    },
  });

  function fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new AppError('Only JPEG, PNG, or WEBP images are allowed.', 400));
    }
    cb(null, true);
  }

  return multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } }).single(fieldName);
}

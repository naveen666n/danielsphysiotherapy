import fs from 'node:fs/promises';
import multer from 'multer';
import AppError from '../utils/AppError.js';

async function cleanupUploadedFile(req) {
  if (!req.file?.path) return;
  try {
    await fs.unlink(req.file.path);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to clean up orphaned upload ${req.file.path}:`, err.message);
    }
  }
}

export async function errorHandler(err, req, res, next) {
  await cleanupUploadedFile(req);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      errors: null,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.',
    errors: null,
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: null,
  });
}

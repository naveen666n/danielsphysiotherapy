import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';
import * as testimonialRepository from '../repositories/testimonialRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/testimonials/${file.filename}` : null;
}

async function deletePhotoFile(photoUrl) {
  if (!photoUrl) return;
  const filePath = path.join(UPLOADS_ROOT, photoUrl.replace('/uploads/', ''));
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to delete photo file ${filePath}:`, err.message);
    }
  }
}

function toRow(data, photoUrl) {
  return {
    patient_name: data.patient_name,
    review: data.review,
    rating: data.rating,
    photo_url: photoUrl,
  };
}

export async function listTestimonials() {
  return testimonialRepository.findAll();
}

export async function listPublicTestimonials() {
  return testimonialRepository.findAll();
}

export async function getTestimonial(id) {
  const testimonial = await testimonialRepository.findById(id);
  if (!testimonial) {
    throw new AppError('Testimonial not found.', 404);
  }
  return testimonial;
}

export async function createTestimonial(data, file) {
  const testimonial = toRow(data, buildPhotoUrl(file));
  const id = await testimonialRepository.create(testimonial);
  return getTestimonial(id);
}

export async function updateTestimonial(id, data, file) {
  const existing = await getTestimonial(id);

  const photoUrl = file ? buildPhotoUrl(file) : existing.photo_url;
  const testimonial = toRow(data, photoUrl);
  await testimonialRepository.update(id, testimonial);

  if (file) {
    await deletePhotoFile(existing.photo_url);
  }

  return getTestimonial(id);
}

export async function deleteTestimonial(id) {
  const testimonial = await getTestimonial(id);
  await testimonialRepository.remove(id);
  await deletePhotoFile(testimonial.photo_url);
}

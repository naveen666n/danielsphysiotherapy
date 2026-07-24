import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';
import * as serviceRepository from '../repositories/serviceRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/services/${file.filename}` : null;
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
    name: data.name,
    description: data.description ?? null,
    image_url: photoUrl,
    display_order: data.display_order ?? 0,
  };
}

export async function listServices() {
  return serviceRepository.findAll();
}

export async function listPublicServices() {
  return serviceRepository.findAll();
}

export async function getService(id) {
  const service = await serviceRepository.findById(id);
  if (!service) {
    throw new AppError('Service not found.', 404);
  }
  return service;
}

export async function createService(data, file) {
  const service = toRow(data, buildPhotoUrl(file));
  const id = await serviceRepository.create(service);
  return getService(id);
}

export async function updateService(id, data, file) {
  const existing = await getService(id);

  const photoUrl = file ? buildPhotoUrl(file) : existing.image_url;
  const service = toRow(data, photoUrl);
  await serviceRepository.update(id, service);

  if (file) {
    await deletePhotoFile(existing.image_url);
  }

  return getService(id);
}

export async function deleteService(id) {
  const service = await getService(id);
  await serviceRepository.remove(id);
  await deletePhotoFile(service.image_url);
}

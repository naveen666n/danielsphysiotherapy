import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as settingsRepository from '../repositories/settingsRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/settings/${file.filename}` : null;
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

function toFields(data, logoUrl) {
  const fields = {};
  if (data.hospital_name !== undefined) fields.hospital_name = data.hospital_name;
  if (data.address !== undefined) fields.address = data.address;
  if (data.phone !== undefined) fields.phone = data.phone;
  if (data.email !== undefined) fields.email = data.email;
  if (data.google_map_link !== undefined) fields.google_map_link = data.google_map_link;
  if (data.opening_hours !== undefined) fields.opening_hours = data.opening_hours;
  if (data.social_links !== undefined) fields.social_links = JSON.stringify(data.social_links);
  if (data.site_theme !== undefined) fields.site_theme = data.site_theme;
  if (logoUrl !== undefined) fields.logo_url = logoUrl;
  return fields;
}

export async function getSettings() {
  return settingsRepository.find();
}

export async function getPublicSettings() {
  return settingsRepository.find();
}

export async function updateSettings(data, file) {
  const existing = await settingsRepository.find();
  const fields = toFields(data, file ? buildPhotoUrl(file) : undefined);

  await settingsRepository.update(fields);

  if (file && existing?.logo_url) {
    await deletePhotoFile(existing.logo_url);
  }

  return settingsRepository.find();
}

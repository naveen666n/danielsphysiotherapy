import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as contentRepository from '../repositories/contentRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.content_key, row.content_value]));
}

function buildHeroImageUrl(file) {
  return file ? `/uploads/content/${file.filename}` : null;
}

async function deleteContentFile(url) {
  if (!url) return;
  const filePath = path.join(UPLOADS_ROOT, url.replace('/uploads/', ''));
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to delete content file ${filePath}:`, err.message);
    }
  }
}

export async function getContent() {
  return toMap(await contentRepository.findAll());
}

export async function getPublicContent() {
  return toMap(await contentRepository.findAll());
}

export async function updateContent(data, file) {
  const fields = { ...data };

  if (!file) {
    await contentRepository.upsertMany(fields);
    return getContent();
  }

  const existing = await getContent();
  fields.hero_image_url = buildHeroImageUrl(file);
  await contentRepository.upsertMany(fields);
  if (existing.hero_image_url) await deleteContentFile(existing.hero_image_url);
  return getContent();
}

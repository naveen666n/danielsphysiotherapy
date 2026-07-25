import * as contentRepository from '../repositories/contentRepository.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.content_key, row.content_value]));
}

export async function getContent() {
  return toMap(await contentRepository.findAll());
}

export async function getPublicContent() {
  return toMap(await contentRepository.findAll());
}

export async function updateContent(data) {
  await contentRepository.upsertMany(data);
  return getContent();
}

import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT content_key, content_value FROM site_content');
  return rows;
}

export async function upsertMany(fields) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO site_content (content_key, content_value) VALUES (:key, :value)
       ON DUPLICATE KEY UPDATE content_value = :value`,
      { key, value }
    );
  }
}

import pool from '../config/db.js';

export async function find() {
  const [rows] = await pool.query('SELECT * FROM hospital_settings WHERE id = 1');
  return rows[0] ?? null;
}

export async function update(fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE hospital_settings SET ${setClause} WHERE id = 1`, fields);
}

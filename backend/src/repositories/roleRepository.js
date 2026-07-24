import pool from '../config/db.js';

export async function findRoleByName(name) {
  const [rows] = await pool.query('SELECT id, name FROM roles WHERE name = :name', { name });
  return rows[0] ?? null;
}

export async function findRoleById(id) {
  const [rows] = await pool.query('SELECT id, name FROM roles WHERE id = :id', { id });
  return rows[0] ?? null;
}

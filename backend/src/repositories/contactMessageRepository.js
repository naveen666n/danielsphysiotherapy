import pool from '../config/db.js';

export async function findAll(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.isRead !== undefined) {
    conditions.push('is_read = :isRead');
    params.isRead = filters.isRead;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM contact_messages ${whereClause} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM contact_messages WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(message) {
  const [result] = await pool.query(
    `INSERT INTO contact_messages (name, phone, email, message, is_read)
     VALUES (:name, :phone, :email, :message, :is_read)`,
    message
  );
  return result.insertId;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE contact_messages SET ${setClause} WHERE id = :id`, { ...fields, id });
}

export async function remove(id) {
  await pool.query('DELETE FROM contact_messages WHERE id = :id', { id });
}

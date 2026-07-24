import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT * FROM services ORDER BY display_order ASC, name ASC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM services WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(service) {
  const [result] = await pool.query(
    `INSERT INTO services (name, description, image_url, display_order)
     VALUES (:name, :description, :image_url, :display_order)`,
    service
  );
  return result.insertId;
}

export async function update(id, service) {
  await pool.query(
    `UPDATE services SET
      name = :name,
      description = :description,
      image_url = :image_url,
      display_order = :display_order
     WHERE id = :id`,
    { ...service, id }
  );
}

export async function remove(id) {
  await pool.query('DELETE FROM services WHERE id = :id', { id });
}

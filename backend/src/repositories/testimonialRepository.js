import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT * FROM testimonials ORDER BY created_at DESC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM testimonials WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(testimonial) {
  const [result] = await pool.query(
    `INSERT INTO testimonials (patient_name, review, rating, photo_url)
     VALUES (:patient_name, :review, :rating, :photo_url)`,
    testimonial
  );
  return result.insertId;
}

export async function update(id, testimonial) {
  await pool.query(
    `UPDATE testimonials SET
      patient_name = :patient_name,
      review = :review,
      rating = :rating,
      photo_url = :photo_url
     WHERE id = :id`,
    { ...testimonial, id }
  );
}

export async function remove(id) {
  await pool.query('DELETE FROM testimonials WHERE id = :id', { id });
}

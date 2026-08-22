import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT * FROM doctors ORDER BY name ASC');
  return rows;
}

export async function findActiveOnly() {
  const [rows] = await pool.query('SELECT * FROM doctors WHERE active = TRUE ORDER BY name ASC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM doctors WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(doctor) {
  const [result] = await pool.query(
    `INSERT INTO doctors
      (name, email, qualification, specialization, experience_years, photo_url, consultation_fee, video_consultation_fee, video_consultation_zoom_link, working_days, available_time, active)
     VALUES
      (:name, :email, :qualification, :specialization, :experience_years, :photo_url, :consultation_fee, :video_consultation_fee, :video_consultation_zoom_link, :working_days, :available_time, :active)`,
    doctor
  );
  return result.insertId;
}

export async function update(id, doctor) {
  await pool.query(
    `UPDATE doctors SET
      name = :name,
      email = :email,
      qualification = :qualification,
      specialization = :specialization,
      experience_years = :experience_years,
      photo_url = :photo_url,
      consultation_fee = :consultation_fee,
      video_consultation_fee = :video_consultation_fee,
      video_consultation_zoom_link = :video_consultation_zoom_link,
      working_days = :working_days,
      available_time = :available_time,
      active = :active
     WHERE id = :id`,
    { ...doctor, id }
  );
}

export async function remove(id) {
  await pool.query('DELETE FROM doctors WHERE id = :id', { id });
}

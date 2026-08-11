import pool from '../config/db.js';

export async function findAll(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.status) {
    conditions.push('status = :status');
    params.status = filters.status;
  }
  if (filters.doctorId) {
    conditions.push('doctor_id = :doctorId');
    params.doctorId = filters.doctorId;
  }
  if (filters.date) {
    conditions.push('consultation_date = :date');
    params.date = filters.date;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM video_consultations ${whereClause} ORDER BY consultation_date DESC, consultation_time DESC`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM video_consultations WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(consultation) {
  const [result] = await pool.query(
    `INSERT INTO video_consultations
      (patient_name, mobile, email, doctor_id, consultation_date, consultation_time, problem_description, status)
     VALUES
      (:patient_name, :mobile, :email, :doctor_id, :consultation_date, :consultation_time, :problem_description, :status)`,
    consultation
  );
  return result.insertId;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE video_consultations SET ${setClause} WHERE id = :id`, { ...fields, id });
}

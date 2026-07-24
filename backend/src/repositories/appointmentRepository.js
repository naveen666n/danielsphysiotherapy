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
    conditions.push('appointment_date = :date');
    params.date = filters.date;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM appointments ${whereClause} ORDER BY appointment_date DESC, appointment_time DESC`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM appointments WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(appointment) {
  const [result] = await pool.query(
    `INSERT INTO appointments
      (patient_name, mobile, email, gender, age, doctor_id, appointment_date, appointment_time, problem_description, status)
     VALUES
      (:patient_name, :mobile, :email, :gender, :age, :doctor_id, :appointment_date, :appointment_time, :problem_description, :status)`,
    appointment
  );
  return result.insertId;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE appointments SET ${setClause} WHERE id = :id`, { ...fields, id });
}

export async function remove(id) {
  await pool.query('DELETE FROM appointments WHERE id = :id', { id });
}

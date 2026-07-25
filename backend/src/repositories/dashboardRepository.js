import pool from '../config/db.js';

export async function getAppointmentCounts() {
  const [rows] = await pool.query('SELECT status, COUNT(*) as count FROM appointments GROUP BY status');
  return rows;
}

export async function getActiveDoctorCount() {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM doctors WHERE active = 1');
  return rows[0].count;
}

export async function getActiveStaffCount() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'staff' AND u.active = 1`
  );
  return rows[0].count;
}

export async function getUnreadMessageCount() {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM contact_messages WHERE is_read = 0');
  return rows[0].count;
}

export async function getRecentAppointments(limit) {
  const [rows] = await pool.query(
    'SELECT id, patient_name, appointment_date, appointment_time, status FROM appointments ORDER BY created_at DESC LIMIT :limit',
    { limit }
  );
  return rows;
}

export async function getRecentUnreadMessages(limit) {
  const [rows] = await pool.query(
    'SELECT id, name, message, created_at FROM contact_messages WHERE is_read = 0 ORDER BY created_at DESC LIMIT :limit',
    { limit }
  );
  return rows;
}

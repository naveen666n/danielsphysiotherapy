import pool from '../config/db.js';

export async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.password_hash, u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = :username`,
    { username }
  );
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id`,
    { id }
  );
  return rows[0] ?? null;
}

export async function findStaffUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'staff'
     ORDER BY u.name ASC`
  );
  return rows;
}

export async function createUser({ roleId, name, mobile, email, username, passwordHash }) {
  const [result] = await pool.query(
    `INSERT INTO users (role_id, name, mobile, email, username, password_hash)
     VALUES (:roleId, :name, :mobile, :email, :username, :passwordHash)`,
    { roleId, name, mobile: mobile ?? null, email: email ?? null, username, passwordHash }
  );
  return result.insertId;
}

export async function updateUser(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE users SET ${setClause} WHERE id = :id`, { ...fields, id });
}

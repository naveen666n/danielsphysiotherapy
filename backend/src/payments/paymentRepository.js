import pool from '../config/db.js';

export async function create(payment) {
  const [result] = await pool.query(
    `INSERT INTO payments (payable_type, payable_id, gateway, amount, currency, status, receipt)
     VALUES (:payable_type, :payable_id, :gateway, :amount, :currency, :status, :receipt)`,
    payment
  );
  return result.insertId;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function findByGatewayOrderId(gatewayOrderId) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE gateway_order_id = :gatewayOrderId', { gatewayOrderId });
  return rows[0] ?? null;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE payments SET ${setClause} WHERE id = :id`, { ...fields, id });
}

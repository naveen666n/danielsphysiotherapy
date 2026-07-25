import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, '../src/config/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\``);
    await connection.query(`USE \`${env.DB_NAME}\``);
    await connection.query(schema);
    await connection.query("INSERT IGNORE INTO roles (name) VALUES ('admin'), ('staff')");
    await connection.query('INSERT IGNORE INTO hospital_settings (id) VALUES (1)');
    console.log(`Database schema applied successfully to "${env.DB_NAME}".`);
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

import bcrypt from 'bcrypt';
import env from '../src/config/env.js';
import pool from '../src/config/db.js';
import { findRoleByName } from '../src/repositories/roleRepository.js';
import { findUserByUsername, createUser } from '../src/repositories/userRepository.js';

async function seedAdmin() {
  const existing = await findUserByUsername(env.ADMIN_USERNAME);
  if (existing) {
    console.log(`Admin user "${env.ADMIN_USERNAME}" already exists. Skipping.`);
    return;
  }

  const adminRole = await findRoleByName('admin');
  if (!adminRole) {
    throw new Error('Admin role not found. Run "npm run migrate" first.');
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const id = await createUser({
    roleId: adminRole.id,
    name: env.ADMIN_NAME,
    mobile: null,
    email: null,
    username: env.ADMIN_USERNAME,
    passwordHash,
  });

  console.log(`Admin user "${env.ADMIN_USERNAME}" created with id ${id}.`);
}

seedAdmin()
  .catch((err) => {
    console.error('Seeding admin failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

import bcrypt from 'bcrypt';
import AppError from '../utils/AppError.js';
import * as userRepository from '../repositories/userRepository.js';
import * as roleRepository from '../repositories/roleRepository.js';

function toPublicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    username: user.username,
    active: user.active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function listStaff() {
  const staff = await userRepository.findStaffUsers();
  return staff.map(toPublicProfile);
}

export async function getStaffMember(id) {
  const user = await userRepository.findUserById(id);
  if (!user || user.role !== 'staff') {
    throw new AppError('Staff member not found.', 404);
  }
  return toPublicProfile(user);
}

export async function createStaffMember(data) {
  const staffRole = await roleRepository.findRoleByName('staff');
  const passwordHash = await bcrypt.hash(data.password, 10);

  let id;
  try {
    id = await userRepository.createUser({
      roleId: staffRole.id,
      name: data.name,
      mobile: data.mobile ?? null,
      email: data.email ?? null,
      username: data.username,
      passwordHash,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('Username already taken.', 409);
    }
    throw err;
  }

  return getStaffMember(id);
}

export async function updateStaffMember(id, data) {
  await getStaffMember(id);

  const fields = {};
  if (data.name !== undefined) fields.name = data.name;
  if (data.mobile !== undefined) fields.mobile = data.mobile;
  if (data.email !== undefined) fields.email = data.email;
  if (data.username !== undefined) fields.username = data.username;
  if (data.active !== undefined) fields.active = data.active;
  if (data.password) {
    fields.password_hash = await bcrypt.hash(data.password, 10);
  }

  try {
    await userRepository.updateUser(id, fields);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('Username already taken.', 409);
    }
    throw err;
  }

  return getStaffMember(id);
}

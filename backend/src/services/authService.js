import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import { findUserByUsername, findUserById } from '../repositories/userRepository.js';

function toPublicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    email: user.email,
    mobile: user.mobile,
  };
}

export async function login({ username, password }) {
  const user = await findUserByUsername(username);
  if (!user || !user.active) {
    throw new AppError('Invalid username or password.', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError('Invalid username or password.', 401);
  }

  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { token, user: toPublicProfile(user) };
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);
  if (!user || !user.active) {
    throw new AppError('Your session is no longer valid.', 401);
  }
  return toPublicProfile(user);
}

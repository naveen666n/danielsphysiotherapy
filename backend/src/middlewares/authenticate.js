import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import { findUserById } from '../repositories/userRepository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(new AppError('Your session has expired. Please log in again.', 401));
  }

  const user = await findUserById(payload.id);
  if (!user || !user.active) {
    return next(new AppError('Your session is no longer valid.', 401));
  }

  req.user = { id: user.id, role: user.role };
  next();
});

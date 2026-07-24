import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

export function authenticate(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return next(new AppError('Your session has expired. Please log in again.', 401));
  }
}

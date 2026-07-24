import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import env from '../config/env.js';
import * as authService from '../services/authService.js';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

export const login = asyncHandler(async (req, res) => {
  const { token, user } = await authService.login(req.body);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  sendResponse(res, { status: 200, message: 'Login successful', data: user });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  sendResponse(res, { status: 200, message: 'Current user', data: user });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  sendResponse(res, { status: 200, message: 'Logged out successfully' });
});

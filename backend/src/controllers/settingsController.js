import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as settingsService from '../services/settingsService.js';

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  sendResponse(res, { status: 200, message: 'Settings retrieved', data: settings });
});

export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getPublicSettings();
  sendResponse(res, { status: 200, message: 'Settings retrieved', data: settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.file);
  sendResponse(res, { status: 200, message: 'Settings updated', data: settings });
});

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as dashboardService from '../services/dashboardService.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard();
  sendResponse(res, { status: 200, message: 'Dashboard retrieved', data: dashboard });
});

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as staffService from '../services/staffService.js';

export const list = asyncHandler(async (req, res) => {
  const staff = await staffService.listStaff();
  sendResponse(res, { status: 200, message: 'Staff retrieved', data: staff });
});

export const getOne = asyncHandler(async (req, res) => {
  const staff = await staffService.getStaffMember(req.params.id);
  sendResponse(res, { status: 200, message: 'Staff member retrieved', data: staff });
});

export const create = asyncHandler(async (req, res) => {
  const staff = await staffService.createStaffMember(req.body);
  sendResponse(res, { status: 201, message: 'Staff member created', data: staff });
});

export const update = asyncHandler(async (req, res) => {
  const staff = await staffService.updateStaffMember(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Staff member updated', data: staff });
});

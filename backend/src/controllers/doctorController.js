import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as doctorService from '../services/doctorService.js';

export const list = asyncHandler(async (req, res) => {
  const doctors = await doctorService.listDoctors();
  sendResponse(res, { status: 200, message: 'Doctors retrieved', data: doctors });
});

export const listPublic = asyncHandler(async (req, res) => {
  const doctors = await doctorService.listPublicDoctors();
  sendResponse(res, { status: 200, message: 'Doctors retrieved', data: doctors });
});

export const getOne = asyncHandler(async (req, res) => {
  const doctor = await doctorService.getDoctor(req.params.id);
  sendResponse(res, { status: 200, message: 'Doctor retrieved', data: doctor });
});

export const create = asyncHandler(async (req, res) => {
  const doctor = await doctorService.createDoctor(req.body, req.file);
  sendResponse(res, { status: 201, message: 'Doctor created', data: doctor });
});

export const update = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateDoctor(req.params.id, req.body, req.file);
  sendResponse(res, { status: 200, message: 'Doctor updated', data: doctor });
});

export const remove = asyncHandler(async (req, res) => {
  await doctorService.deleteDoctor(req.params.id);
  sendResponse(res, { status: 200, message: 'Doctor deleted' });
});

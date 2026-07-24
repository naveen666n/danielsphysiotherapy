import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as appointmentService from '../services/appointmentService.js';

export const list = asyncHandler(async (req, res) => {
  const { status, doctorId, date } = req.query;
  const filters = {
    status: status || undefined,
    doctorId: doctorId ? Number(doctorId) : undefined,
    date: date || undefined,
  };
  const appointments = await appointmentService.listAppointments(filters);
  sendResponse(res, { status: 200, message: 'Appointments retrieved', data: appointments });
});

export const getOne = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.getAppointment(req.params.id);
  sendResponse(res, { status: 200, message: 'Appointment retrieved', data: appointment });
});

export const createPublic = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.createPublicAppointment(req.body);
  sendResponse(res, { status: 201, message: 'Appointment booked', data: appointment });
});

export const update = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateAppointment(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Appointment updated', data: appointment });
});

export const remove = asyncHandler(async (req, res) => {
  await appointmentService.deleteAppointment(req.params.id);
  sendResponse(res, { status: 200, message: 'Appointment deleted' });
});

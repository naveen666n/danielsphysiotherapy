import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as videoConsultationService from '../services/videoConsultationService.js';

export const list = asyncHandler(async (req, res) => {
  const { status, doctorId, date } = req.query;
  const filters = {
    status: status || undefined,
    doctorId: doctorId ? Number(doctorId) : undefined,
    date: date || undefined,
  };
  const consultations = await videoConsultationService.listConsultations(filters);
  sendResponse(res, { status: 200, message: 'Video consultations retrieved', data: consultations });
});

export const getOne = asyncHandler(async (req, res) => {
  const consultation = await videoConsultationService.getConsultation(req.params.id);
  sendResponse(res, { status: 200, message: 'Video consultation retrieved', data: consultation });
});

export const createOrder = asyncHandler(async (req, res) => {
  const order = await videoConsultationService.createOrder(req.body);
  sendResponse(res, { status: 201, message: 'Order created', data: order });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const consultation = await videoConsultationService.verifyPayment(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Payment verified', data: consultation });
});

export const update = asyncHandler(async (req, res) => {
  const consultation = await videoConsultationService.updateConsultation(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Video consultation updated', data: consultation });
});

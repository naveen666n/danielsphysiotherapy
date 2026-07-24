import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as serviceService from '../services/serviceService.js';

export const list = asyncHandler(async (req, res) => {
  const services = await serviceService.listServices();
  sendResponse(res, { status: 200, message: 'Services retrieved', data: services });
});

export const listPublic = asyncHandler(async (req, res) => {
  const services = await serviceService.listPublicServices();
  sendResponse(res, { status: 200, message: 'Services retrieved', data: services });
});

export const getOne = asyncHandler(async (req, res) => {
  const service = await serviceService.getService(req.params.id);
  sendResponse(res, { status: 200, message: 'Service retrieved', data: service });
});

export const create = asyncHandler(async (req, res) => {
  const service = await serviceService.createService(req.body, req.file);
  sendResponse(res, { status: 201, message: 'Service created', data: service });
});

export const update = asyncHandler(async (req, res) => {
  const service = await serviceService.updateService(req.params.id, req.body, req.file);
  sendResponse(res, { status: 200, message: 'Service updated', data: service });
});

export const remove = asyncHandler(async (req, res) => {
  await serviceService.deleteService(req.params.id);
  sendResponse(res, { status: 200, message: 'Service deleted' });
});

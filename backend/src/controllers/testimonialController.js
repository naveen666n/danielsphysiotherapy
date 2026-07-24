import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as testimonialService from '../services/testimonialService.js';

export const list = asyncHandler(async (req, res) => {
  const testimonials = await testimonialService.listTestimonials();
  sendResponse(res, { status: 200, message: 'Testimonials retrieved', data: testimonials });
});

export const listPublic = asyncHandler(async (req, res) => {
  const testimonials = await testimonialService.listPublicTestimonials();
  sendResponse(res, { status: 200, message: 'Testimonials retrieved', data: testimonials });
});

export const getOne = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.getTestimonial(req.params.id);
  sendResponse(res, { status: 200, message: 'Testimonial retrieved', data: testimonial });
});

export const create = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.createTestimonial(req.body, req.file);
  sendResponse(res, { status: 201, message: 'Testimonial created', data: testimonial });
});

export const update = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.updateTestimonial(req.params.id, req.body, req.file);
  sendResponse(res, { status: 200, message: 'Testimonial updated', data: testimonial });
});

export const remove = asyncHandler(async (req, res) => {
  await testimonialService.deleteTestimonial(req.params.id);
  sendResponse(res, { status: 200, message: 'Testimonial deleted' });
});

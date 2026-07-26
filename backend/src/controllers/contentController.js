import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as contentService from '../services/contentService.js';

export const getContent = asyncHandler(async (req, res) => {
  const content = await contentService.getContent();
  sendResponse(res, { status: 200, message: 'Content retrieved', data: content });
});

export const getPublicContent = asyncHandler(async (req, res) => {
  const content = await contentService.getPublicContent();
  sendResponse(res, { status: 200, message: 'Content retrieved', data: content });
});

export const updateContent = asyncHandler(async (req, res) => {
  const content = await contentService.updateContent(req.body, req.file);
  sendResponse(res, { status: 200, message: 'Content updated', data: content });
});

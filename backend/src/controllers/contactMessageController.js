import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as contactMessageService from '../services/contactMessageService.js';

export const list = asyncHandler(async (req, res) => {
  const { isRead } = req.query;
  const filters = {
    isRead: isRead === undefined ? undefined : isRead === 'true',
  };
  const messages = await contactMessageService.listMessages(filters);
  sendResponse(res, { status: 200, message: 'Messages retrieved', data: messages });
});

export const create = asyncHandler(async (req, res) => {
  const message = await contactMessageService.createMessage(req.body);
  sendResponse(res, { status: 201, message: 'Message sent', data: message });
});

export const markRead = asyncHandler(async (req, res) => {
  const message = await contactMessageService.markMessageRead(req.params.id, req.body.is_read);
  sendResponse(res, { status: 200, message: 'Message updated', data: message });
});

export const remove = asyncHandler(async (req, res) => {
  await contactMessageService.deleteMessage(req.params.id);
  sendResponse(res, { status: 200, message: 'Message deleted' });
});

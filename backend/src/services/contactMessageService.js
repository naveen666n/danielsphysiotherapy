import AppError from '../utils/AppError.js';
import * as contactMessageRepository from '../repositories/contactMessageRepository.js';

function toCreateRow(data) {
  return {
    name: data.name,
    phone: data.phone ?? null,
    email: data.email ?? null,
    message: data.message,
    is_read: false,
  };
}

export async function listMessages(filters) {
  return contactMessageRepository.findAll(filters);
}

export async function getMessage(id) {
  const message = await contactMessageRepository.findById(id);
  if (!message) {
    throw new AppError('Message not found.', 404);
  }
  return message;
}

export async function createMessage(data) {
  const message = toCreateRow(data);
  const id = await contactMessageRepository.create(message);
  return getMessage(id);
}

export async function markMessageRead(id, isRead) {
  await getMessage(id);
  await contactMessageRepository.update(id, { is_read: isRead });
  return getMessage(id);
}

export async function deleteMessage(id) {
  await getMessage(id);
  await contactMessageRepository.remove(id);
}

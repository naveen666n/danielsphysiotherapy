import api from './api.js';

export async function listMessages(filters = {}) {
  const { data } = await api.get('/contact-messages', { params: filters });
  return data.data;
}

export async function markMessageRead(id, isRead) {
  const { data } = await api.patch(`/contact-messages/${id}`, { is_read: isRead });
  return data.data;
}

export async function deleteMessage(id) {
  await api.delete(`/contact-messages/${id}`);
}

export async function submitContactMessage(payload) {
  const { data } = await api.post('/contact', payload);
  return data.data;
}

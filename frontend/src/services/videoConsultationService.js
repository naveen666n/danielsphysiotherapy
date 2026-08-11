import api from './api.js';

export async function createOrder(payload) {
  const { data } = await api.post('/video-consultations/orders', payload);
  return data.data;
}

export async function verifyPayment(id, payload) {
  const { data } = await api.post(`/video-consultations/${id}/verify`, payload);
  return data.data;
}

export async function listConsultations(filters = {}) {
  const { data } = await api.get('/video-consultations', { params: filters });
  return data.data;
}

export async function getConsultation(id) {
  const { data } = await api.get(`/video-consultations/${id}`);
  return data.data;
}

export async function updateConsultation(id, payload) {
  const { data } = await api.patch(`/video-consultations/${id}`, payload);
  return data.data;
}

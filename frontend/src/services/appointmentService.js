import api from './api.js';

export async function listAppointments(filters = {}) {
  const { data } = await api.get('/appointments', { params: filters });
  return data.data;
}

export async function getAppointment(id) {
  const { data } = await api.get(`/appointments/${id}`);
  return data.data;
}

export async function bookAppointmentPublic(payload) {
  const { data } = await api.post('/appointments/public', payload);
  return data.data;
}

export async function updateAppointment(id, payload) {
  const { data } = await api.patch(`/appointments/${id}`, payload);
  return data.data;
}

export async function deleteAppointment(id) {
  await api.delete(`/appointments/${id}`);
}

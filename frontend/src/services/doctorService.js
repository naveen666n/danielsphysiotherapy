import api from './api.js';

export async function listDoctors() {
  const { data } = await api.get('/doctors');
  return data.data;
}

export async function listPublicDoctors() {
  const { data } = await api.get('/doctors/public');
  return data.data;
}

export async function getDoctor(id) {
  const { data } = await api.get(`/doctors/${id}`);
  return data.data;
}

export async function createDoctor(formData) {
  const { data } = await api.post('/doctors', formData);
  return data.data;
}

export async function updateDoctor(id, formData) {
  const { data } = await api.put(`/doctors/${id}`, formData);
  return data.data;
}

export async function deleteDoctor(id) {
  await api.delete(`/doctors/${id}`);
}

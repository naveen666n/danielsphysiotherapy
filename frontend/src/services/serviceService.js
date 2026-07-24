import api from './api.js';

export async function listServices() {
  const { data } = await api.get('/services');
  return data.data;
}

export async function getService(id) {
  const { data } = await api.get(`/services/${id}`);
  return data.data;
}

export async function createService(formData) {
  const { data } = await api.post('/services', formData);
  return data.data;
}

export async function updateService(id, formData) {
  const { data } = await api.put(`/services/${id}`, formData);
  return data.data;
}

export async function deleteService(id) {
  await api.delete(`/services/${id}`);
}

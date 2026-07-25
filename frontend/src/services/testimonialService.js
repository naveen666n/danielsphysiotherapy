import api from './api.js';

export async function listTestimonials() {
  const { data } = await api.get('/testimonials');
  return data.data;
}

export async function getTestimonial(id) {
  const { data } = await api.get(`/testimonials/${id}`);
  return data.data;
}

export async function createTestimonial(formData) {
  const { data } = await api.post('/testimonials', formData);
  return data.data;
}

export async function updateTestimonial(id, formData) {
  const { data } = await api.put(`/testimonials/${id}`, formData);
  return data.data;
}

export async function deleteTestimonial(id) {
  await api.delete(`/testimonials/${id}`);
}

export async function listPublicTestimonials() {
  const { data } = await api.get('/testimonials/public');
  return data.data;
}

import api from './api.js';

export async function listStaff() {
  const { data } = await api.get('/staff');
  return data.data;
}

export async function getStaffMember(id) {
  const { data } = await api.get(`/staff/${id}`);
  return data.data;
}

export async function createStaffMember(payload) {
  const { data } = await api.post('/staff', payload);
  return data.data;
}

export async function updateStaffMember(id, payload) {
  const { data } = await api.put(`/staff/${id}`, payload);
  return data.data;
}

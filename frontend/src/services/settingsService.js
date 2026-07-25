import api from './api.js';

export async function getSettings() {
  const { data } = await api.get('/settings');
  return data.data;
}

export async function updateSettings(formData) {
  const { data } = await api.put('/settings', formData);
  return data.data;
}

export async function getPublicSettings() {
  const { data } = await api.get('/settings/public');
  return data.data;
}

import api from './api.js';

export async function getDashboard() {
  const { data } = await api.get('/dashboard');
  return data.data;
}

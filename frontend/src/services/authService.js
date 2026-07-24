import api from './api.js';

export async function loginRequest({ username, password }) {
  const { data } = await api.post('/auth/login', { username, password });
  return data.data;
}

export async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function logoutRequest() {
  await api.post('/auth/logout');
}

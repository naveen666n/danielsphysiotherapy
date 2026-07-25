import api from './api.js';

export async function getContent() {
  const { data } = await api.get('/content');
  return data.data;
}

export async function getPublicContent() {
  const { data } = await api.get('/content/public');
  return data.data;
}

export async function updateContent(fields) {
  const { data } = await api.put('/content', fields);
  return data.data;
}

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000
});

export const authAPI = {
  getStatus: () => api.get('/auth/status'),
  logout: () => api.post('/auth/logout')
};

export const contactsAPI = {
  getAll: (group) => api.get('/contacts', { params: { group } }),
  getGroups: () => api.get('/contacts/groups'),
  add: (data) => api.post('/contacts', data),
  uploadCSV: (formData) => api.post('/contacts/upload', formData),
  delete: (id) => api.delete(`/contacts/${id}`),
  deleteAll: (group) => api.delete('/contacts', { params: { group } })
};

export const blastAPI = {
  getSessions: () => api.get('/blast/sessions'),
  getSessionLogs: (id) => api.get(`/blast/sessions/${id}/logs`),
  start: (data) => api.post('/blast/start', data),
  cancel: () => api.post('/blast/cancel'),
  isActive: () => api.get('/blast/active'),
  deleteSession: (id) => api.delete(`/blast/sessions/${id}`)
};

export const templatesAPI = {
  getAll: () => api.get('/templates'),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`)
};

export default api;

import axios from 'axios';
import { clearAuthStorage, getAuthToken } from '../lib/auth';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || '';
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (status === 401 && !isLoginRequest) {
      clearAuthStorage();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  logoutApp: () => api.post('/auth/logout-app-token'),
  getStatus: () => api.get('/auth/status'),
  logout: () => api.post('/auth/logout')
};

export const contactsAPI = {
  getAll: (group) => api.get('/contacts', { params: { group } }),
  getGroups: () => api.get('/contacts/groups'),
  add: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
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

export const clusteringAPI = {
  run: (data) => api.post('/clustering/run', data),
  latest: () => api.get('/clustering/latest'),
  contactsByCluster: (clusterId) => api.get(`/clustering/contacts-by-cluster/${clusterId}`),
  clear: () => api.delete('/clustering/clear')
};

export default api;

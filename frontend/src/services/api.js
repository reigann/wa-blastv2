import axios from 'axios';
import { clearAuthStorage, getAuthToken } from '../lib/auth';
import { API_BASE_URL } from '../lib/config';

const api = axios.create({
  baseURL: API_BASE_URL,
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
  me: () => api.get('/auth/me'),
  logoutApp: () => api.post('/auth/logout-app-token'),
  getStatus: () => api.get('/auth/status'),
  logout: () => api.post('/auth/logout'),
  getAllowlist: () => api.get('/auth/allowlist'),
  addToAllowlist: (email) => api.post('/auth/allowlist/add', { email }),
  removeFromAllowlist: (email) => api.post('/auth/allowlist/remove', { email })
};

export const contactsAPI = {
  getAll: (group) => api.get('/contacts', { params: { group } }),
  getGroups: () => api.get('/contacts/groups'),
  add: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  uploadCSV: (formData) => api.post('/contacts/upload', formData),
  previewUpload: (formData) => api.post('/contacts/upload/preview', formData),
  importContacts: (payload) => api.post('/contacts/import', payload),
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

export const banditAPI = {
  create: (data) => api.post('/bandit/create', data),
  recommend: (data) => api.post('/bandit/recommend', data),
  feedback: (data) => api.post('/bandit/feedback', data),
  getPolicies: () => api.get('/bandit/policies'),
  getEvents: (params) => api.get('/bandit/events', { params }),
  updateDeliveryStatus: (data) => api.post('/bandit/update-delivery-status', data),
  getAnalytics: (policyId) => api.get(`/bandit/analytics/${policyId}`),
  defineArms: (data) => api.post('/bandit/define-arms', data),
  getArmDefinitions: (policyId) => api.get(`/bandit/arm-definitions/${policyId}`),
  getEventsByPolicy: (policyId) => api.get(`/bandit/events/${policyId}`),
  getDebug: (policyId) => api.get(`/bandit/debug/${policyId}`),
  simulateRead: (data) => api.post('/bandit/test/simulate-read', data),
  simulateReply: (data) => api.post('/bandit/test/simulate-reply', data),
  
  // NEW STATISTICS ENDPOINTS
  getPolicyStats: (policyId, params = {}) => api.get(`/bandit/stats/policy/${policyId}`, { params }),
  getSessionStats: (sessionId) => api.get(`/bandit/stats/session/${sessionId}`),
  getRecentEvents: (policyId, limit = 100, params = {}) => api.get(`/bandit/stats/events/${policyId}`, { params: { limit, ...params } }),
  getEventBreakdown: (policyId, params = {}) => api.get(`/bandit/stats/breakdown/${policyId}`, { params }),
  comparePolicies: (policyIds) => api.post('/bandit/stats/compare', { policy_ids: policyIds }),
  getLearningProgress: (policyId, params = {}) => api.get(`/bandit/stats/learning-progress/${policyId}`, { params }),
  recommendTemplate: (templateIds, policyId = null, startDate = null, endDate = null) => api.post('/bandit/stats/recommend-template', {
    template_ids: templateIds,
    policy_id: policyId,
    start_date: startDate,
    end_date: endDate,
  }),
};

export const clusteringAPI = {
  run: (data) => api.post('/clustering/run', data, { timeout: 180000 }),
  latest: () => api.get('/clustering/latest'),
  contactsByCluster: (clusterId) => api.get(`/clustering/contacts-by-cluster/${clusterId}`),
  clear: () => api.delete('/clustering/clear'),
  getResults: (params) => api.get('/clustering/results', { params }),
  getStats: () => api.get('/clustering/stats'),
  getDebug: () => api.get('/clustering/debug'),
};

export const systemAPI = {
  health: () => api.get('/health'),
};

export default api;

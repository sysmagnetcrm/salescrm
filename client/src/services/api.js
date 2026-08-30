import axios from 'axios';

// Resolve API base URL with sensible dev defaults
const localStorageOverride = (typeof window !== 'undefined') ? localStorage.getItem('API_URL') : null;
const isLocalhost = (typeof window !== 'undefined') && (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
);
const inferredLocal = isLocalhost ? 'http://localhost:5000/api' : null;
const devDefault = import.meta.env?.DEV ? 'http://localhost:5000/api' : null;
const API_URL = (
  localStorageOverride ||
  import.meta.env.VITE_API_URL ||
  devDefault ||
  inferredLocal ||
  'https://salescrm-7z2o.onrender.com/api'
);

if (import.meta.env?.DEV) {
  // Helpful debug in dev to ensure we are pointing at the intended API
  // eslint-disable-next-line no-console
  console.debug('[API] baseURL =', API_URL);
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-client-version': '1.2.0'
  }
});

// Add token to requests (skip for auth endpoints)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const url = config?.url || '';
    const isAuthEndpoint = /\/auth\/(login|login-phone|register)/.test(url);
    if (token && !isAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (isAuthEndpoint && config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = /\/auth\/(login|login-phone|register)/.test(url);
    if (status === 401 && !isAuthEndpoint) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('crmAuthExpired'));
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && window.location?.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  loginPhone: (payload) => api.post('/auth/login-phone', payload),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  changePassword: (payload) => api.put('/auth/password', payload),
  updateProfile: (payload) => api.put('/auth/profile', payload)
};

// User APIs
export const userAPI = {
  getSalespeople: (params) => api.get('/users/salespeople', { params }),
  createSalesperson: (data) => api.post('/users/salespeople', data),
  updateSalesperson: (id, data) => api.put(`/users/salespeople/${id}`, data),
  deactivateSalesperson: (id) => api.delete(`/users/salespeople/${id}`),
  deleteSalesperson: (id) => api.delete(`/users/salespeople/${id}?hard=true`),
  getPerformance: (id, period) => api.get(`/users/salespeople/${id}/performance?period=${period}`),
  getDetailedPerformance: (id, period) => api.get(`/users/salespeople/${id}/performance-detailed?period=${period}`)
};

// Lead APIs
export const leadAPI = {
  uploadLeads: (formData) => api.post('/leads/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  createLead: (data) => api.post('/leads', data),
  getAllLeads: (params) => api.get('/leads', { params }),
  getMyLeads: (params) => api.get('/leads/my-leads', { params }),
  getQueue: (params) => api.get('/leads/queue', { params }),
  getLead: (id) => api.get(`/leads/${id}`),
  updateLead: (id, data) => api.put(`/leads/${id}`, data),
  deleteLead: (id) => api.delete(`/leads/${id}`),
  addActivity: (id, data) => api.post(`/leads/${id}/activity`, data),
  markDuplicate: (id, data) => api.post(`/leads/${id}/mark-duplicate`, data),
  getCountries: () => api.get('/leads/countries'),
  getProducts: () => api.get('/leads/products'),
  getStaleLeads: (params) => api.get('/leads/stale', { params }),
  getUnassignedLeads: (params) => api.get('/leads/unassigned', { params }),
  redistributeLeads: (leadIds, branch) => api.post('/leads/redistribute', { leadIds, branch }),
  assignLeads: (leadIds, assignTo) => api.post('/leads/assign', { leadIds, assignTo })
};

// Payment APIs
export const paymentAPI = {
  recordPayment: (data) => api.post('/payments', data),
  getLeadPayments: (leadId) => api.get(`/payments/lead/${leadId}`),
  allocateBatch: (data) => api.post('/payments/allocate-batch', data)
};

// Calling & Call Intelligence APIs
export const callAPI = {
  logCall: (data) => api.post('/calls', data),
  updateCallState: (id, data) => api.put(`/calls/${id}`, data),
  getLeadCallHistory: (leadId) => api.get(`/calls/lead/${leadId}`),
  getAllCallLogs: () => api.get('/calls'),
  getCallAudio: (id) => api.get(`/calls/${id}/audio`),
  triggerAIAnalysis: (id) => api.post(`/calls/${id}/analyze`),
  getCallTranscript: (id) => api.get(`/calls/${id}/transcript`),
  getCallAIAnalysis: (id) => api.get(`/calls/${id}/analysis`),
  getUnmatchedCalls: () => api.get('/calls/unmatched'),
  reconcileUnmatchedCall: (id, leadId) => api.post(`/calls/unmatched/${id}/reconcile`, { leadId }),
  getCallAnalytics: (timeframe) => api.get(`/calls/analytics?timeframe=${timeframe || 'today'}`),
  getFleetStatus: () => api.get('/calls/fleet-status')
};

// System Version API
export const systemAPI = {
  getVersion: () => api.get('/system/version')
};

// Dashboard APIs
export const dashboardAPI = {
  getAdminDashboard: (params) => api.get('/dashboard/admin', { params }),
  getSalespersonDashboard: () => api.get('/dashboard/salesperson'),
  getLeaderboard: (params) => api.get('/dashboard/leaderboard', { params }),
  getStatusCounts: (params) => api.get('/dashboard/status-counts', { params })
};

// Settings APIs
export const settingsAPI = {
  getPublicBranding: () => api.get('/settings/branding/public'),
  getBranding: () => api.get('/settings/branding'),
  updateBranding: (data) => api.put('/settings/branding', data),
  uploadLogo: (formData) => api.post('/settings/branding/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadFavicon: (formData) => api.post('/settings/branding/favicon', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  removeLogo: () => api.delete('/settings/branding/logo'),
  removeFavicon: () => api.delete('/settings/branding/favicon'),
  resetBranding: () => api.post('/settings/branding/reset'),
  getTelephonySettings: () => api.get('/settings/telephony'),
  getCountries: () => api.get('/settings/countries'),
  addCountry: (data) => api.post('/settings/countries', data),
  deleteCountry: (id) => api.delete(`/settings/countries/${id}`),
  getProducts: () => api.get('/settings/products'),
  addProduct: (data) => api.post('/settings/products', data),
  deleteProduct: (id) => api.delete(`/settings/products/${id}`),
  getStatuses: () => api.get('/settings/statuses'),
  addStatus: (data) => api.post('/settings/statuses', data),
  deleteStatus: (id) => api.delete(`/settings/statuses/${id}`)
};

// Centralized Unified CRM Calling Contract
export const startCrmCall = async (lead) => {
  if (!lead?.id || !lead?.phone) {
    throw new Error('Invalid lead information for calling.');
  }

  if (window.AndroidCRM?.getCallCapability) {
    const capability = window.AndroidCRM.getCallCapability();
    console.log('[AndroidCRMBridge] Device call capability:', capability);
  }

  const res = await callAPI.logCall({
    leadId: lead.id,
    phoneNumber: lead.phone,
    callStatus: 'initiated',
    callDirection: 'outbound',
    startedAt: new Date()
  });

  const callLogData = res.data?.data || res.data;
  const callId = callLogData?.id || '';

  if (callId && window.AndroidCRM?.startCallRecording) {
    window.AndroidCRM.startCallRecording(callId);
  }

  if (window.AndroidCRM?.setServerConfig) {
    const token = localStorage.getItem('token') || '';
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://salescrm-7z2o.onrender.com/api';
    window.AndroidCRM.setServerConfig(apiBase, token);
  }

  if (window.AndroidCRM?.placeTelecomCall) {
    window.AndroidCRM.placeTelecomCall(lead.phone, lead.id, callId);
  } else {
    const formattedPhone = String(lead.phone).replace(/[^0-9+]/g, '');
    window.location.href = `tel:${formattedPhone}`;
  }

  return callLogData;
};

// Disposition APIs
export const dispositionAPI = {
  getDispositions: () => api.get('/settings/dispositions'),
  createDisposition: (data) => api.post('/settings/dispositions', data)
};

export default api;



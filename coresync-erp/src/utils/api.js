import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const baseURL = String(rawBaseUrl).replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeTenantId = localStorage.getItem('activeTenantId');
    if (activeTenantId && activeTenantId !== 'null' && activeTenantId !== 'undefined' && activeTenantId !== '') {
      config.headers['X-Tenant-ID'] = activeTenantId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        const message = error.response.data?.message || 'Sesi Anda telah berakhir. Silakan login kembali.';
        const code = error.response.data?.code || 'SESSION_EXPIRED';
        
        sessionStorage.setItem('authNotification', JSON.stringify({
          message,
          code,
          type: code === 'SESSION_TERMINATED' ? 'warning' : 'info'
        }));

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
        localStorage.removeItem('activeTenantId');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

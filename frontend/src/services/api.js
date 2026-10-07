import axios from 'axios';
import { getToken, clearToken } from './session';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => {
  if (response.status !== 204 && !response.headers['content-type']?.includes('application/json')) {
    return Promise.reject(new Error('API returned a non-JSON response'));
  }
  return response;
}, (error) => {
  if (error.response?.status === 401 && getToken()) {
    clearToken();
    window.dispatchEvent(new Event('calar-session-expired'));
  }
  return Promise.reject(error);
});

export default api;

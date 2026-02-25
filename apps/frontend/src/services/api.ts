import axios from 'axios';

// In development we prefer a relative base so Vite's proxy can forward requests
// When VITE_API_URL is not set, use '' (relative) so requests go through the dev server proxy.
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;


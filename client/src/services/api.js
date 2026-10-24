import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export function apiError(error) {
  return error.response?.data?.message || error.message || 'Request failed';
}

export default api;

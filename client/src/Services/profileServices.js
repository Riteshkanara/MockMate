import API_BASE from '../config/api.js';
import axios from "axios";

const API = axios.create({
  baseURL: `${API_BASE}/profile`,
});

const AuthAPI = axios.create({
  baseURL: `${API_BASE}/profile`,
  withCredentials: true,
});

AuthAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getShareLink = async () => {
  const response = await AuthAPI.get("/share-link");
  return response.data;
};

export const getPublicProfile = async (slug) => {
  const response = await API.get(`/${slug}`);
  return response.data;
};

export const getMyProfile = async () => {
  const response = await AuthAPI.get("/me");
  return response.data;
};

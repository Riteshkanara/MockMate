import API_BASE from '../config/api.js';
import axios from "axios";

// Separate axios instance because /profile/:slug must NOT send an
// Authorization header — it's a public route anyone can open.
const API = axios.create({
  baseURL: `${API_BASE}/profile`,
});

// Authenticated instance — only used for getShareLink.
const AuthAPI = axios.create({
  baseURL: `${API_BASE}/profile`,
});

AuthAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gets (or lazily creates) the current user's share slug.
// Returns e.g. { slug: "aB3dE9kL" }
export const getShareLink = async () => {
  const response = await AuthAPI.get("/share-link");
  return response.data;
};

// Public lookup — no auth header, works for any visitor.
export const getPublicProfile = async (slug) => {
  const response = await API.get(`/${slug}`);
  return response.data;
};
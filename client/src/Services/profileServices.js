import API_BASE from '../config/api.js';
import axios from "axios";

// Separate axios instance because /profile/:slug must NOT send an
// Authorization header — it's a public route anyone can open.
const API = axios.create({
  baseURL: `${API_BASE}/profile`,
});

const AuthAPI = axios.create({
  baseURL: `${API_BASE}/profile`,
  withCredentials: true,
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
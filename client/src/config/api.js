// Single source of truth for the backend URL.
// Set VITE_API_URL in your .env file for production.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export default API_BASE;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Pings the server the moment the app loads.
// By the time the user hits Login, the server is already warm.
export const wakeServer = async () => {
  try {
    await fetch(`${API_BASE}/health`);
  } catch {
    // silently fail — user experience is unaffected
  }
};

export default API_BASE;

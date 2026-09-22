const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Keep-alive ping ────────────────────────────────────────────────────────
// Render free tier sleeps after 15 min of inactivity.
// We ping every 10 min so the server stays warm during an active session.
// Returns a cleanup function to stop pinging (call on app unmount).
let _pingInterval = null;

export const startKeepAlive = () => {
  if (_pingInterval) return; // already running
  const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  const ping = async () => {
    try {
      await fetch(`${API_BASE}/health`, {
        method: 'GET',
        // No-cache so the request always hits the server
        headers: { 'Cache-Control': 'no-cache' },
      });
    } catch {
      // silently ignore — server might be momentarily unavailable
    }
  };

  // First ping fires immediately so there is never a delay
  ping();
  _pingInterval = setInterval(ping, INTERVAL_MS);
};

export const stopKeepAlive = () => {
  if (_pingInterval) {
    clearInterval(_pingInterval);
    _pingInterval = null;
  }
};

// Legacy one-shot export kept for back-compat (main.jsx still imports it)
export const wakeServer = async () => {
  try {
    await fetch(`${API_BASE}/health`, { method: 'GET' });
  } catch {
    // silently fail
  }
};

export default API_BASE;

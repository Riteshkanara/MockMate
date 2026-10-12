// Remembers "who challenged me" across the Google sign-in redirect so the
// visitor lands in a challenge flow instead of a blank dashboard.
const KEY = 'mm_challenge';

export const rememberChallenge = (slug) => {
  try { if (slug) localStorage.setItem(KEY, slug); } catch { /* storage blocked — flow degrades gracefully */ }
};
export const getChallenge = () => {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
};
export const clearChallenge = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
};

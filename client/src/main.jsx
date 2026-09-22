import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { startKeepAlive } from './config/api';

// ── 1. Start keep-alive pinging immediately ────────────────────────────────
// Fires /health right away (wakes the Render instance from cold sleep)
// then every 10 min to keep it warm during the session.
startKeepAlive();

// ── 2. Remove the pre-boot placeholder ────────────────────────────────────
// index.html renders a tiny ⚡ from byte 0 so there is never a white flash,
// not even for a single frame.  Now that JS has parsed, remove it so it
// doesn't sit on top of the React tree.
const preBoot = document.getElementById('pre-boot');
if (preBoot) preBoot.remove();

// ── 3. Mount React ────────────────────────────────────────────────────────
//
// Note: BrowserRouter now lives inside App.jsx (not here) so that the router
// context is available throughout the AppShell/ServerWakeScreen layer. The
// AuthProvider and Toaster stay here — they don't need router context and
// need to wrap the entire tree.
//
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 3800,
          style: {
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 12,
            border: '1.5px solid #DDE5F7',
            boxShadow: '0 8px 32px rgba(0,31,107,0.13), 0 2px 8px rgba(0,31,107,0.06)',
            color: '#0A1628',
            background: '#FFFFFF',
            padding: '11px 14px',
          },
          success: {
            iconTheme: { primary: '#059669', secondary: '#ECFDF5' },
            style: { borderColor: '#BBF7D0' },
          },
          error: {
            iconTheme: { primary: '#DC2626', secondary: '#FEF2F2' },
            style: { borderColor: '#FECACA' },
          },
          loading: {
            iconTheme: { primary: '#1A6EFF', secondary: '#EBF2FF' },
          },
        }}
      />
    </AuthProvider>
  </StrictMode>
);
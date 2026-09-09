import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

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
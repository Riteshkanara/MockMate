import { useEffect } from "react";
import API_BASE from '../config/api.js';

const AuthCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);

      // Check if user already completed onboarding
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user?.college) {
            // Returning user → go to dashboard
            window.location.href = "/dashboard";
          } else {
            // New user → go to onboarding
            window.location.href = "/onboarding";
          }
        })
        .catch(() => {
          window.location.href = "/dashboard";
        });
    } else {
      window.location.href = "/";
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8F9FF'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 32,
          marginBottom: 16
        }}>
          🎯
        </div>
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 15,
          color: '#64748B',
          fontWeight: 500
        }}>
          Logging you in...
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
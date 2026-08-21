import { useEffect } from "react";
import API_BASE from '../config/api.js';

const AuthCallback = () => {
    useEffect(() => {
        // No token in URL anymore — cookies were set by the server
        fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
        })
            .then(res => res.json())
            .then(data => {
                if (data.user?.college) {
                    window.location.href = "/dashboard";
                } else {
                    window.location.href = "/onboarding";
                }
            })
            .catch(() => {
                window.location.href = "/";
            });
    }, []);

    return (
        <div style={{
            minHeight: '100vh', display: 'flex',
            alignItems: 'center', justifyContent: 'center', background: '#F8F9FF'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#64748B', fontWeight: 500 }}>
                    Logging you in...
                </p>
            </div>
        </div>
    );
};

export default AuthCallback;
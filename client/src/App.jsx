import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import MainLoader from './components/MainLoader';

import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import AuthCallback from './pages/AuthCallback';
import Onboarding from './pages/Onboarding';
import Interview from './pages/Interview';
import Result from './pages/Result';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Coach from './pages/Coach';
import PublicProfile from './pages/publicProfile';

const PAGE_TITLES = {
  '/':            'MockMate — AI Mock Interview for Placements',
  '/dashboard':   'Dashboard — MockMate',
  '/interview':   'Interview — MockMate',
  '/result':      'Results — MockMate',
  '/leaderboard': 'Leaderboard — MockMate',
  '/history':     'History — MockMate',
  '/analytics':   'Analytics — MockMate',
  '/coach':       'Coach — MockMate',
  '/onboarding':  'Setup — MockMate',
};

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setVisible(true);
    }, 80);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <>
      <style>{`
        .mm-page-wrap {
          opacity: 0;
          transition: opacity 0.18s ease;
        }
        .mm-page-wrap.visible {
          opacity: 1;
        }
      `}</style>
      <div className={`mm-page-wrap${visible ? ' visible' : ''}`}>
        {children}
      </div>
    </>
  );
};
// ── Title updater ──────────────────────────────────────────────────────────
const TitleUpdater = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith('/p/')) return;
    document.title = PAGE_TITLES[pathname] || 'MockMate';
  }, [pathname]);
  return null;
};

// ── 404 ────────────────────────────────────────────────────────────────────
const NotFound = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#F0F4FF', fontFamily: "'Inter', sans-serif", gap: 16,
  }}>
    <div style={{ fontSize: 64, fontWeight: 900, color: '#1A6EFF' }}>404</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#0A1628' }}>Page not found</div>
    <div style={{ fontSize: 14, color: '#7A8BAF', marginBottom: 8 }}>
      The page you're looking for doesn't exist.
    </div>
    <button
      onClick={() => window.location.href = '/'}
      style={{
        background: '#1A6EFF', color: '#fff', border: 'none',
        borderRadius: 10, padding: '12px 28px', fontSize: 14,
        fontWeight: 700, cursor: 'pointer',
      }}
    >
      Go Home
    </button>
  </div>
);

const AppLoader = ({ children }) => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, []);
  if (loading) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F0F4FF',
    }}>
      <MainLoader />
    </div>
  );
  return children;
};

// ── Inner app (needs to be inside BrowserRouter for useLocation) ───────────
const InnerApp = () => {
  return (
    <>
      <TitleUpdater />
      <Navbar />
      <PageTransition>
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/p/:slug"       element={<PublicProfile />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/onboarding"    element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/interview"     element={<ProtectedRoute><Interview /></ProtectedRoute>} />
          <Route path="/result"        element={<ProtectedRoute><Result /></ProtectedRoute>} />
          <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/history"       element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/analytics"     element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/coach"         element={<ProtectedRoute><Coach /></ProtectedRoute>} />
          <Route path="/leaderboard"   element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="*"              element={<NotFound />} />
        </Routes>
      </PageTransition>
    </>
  );
};

function App() {
  return (
    <AppLoader>
      <BrowserRouter>
        <ErrorBoundary>
          <InnerApp />
        </ErrorBoundary>
      </BrowserRouter>
    </AppLoader>
  );
}

export default App;
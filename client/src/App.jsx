import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MainLoader from './components/MainLoader';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Home        from './pages/Home';
import AuthCallback from './pages/AuthCallback';
import Onboarding  from './pages/Onboarding';
import Interview   from './pages/Interview';
import Result      from './pages/Result';
import Dashboard   from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import History     from './pages/History';
import Analytics   from './pages/Analytics';
import Coach       from './pages/Coach';
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

// ── Route progress bar ─────────────────────────────────────────────────────
const RouteProgressBar = () => {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef([]);

  const clear = () => timers.current.forEach(clearTimeout);

  useEffect(() => {
    clear();
    setVisible(true);
    setProgress(0);
    timers.current = [
      setTimeout(() => setProgress(62), 20),
      setTimeout(() => setProgress(86), 220),
      setTimeout(() => {
        setProgress(100);
        timers.current.push(setTimeout(() => setVisible(false), 300));
      }, 620),
    ];
    return clear;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!visible) return null;
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, height:2, zIndex:99999, pointerEvents:'none' }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #1A6EFF 0%, #00C8F0 100%)',
        boxShadow: '0 0 10px rgba(0,200,240,0.55)',
        borderRadius: '0 2px 2px 0',
        transition: progress === 0 ? 'none'
          : progress === 100 ? 'width 0.22s ease'
          : 'width 0.55s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
};

// ── Page transition ────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  enter:   { opacity: 1, y: 0,   transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -6,  transition: { duration: 0.14, ease: [0.4,  0, 1,    1] } },
};

const PageTransition = ({ children }) => {
  const location = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
    minHeight:'100vh', display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    background:'#F0F4FF', fontFamily:"'Inter',sans-serif", gap:16,
  }}>
    <div style={{ fontSize:64, fontWeight:900, color:'#1A6EFF' }}>404</div>
    <div style={{ fontSize:20, fontWeight:700, color:'#0A1628' }}>Page not found</div>
    <div style={{ fontSize:14, color:'#7A8BAF', marginBottom:8 }}>
      The page you're looking for doesn't exist.
    </div>
    <button
      onClick={() => window.location.href='/'}
      style={{
        background:'#1A6EFF', color:'#fff', border:'none',
        borderRadius:10, padding:'12px 28px', fontSize:14,
        fontWeight:700, cursor:'pointer',
        transition:'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(26,110,255,0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}
    >
      Go Home
    </button>
  </div>
);

// ── App-level splash (first paint only) ───────────────────────────────────
const AppLoader = ({ children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);
  return (
    <AnimatePresence>
      {!ready ? (
        <motion.div key="splash"
          initial={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.28 }}
          style={{ position:'fixed', inset:0, display:'flex', alignItems:'center',
            justifyContent:'center', background:'#F0F4FF', zIndex:99999 }}>
          <MainLoader />
        </motion.div>
      ) : (
        <motion.div key="app" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.18 }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Inner app ──────────────────────────────────────────────────────────────
const InnerApp = () => (
  <>
    <TitleUpdater />
    <RouteProgressBar />
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

export default function App() {
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
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MainLoader from './components/MainLoader';
import ServerWakeScreen from './components/ServerWakeScreen';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import API_BASE from './config/api';

import Home         from './pages/Home';
import AuthCallback  from './pages/AuthCallback';
import Onboarding   from './pages/Onboarding';
import Interview     from './pages/Interview';
import Result        from './pages/Result';
import Dashboard     from './pages/Dashboard';
import Leaderboard   from './pages/Leaderboard';
import History       from './pages/History';
import Analytics     from './pages/Analytics';
import Coach         from './pages/Coach';
import PublicProfile from './pages/publicProfile';
import Pricing      from './pages/Pricing';

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
  const [visible, setVisible]   = useState(false);
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
  enter:   { opacity: 1, y: 0,  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.14, ease: [0.4,  0, 1,    1] } },
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

// ── Server wake hook ───────────────────────────────────────────────────────
//
// Three phases:
//   'checking'  — first paint, haven't heard from server yet
//   'waking'    — server not yet responding (cold start in progress)
//   'ready'     — server replied 200
//
// The wake screen is shown for 'checking' and 'waking'.
// On 'ready' a smooth CSS fade-out plays, then the real app fades in.
//
// MIN_SHOW_MS ensures the wake screen is never so brief it looks like a
// broken flash on a warm server.
//
const MIN_SHOW_MS = 1500;
const POLL_MS     = 3000;
const DEADLINE_MS = 50000;

const useServerWake = () => {
  const [phase, setPhase] = useState('checking');
  const mountedAt = useRef(Date.now());
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    mountedAt.current = Date.now();

    let pollTimer     = null;
    let deadlineTimer = null;

    const markReady = () => {
      if (cancelled.current) return;
      const elapsed   = Date.now() - mountedAt.current;
      const remaining = MIN_SHOW_MS - elapsed;
      if (remaining > 0) {
        setTimeout(() => { if (!cancelled.current) setPhase('ready'); }, remaining);
      } else {
        setPhase('ready');
      }
    };

    const attempt = async () => {
      if (cancelled.current) return;
      try {
        const res = await fetch(`${API_BASE}/health`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          clearTimeout(deadlineTimer);
          markReady();
          return;
        }
      } catch {
        // Server still booting — keep polling
      }
      if (!cancelled.current) {
        setPhase('waking');
        pollTimer = setTimeout(attempt, POLL_MS);
      }
    };

    deadlineTimer = setTimeout(() => {
      if (!cancelled.current) markReady();
    }, DEADLINE_MS);

    attempt();

    return () => {
      cancelled.current = true;
      clearTimeout(pollTimer);
      clearTimeout(deadlineTimer);
    };
  }, []);

  return phase;
};

// ── App shell ──────────────────────────────────────────────────────────────
//
// Key architectural decisions:
//
// 1. BrowserRouter lives OUTSIDE AppShell so that useLocation (used by
//    RouteProgressBar, PageTransition, TitleUpdater) is always available,
//    regardless of wake-screen state.
//
// 2. The wake screen and the real app are NEVER both mounted at once.
//    AnimatePresence with a boolean key drives the swap:
//      key="wake"  → wake screen fades IN on mount, fades OUT on unmount
//      key="app"   → real app fades IN once wake screen has fully exited
//    Framer's `mode="wait"` ensures exit completes before enter begins —
//    no overlap, no flash.
//
// 3. The real app renders with pointer-events:none during its own fade-in
//    so the user can't click mis-placed elements while opacity is < 1.
//
const WAKE_EXIT_MS = 340; // must match the exit transition duration below

const AppShell = ({ children }) => {
  const phase = useServerWake();
  const isReady = phase === 'ready';

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!isReady ? (
        // ── Wake screen ────────────────────────────────────────────────────
        // key="wake" is stable while server is not ready.
        // When isReady flips to true this element unmounts → exit plays.
        <motion.div
          key="wake"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: WAKE_EXIT_MS / 1000, ease: 'easeInOut' } }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
        >
          <ServerWakeScreen phase={phase} />
        </motion.div>
      ) : (
        // ── Real app ───────────────────────────────────────────────────────
        // key="app" mounts only after wake screen has fully exited.
        // pointerEvents auto once opacity reaches 1 (CSS handles this via
        // the opacity transition — we set it explicitly for safety).
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.28, ease: 'easeOut' } }}
          style={{ minHeight: '100vh' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Inner app (requires BrowserRouter context) ─────────────────────────────
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
        <Route path="/pricing"       element={<Pricing />} /> 
        <Route path="*"              element={<NotFound />} />
      </Routes>
    </PageTransition>
  </>
);

// ── Root App ───────────────────────────────────────────────────────────────
//
// BrowserRouter wraps everything so router context is always available,
// even during the wake screen phase. AppShell sits inside it so that
// InnerApp (which uses useLocation) inherits the context correctly.
//
export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppShell>
          <InnerApp />
        </AppShell>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
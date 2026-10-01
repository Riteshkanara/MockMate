import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ServerWakeScreen from './components/ServerWakeScreen';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import useAuth from './hooks/useAuth';
import API_BASE, { isServerLikelyWarm, markServerWarm } from './config/api';

// ── Route code-splitting ───────────────────────────────────────────────────
// Every page used to be bundled into ONE ~1.85 MB file that all visitors had
// to download before seeing anything. Now each page is its own chunk, fetched
// on demand. `routeLoaders` is the single source of truth so React.lazy and
// the prefetcher below share the SAME import() promise (the browser caches
// dynamic imports by URL, so a prefetch is never downloaded twice).
const routeLoaders = {
  '/':            () => import('./pages/Home'),
  '/p':           () => import('./pages/publicProfile'),
  '/auth/callback': () => import('./pages/AuthCallback'),
  '/onboarding':  () => import('./pages/Onboarding'),
  '/interview':   () => import('./pages/Interview'),
  '/result':      () => import('./pages/Result'),
  '/dashboard':   () => import('./pages/Dashboard'),
  '/history':     () => import('./pages/History'),
  '/analytics':   () => import('./pages/Analytics'),
  '/coach':       () => import('./pages/Coach'),
  '/leaderboard': () => import('./pages/Leaderboard'),
  '/pricing':     () => import('./pages/Pricing'),
};

// Stale-chunk recovery. After a redeploy, a tab that was opened BEFORE the
// deploy still points at old chunk filenames that no longer exist, so the next
// navigation fails with "Failed to fetch dynamically imported module". When
// that happens we reload ONCE (guarded to at most once per 10 s so a genuinely
// broken deploy can never cause a reload loop) to pick up the new build; if it
// still fails, the error propagates to <ErrorBoundary> as normal.
const CHUNK_ERR = /dynamically imported module|importing a module script|loading chunk|loading css chunk/i;
const lazyRoute = (loader) =>
  lazy(() =>
    loader().catch((err) => {
      if (CHUNK_ERR.test(String(err?.message || err))) {
        try {
          const last = Number(sessionStorage.getItem('mm_chunk_reload_at') || 0);
          if (Date.now() - last > 10000) {
            sessionStorage.setItem('mm_chunk_reload_at', String(Date.now()));
            window.location.reload();
            return new Promise(() => {}); // hold the Suspense fallback until the reload lands
          }
        } catch { /* storage unavailable — fall through to the error boundary */ }
      }
      throw err;
    })
  );

const Home         = lazyRoute(routeLoaders['/']);
const PublicProfile = lazyRoute(routeLoaders['/p']);
const AuthCallback = lazyRoute(routeLoaders['/auth/callback']);
const Onboarding   = lazyRoute(routeLoaders['/onboarding']);
const Interview    = lazyRoute(routeLoaders['/interview']);
const Result       = lazyRoute(routeLoaders['/result']);
const Dashboard    = lazyRoute(routeLoaders['/dashboard']);
const History      = lazyRoute(routeLoaders['/history']);
const Analytics    = lazyRoute(routeLoaders['/analytics']);
const Coach        = lazyRoute(routeLoaders['/coach']);
const Leaderboard  = lazyRoute(routeLoaders['/leaderboard']);
const Pricing      = lazyRoute(routeLoaders['/pricing']);

// Warm a page's chunk ahead of the click. Failures are swallowed (and the
// entry forgotten) — a failed prefetch must never surface as an error; the
// real navigation will simply fetch the chunk normally.
const prefetched = new Set();
const prefetchRoute = (pathname) => {
  const key = pathname.startsWith('/p/') ? '/p' : pathname;
  const loader = routeLoaders[key];
  if (!loader || prefetched.has(key)) return;
  prefetched.add(key);
  loader().catch(() => prefetched.delete(key));
};

const shouldSkipPrefetch = () => {
  const c = navigator.connection;
  return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
};

const RoutePrefetcher = () => {
  const { user } = useAuth();

  // 1. Intent-based: the moment a pointer/finger/keyboard focus lands on an
  //    internal link, start fetching that page's chunk (~100-300 ms head start).
  useEffect(() => {
    const onIntent = (e) => {
      if (shouldSkipPrefetch()) return;
      const a = e.target?.closest?.('a[href]');
      if (!a || a.target === '_blank') return;
      try {
        const url = new URL(a.href, window.location.origin);
        if (url.origin === window.location.origin) prefetchRoute(url.pathname);
      } catch { /* malformed href — ignore */ }
    };
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('touchstart',  onIntent, { passive: true });
    document.addEventListener('focusin',     onIntent);
    return () => {
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('touchstart',  onIntent);
      document.removeEventListener('focusin',     onIntent);
    };
  }, []);

  // 2. Idle-based: once a signed-in user is on the page, quietly fetch the
  //    two screens they are most likely to open next.
  useEffect(() => {
    if (!user || shouldSkipPrefetch()) return undefined;
    const run = () => { prefetchRoute('/dashboard'); prefetchRoute('/interview'); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 2000);
    return () => clearTimeout(id);
  }, [user]);

  return null;
};

// ── Suspense fallback (shown only while a page chunk is still downloading) ─
const RouteFallback = () => (
  <div aria-busy="true" style={{ minHeight: '100vh', background: '#F0F2F7', padding: '96px 20px 40px' }}>
    <style>{`
      @keyframes mmSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
      @keyframes mmPulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
    `}</style>
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 99999, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ height: '100%', width: '38%', background: 'linear-gradient(90deg,#1A6EFF,#00C8F0)', animation: 'mmSlide 1s ease-in-out infinite' }} />
    </div>
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 14 }}>
      {[54, 120, 120].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 16, background: '#E4E9F4', animation: `mmPulse 1.3s ease-in-out ${i * 0.12}s infinite` }} />
      ))}
    </div>
  </div>
);

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
// Kept intentionally brief: a quick sweep confirming the click registered.
// (It used to run a fixed ~920 ms regardless of how fast the page really was.)
// While a page chunk is genuinely downloading, RouteFallback shows its own
// indeterminate bar, so the two never lie about real progress.
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
      setTimeout(() => setProgress(70), 16),
      setTimeout(() => {
        setProgress(100);
        timers.current.push(setTimeout(() => setVisible(false), 180));
      }, 200),
    ];
    return clear;
  }, [location.pathname]);

  if (!visible) return null;
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, height:2, zIndex:99998, pointerEvents:'none' }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #1A6EFF 0%, #00C8F0 100%)',
        boxShadow: '0 0 10px rgba(0,200,240,0.55)',
        borderRadius: '0 2px 2px 0',
        transition: progress === 0 ? 'none'
          : progress === 100 ? 'width 0.16s ease'
          : 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
};

// ── Page transition ────────────────────────────────────────────────────────
// Enter-only. The old version used AnimatePresence mode="wait", which forced
// every navigation to sit through a 140 ms exit animation of the OLD page
// before the NEW page could even start (≈380 ms of dead time per click).
// Now the new page mounts immediately and fades up over 180 ms.
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } },
};

const PageTransition = ({ children }) => {
  const location = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);

  return (
    <motion.div
      key={location.pathname}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
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
// Phases:
//   'checking'  — haven't heard from the server yet
//   'waking'    — server not responding (cold start in progress)
//   'ready'     — server replied 200 (or we know it was awake moments ago)
//
// What changed (speed):
//   • No more artificial 1.5 s minimum on the wake screen — the app appears
//     the instant the server answers.
//   • If a /health call succeeded < 10 min ago the server cannot have gone to
//     sleep yet, so we start as 'ready' and render the app IMMEDIATELY; the
//     health check still runs in the background to confirm.
//   • The wake screen only appears after GRACE_MS of silence, so a warm-but-
//     slow network never flashes a full-screen loader for a blink.
//
// Safety: an optimistic 'ready' is only downgraded after TWO consecutive
// failed checks, so one dropped packet on a flaky mobile network can never
// kick a signed-in user out of the app.
//
const GRACE_MS    = 700;
const POLL_MS     = 3000;
const DEADLINE_MS = 50000;

const useServerWake = () => {
  const [phase, setPhase] = useState(() => (isServerLikelyWarm() ? 'ready' : 'checking'));
  const [graceOver, setGraceOver] = useState(false);
  const cancelled = useRef(false);
  const optimistic = useRef(phase === 'ready');

  useEffect(() => {
    cancelled.current = false;
    let pollTimer     = null;
    let deadlineTimer = null;
    let fails         = 0;

    const graceTimer = setTimeout(() => { if (!cancelled.current) setGraceOver(true); }, GRACE_MS);

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
          markServerWarm();
          if (!cancelled.current) setPhase('ready');
          return;
        }
      } catch {
        // Server still booting — keep polling
      }
      if (cancelled.current) return;
      fails += 1;
      // Optimistic-ready: tolerate a single blip before showing the wake screen.
      if (!(optimistic.current && fails < 2)) setPhase('waking');
      pollTimer = setTimeout(attempt, POLL_MS);
    };

    deadlineTimer = setTimeout(() => {
      if (!cancelled.current) setPhase('ready');
    }, DEADLINE_MS);

    attempt();

    return () => {
      cancelled.current = true;
      clearTimeout(pollTimer);
      clearTimeout(deadlineTimer);
      clearTimeout(graceTimer);
    };
  }, []);

  return { phase, graceOver };
};

// ── Boot splash ────────────────────────────────────────────────────────────
// Visually identical to the #pre-boot element in index.html, so the handoff
// from "HTML only" to "React mounted" is seamless and nothing flashes.
const BootSplash = () => (
  <div style={{ position: 'fixed', inset: 0, background: '#F0F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{
      width: 54, height: 54, borderRadius: 15,
      background: 'linear-gradient(135deg, #1A6EFF 0%, #3B8EFF 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 0 4px rgba(26,110,255,0.10), 0 6px 20px rgba(26,110,255,0.30)',
    }}>
      <svg width="32" height="32" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <path d="M13 36V19l13 10 13-10v17" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="13" cy="19" r="2.2" fill="white" opacity="0.65"/>
        <circle cx="39" cy="19" r="2.2" fill="white" opacity="0.65"/>
        <path d="M18 39h16" stroke="rgba(255,255,255,0.40)" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  </div>
);

// ── App shell ──────────────────────────────────────────────────────────────
//
// 1. BrowserRouter lives OUTSIDE AppShell so useLocation (RouteProgressBar,
//    PageTransition, TitleUpdater) is always available.
// 2. Only ONE of splash / wake screen / real app is mounted at a time.
//    AnimatePresence mode="wait" guarantees the exit finishes before the
//    next enters — no overlap, no flash. The splash exits instantly (0 ms);
//    the wake screen keeps its soft 340 ms fade because it's only ever seen
//    on a genuine cold start.
// 3. The real app is NOT mounted until the server is confirmed (or recently
//    known) awake, so page-level fetches never fire at a sleeping server.
//
const WAKE_EXIT_MS = 340;

const AppShell = ({ children }) => {
  const { phase, graceOver } = useServerWake();
  const isReady = phase === 'ready';
  const gate = isReady ? 'app' : (phase === 'checking' && !graceOver ? 'splash' : 'wake');

  return (
    <AnimatePresence mode="wait" initial={false}>
      {gate === 'splash' && (
        <motion.div
          key="splash"
          exit={{ opacity: 0, transition: { duration: 0 } }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
        >
          <BootSplash />
        </motion.div>
      )}
      {gate === 'wake' && (
        <motion.div
          key="wake"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: WAKE_EXIT_MS / 1000, ease: 'easeInOut' } }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
        >
          <ServerWakeScreen phase={phase} />
        </motion.div>
      )}
      {gate === 'app' && (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
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
    <RoutePrefetcher />
    <Navbar />
    <PageTransition>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </PageTransition>
  </>
);

// ── Root App ───────────────────────────────────────────────────────────────
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

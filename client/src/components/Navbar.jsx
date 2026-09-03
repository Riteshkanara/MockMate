import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';

// ═══════════════════════════════════════════════════════════════════════════
// Navbar — MockMate Capsule v8
//
// CHANGES FROM v7 (nothing else touched — same links, same logo, same layout):
//
// 1. ACTIVE-LINK BUG FIXED. v7 measured the pill with getBoundingClientRect()
//    against the viewport for both the link and the nav container, then took
//    their difference. That breaks the moment the nav shell scrolls
//    horizontally (which it does at the icon-only breakpoint below 1020px) —
//    the two viewport-relative rects fall out of sync and the pill lands on
//    the wrong button. Fixed by measuring with offsetLeft/offsetWidth, which
//    are relative to the scrolling shell itself, not the viewport, so they
//    stay correct at any scroll position. Also re-measures on the shell's
//    own scroll event (not just window resize) and scrolls the active link
//    into view if it's clipped.
// 2. Every button/CTA/active-state on the bar now uses one consistent blue
//    gloss treatment (buttons, active nav pill, avatar ring, CTA, login)
//    instead of the mixed navy/cyan/graphite palette — a tighter, more
//    "futuristic HUD" blue with real specular highlights instead of flat fill.
// 3. Google button now uses the actual 4-color Google "G" mark instead of a
//    flat monochrome letter.
//
// Nothing else changed: same NAV_LINKS, same dropdown items, same Logomark,
// same layout grid, same responsive breakpoints.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: '#F0F4FF',
  bgDeep: '#E8EEFF',
  card: '#FFFFFF',
  cardAlt: '#F8FAFF',
  cardGlass: 'rgba(255,255,255,0.82)',

  text: '#0A1628',
  sub: '#3D5280',
  muted: '#7A8BAF',
  faint: '#A8B8D4',

  border: '#DDE5F7',
  borderMd: '#B8CAF0',
  borderStr: '#7FA3E8',

  blue50: '#EBF2FF',
  blue100: '#C7DAFF',
  blue200: '#9DBFFF',
  blue300: '#6FA5FF',
  blue400: '#4D8FFF',
  blue500: '#1A6EFF',
  blue600: '#0057E8',
  blue700: '#0044C4',
  blue800: '#002E96',
  blue900: '#001F6B',

  navy: '#001445',

  cyan300: '#5FE0FF',
  cyan400: '#00C8F0',
  cyan500: '#00ADE0',
  cyan600: '#0093C4',
  cyanTint: '#E6F9FF',

  green: '#059669',
  greenTint: '#ECFDF5',
  amber: '#D97706',
  amberTint: '#FFFBEB',
  orange: '#EA580C',
  orangeTint: '#FFF7ED',
  red: '#DC2626',
  redTint: '#FEF2F2',

  shadow: '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const NAV_LINKS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  { label: 'History', path: '/history', icon: 'clock' },
  { label: 'Leaderboard', path: '/leaderboard', icon: 'trophy' },
  { label: 'Analytics', path: '/analytics', icon: 'chart' },
  { label: 'Coach', path: '/coach', icon: 'chat', badge: 'AI' },
];

const HIDDEN_ROUTES = ['/auth/callback', '/onboarding'];

const scoreColor = (s) => {
  const score = Number(s) || 0;
  if (score >= 80) return C.green;
  if (score >= 60) return C.blue500;
  if (score >= 40) return C.amber;
  return C.orange;
};

const scoreGlow = (s) => {
  const score = Number(s) || 0;
  if (score >= 80) return 'rgba(5,150,105,0.30)';
  if (score >= 60) return 'rgba(26,110,255,0.30)';
  if (score >= 40) return 'rgba(217,119,6,0.30)';
  return 'rgba(234,88,12,0.30)';
};

// ═══════════════════════════════════════════════════════════════════════════
// Navigation icons — unchanged from v7
// ═══════════════════════════════════════════════════════════════════════════

const NavIcon = ({ name, size = 17 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.35,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5.5v1.5A3.5 3.5 0 0 0 9 11" />
        <path d="M16 6h2.5v1.5A3.5 3.5 0 0 1 15 11" />
        <path d="M12 12.5V17" />
        <path d="M9 20h6" />
        <path d="M9.5 17h5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 3-4 3 2 5-7" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z" />
        <path d="m19 14 .6 2 1.9.9-1.9.9-.6 2-.6-2-1.9-.9 1.9-.9.6-2Z" />
      </>
    ),
    flame: (
      <>
        <path d="M13.2 2.8c.4 3-1.1 4.7-2.7 6.2-1.9 1.8-3.6 3.4-3.6 6.2A5.2 5.2 0 0 0 12 20.4a5.3 5.3 0 0 0 5.2-5.3c0-2.7-1.5-4.7-3.2-6.5-.8-.9-1-2.5-.8-5.8Z" />
        <path d="M11.9 11.4c-.8 1-1.6 2-1.6 3.5a1.8 1.8 0 0 0 3.6 0c0-1.3-.8-2.4-2-3.5Z" />
      </>
    ),
    trend: (
      <>
        <path d="M4 16.5 9 11l3.5 3.5L20 7" />
        <path d="M15.5 7H20v4.5" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
        <path d="M12 17.5V21" />
        <path d="M8.5 21h7" />
      </>
    ),
    chat: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
        <circle cx="9" cy="9.5" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="12.5" cy="9.5" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="16" cy="9.5" r="1.05" fill="currentColor" stroke="none" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" />
        <path d="M14 8l4 4-4 4M18 12H9" />
      </>
    ),
  };

  return (
    <svg {...common} aria-hidden="true">
      {paths[name] || paths.grid}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Google "G" mark — real 4-color logo, not a flat letter
// ═══════════════════════════════════════════════════════════════════════════

const GoogleG = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.69 28.18A13.96 13.96 0 0 1 10.93 24c0-1.45.25-2.86.76-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// Score ring
// ═══════════════════════════════════════════════════════════════════════════

const ScoreRing = ({ value = 0, size = 20, strokeW = 2, id = 'sr' }) => {
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circ - (pct / 100) * circ;
  const accent = scoreColor(pct);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`sg-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={strokeW} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#sg-${id})`}
        strokeWidth={strokeW}
        strokeDasharray={circ}
        strokeDashoffset={pct > 0 ? offset : circ}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}
      />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Logomark — UNCHANGED from v7, exactly as provided
// ═══════════════════════════════════════════════════════════════════════════

const Logomark = ({ irs = 0, size = 38, uid = 'default' }) => {
  const accent = scoreColor(irs);
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(irs) || 0));
  const offset = circ - (pct / 100) * circ;

  const gradId = `lm-g-${uid}`;
  const filterId = `lm-glow-${uid}`;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.blue500} />
            <stop offset="100%" stopColor={C.cyan400} />
          </linearGradient>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill={C.blue900} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={2.5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={2.5}
          strokeDasharray={circ}
          strokeDashoffset={pct > 0 ? offset : circ}
          strokeLinecap="round"
          filter={`url(#${filterId})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={C.cyan400} strokeWidth="1.5" opacity="0.35" />
          <circle cx="12" cy="12" r="4.5" stroke={C.cyan400} strokeWidth="1.5" opacity="0.65" />
          <circle cx="12" cy="12" r="1.6" fill={accent} />
          {[
            ['12', '2', '12', '5'],
            ['12', '19', '12', '22'],
            ['2', '12', '5', '12'],
            ['19', '12', '22', '12'],
          ].map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
          ))}
        </svg>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Navbar
// ═══════════════════════════════════════════════════════════════════════════

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  const dropRef = useRef(null);
  const shellRef = useRef(null);
  const linkRefs = useRef({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const irs = user?.irs ?? user?.readinessScore ?? 0;
  const avgScore = user?.averageScore ?? null;
  const streak = user?.streak?.current ?? 0;

  const tierLabel =
    user?.tierLabel ??
    (irs >= 80 ? '₹20 LPA+' : irs >= 60 ? '₹12–20 LPA' : irs >= 38 ? '₹6–12 LPA' : '₹3–6 LPA');

  const accent = scoreColor(irs);
  const initials = user?.name?.[0]?.toUpperCase() || 'M';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropOpen(false);
  }, [location.pathname]);

  // ───────────────────────────────────────────────────────────────────────
  // FIX: measure the active link relative to the scrolling shell itself
  // (offsetLeft / offsetWidth) instead of viewport rects. This is what
  // keeps the indicator locked onto the correct button even once the
  // shell has scrolled horizontally at the icon-only breakpoint. Also
  // recalculates on the shell's own scroll event, and brings a clipped
  // active link back into view.
  // ───────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const updateIndicator = () => {
      const active = linkRefs.current[location.pathname];
      if (!active) {
        setIndicator((prev) => ({ ...prev, opacity: 0 }));
        return;
      }
      setIndicator({
        left: active.offsetLeft,
        width: active.offsetWidth,
        opacity: 1,
      });
    };

    updateIndicator();

    const shell = shellRef.current;
    const active = linkRefs.current[location.pathname];
    if (shell && active) {
      const shellBox = shell.getBoundingClientRect();
      const linkBox = active.getBoundingClientRect();
      const isClipped = linkBox.left < shellBox.left || linkBox.right > shellBox.right;
      if (isClipped) {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    }

    window.addEventListener('resize', updateIndicator);
    shell?.addEventListener('scroll', updateIndicator, { passive: true });
    return () => {
      window.removeEventListener('resize', updateIndicator);
      shell?.removeEventListener('scroll', updateIndicator);
    };
  }, [location.pathname, user?.name]);

  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  const isActive = (path) => location.pathname === path;

  const capsuleShadow = scrolled
    ? `0 20px 56px rgba(0,31,107,.13), 0 4px 14px rgba(0,31,107,.06), inset 0 1px 0 rgba(255,255,255,.96)`
    : `0 12px 36px rgba(0,31,107,.08), 0 2px 8px rgba(0,31,107,.04), inset 0 1px 0 rgba(255,255,255,.95)`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }
        body { padding-top: 88px; }

        @keyframes mmOrb1 { 0%,100% { transform: translate(0,0) scale(1); opacity:.42; } 50% { transform: translate(22px,-6px) scale(1.09); opacity:.66; } }
        @keyframes mmOrb2 { 0%,100% { transform: translate(0,0) scale(1); opacity:.22; } 50% { transform: translate(-20px,7px) scale(1.11); opacity:.42; } }
        @keyframes mmOrb3 { 0%,100% { transform: translate(0,0) scale(1); opacity:.18; } 50% { transform: translate(10px,4px) scale(1.07); opacity:.30; } }
        @keyframes mmStreak { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
        @keyframes mmHolo { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
        @keyframes mmDropIn { from { opacity:0; transform: translateY(-9px) scale(.96); } to { opacity:1; transform: translateY(0) scale(1); } }
        @keyframes mmSlideDown { from { opacity:0; transform: translateY(-10px); } to { opacity:1; transform: translateY(0); } }
        @keyframes mmSheen { 0% { transform: translateX(-120%) skewX(-14deg); } 100% { transform: translateX(260%) skewX(-14deg); } }

        .mm-nav-root {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 1000;
          padding: 10px 16px;
          pointer-events: none;
        }

        .mm-nav-capsule {
          position: relative;
          width: min(1440px, 100%);
          min-height: 68px;
          margin: 0 auto;
          padding: 8px 9px;
          display: flex;
          align-items: center;
          border-radius: 23px;
          border: 1px solid rgba(180,210,255,.34);
          background: linear-gradient(145deg, rgba(255,255,255,.97) 0%, rgba(248,252,255,.94) 100%);
          backdrop-filter: blur(32px) saturate(200%);
          -webkit-backdrop-filter: blur(32px) saturate(200%);
          transition: box-shadow .35s ease, border-color .35s ease;
          pointer-events: auto;
        }

        .mm-nav-capsule::before {
          content: '';
          position: absolute;
          left: 8%; right: 8%; top: 0;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(26,110,255,.55), rgba(0,200,240,.50), rgba(26,110,255,.55), transparent);
          opacity: .75;
          pointer-events: none;
        }

        .mm-nav-capsule::after {
          content: '';
          position: absolute;
          left: 20%; right: 20%; bottom: -1px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(26,110,255,.22), transparent);
          pointer-events: none;
        }

        .mm-aurora { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
        .mm-orb { position: absolute; border-radius: 50%; filter: blur(18px); }
        .mm-orb-a { width: 340px; height: 80px; left: -60px; top: -22px; background: radial-gradient(ellipse, rgba(26,110,255,.10), transparent 70%); animation: mmOrb1 12s ease-in-out infinite; }
        .mm-orb-b { width: 280px; height: 70px; right: 4%; top: -14px; background: radial-gradient(ellipse, rgba(0,200,240,.08), transparent 70%); animation: mmOrb2 15s ease-in-out infinite; }
        .mm-orb-c { width: 200px; height: 55px; left: 38%; top: -10px; background: radial-gradient(ellipse, rgba(100,120,255,.06), transparent 70%); animation: mmOrb3 18s ease-in-out infinite; }

        .mm-nav-content {
          position: relative;
          z-index: 2;
          width: 100%;
          min-width: 0;
          min-height: 50px;
          display: grid;
          grid-template-columns: minmax(150px, 210px) minmax(420px, 1fr) auto;
          align-items: center;
          column-gap: 12px;
        }

        .mm-brand {
          min-width: 0;
          width: fit-content;
          max-width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          padding: 5px 12px 5px 5px;
          border-radius: 16px;
          text-decoration: none;
          transition: background .18s ease, transform .2s cubic-bezier(.22,1,.36,1);
        }

        .mm-brand:hover { background: rgba(235,242,255,.70); transform: translateY(-1px); }

        .mm-brand-copy { min-width: 0; display: flex; flex-direction: column; justify-content: center; }

        .mm-brand-title {
          font-family: ${F.display};
          font-size: 19px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -.065em;
          color: ${C.text};
          white-space: nowrap;
        }

        .mm-brand-title span {
          background: linear-gradient(118deg, ${C.blue600}, ${C.blue500} 52%, ${C.cyan500});
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .mm-brand-sub {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 5px;
          color: ${C.muted};
          font: 700 6.5px ${F.mono};
          letter-spacing: 1.15px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .mm-brand-dot { width: 5px; height: 5px; border-radius: 50%; background: ${C.cyan400}; box-shadow: 0 0 8px rgba(0,200,240,.6); flex-shrink: 0; }

        .mm-navigation { min-width: 0; display: flex; align-items: center; justify-content: center; width: 100%; }

        .mm-nav-shell {
          position: relative;
          min-width: 0;
          width: 100%;
          max-width: 640px;
          display: flex;
          align-items: center;
          padding: 5px;
          border: 1px solid rgba(180,205,255,.28);
          border-radius: 17px;
          background: rgba(255,255,255,.52);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.88), 0 3px 14px rgba(0,31,107,.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
        }

        .mm-nav-shell::-webkit-scrollbar { display: none; }

        .mm-link {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 42px;
          flex: 1 1 auto;
          min-width: 92px;
          padding: 0 14px;
          border: none;
          border-radius: 13px;
          background: transparent;
          color: ${C.sub};
          text-decoration: none;
          font: 700 13.5px ${F.body};
          white-space: nowrap;
          letter-spacing: -.012em;
          cursor: pointer;
          transition: color .18s ease, transform .2s cubic-bezier(.22,1,.36,1);
        }

        .mm-link:hover { color: ${C.text}; transform: translateY(-1px); }
        .mm-link.active { color: #fff; font-weight: 800; }

        .mm-link-icon {
          width: 29px;
          height: 29px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          color: ${C.blue700};
          background: ${C.blue50};
          flex-shrink: 0;
          transition: color .18s ease, background .18s ease, transform .2s ease;
        }

        .mm-link:hover .mm-link-icon { color: ${C.blue500}; background: ${C.blue100}; transform: rotate(-4deg) scale(1.08); }

        .mm-link.active .mm-link-icon { color: #fff; background: rgba(255,255,255,.20); }

        .mm-link-badge {
          padding: 2px 6px;
          border: 1px solid rgba(0,173,224,.24);
          border-radius: 5px;
          color: ${C.cyan600};
          background: ${C.cyanTint};
          font: 800 7.5px ${F.mono};
          letter-spacing: .4px;
          flex-shrink: 0;
        }

        .mm-link.active .mm-link-badge { color: #fff; border-color: rgba(255,255,255,.35); background: rgba(255,255,255,.18); }

        /* Active pill: gloss blue slab — the "one accent, done right" */
        .mm-pill {
          position: absolute;
          top: 50%;
          height: 42px;
          border-radius: 13px;
          transform: translateY(-50%);
          background: linear-gradient(155deg, ${C.blue400} 0%, ${C.blue600} 55%, ${C.blue700} 100%);
          box-shadow: 0 6px 18px rgba(26,110,255,.38), 0 2px 6px rgba(0,68,196,.22), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,20,80,.25);
          pointer-events: none;
          overflow: hidden;
          transition: left .4s cubic-bezier(.22,1,.36,1), width .4s cubic-bezier(.22,1,.36,1), opacity .2s ease;
        }

        .mm-pill::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 55%);
          pointer-events: none;
        }

        .mm-pill::after {
          content: '';
          position: absolute;
          left: 18%; right: 18%; bottom: 0;
          height: 2px;
          border-radius: 999px;
          background: ${C.cyan300};
          box-shadow: 0 0 10px rgba(95,224,255,.6);
        }

        .mm-right { min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-shrink: 0; }

        .mm-performance {
          display: flex;
          align-items: center;
          height: 52px;
          padding: 5px;
          gap: 4px;
          border: 1px solid ${C.border};
          border-radius: 17px;
          background: linear-gradient(135deg, rgba(255,255,255,.97), rgba(244,248,255,.94));
          box-shadow: 0 5px 20px rgba(0,31,107,.07), 0 1px 4px rgba(0,31,107,.04), inset 0 1px 0 rgba(255,255,255,.96);
          flex-shrink: 0;
          transition: transform .2s ease, box-shadow .2s ease;
        }

        .mm-performance:hover { transform: translateY(-1px); box-shadow: 0 9px 26px rgba(0,31,107,.10), inset 0 1px 0 rgba(255,255,255,.97); }

        .mm-stat {
          position: relative;
          height: 42px;
          min-width: 86px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px 0 6px;
          border-radius: 13px;
          background: linear-gradient(135deg, rgba(255,255,255,.92), var(--stat-bg, rgba(255,255,255,.4)));
          transition: transform .2s ease, background .18s ease, box-shadow .18s ease;
          overflow: hidden;
        }

        .mm-stat:hover { box-shadow: 0 4px 14px rgba(0,31,107,.08); }

        .mm-stat::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); }
        .mm-stat::after { content: ''; position: absolute; left: 10%; right: 10%; bottom: 1px; height: 2px; border-radius: 99px; background: linear-gradient(90deg, transparent, var(--stat-accent), transparent); opacity: .28; }
        .mm-stat:hover { background: linear-gradient(135deg, rgba(255,255,255,.99), var(--stat-bg, rgba(255,255,255,.6))); transform: translateY(-1px); }

        .mm-stat-icon { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 10px; color: var(--stat-accent); background: var(--stat-bg); flex-shrink: 0; transition: transform .2s ease; }
        .mm-stat:hover .mm-stat-icon { transform: scale(1.08) rotate(-5deg); }

        .mm-stat-label { color: ${C.muted}; font: 800 7px ${F.mono}; letter-spacing: .8px; line-height: 1; text-transform: uppercase; }
        .mm-stat-value { color: var(--stat-accent); font: 900 18.5px ${F.display}; line-height: .95; letter-spacing: -.055em; }
        .mm-stat-value small { margin-left: 1px; font: 800 7.5px ${F.mono}; letter-spacing: 0; }

        .mm-streak { --stat-accent: ${C.orange}; --stat-bg: rgba(234,88,12,.085); animation: mmStreak 3.8s ease-in-out infinite; }
        .mm-avg { --stat-accent: ${C.cyan500}; --stat-bg: rgba(0,173,224,.07); }
        .mm-irs { --stat-accent: ${accent}; --stat-bg: ${accent}12; min-width: 90px; }

        .mm-perf-div { width: 1px; height: 22px; background: ${C.border}; flex-shrink: 0; }

        /* Primary blue gloss CTA — used for "New Interview" everywhere */
        .mm-cta {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 45px;
          padding: 0 16px 0 8px;
          border: none;
          border-radius: 14px;
          color: #fff;
          background: linear-gradient(155deg, ${C.blue400} 0%, ${C.blue600} 50%, ${C.blue700} 100%);
          font: 700 12.5px ${F.body};
          letter-spacing: -.01em;
          white-space: nowrap;
          cursor: pointer;
          box-shadow: 0 10px 26px rgba(26,110,255,.34), 0 3px 8px rgba(0,68,196,.18), inset 0 1px 0 rgba(255,255,255,.40), inset 0 -1px 0 rgba(0,20,80,.20);
          transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease;
          flex-shrink: 0;
        }

        .mm-cta::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,0) 55%); pointer-events: none; }
        .mm-cta::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 45%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.45), transparent); transform: translateX(-160%) skewX(-14deg); transition: transform .7s cubic-bezier(.22,1,.36,1); pointer-events: none; }
        .mm-cta:hover::after { transform: translateX(280%) skewX(-14deg); }
        .mm-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(26,110,255,.42), 0 4px 10px rgba(0,68,196,.22), inset 0 1px 0 rgba(255,255,255,.45); }
        .mm-cta:active { transform: scale(.97); }

        .mm-cta-icon { position: relative; z-index: 1; width: 29px; height: 29px; display: flex; align-items: center; justify-content: center; border-radius: 9px; background: rgba(255,255,255,.20); border: 1px solid rgba(255,255,255,.28); box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset; flex-shrink: 0; }
        .mm-cta-text { position: relative; z-index: 1; }

        .mm-profile-wrap { position: relative; flex-shrink: 0; }

        /* Profile button: same card chrome as v7, blue-gloss ring + focus */
        .mm-av-btn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          height: 45px;
          padding: 5px 8px 5px 6px;
          border: 1px solid ${C.border};
          border-radius: 15px;
          background: rgba(255,255,255,.88);
          box-shadow: 0 3px 10px rgba(0,31,107,.05), inset 0 1px 0 rgba(255,255,255,.9);
          cursor: pointer;
          transition: all .22s cubic-bezier(.22,1,.36,1);
          max-width: 190px;
        }

        .mm-av-btn:hover { background: #fff; border-color: ${C.blue300}; transform: translateY(-1px); box-shadow: 0 8px 22px rgba(26,110,255,.16), inset 0 1px 0 rgba(255,255,255,.95); }
        .mm-av-btn:active { transform: scale(.975); }

        .mm-av-meta { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; text-align: left; }
        .mm-av-sub { display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--stat-accent, ${C.muted}); font: 700 8.5px ${F.mono}; letter-spacing: .2px; }
        .mm-av-sub-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

        .mm-chevron-wrap { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 8px; background: ${C.blue50}; border: 1px solid ${C.border}; flex-shrink: 0; transition: background .18s ease, transform .22s ease, border-color .18s ease; color: ${C.blue600}; }
        .mm-av-btn:hover .mm-chevron-wrap { background: ${C.blue100}; border-color: ${C.blue300}; }
        .mm-av-btn[aria-expanded="true"] .mm-chevron-wrap { background: ${C.blue600}; border-color: ${C.blue600}; color: #fff; }

        .mm-av-ring {
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          background: linear-gradient(150deg, ${C.blue400}, ${C.blue600} 60%, ${C.blue800});
          box-shadow: 0 3px 10px rgba(26,110,255,.40), inset 0 1px 0 rgba(255,255,255,.35);
          flex-shrink: 0;
        }

        .mm-av-inner { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: ${C.card}; color: ${C.blue700}; font: 800 12px ${F.display}; }

        .mm-av-name { min-width: 0; max-width: 108px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${C.text}; font: 800 12.5px ${F.display}; letter-spacing: -.01em; }
        .mm-chevron { color: currentColor; flex-shrink: 0; transition: transform .22s ease; }
        .mm-av-btn[aria-expanded="true"] .mm-chevron { transform: rotate(180deg); }

        .mm-drop {
          position: absolute;
          top: calc(100% + 11px);
          right: 0;
          width: 292px;
          padding: 6px;
          border: 1.5px solid ${C.border};
          border-radius: 20px;
          background: rgba(255,255,255,.98);
          backdrop-filter: blur(30px) saturate(200%);
          -webkit-backdrop-filter: blur(30px) saturate(200%);
          box-shadow: 0 28px 70px rgba(0,31,107,.18), 0 6px 20px rgba(0,31,107,.08), inset 0 1px 0 rgba(255,255,255,.95);
          animation: mmDropIn .2s cubic-bezier(.22,1,.36,1);
          z-index: 100;
        }

        .mm-drop::before { content: ''; position: absolute; left: 10%; right: 10%; top: 0; height: 1px; border-radius: 999px; background: linear-gradient(90deg, transparent, rgba(26,110,255,.40), transparent); pointer-events: none; }

        .mm-drop-profile { padding: 13px; border-radius: 14px; background: linear-gradient(150deg, ${C.blue50}, #fff 60%); border: 1px solid ${C.border}; }
        .mm-drop-top { display: flex; align-items: center; gap: 10px; }
        .mm-drop-meta { min-width: 0; flex: 1; }
        .mm-drop-name { color: ${C.text}; font: 800 14px ${F.display}; }
        .mm-drop-college { margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${C.muted}; font: 500 10px ${F.body}; }

        .mm-drop-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-top: 12px; }
        .mm-drop-stat { padding: 9px 4px; text-align: center; border: 1px solid ${C.border}; border-radius: 11px; background: #fff; transition: transform .18s ease, box-shadow .18s ease; }
        .mm-drop-stat:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,31,107,.07); }
        .mm-drop-stat-value { font: 800 15px ${F.display}; }
        .mm-drop-stat-label { margin-top: 3px; color: ${C.muted}; font: 700 6.5px ${F.mono}; letter-spacing: .4px; }

        .mm-tier { display: inline-flex; align-items: center; gap: 5px; margin-top: 11px; padding: 4px 9px; border: 1px solid ${C.borderMd}; border-radius: 999px; color: ${C.blue600}; background: ${C.blue50}; font: 700 8px ${F.mono}; letter-spacing: .35px; }
        .mm-tier-dot { width: 5px; height: 5px; border-radius: 50%; background: ${C.blue500}; box-shadow: 0 0 8px rgba(26,110,255,.40); }

        .mm-drop-divider { height: 1px; background: ${C.border}; margin: 6px 0; }

        .mm-drop-item { width: 100%; display: flex; align-items: center; gap: 9px; padding: 9px 10px; border: none; border-radius: 11px; background: transparent; color: ${C.sub}; font: 600 12px ${F.body}; text-align: left; cursor: pointer; transition: background .14s ease, color .14s ease, transform .16s ease; }
        .mm-drop-item:hover { color: ${C.blue600}; background: ${C.blue50}; transform: translateX(2px); }
        .mm-drop-item.danger { color: ${C.red}; }
        .mm-drop-item.danger:hover { background: ${C.redTint}; color: ${C.red}; transform: translateX(2px); }

        .mm-drop-icon { width: 29px; height: 29px; display: grid; place-items: center; border: 1px solid ${C.border}; border-radius: 9px; background: ${C.cardAlt}; flex-shrink: 0; transition: background .14s ease, border-color .14s ease, color .14s ease; }
        .mm-drop-item:hover .mm-drop-icon { background: ${C.blue100}; border-color: ${C.blue300}; color: ${C.blue700}; }
        .mm-drop-item.danger:hover .mm-drop-icon { background: #fecaca; border-color: #fca5a5; color: ${C.red}; }

        /* Google sign-in button: white surface + real 4-color G, blue-tinted chrome to match the rest of the bar */
        .mm-login {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 45px;
          padding: 0 18px 0 8px;
          border: 1px solid ${C.border};
          border-radius: 14px;
          background: #fff;
          color: ${C.text};
          text-decoration: none;
          font: 700 12.5px ${F.body};
          box-shadow: 0 3px 10px rgba(0,31,107,.06), inset 0 1px 0 rgba(255,255,255,.9);
          transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease, border-color .22s ease;
          white-space: nowrap;
        }

        .mm-login:hover { transform: translateY(-2px); border-color: ${C.blue300}; box-shadow: 0 12px 28px rgba(26,110,255,.20), inset 0 1px 0 rgba(255,255,255,.95); }
        .mm-login:active { transform: scale(.97); }

        .mm-google { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px; background: ${C.blue50}; flex-shrink: 0; }

        .mm-mobile-controls { display: none; align-items: center; gap: 7px; flex-shrink: 0; }

        .mm-ham { width: 42px; height: 42px; border: 1px solid ${C.border}; border-radius: 12px; background: rgba(255,255,255,.84); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: border-color .18s ease, background .18s ease; }
        .mm-ham:hover { background: #fff; border-color: ${C.blue300}; }
        .mm-ham .bar { width: 17px; height: 2px; border-radius: 3px; background: ${C.blue600}; transition: all .24s cubic-bezier(.22,1,.36,1); }
        .mm-ham.open .bar:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
        .mm-ham.open .bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .mm-ham.open .bar:nth-child(3) { transform: rotate(-45deg) translate(4.5px,-4.5px); }

        .mm-mobile-panel {
          position: absolute;
          left: 9px; right: 9px;
          top: calc(100% + 9px);
          display: block;
          padding: 10px;
          border: 1px solid ${C.border};
          border-radius: 20px;
          background: rgba(255,255,255,.98);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          box-shadow: 0 24px 62px rgba(0,31,107,.16);
          animation: mmSlideDown .22s ease;
        }

        .mm-mobile-user { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid ${C.border}; border-radius: 15px; background: linear-gradient(150deg, ${C.blue50}, ${C.cardAlt}); }
        .mm-mobile-user-main { flex: 1; min-width: 0; }
        .mm-mobile-user-name { color: ${C.text}; font: 800 13px ${F.display}; }
        .mm-mobile-user-sub { margin-top: 2px; color: ${C.muted}; font: 500 9.5px ${F.body}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mm-mobile-user-tier { padding: 4px 7px; border: 1px solid ${C.borderMd}; border-radius: 999px; color: ${C.blue600}; background: ${C.blue50}; font: 700 7px ${F.mono}; flex-shrink: 0; }

        .mm-mobile-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; margin: 10px 0 12px; }
        .mm-mobile-stat { padding: 11px 5px; text-align: center; border: 1px solid ${C.border}; border-radius: 14px; background: #fff; transition: transform .18s ease; }
        .mm-mobile-stat:hover { transform: translateY(-1px); }
        .mm-mobile-stat-value { font: 900 17px ${F.display}; letter-spacing: -.04em; }
        .mm-mobile-stat-label { margin-top: 3px; color: ${C.muted}; font: 700 7px ${F.mono}; letter-spacing: .45px; }

        .mm-mobile-link {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 13px 12px;
          border: none;
          border-radius: 14px;
          background: transparent;
          color: ${C.sub};
          text-decoration: none;
          font: 700 14px ${F.body};
          cursor: pointer;
        }

        .mm-mobile-link:hover { background: ${C.blue50}; color: ${C.blue600}; }
        .mm-mobile-link.active { background: linear-gradient(150deg, ${C.blue500}, ${C.blue700}); color: #fff; font-weight: 800; box-shadow: 0 6px 18px rgba(26,110,255,.30); }

        .mm-mobile-link-icon {
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          color: ${C.blue700};
          background: ${C.blue50};
          flex-shrink: 0;
        }

        .mm-mobile-link.active .mm-mobile-link-icon { color: #fff; background: rgba(255,255,255,.20); }

        .mm-mobile-logout { color: ${C.red}; background: ${C.redTint}; margin-top: 8px; }
        .mm-mobile-logout:hover { background: #fee2e2; color: ${C.red}; }

        .mm-mobile-cta { width: 100% !important; display: inline-flex !important; justify-content: center; margin-top: 8px; }

        .mm-focus:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 2px; }

        @media (max-width: 1480px) {
          .mm-nav-content { grid-template-columns: minmax(150px, 200px) minmax(380px, 1fr) auto; }
          .mm-stat { min-width: 74px; }
        }

        @media (max-width: 1360px) {
          .mm-performance { display: none; }
        }

        @media (max-width: 1300px) {
          .mm-nav-content { grid-template-columns: minmax(140px, 185px) minmax(340px, 1fr) auto; column-gap: 8px; }
          .mm-brand-title { font-size: 18px; }
          .mm-link { min-width: 82px; padding: 0 10px; height: 40px; }
          .mm-pill { height: 40px; }
        }

        @media (max-width: 1120px) {
          .mm-brand-sub { display: none; }
          .mm-brand-title { font-size: 17px; }
        }

        @media (max-width: 1020px) {
          .mm-nav-content { grid-template-columns: minmax(130px, 170px) minmax(260px, 1fr) auto; }
          .mm-navigation { justify-content: flex-start; }
          .mm-nav-shell { width: 100%; max-width: none; }
          .mm-link { flex: 1 1 0; min-width: 52px; padding: 0 6px; gap: 0; }
          .mm-link-label { display: none; }
          .mm-link-icon { width: 32px; height: 32px; }
          .mm-link-badge { position: absolute; top: 4px; right: 4px; padding: 1px 4px; font-size: 6px; }
          .mm-cta-text { font-size: 11.5px; }
        }

        @media (max-width: 830px) {
          body { padding-top: 80px; }
          .mm-nav-root { padding: 9px 10px; }
          .mm-nav-capsule { min-height: 62px; border-radius: 19px; padding: 6px; }
          .mm-nav-content { display: flex; gap: 0; }
          .mm-brand { padding-right: 8px; }
          .mm-brand-title { font-size: 17px; }
          .mm-navigation { display: none; }
          .mm-right { margin-left: auto; gap: 7px; }
          .mm-profile-wrap { display: none; }
          .mm-cta.desktop-only { display: none; }
          .mm-mobile-controls { display: flex; }
        }

        @media (min-width: 831px) {
          .mm-mobile-controls { display: none !important; }
          .mm-mobile-panel { display: none !important; }
        }

        @media (max-width: 560px) {
          .mm-nav-root { padding-left: 8px; padding-right: 8px; }
          .mm-nav-capsule { border-radius: 18px; }
          .mm-brand-title { font-size: 16px; }
          .mm-brand { gap: 8px; }
          .mm-cta { height: 41px; }
          .mm-mobile-panel { left: 6px; right: 6px; }
        }

        @media (max-width: 430px) {
          .mm-brand-sub { display: none; }
          .mm-brand-title { font-size: 15.5px; }
          .mm-cta-text { display: none; }
          .mm-cta { width: 42px; padding: 0; }
          .mm-cta-icon { width: 28px; }
          .mm-ham { width: 41px; height: 41px; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <nav className="mm-nav-root" aria-label="Main navigation">
        <div className="mm-nav-capsule" style={{ boxShadow: capsuleShadow }}>

          <div className="mm-aurora">
            <div className="mm-orb mm-orb-a" />
            <div className="mm-orb mm-orb-b" />
            <div className="mm-orb mm-orb-c" />
          </div>

          <div className="mm-nav-content">

            <Link to={user ? '/dashboard' : '/'} className="mm-brand mm-focus">
              <Logomark irs={irs} size={38} uid="navbar" />
              <div className="mm-brand-copy">
                <div className="mm-brand-title">
                  Mock<span>Mate</span>
                </div>
                <div className="mm-brand-sub">
                  <span className="mm-brand-dot" />
                  AI Interview
                </div>
              </div>
            </Link>

            {user && (
              <div className="mm-navigation">
                <div ref={shellRef} className="mm-nav-shell">
                  <div
                    className="mm-pill"
                    style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
                  />

                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.path}
                      ref={(el) => { linkRefs.current[link.path] = el; }}
                      to={link.path}
                      className={`mm-link mm-focus ${isActive(link.path) ? 'active' : ''}`}
                    >
                      <span className="mm-link-icon">
                        <NavIcon name={link.icon} size={16} />
                      </span>

                      <span className="mm-link-label">{link.label}</span>

                      {link.badge && <span className="mm-link-badge">{link.badge}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mm-right">

              {user ? (
                <>
                  <div className="mm-performance">

                    <div className="mm-stat mm-streak" style={{ border: '1px solid rgba(234,88,12,.18)' }}>
                      <span className="mm-stat-icon"><NavIcon name="flame" size={15} /></span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="mm-stat-label">STREAK</span>
                        <span className="mm-stat-value">{streak}<small>d</small></span>
                      </span>
                    </div>

                    <div className="mm-perf-div" />

                    <div className="mm-stat mm-avg" style={{ border: '1px solid rgba(0,173,224,.18)' }}>
                      <span className="mm-stat-icon"><NavIcon name="trend" size={15} /></span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="mm-stat-label">AVG</span>
                        <span className="mm-stat-value">{avgScore ?? '—'}</span>
                      </span>
                    </div>

                    <div className="mm-perf-div" />

                    <div className="mm-stat mm-irs" style={{ border: `1px solid ${accent}45` }}>
                      <span className="mm-stat-icon" style={{ background: `${accent}12` }}>
                        <ScoreRing value={irs} size={22} strokeW={2.4} id="nav-irs" />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="mm-stat-label">IRS</span>
                        <span className="mm-stat-value" style={{ color: accent, textShadow: `0 0 14px ${scoreGlow(irs)}` }}>
                          {irs}
                        </span>
                      </span>
                    </div>
                  </div>

                  <button className="mm-cta desktop-only mm-focus" onClick={() => navigate('/interview')}>
                    <span className="mm-cta-icon"><NavIcon name="mic" size={14} /></span>
                    <span className="mm-cta-text">New Interview</span>
                  </button>

                  <div ref={dropRef} className="mm-profile-wrap">
                    <button
                      className="mm-av-btn mm-focus"
                      onClick={() => setDropOpen((v) => !v)}
                      aria-expanded={dropOpen}
                      aria-haspopup="menu"
                    >
                      <div className="mm-av-ring">
                        <div className="mm-av-inner">{initials}</div>
                      </div>

                      <span className="mm-av-meta">
                        <span className="mm-av-name">{user.name?.split(' ')[0]}</span>
                        <span className="mm-av-sub" style={{ '--stat-accent': accent }}>
                          <span className="mm-av-sub-dot" />
                          IRS {irs}
                        </span>
                      </span>

                      <span className="mm-chevron-wrap">
                        <svg
                          className="mm-chevron"
                          width="9" height="9" viewBox="0 0 10 10" fill="none"
                        >
                          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>

                    {dropOpen && (
                      <div className="mm-drop" role="menu">
                        <div className="mm-drop-profile">
                          <div className="mm-drop-top">
                            <div className="mm-av-ring">
                              <div className="mm-av-inner">{initials}</div>
                            </div>

                            <div className="mm-drop-meta">
                              <div className="mm-drop-name">{user.name?.split(' ')[0]}</div>
                              <div className="mm-drop-college">{user.college ?? 'MockMate User'}</div>
                            </div>

                            <ScoreRing value={irs} size={30} strokeW={2.4} id="drop-irs" />
                          </div>

                          <div className="mm-drop-stats">
                            {[
                              { value: irs, color: scoreColor(irs), label: 'IRS' },
                              { value: avgScore ?? '—', color: C.cyan500, label: 'AVG' },
                              { value: streak, color: C.orange, label: 'STREAK' },
                            ].map(({ value, color, label }) => (
                              <div className="mm-drop-stat" key={label}>
                                <div className="mm-drop-stat-value" style={{ color }}>{value}</div>
                                <div className="mm-drop-stat-label">{label}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mm-tier">
                            <span className="mm-tier-dot" />
                            {tierLabel} eligible
                          </div>
                        </div>

                        {[
                          { icon: 'grid', label: 'Dashboard', path: '/dashboard' },
                          { icon: 'clock', label: 'Interview history', path: '/history' },
                          { icon: 'trophy', label: 'Leaderboard', path: '/leaderboard' },
                          { icon: 'chart', label: 'Analytics', path: '/analytics' },
                          { icon: 'mic', label: 'New interview', path: '/interview' },
                        ].map((item) => (
                          <button
                            key={item.path}
                            className="mm-drop-item mm-focus"
                            role="menuitem"
                            onClick={() => { setDropOpen(false); navigate(item.path); }}
                          >
                            <span className="mm-drop-icon"><NavIcon name={item.icon} size={15} /></span>
                            {item.label}
                          </button>
                        ))}

                        <div className="mm-drop-divider" />

                        <button
                          className="mm-drop-item danger mm-focus"
                          role="menuitem"
                          onClick={() => { setDropOpen(false); logout(); }}
                        >
                          <span className="mm-drop-icon"><NavIcon name="logout" size={15} /></span>
                          Logout
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mm-mobile-controls">
                    <button
                      className="mm-cta mm-focus"
                      style={{ height: 41, padding: '0 10px' }}
                      onClick={() => navigate('/interview')}
                    >
                      <span className="mm-cta-icon"><NavIcon name="mic" size={14} /></span>
                      <span className="mm-cta-text">New</span>
                    </button>

                    <button
                      className={`mm-ham mm-focus ${mobileOpen ? 'open' : ''}`}
                      onClick={() => setMobileOpen((v) => !v)}
                      aria-expanded={mobileOpen}
                      aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    >
                      <span className="bar" />
                      <span className="bar" />
                      <span className="bar" />
                    </button>
                  </div>
                </>
              ) : (
                <a href={`${API_BASE}/auth/google`} className="mm-login mm-focus">
                  <span className="mm-google"><GoogleG size={17} /></span>
                  <span className="mm-login-text">Sign in with Google</span>
                </a>
              )}
            </div>
          </div>

          {mobileOpen && user && (
            <div className="mm-mobile-panel">

              <div className="mm-mobile-user">
                <div className="mm-av-ring">
                  <div className="mm-av-inner">{initials}</div>
                </div>

                <div className="mm-mobile-user-main">
                  <div className="mm-mobile-user-name">{user.name?.split(' ')[0]}</div>
                  <div className="mm-mobile-user-sub">{user.college ?? 'MockMate User'}</div>
                </div>

                <span className="mm-mobile-user-tier">{tierLabel}</span>
              </div>

              <div className="mm-mobile-stats">
                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-value" style={{ color: C.orange }}>🔥 {streak}</div>
                  <div className="mm-mobile-stat-label">STREAK</div>
                </div>

                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-value" style={{ color: C.cyan500 }}>{avgScore ?? '—'}</div>
                  <div className="mm-mobile-stat-label">AVG</div>
                </div>

                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-value" style={{ color: accent }}>{irs}</div>
                  <div className="mm-mobile-stat-label">IRS</div>
                </div>
              </div>

              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`mm-mobile-link mm-focus ${isActive(link.path) ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="mm-mobile-link-icon">
                    <NavIcon name={link.icon} size={17} />
                  </span>

                  {link.label}

                  {link.badge && (
                    <span className="mm-link-badge" style={{ marginLeft: 'auto' }}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}

              <button
                className="mm-cta mm-mobile-cta mm-focus"
                onClick={() => { setMobileOpen(false); navigate('/interview'); }}
              >
                <span className="mm-cta-icon"><NavIcon name="mic" size={14} /></span>
                <span className="mm-cta-text">New Interview</span>
              </button>

              <button
                className="mm-mobile-link mm-mobile-logout mm-focus"
                onClick={() => { setMobileOpen(false); logout(); }}
              >
                <span className="mm-mobile-link-icon" style={{ background: C.redTint, color: C.red }}>
                  <NavIcon name="logout" size={17} />
                </span>
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;  
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';

// ═══════════════════════════════════════════════════════════════════════════
// Navbar — MockMate v9
// Design: Light white capsule, PostHog-style minimal right profile icon,
// Apple Vision Pro-inspired blue gloss active pill + Interview CTA,
// clean text-only nav links, editorial spacing.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: '#F0F4FF',
  card: '#FFFFFF',

  text: '#0A1628',
  sub: '#4A5878',
  muted: '#8494B2',
  faint: '#C2CEEA',

  border: 'rgba(210,220,245,0.7)',
  borderMd: 'rgba(180,200,240,0.9)',

  blue50: '#EBF2FF',
  blue100: '#C7DAFF',
  blue300: '#6FA5FF',
  blue400: '#4D8FFF',
  blue500: '#1A6EFF',
  blue600: '#0057E8',
  blue700: '#0044C4',
  blue800: '#002E96',
  blue900: '#001F6B',

  cyan300: '#5FE0FF',
  cyan400: '#00C8F0',
  cyan500: '#00ADE0',

  orange: '#EA580C',
  red: '#DC2626',
  redTint: '#FEF2F2',
  green: '#059669',
  amber: '#D97706',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
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

// ─── Icons ────────────────────────────────────────────────────────────────

const NavIcon = ({ name, size = 16 }) => {
  const common = {
    width: size, height: size,
    viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2.2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
    trophy: <><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.5v1.5A3.5 3.5 0 0 0 9 11"/><path d="M16 6h2.5v1.5A3.5 3.5 0 0 1 15 11"/><path d="M12 12.5V17"/><path d="M9 20h6"/><path d="M9.5 17h5"/></>,
    chart: <><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></>,
    chat: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"/><circle cx="9" cy="9.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="12.5" cy="9.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="16" cy="9.5" r="1.05" fill="currentColor" stroke="none"/></>,
    mic: <><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/></>,
    logout: <><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10"/><path d="M14 8l4 4-4 4M18 12H9"/></>,
    flame: <><path d="M13.2 2.8c.4 3-1.1 4.7-2.7 6.2-1.9 1.8-3.6 3.4-3.6 6.2A5.2 5.2 0 0 0 12 20.4a5.3 5.3 0 0 0 5.2-5.3c0-2.7-1.5-4.7-3.2-6.5-.8-.9-1-2.5-.8-5.8Z"/><path d="M11.9 11.4c-.8 1-1.6 2-1.6 3.5a1.8 1.8 0 0 0 3.6 0c0-1.3-.8-2.4-2-3.5Z"/></>,
    trend: <><path d="M4 16.5 9 11l3.5 3.5L20 7"/><path d="M15.5 7H20v4.5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>,
    chevDown: <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    spark: <><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z"/><path d="m19 14 .6 2 1.9.9-1.9.9-.6 2-.6-2-1.9-.9 1.9-.9.6-2Z"/></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name] || paths.grid}</svg>;
};

const GoogleG = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.69 28.18A13.96 13.96 0 0 1 10.93 24c0-1.45.25-2.86.76-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
  </svg>
);

// ─── Logomark (unchanged) ──────────────────────────────────────────────────

const Logomark = ({ irs = 0, size = 36, uid = 'default' }) => {
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
            <stop offset="0%" stopColor={C.blue500}/>
            <stop offset="100%" stopColor={C.cyan400}/>
          </linearGradient>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill={C.blue900}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={2.5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={2.5}
          strokeDasharray={circ} strokeDashoffset={pct > 0 ? offset : circ} strokeLinecap="round"
          filter={`url(#${filterId})`} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={C.cyan400} strokeWidth="1.5" opacity="0.35"/>
          <circle cx="12" cy="12" r="4.5" stroke={C.cyan400} strokeWidth="1.5" opacity="0.65"/>
          <circle cx="12" cy="12" r="1.6" fill={accent}/>
          {[['12','2','12','5'],['12','19','12','22'],['2','12','5','12'],['19','12','22','12']].map(([x1,y1,x2,y2],i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/>
          ))}
        </svg>
      </div>
    </div>
  );
};

// ─── Score Ring ────────────────────────────────────────────────────────────

const ScoreRing = ({ value = 0, size = 20, strokeW = 2, id = 'sr' }) => {
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circ - (pct / 100) * circ;
  const accent = scoreColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={accent}/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={strokeW}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#sg-${id})`} strokeWidth={strokeW}
        strokeDasharray={circ} strokeDashoffset={pct > 0 ? offset : circ} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}/>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Navbar Component
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
  const accent = scoreColor(irs);
  const initials = user?.name?.[0]?.toUpperCase() || 'M';

  const tierLabel =
    user?.tierLabel ??
    (irs >= 80 ? '₹20 LPA+' : irs >= 60 ? '₹12–20 LPA' : irs >= 38 ? '₹6–12 LPA' : '₹3–6 LPA');

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

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const active = linkRefs.current[location.pathname];
      if (!active) { setIndicator(prev => ({ ...prev, opacity: 0 })); return; }
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth, opacity: 1 });
    };
    updateIndicator();
    const shell = shellRef.current;
    const active = linkRefs.current[location.pathname];
    if (shell && active) {
      const shellBox = shell.getBoundingClientRect();
      const linkBox = active.getBoundingClientRect();
      if (linkBox.left < shellBox.left || linkBox.right > shellBox.right) {
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

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { padding-top: 100px; }
        

        /* ── Animations ── */
        @keyframes mmDropIn { from { opacity:0; transform:translateY(-8px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes mmSlideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mmSheen { 0% { transform:translateX(-120%) skewX(-14deg); } 100% { transform:translateX(260%) skewX(-14deg); } }

        /* ── Root shell ── */
        .mm-root {
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 1000;
          padding: 10px 20px;
          pointer-events: none;
        }

        /* ── Main capsule — white glass ── */
        .mm-capsule {
          position: relative;
          width: min(1440px, 100%);
          margin: 0 auto;
          padding: 6px 6px 6px 8px;
          display: flex;
          align-items: center;
          min-height: 64px;
          border-radius: 20px;
          border: 1px solid rgba(210,222,248,0.80);
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          transition: box-shadow .3s ease;
          pointer-events: auto;
        }

        .mm-capsule.scrolled {
          box-shadow: 0 8px 40px rgba(0,31,107,.10), 0 2px 10px rgba(0,31,107,.05), inset 0 1px 0 rgba(255,255,255,.98);
        }

        /* top specular line */
        .mm-capsule::before {
          content: '';
          position: absolute;
          left: 6%; right: 6%; top: 0;
          height: 1px; border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(26,110,255,.35), rgba(0,200,240,.30), rgba(26,110,255,.35), transparent);
          opacity: .6;
          pointer-events: none;
        }

        /* ── Brand ── */
        .mm-brand {
          display: flex; align-items: center; gap: 9px;
          text-decoration: none;
          padding: 4px 12px 4px 4px;
          border-radius: 14px;
          flex-shrink: 0;
          transition: background .15s ease;
        }
        .mm-brand:hover { background: rgba(235,242,255,.6); }

        .mm-brand-title {
          font-family: ${F.display};
          font-size: 18px; font-weight: 900;
          letter-spacing: -.06em; line-height: 1;
          color: ${C.text};
          white-space: nowrap;
        }
        .mm-brand-title span {
          background: linear-gradient(115deg, ${C.blue600}, ${C.blue500} 50%, ${C.cyan500});
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .mm-brand-tag {
          margin-top: 4px;
          font: 600 7px ${F.mono};
          letter-spacing: 1px;
          text-transform: uppercase;
          color: ${C.muted};
          white-space: nowrap;
        }

        /* ── Nav shell (center) ── */
        .mm-nav {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          min-width: 0; padding: 0 16px;
        }

        .mm-nav-track {
          position: relative;
          display: flex; align-items: center;
          gap: 2px;
          padding: 4px;
          border-radius: 14px;
          background: rgba(245,248,255,.7);
          border: 1px solid rgba(210,222,248,.5);
          overflow-x: auto; overflow-y: hidden;
          scrollbar-width: none;
        }
        .mm-nav-track::-webkit-scrollbar { display: none; }

        /* Active pill — Apple Vision Pro blue gloss */
        .mm-pill {
          position: absolute; top: 50%; height: 38px;
          border-radius: 10px;
          transform: translateY(-50%);
          /* Deep blue gloss — Vision Pro inspired */
          background: linear-gradient(160deg,
            rgba(100,160,255,.18) 0%,
            rgba(26,110,255,.12) 40%,
            rgba(0,68,196,.09) 100%
          );
          border: 1px solid rgba(26,110,255,.28);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.55),
            inset 0 -1px 0 rgba(26,110,255,.12),
            0 2px 14px rgba(26,110,255,.18),
            0 0 0 1px rgba(26,110,255,.06);
          pointer-events: none; overflow: hidden;
          transition: left .38s cubic-bezier(.22,1,.36,1), width .38s cubic-bezier(.22,1,.36,1), opacity .18s ease;
        }
        /* specular sheen on pill */
        .mm-pill::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,.38) 0%, rgba(255,255,255,0) 55%);
          border-radius: inherit;
          pointer-events: none;
        }
        /* bottom glow line */
        .mm-pill::after {
          content: '';
          position: absolute; left: 20%; right: 20%; bottom: 0;
          height: 1.5px; border-radius: 999px;
          background: ${C.blue400};
          box-shadow: 0 0 8px rgba(26,110,255,.5);
        }

        /* Nav links — text-only, PostHog editorial style */
        .mm-link {
          position: relative; z-index: 2;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px; height: 38px;
          flex: 1 1 auto; min-width: 80px;
          padding: 0 14px;
          border: none; border-radius: 10px;
          background: transparent;
          color: ${C.muted};
          text-decoration: none;
          font: 500 13px ${F.body};
          letter-spacing: -.008em;
          white-space: nowrap;
          cursor: pointer;
          transition: color .15s ease;
        }
        .mm-link:hover { color: ${C.sub}; }
        /* active — blue text to match the gloss pill */
        .mm-link.active {
          color: ${C.blue600};
          font-weight: 700;
        }

        .mm-link-badge {
          padding: 1.5px 5px;
          border: 1px solid rgba(0,173,224,.22);
          border-radius: 4px;
          color: ${C.cyan500};
          background: rgba(0,200,240,.07);
          font: 700 7px ${F.mono};
          letter-spacing: .3px;
        }
        .mm-link.active .mm-link-badge {
          color: ${C.blue600};
          border-color: rgba(26,110,255,.3);
          background: rgba(26,110,255,.08);
        }

        /* ── Right side ── */
        .mm-right {
          display: flex; align-items: center; gap: 8px;
          flex-shrink: 0;
        }

        /* Quick stats strip — ultra-minimal, inline */
        .mm-stats {
          display: flex; align-items: center; gap: 0;
          height: 40px;
          padding: 0 2px;
          border: 1px solid ${C.border};
          border-radius: 13px;
          background: rgba(255,255,255,.8);
          flex-shrink: 0;
        }

        .mm-stat {
          display: flex; align-items: center; gap: 5px;
          padding: 0 10px; height: 100%;
          border-radius: 11px;
        }
        .mm-stat-label {
          font: 600 9px ${F.mono};
          letter-spacing: .5px; text-transform: uppercase;
          color: ${C.muted};
          line-height: 1;
        }
        .mm-stat-val {
          font: 700 14px ${F.display};
          letter-spacing: -.04em; line-height: 1;
        }
        .mm-stat-sep { width: 1px; height: 16px; background: ${C.border}; flex-shrink: 0; }

        /* ── Interview CTA — Apple Vision gloss blue ── */
        .mm-cta {
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          height: 40px; padding: 0 16px 0 10px;
          border: none; border-radius: 12px;
          color: #fff;
          /* Vision Pro-inspired deep blue gloss */
          background: linear-gradient(160deg,
            ${C.blue400} 0%,
            ${C.blue600} 55%,
            ${C.blue800} 100%
          );
          font: 600 13px ${F.body};
          letter-spacing: -.01em; white-space: nowrap;
          cursor: pointer;
          box-shadow:
            0 1px 0 rgba(255,255,255,.28) inset,
            0 -1px 0 rgba(0,20,80,.22) inset,
            0 0 0 1px rgba(0,68,196,.4),
            0 4px 18px rgba(26,110,255,.38),
            0 1px 4px rgba(0,44,150,.25);
          transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease;
          flex-shrink: 0;
        }
        /* gloss top layer */
        .mm-cta::before {
          content: '';
          position: absolute; left: 0; right: 0; top: 0; height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 100%);
          border-radius: inherit; pointer-events: none;
        }
        /* sheen sweep */
        .mm-cta::after {
          content: '';
          position: absolute; top: -20%; bottom: -20%; width: 40%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.32), transparent);
          transform: translateX(-160%) skewX(-12deg);
          transition: transform .65s cubic-bezier(.22,1,.36,1);
          pointer-events: none;
        }
        .mm-cta:hover::after { transform: translateX(280%) skewX(-12deg); }
        .mm-cta:hover {
          transform: translateY(-1px);
          box-shadow:
            0 1px 0 rgba(255,255,255,.3) inset,
            0 -1px 0 rgba(0,20,80,.25) inset,
            0 0 0 1px rgba(0,68,196,.45),
            0 8px 24px rgba(26,110,255,.46),
            0 2px 6px rgba(0,44,150,.28);
        }
        .mm-cta:active { transform: scale(.97); }

        .mm-cta-icon {
          position: relative; z-index: 1;
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px;
          background: rgba(255,255,255,.16);
          border: 1px solid rgba(255,255,255,.22);
          flex-shrink: 0;
        }
        .mm-cta-text { position: relative; z-index: 1; }

        /* ── Profile button — PostHog icon style ── */
        .mm-profile-wrap { position: relative; flex-shrink: 0; }

        .mm-av-btn {
          display: inline-flex; align-items: center; gap: 0;
          width: 40px; height: 40px;
          border: 1.5px solid ${C.border};
          border-radius: 12px;
          background: rgba(255,255,255,.9);
          cursor: pointer;
          transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
          overflow: hidden;
          padding: 0;
          justify-content: center;
        }
        .mm-av-btn:hover {
          border-color: rgba(26,110,255,.35);
          background: #fff;
          box-shadow: 0 4px 14px rgba(26,110,255,.14);
        }
        .mm-av-btn[aria-expanded="true"] {
          border-color: rgba(26,110,255,.5);
          box-shadow: 0 0 0 3px rgba(26,110,255,.12);
        }

        /* initials inside the square icon button */
        .mm-av-initial {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(145deg, ${C.blue500}, ${C.blue800});
          color: #fff;
          font: 700 14px ${F.display};
          letter-spacing: -.01em;
        }

        /* ── Dropdown ── */
        .mm-drop {
          position: absolute;
          top: calc(100% + 10px); right: 0;
          width: 280px; padding: 6px;
          border: 1.5px solid ${C.border};
          border-radius: 18px;
          background: rgba(255,255,255,.98);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          box-shadow: 0 24px 60px rgba(0,31,107,.16), 0 4px 16px rgba(0,31,107,.07), inset 0 1px 0 rgba(255,255,255,.95);
          animation: mmDropIn .18s cubic-bezier(.22,1,.36,1);
          z-index: 100;
        }
        .mm-drop::before {
          content: '';
          position: absolute; left: 8%; right: 8%; top: 0;
          height: 1px; border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(26,110,255,.35), transparent);
          pointer-events: none;
        }

        /* Profile header inside dropdown */
        .mm-drop-header {
          padding: 12px;
          border-radius: 12px;
          background: linear-gradient(145deg, rgba(235,242,255,.8), rgba(255,255,255,.6));
          border: 1px solid ${C.border};
          margin-bottom: 4px;
        }
        .mm-drop-avatar {
          width: 40px; height: 40px;
          border-radius: 11px;
          background: linear-gradient(145deg, ${C.blue500}, ${C.blue800});
          display: flex; align-items: center; justify-content: center;
          color: #fff; font: 700 16px ${F.display};
          flex-shrink: 0;
        }
        .mm-drop-name { font: 700 14px ${F.display}; color: ${C.text}; }
        .mm-drop-sub { font: 500 11px ${F.body}; color: ${C.muted}; margin-top: 2px; }
        .mm-drop-tier {
          display: inline-flex; align-items: center; gap: 4px;
          margin-top: 10px; padding: 3px 8px;
          border: 1px solid rgba(26,110,255,.2); border-radius: 999px;
          color: ${C.blue600}; background: ${C.blue50};
          font: 600 8px ${F.mono}; letter-spacing: .3px;
        }
        .mm-drop-tier-dot { width: 4px; height: 4px; border-radius: 50%; background: ${C.blue500}; }

        .mm-drop-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 4px; margin-top: 10px; }
        .mm-drop-stat { padding: 8px 4px; text-align: center; border: 1px solid ${C.border}; border-radius: 10px; background: #fff; }
        .mm-drop-stat-val { font: 700 15px ${F.display}; }
        .mm-drop-stat-label { font: 600 7px ${F.mono}; letter-spacing: .4px; color: ${C.muted}; margin-top: 2px; }

        .mm-drop-divider { height: 1px; background: ${C.border}; margin: 5px 0; }

        .mm-drop-item {
          width: 100%; display: flex; align-items: center; gap: 9px;
          padding: 9px 10px; border: none; border-radius: 10px;
          background: transparent; color: ${C.sub};
          font: 500 12.5px ${F.body}; text-align: left; cursor: pointer;
          transition: background .12s ease, color .12s ease;
        }
        .mm-drop-item:hover { color: ${C.blue700}; background: ${C.blue50}; }
        .mm-drop-item.danger { color: ${C.red}; }
        .mm-drop-item.danger:hover { background: ${C.redTint}; }

        .mm-drop-icon {
          width: 28px; height: 28px; display: grid; place-items: center;
          border: 1px solid ${C.border}; border-radius: 8px;
          background: rgba(248,250,255,.9); flex-shrink: 0;
          transition: background .12s ease, border-color .12s ease;
        }
        .mm-drop-item:hover .mm-drop-icon { background: ${C.blue50}; border-color: rgba(26,110,255,.25); }
        .mm-drop-item.danger:hover .mm-drop-icon { background: #fecaca; border-color: #fca5a5; }

        /* ── Sign in button ── */
        .mm-login {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          height: 40px; padding: 0 16px 0 8px;
          border: 1px solid ${C.border}; border-radius: 12px;
          background: #fff; color: ${C.text}; text-decoration: none;
          font: 600 13px ${F.body};
          box-shadow: 0 2px 8px rgba(0,31,107,.05), inset 0 1px 0 rgba(255,255,255,.9);
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
          white-space: nowrap;
        }
        .mm-login:hover {
          transform: translateY(-1px);
          border-color: rgba(26,110,255,.3);
          box-shadow: 0 8px 22px rgba(26,110,255,.18), inset 0 1px 0 rgba(255,255,255,.95);
        }
        .mm-google-wrap {
          width: 26px; height: 26px; display: grid; place-items: center;
          border-radius: 7px; background: ${C.blue50}; flex-shrink: 0;
        }

        /* ── Mobile ── */
        .mm-mobile-controls { display: none; align-items: center; gap: 6px; flex-shrink: 0; }
        .mm-ham {
        @media (max-width: 830px) {
  body { padding-top: 88px; }
}
          width: 40px; height: 40px; border: 1px solid ${C.border};
          border-radius: 11px; background: rgba(255,255,255,.84);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4.5px;
          cursor: pointer; transition: border-color .15s ease, background .15s ease;
        }
        .mm-ham:hover { background: #fff; border-color: rgba(26,110,255,.35); }
        .mm-ham .bar { width: 16px; height: 1.8px; border-radius: 3px; background: ${C.blue600}; transition: all .22s cubic-bezier(.22,1,.36,1); }
        .mm-ham.open .bar:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
        .mm-ham.open .bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .mm-ham.open .bar:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }

        .mm-mobile-panel {
          position: absolute; left: 8px; right: 8px; top: calc(100% + 8px);
          padding: 8px; border: 1px solid ${C.border}; border-radius: 18px;
          background: rgba(255,255,255,.98); backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          box-shadow: 0 20px 56px rgba(0,31,107,.14);
          animation: mmSlideDown .2s ease;
        }
        .mm-mobile-user {
          display: flex; align-items: center; gap: 10px;
          padding: 11px; border: 1px solid ${C.border}; border-radius: 13px;
          background: linear-gradient(145deg, ${C.blue50}, rgba(255,255,255,.8));
        }
        .mm-mobile-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; margin: 8px 0 10px; }
        .mm-mobile-stat { padding: 10px 5px; text-align: center; border: 1px solid ${C.border}; border-radius: 12px; background: #fff; }
        .mm-mobile-stat-val { font: 700 16px ${F.display}; letter-spacing: -.04em; }
        .mm-mobile-stat-label { font: 600 7px ${F.mono}; letter-spacing: .4px; color: ${C.muted}; margin-top: 2px; }

        .mm-mobile-link {
          display: flex; align-items: center; gap: 11px;
          width: 100%; padding: 12px 11px;
          border: none; border-radius: 12px;
          background: transparent; color: ${C.sub};
          text-decoration: none; font: 500 14px ${F.body}; cursor: pointer;
          transition: background .12s ease, color .12s ease;
        }
        .mm-mobile-link:hover { background: ${C.blue50}; color: ${C.blue700}; }
        .mm-mobile-link.active {
          background: linear-gradient(145deg, ${C.blue500}, ${C.blue700});
          color: #fff; font-weight: 700;
          box-shadow: 0 4px 16px rgba(26,110,255,.28);
        }
        .mm-mobile-link-icon {
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          border-radius: 9px; color: ${C.blue600}; background: ${C.blue50}; flex-shrink: 0;
        }
        .mm-mobile-link.active .mm-mobile-link-icon { color: #fff; background: rgba(255,255,255,.2); }
        .mm-mobile-logout { color: ${C.red}; margin-top: 6px; }
        .mm-mobile-logout:hover { background: ${C.redTint}; color: ${C.red}; }

        .mm-focus:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 2px; }

        /* ── Responsive ── */
        @media (max-width: 1360px) { .mm-stats { display: none; } }
        @media (max-width: 1160px) { .mm-brand-tag { display: none; } }
        @media (max-width: 1020px) {
          .mm-link { min-width: 52px; padding: 0 8px; font-size: 12px; }
        }
        @media (max-width: 830px) {
          .mm-root { padding: 8px 12px; }
          .mm-nav { display: none; }
          .mm-profile-wrap { display: none; }
          .mm-cta.desktop-only { display: none; }
          .mm-mobile-controls { display: flex; }
          .mm-right { margin-left: auto; }
        }
        @media (min-width: 831px) {
          .mm-mobile-controls { display: none !important; }
          .mm-mobile-panel { display: none !important; }
        }
        @media (max-width: 560px) { .mm-root { padding: 8px; } .mm-brand-title { font-size: 16px; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
      `}</style>

      <nav className="mm-root" aria-label="Main navigation">
        <div className={`mm-capsule${scrolled ? ' scrolled' : ''}`}>

          {/* Brand */}
          <Link to={user ? '/dashboard' : '/'} className="mm-brand mm-focus">
            <Logomark irs={irs} size={36} uid="navbar"/>
            <div>
              <div className="mm-brand-title">Mock<span>Mate</span></div>
              <div className="mm-brand-tag">AI Interview Coach</div>
            </div>
          </Link>

          {/* Center nav */}
          {user && (
            <div className="mm-nav">
              <div ref={shellRef} className="mm-nav-track">
                {/* Active pill */}
                <div className="mm-pill"
                  style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
                />

                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    ref={(el) => { linkRefs.current[link.path] = el; }}
                    to={link.path}
                    className={`mm-link mm-focus ${isActive(link.path) ? 'active' : ''}`}
                  >
                    {link.label}
                    {link.badge && <span className="mm-link-badge">{link.badge}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Right side */}
          <div className="mm-right">
            {user ? (
              <>
                {/* Minimal stats strip */}
                <div className="mm-stats">
                  <div className="mm-stat">
                    <span style={{ fontSize: 14 }}>🔥</span>
                    <div>
                      <div className="mm-stat-label">Streak</div>
                      <div className="mm-stat-val" style={{ color: C.orange }}>{streak}d</div>
                    </div>
                  </div>
                  <div className="mm-stat-sep"/>
                  <div className="mm-stat">
                    <div>
                      <div className="mm-stat-label">Avg</div>
                      <div className="mm-stat-val" style={{ color: C.cyan500 }}>{avgScore ?? '—'}</div>
                    </div>
                  </div>
                  <div className="mm-stat-sep"/>
                  <div className="mm-stat">
                    <div>
                      <div className="mm-stat-label">IRS</div>
                      <div className="mm-stat-val" style={{ color: accent }}>{irs}</div>
                    </div>
                  </div>
                </div>

                {/* Interview CTA */}
                <button className="mm-cta desktop-only mm-focus" onClick={() => navigate('/interview')}>
                  <span className="mm-cta-icon"><NavIcon name="mic" size={13}/></span>
                  <span className="mm-cta-text">New Interview</span>
                </button>

                {/* Profile icon — PostHog style square icon */}
                <div ref={dropRef} className="mm-profile-wrap">
                  <button
                    className="mm-av-btn mm-focus"
                    onClick={() => setDropOpen(v => !v)}
                    aria-expanded={dropOpen}
                    aria-haspopup="menu"
                    aria-label="Open profile menu"
                  >
                    <div className="mm-av-initial">{initials}</div>
                  </button>

                  {dropOpen && (
                    <div className="mm-drop" role="menu">
                      {/* Profile header */}
                      <div className="mm-drop-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="mm-drop-avatar">{initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mm-drop-name">{user.name?.split(' ')[0]}</div>
                            <div className="mm-drop-sub">{user.college ?? 'MockMate User'}</div>
                          </div>
                          <ScoreRing value={irs} size={28} strokeW={2.2} id="drop-irs"/>
                        </div>
                        <div className="mm-drop-stats">
                          {[
                            { val: irs, color: accent, label: 'IRS' },
                            { val: avgScore ?? '—', color: C.cyan500, label: 'Avg' },
                            { val: `${streak}d`, color: C.orange, label: 'Streak' },
                          ].map(({ val, color, label }) => (
                            <div className="mm-drop-stat" key={label}>
                              <div className="mm-drop-stat-val" style={{ color }}>{val}</div>
                              <div className="mm-drop-stat-label">{label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mm-drop-tier">
                          <span className="mm-drop-tier-dot"/>
                          {tierLabel} eligible
                        </div>
                      </div>

                      {[
                        { icon: 'grid', label: 'Dashboard', path: '/dashboard' },
                        { icon: 'clock', label: 'Interview history', path: '/history' },
                        { icon: 'trophy', label: 'Leaderboard', path: '/leaderboard' },
                        { icon: 'chart', label: 'Analytics', path: '/analytics' },
                        { icon: 'mic', label: 'New interview', path: '/interview' },
                      ].map(item => (
                        <button key={item.path} className="mm-drop-item mm-focus" role="menuitem"
                          onClick={() => { setDropOpen(false); navigate(item.path); }}>
                          <span className="mm-drop-icon"><NavIcon name={item.icon} size={14}/></span>
                          {item.label}
                        </button>
                      ))}

                      <div className="mm-drop-divider"/>

                      <button className="mm-drop-item danger mm-focus" role="menuitem"
                        onClick={() => { setDropOpen(false); logout(); }}>
                        <span className="mm-drop-icon"><NavIcon name="logout" size={14}/></span>
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile controls */}
                <div className="mm-mobile-controls">
                  <button className="mm-cta mm-focus" style={{ height: 40, padding: '0 12px' }}
                    onClick={() => navigate('/interview')}>
                    <span className="mm-cta-icon"><NavIcon name="mic" size={13}/></span>
                    <span className="mm-cta-text">New</span>
                  </button>
                  <button
                    className={`mm-ham mm-focus ${mobileOpen ? 'open' : ''}`}
                    onClick={() => setMobileOpen(v => !v)}
                    aria-expanded={mobileOpen}
                    aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                  >
                    <span className="bar"/><span className="bar"/><span className="bar"/>
                  </button>
                </div>
              </>
            ) : (
              <a href={`${API_BASE}/auth/google`} className="mm-login mm-focus">
                <span className="mm-google-wrap"><GoogleG size={16}/></span>
                Sign in with Google
              </a>
            )}
          </div>

          {/* Mobile panel */}
          {mobileOpen && user && (
            <div className="mm-mobile-panel">
              <div className="mm-mobile-user">
                <div className="mm-drop-avatar" style={{ width: 38, height: 38, borderRadius: 10 }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `700 13px ${F.display}`, color: C.text }}>{user.name?.split(' ')[0]}</div>
                  <div style={{ font: `500 10px ${F.body}`, color: C.muted, marginTop: 2 }}>{user.college ?? 'MockMate User'}</div>
                </div>
                <span style={{ font: `600 8px ${F.mono}`, color: C.blue600, background: C.blue50, border: `1px solid rgba(26,110,255,.2)`, borderRadius: 999, padding: '3px 8px' }}>{tierLabel}</span>
              </div>

              <div className="mm-mobile-stats">
                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-val" style={{ color: C.orange }}>🔥{streak}</div>
                  <div className="mm-mobile-stat-label">Streak</div>
                </div>
                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-val" style={{ color: C.cyan500 }}>{avgScore ?? '—'}</div>
                  <div className="mm-mobile-stat-label">Avg</div>
                </div>
                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-val" style={{ color: accent }}>{irs}</div>
                  <div className="mm-mobile-stat-label">IRS</div>
                </div>
              </div>

              {NAV_LINKS.map(link => (
                <Link key={link.path} to={link.path}
                  className={`mm-mobile-link mm-focus ${isActive(link.path) ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}>
                  <span className="mm-mobile-link-icon"><NavIcon name={link.icon} size={16}/></span>
                  {link.label}
                  {link.badge && (
                    <span style={{ marginLeft: 'auto', font: `700 7px ${F.mono}`, color: C.cyan500, background: 'rgba(0,200,240,.07)', border: '1px solid rgba(0,173,224,.2)', borderRadius: 4, padding: '2px 5px' }}>{link.badge}</span>
                  )}
                </Link>
              ))}

              <button className="mm-cta mm-focus" style={{ width: '100%', height: 42, marginTop: 8, justifyContent: 'center' }}
                onClick={() => { setMobileOpen(false); navigate('/interview'); }}>
                <span className="mm-cta-icon"><NavIcon name="mic" size={13}/></span>
                <span className="mm-cta-text">New Interview</span>
              </button>

              <button className="mm-mobile-link mm-mobile-logout mm-focus"
                onClick={() => { setMobileOpen(false); logout(); }}>
                <span className="mm-mobile-link-icon" style={{ background: C.redTint, color: C.red }}>
                  <NavIcon name="logout" size={16}/>
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
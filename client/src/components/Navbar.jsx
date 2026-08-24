import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';

// ═══════════════════════════════════════════════════════════════════════════
// Navbar — MockMate Blueprint v3
// Light glass theme matching Dashboard's design system exactly.
// Tokens: F0F4FF bg · white cards · 1A6EFF primary · 001F6B navy · cyan acc.
// Signature: aurora scan orbs in navy/blue/cyan, neon pill indicator,
//            holographic-ring avatar, inline score ring, pill-shaped CTA.
// Fonts: Plus Jakarta Sans (display) · Inter (body) · JetBrains Mono (data)
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  // Page & card surfaces — exact Dashboard tokens
  bg:        '#F0F4FF',
  bgDeep:    '#E8EEFF',
  card:      '#FFFFFF',
  cardAlt:   '#F8FAFF',
  cardGlass: 'rgba(255,255,255,0.82)',

  // Text hierarchy
  text:  '#0A1628',
  sub:   '#3D5280',
  muted: '#7A8BAF',
  faint: '#A8B8D4',

  // Borders
  border:    '#DDE5F7',
  borderMd:  '#B8CAF0',
  borderStr: '#7FA3E8',

  // Blue family
  blue50:  '#EBF2FF',
  blue100: '#C7DAFF',
  blue200: '#9DBFFF',
  blue300: '#6FA5FF',
  blue400: '#4D8FFF',
  blue500: '#1A6EFF',
  blue600: '#0057E8',
  blue700: '#0044C4',
  blue900: '#001F6B',

  // Cyan
  cyan300:  '#5FE0FF',
  cyan400:  '#00C8F0',
  cyan500:  '#00ADE0',
  cyan600:  '#0093C4',
  cyanTint: '#E6F9FF',

  // Semantic
  green:     '#059669',
  greenTint: '#ECFDF5',
  amber:     '#D97706',
  amberTint: '#FFFBEB',
  orange:    '#EA580C',
  red:       '#DC2626',
  redTint:   '#FEF2F2',

  // Shadows
  shadow:   '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const NAV_LINKS = [
  { label: 'Dashboard',   path: '/dashboard'   },
  { label: 'History',     path: '/history'     },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'Analytics',   path: '/analytics'   },
  { label: 'Coach', path: '/coach' }
];

const HIDDEN_ROUTES = ['/auth/callback', '/onboarding'];

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

const scoreGlow = (s) =>
  s >= 80 ? 'rgba(5,150,105,0.25)'
  : s >= 60 ? 'rgba(26,110,255,0.25)'
  : s >= 40 ? 'rgba(217,119,6,0.25)'
  : 'rgba(234,88,12,0.25)';

// ── Inline SVG score ring ─────────────────────────────────────────────────
const ScoreRing = ({ value = 0, size = 20, strokeW = 2, id = 'sr' }) => {
  const r    = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.max(0, Math.min(100, value));
  const offset = circ - (pct / 100) * circ;
  const accent = scoreColor(pct);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={C.border} strokeWidth={strokeW} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={`url(#sg-${id})`} strokeWidth={strokeW}
        strokeDasharray={circ}
        strokeDashoffset={pct > 0 ? offset : circ}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}
      />
    </svg>
  );
};

// ── Logomark — ring gauge + crosshair, Blueprint palette ─────────────────
const Logomark = ({ irs = 0, size = 36 }) => {
  const accent = scoreColor(irs);
  const r      = size / 2 - 3;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.max(0, Math.min(100, irs));
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <defs>
          <linearGradient id="lm-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.blue500} />
            <stop offset="100%" stopColor={C.cyan400} />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill={C.blue900} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.14)" strokeWidth={2.5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="url(#lm-g)" strokeWidth={2.5}
          strokeDasharray={circ}
          strokeDashoffset={pct > 0 ? offset : circ}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9"   stroke={C.cyan400} strokeWidth="1.5" opacity="0.45" />
          <circle cx="12" cy="12" r="4.5" stroke={C.cyan400} strokeWidth="1.5" opacity="0.75" />
          <circle cx="12" cy="12" r="1.6" fill={accent} />
          <line x1="12" y1="2"  x2="12" y2="5"  stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <line x1="12" y1="19" x2="12" y2="22" stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <line x1="2"  y1="12" x2="5"  y2="12" stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <line x1="19" y1="12" x2="22" y2="12" stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
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

  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen,   setDropOpen]   = useState(false);

  const dropRef  = useRef(null);
  const navRef   = useRef(null);
  const linkRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const irs       = user?.irs ?? user?.readinessScore ?? 0;
  const avgScore  = user?.averageScore ?? null;
  const streak    = user?.streak?.current ?? 0;
  const tierLabel = user?.tierLabel ?? (irs >= 80 ? '₹20 LPA+' : irs >= 60 ? '₹12–20 LPA' : irs >= 38 ? '₹6–12 LPA' : '₹3–6 LPA');

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const fn = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => { setMobileOpen(false); setDropOpen(false); }, [location.pathname]);

  useLayoutEffect(() => {
    const el  = linkRefs.current[location.pathname];
    const nav = navRef.current;
    if (el && nav) {
      const nb = nav.getBoundingClientRect();
      const lb = el.getBoundingClientRect();
      setIndicator({ left: lb.left - nb.left, width: lb.width, opacity: 1 });
    } else {
      setIndicator(p => ({ ...p, opacity: 0 }));
    }
  }, [location.pathname, user]);

  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  const isActive = (p) => location.pathname === p;

  const accent = scoreColor(irs);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

        body { padding-top: 66px; }
        @media (max-width: 767px) { body { padding-top: 60px; } }

        /* ── Aurora orbs ── */
        @keyframes mmAF1 {
          0%,100% { transform: translate(0,0) scale(1);     opacity: 0.55; }
          33%      { transform: translate(16px,-8px) scale(1.07); opacity: 0.7; }
          66%      { transform: translate(-8px,5px) scale(0.94);  opacity: 0.45; }
        }
        @keyframes mmAF2 {
          0%,100% { transform: translate(0,0) scale(1);      opacity: 0.38; }
          45%      { transform: translate(-18px,7px) scale(1.1);  opacity: 0.55; }
          70%      { transform: translate(10px,-3px) scale(0.93);  opacity: 0.32; }
        }
        @keyframes mmAF3 {
          0%,100% { transform: translate(0,0) scale(1); opacity: 0.28; }
          50%      { transform: translate(8px,12px) scale(1.05); opacity: 0.42; }
        }

        /* ── Nav links ── */
        .mm-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 7px 15px;
          font-family: ${F.body};
          font-size: 13.5px;
          font-weight: 500;
          color: ${C.sub};
          text-decoration: none;
          border: none;
          background: transparent;
          cursor: pointer;
          white-space: nowrap;
          z-index: 1;
          border-radius: 10px;
          transition: color 0.18s ease;
          letter-spacing: -0.01em;
        }
        .mm-link:hover { color: ${C.text}; }
        .mm-link.active { color: ${C.blue600}; font-weight: 700; }

        /* Sliding pill indicator */
        .mm-pill {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, ${C.blue50}, rgba(255,255,255,0.9));
          border: 1.5px solid ${C.borderMd};
          box-shadow:
            0 2px 8px rgba(26,110,255,0.10),
            0 1px 0 rgba(255,255,255,0.9) inset;
          pointer-events: none;
          transition:
            left 0.4s cubic-bezier(.22,1,.36,1),
            width 0.4s cubic-bezier(.22,1,.36,1),
            opacity 0.22s ease;
        }
        /* Blue glow underline on active pill */
        .mm-pill::after {
          content: '';
          position: absolute;
          bottom: 0; left: 14%; right: 14%;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, transparent, ${C.blue500}, ${C.cyan400}, transparent);
          box-shadow: 0 0 6px rgba(26,110,255,0.45), 0 0 14px rgba(26,110,255,0.25);
        }

        /* ── CTA — New Interview ── */
        .mm-cta {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px 9px 15px;
          border: none;
          border-radius: 100px;
          cursor: pointer;
          font-family: ${F.body};
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.01em;
          white-space: nowrap;
          background: linear-gradient(135deg, ${C.blue700} 0%, ${C.blue500} 55%, #2B8FFF 100%);
          background-size: 200% 200%;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.18) inset,
            0 1px 0 rgba(255,255,255,0.22) inset,
            0 5px 20px rgba(26,110,255,0.38),
            0 2px 6px rgba(0,68,196,0.25);
          transition:
            transform 0.2s cubic-bezier(.22,1,.36,1),
            box-shadow 0.2s ease,
            background-position 0.4s ease;
        }
        .mm-cta::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(
            110deg,
            transparent 22%,
            rgba(255,255,255,0.26) 42%,
            rgba(255,255,255,0.38) 50%,
            rgba(255,255,255,0.12) 60%,
            transparent 78%
          );
          transform: translateX(-130%);
          transition: transform 0.7s cubic-bezier(.22,1,.36,1);
        }
        .mm-cta:hover::before { transform: translateX(130%); }
        .mm-cta:hover {
          transform: translateY(-2px) scale(1.025);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.22) inset,
            0 1px 0 rgba(255,255,255,0.28) inset,
            0 10px 32px rgba(26,110,255,0.44),
            0 4px 12px rgba(0,68,196,0.32);
          background-position: right center;
        }
        .mm-cta:active { transform: scale(0.97); }

        /* Pulsing dot inside CTA */
        .mm-cta-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.82);
          box-shadow: 0 0 5px rgba(255,255,255,0.6);
          flex-shrink: 0;
          animation: mmDotP 2.3s ease-in-out infinite;
        }
        @keyframes mmDotP {
          0%,100% { transform: scale(1);   opacity: 0.82; }
          50%      { transform: scale(1.4); opacity: 1; box-shadow: 0 0 8px rgba(255,255,255,0.45); }
        }

        /* ── Stat pills ── */
        .mm-stat {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px 5px 8px;
          border-radius: 100px;
          background: rgba(255,255,255,0.75);
          border: 1px solid ${C.border};
          backdrop-filter: blur(12px);
          box-shadow: 0 1px 4px rgba(0,31,107,0.06);
          cursor: default;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .mm-stat:hover {
          transform: translateY(-1px);
          border-color: ${C.borderMd};
          box-shadow: 0 4px 10px rgba(26,110,255,0.1);
        }

        /* ── Avatar button ── */
        .mm-av-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 4px;
          border-radius: 100px;
          border: 1.5px solid ${C.border};
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(16px);
          box-shadow: 0 1px 4px rgba(0,31,107,0.06);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(.22,1,.36,1);
        }
        .mm-av-btn:hover {
          border-color: ${C.borderStr};
          background: ${C.blue50};
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(26,110,255,0.14);
        }
        .mm-av-btn:active { transform: scale(0.97); }

        /* Conic gradient ring — holographic using Dashboard palette */
        .mm-av-ring {
          width: 30px; height: 30px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: conic-gradient(
            from 0deg,
            ${C.blue700}, ${C.blue500}, ${C.cyan400}, ${C.blue300},
            ${C.blue500}, ${C.blue700}
          );
          box-shadow: 0 0 10px rgba(26,110,255,0.4);
          animation: mmHolo 8s linear infinite;
          flex-shrink: 0;
        }
        @keyframes mmHolo { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
        .mm-av-inner {
          width: 26px; height: 26px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: ${C.card};
          font-family: ${F.display};
          font-size: 11px; font-weight: 800;
          color: ${C.blue700};
        }

        /* ── Dropdown ── */
        .mm-drop {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 264px;
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(28px) saturate(200%);
          -webkit-backdrop-filter: blur(28px) saturate(200%);
          border: 1.5px solid ${C.border};
          border-radius: 20px;
          padding: 6px;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.9) inset,
            0 0 0 1px rgba(26,110,255,0.06) inset,
            0 24px 60px rgba(0,31,107,0.18),
            0 4px 20px rgba(0,31,107,0.08);
          animation: mmDropIn 0.2s cubic-bezier(.22,1,.36,1);
          z-index: 100;
        }
        @keyframes mmDropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mm-drop-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 9px 10px;
          border-radius: 11px; border: none;
          background: transparent;
          font-family: ${F.body};
          font-size: 13.5px; font-weight: 500;
          color: ${C.sub};
          cursor: pointer; text-align: left;
          transition: background 0.13s, color 0.13s, padding-left 0.18s;
        }
        .mm-drop-item:hover { background: ${C.cardAlt}; color: ${C.blue600}; padding-left: 15px; }
        .mm-drop-item.danger { color: ${C.red}; }
        .mm-drop-item.danger:hover { background: ${C.redTint}; color: ${C.red}; padding-left: 15px; }

        /* ── Login button ── */
        .mm-login {
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 22px;
          border-radius: 100px;
          border: 1.5px solid ${C.borderMd};
          background: linear-gradient(135deg, ${C.blue700} 0%, ${C.blue500} 60%, #2B8FFF 100%);
          font-family: ${F.body};
          font-size: 13.5px; font-weight: 700;
          color: #fff;
          text-decoration: none;
          letter-spacing: 0.01em;
          white-space: nowrap;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.18) inset,
            0 5px 20px rgba(26,110,255,0.36);
          transition: all 0.22s cubic-bezier(.22,1,.36,1);
        }
        .mm-login::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(110deg, transparent 28%, rgba(255,255,255,0.22) 50%, transparent 72%);
          transform: translateX(-130%);
          transition: transform 0.65s ease;
        }
        .mm-login:hover::before { transform: translateX(130%); }
        .mm-login:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 32px rgba(26,110,255,0.44), 0 4px 12px rgba(0,68,196,0.28);
        }
        .mm-login:active { transform: scale(0.97); }
        .mm-g {
          width: 18px; height: 18px;
          border-radius: 50%; background: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 900; color: #4285F4;
          flex-shrink: 0;
        }

        /* ── Hamburger ── */
        .mm-ham {
          width: 40px; height: 40px;
          border-radius: 12px;
          border: 1.5px solid ${C.border};
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(12px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 5px; cursor: pointer; padding: 11px 10px;
          transition: all 0.2s;
          box-shadow: 0 1px 4px rgba(0,31,107,0.06);
        }
        .mm-ham:hover { border-color: ${C.borderStr}; background: ${C.blue50}; }
        .mm-ham .bar {
          width: 18px; height: 1.5px;
          background: ${C.sub};
          border-radius: 2px;
          transition: all 0.25s cubic-bezier(.22,1,.36,1);
          transform-origin: center;
        }
        .mm-ham.open .bar:nth-child(1) { transform: rotate(45deg) translate(4.6px, 4.6px); background: ${C.blue600}; }
        .mm-ham.open .bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .mm-ham.open .bar:nth-child(3) { transform: rotate(-45deg) translate(4.6px,-4.6px); background: ${C.blue600}; }

        /* ── Mobile drawer ── */
        .mm-drawer {
          border-top: 1px solid ${C.border};
          padding: 14px 16px 20px;
          background: rgba(240,244,255,0.98);
          backdrop-filter: blur(32px) saturate(200%);
          -webkit-backdrop-filter: blur(32px) saturate(200%);
          animation: mmSlideDown 0.25s cubic-bezier(.22,1,.36,1);
        }
        @keyframes mmSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mm-mobile-link {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 12px 14px;
          border-radius: 12px; border: none;
          background: transparent;
          font-family: ${F.body};
          font-size: 14px; font-weight: 500;
          color: ${C.sub};
          cursor: pointer; text-align: left;
          text-decoration: none;
          transition: all 0.18s;
        }
        .mm-mobile-link:hover { background: ${C.blue50}; color: ${C.blue600}; }
        .mm-mobile-link.active {
          background: ${C.blue50};
          color: ${C.blue600};
          font-weight: 700;
          border-left: 3px solid ${C.blue500};
          padding-left: 11px;
        }

        /* ── Streak breathe ── */
        .mm-streak { animation: mmStreak 3.2s ease-in-out infinite; }
        @keyframes mmStreak {
          0%,100% { box-shadow: 0 1px 4px rgba(0,31,107,0.06); }
          50%      { box-shadow: 0 0 0 4px rgba(234,88,12,0.12), 0 1px 4px rgba(0,31,107,0.06); }
        }

        /* ── Responsive ── */
        @media (max-width: 1080px) { .mm-stats-strip { display: none !important; } }
        @media (max-width: 767px)  { .mm-desktop { display: none !important; } }
        @media (min-width: 768px)  { .mm-mobile-only { display: none !important; } }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .mm-cta::before, .mm-login::before, .mm-av-ring,
          .mm-cta-dot, .mm-streak, .mm-pill { animation: none !important; transition: none !important; }
        }

        /* ── Focus visible ── */
        .mm-link:focus-visible,
        .mm-cta:focus-visible,
        .mm-login:focus-visible,
        .mm-av-btn:focus-visible,
        button:focus-visible {
          outline: 2px solid ${C.blue500};
          outline-offset: 2px;
        }
      `}</style>

      <nav style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        background: scrolled
          ? 'rgba(240,244,255,0.90)'
          : 'rgba(240,244,255,0.72)',
        backdropFilter: 'blur(28px) saturate(200%) brightness(1.03)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%) brightness(1.03)',
        borderBottom: scrolled
          ? `1px solid rgba(26,110,255,0.16)`
          : `1px solid rgba(26,110,255,0.09)`,
        boxShadow: scrolled
          ? `0 1px 0 rgba(255,255,255,0.8) inset, ${C.shadowMd}`
          : '0 1px 0 rgba(255,255,255,0.7) inset',
        transition: 'background 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease',
        overflow: 'visible',
      }}>

        {/* ── Aurora orb layer — Blueprint palette ── */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          {/* Navy/blue orb — left */}
          <div style={{
            position: 'absolute', width: 300, height: 80,
            left: '-30px', top: '-22px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(26,110,255,0.12) 0%, transparent 70%)',
            animation: 'mmAF1 10s ease-in-out infinite',
            filter: 'blur(10px)',
          }} />
          {/* Cyan orb — center */}
          <div style={{
            position: 'absolute', width: 200, height: 55,
            left: '38%', top: '-10px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(0,200,240,0.10) 0%, transparent 70%)',
            animation: 'mmAF2 13s ease-in-out infinite',
            filter: 'blur(14px)',
          }} />
          {/* Deep navy orb — right */}
          <div style={{
            position: 'absolute', width: 180, height: 50,
            right: '60px', top: '-8px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(0,31,107,0.09) 0%, transparent 70%)',
            animation: 'mmAF3 8s ease-in-out infinite',
            filter: 'blur(12px)',
          }} />
        </div>

        {/* ── Main bar ── */}
        <div style={{
          position: 'relative', zIndex: 1,
          maxWidth: 1240, margin: '0 auto',
          padding: '0 24px', height: 66,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
        }}>

          {/* ── Logo ── */}
          <Link to={user ? '/dashboard' : '/'} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            textDecoration: 'none', flexShrink: 0,
          }}>
            <Logomark irs={irs} size={36} />
            <div>
              <div style={{
                fontFamily: F.display,
                fontSize: 17, fontWeight: 800,
                color: C.text, letterSpacing: '-0.5px', lineHeight: 1,
              }}>
                Mock<span style={{
                  background: `linear-gradient(120deg, ${C.blue600}, ${C.cyan500})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>Mate</span>
              </div>
              <div style={{
                fontFamily: F.mono, fontSize: 9, fontWeight: 700,
                letterSpacing: '1.6px', textTransform: 'uppercase',
                color: C.muted, marginTop: 3,
              }}>
                AI Interview
              </div>
            </div>
          </Link>

          {/* ── Desktop nav links ── */}
          {user && (
            <div ref={navRef} className="mm-desktop" style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 2,
              flex: 1, justifyContent: 'center',
            }}>
              <div className="mm-pill" style={{
                left: indicator.left,
                width: indicator.width,
                opacity: indicator.opacity,
              }} />
              {NAV_LINKS.map(link => (
                <Link
                  key={link.path}
                  ref={el => { linkRefs.current[link.path] = el; }}
                  to={link.path}
                  className={`mm-link${isActive(link.path) ? ' active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* ── Right cluster ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

            {user ? (
              <>
                {/* Stat strip — hidden below 1080px */}
                <div className="mm-stats-strip" style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>

                  {/* IRS pill */}
                  <div className="mm-stat" style={{ borderColor: `${accent}44` }}>
                    <ScoreRing value={irs} size={20} strokeW={2} id="nav-irs" />
                    <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.4px' }}>IRS</span>
                    <span style={{
                      fontFamily: F.display, fontSize: 14, fontWeight: 800,
                      color: accent,
                      textShadow: `0 0 10px ${scoreGlow(irs)}`,
                    }}>{irs}</span>
                  </div>

                  {/* Avg score */}
                  {avgScore !== null && (
                    <div className="mm-stat" style={{ borderColor: 'rgba(0,173,224,0.25)' }}>
                      <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.4px' }}>AVG</span>
                      <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.cyan500 }}>{avgScore}</span>
                    </div>
                  )}

                  {/* Streak */}
                  {streak > 0 && (
                    <div className="mm-stat mm-streak" style={{ borderColor: 'rgba(234,88,12,0.22)' }}>
                      <span style={{ fontSize: 13 }}>🔥</span>
                      <span style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 800, color: C.orange }}>{streak}</span>
                    </div>
                  )}
                </div>

                {/* CTA — New Interview */}
                <button className="mm-cta mm-desktop" onClick={() => navigate('/interview')}>
                  <span className="mm-cta-dot" />
                  New Interview
                </button>

                {/* Avatar + Dropdown */}
                <div ref={dropRef} style={{ position: 'relative' }} className="mm-desktop">
                  <button
                    className="mm-av-btn"
                    onClick={() => setDropOpen(!dropOpen)}
                    aria-expanded={dropOpen}
                    aria-haspopup="true"
                  >
                    <div className="mm-av-ring">
                      <div className="mm-av-inner">{user.name?.[0]?.toUpperCase()}</div>
                    </div>
                    <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.text }}>
                      {user.name?.split(' ')[0]}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
                      transition: 'transform 0.22s ease',
                      transform: dropOpen ? 'rotate(180deg)' : 'none',
                      color: C.muted,
                    }}>
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {dropOpen && (
                    <div className="mm-drop">

                      {/* User card */}
                      <div style={{
                        padding: '12px 12px 14px',
                        borderBottom: `1px solid ${C.border}`,
                        marginBottom: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div className="mm-av-ring" style={{ width: 36, height: 36, fontSize: 14 }}>
                            <div className="mm-av-inner" style={{ width: 32, height: 32, fontSize: 13 }}>
                              {user.name?.[0]?.toUpperCase()}
                            </div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.text }}>
                              {user.name?.split(' ')[0]}
                            </div>
                            <div style={{
                              fontFamily: F.body, fontSize: 11.5, color: C.muted,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {user.college ?? 'MockMate User'}
                            </div>
                          </div>
                        </div>

                        {/* Mini stat grid */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
                          background: C.cardAlt, border: `1px solid ${C.border}`,
                          borderRadius: 12, padding: '10px 8px',
                        }}>
                          {[
                            { label: 'IRS',    val: irs,          color: scoreColor(irs) },
                            { label: 'AVG',    val: avgScore ?? '—', color: C.cyan500 },
                            { label: 'STREAK', val: streak,        color: C.orange },
                          ].map((s, i) => (
                            <div key={s.label} style={{
                              textAlign: 'center',
                              borderLeft:  i > 0 ? `1px solid ${C.border}` : 'none',
                            }}>
                              <div style={{
                                fontFamily: F.display, fontSize: 15, fontWeight: 800, color: s.color,
                              }}>{s.val}</div>
                              <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.4px', marginTop: 2 }}>
                                {s.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Tier badge */}
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: C.blue50,
                          border: `1px solid ${C.borderMd}`,
                          borderRadius: 100, padding: '3px 10px', marginTop: 10,
                          fontFamily: F.mono, fontSize: 9.5, fontWeight: 700,
                          color: C.blue600, letterSpacing: '0.4px',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.blue500, flexShrink: 0 }} />
                          {tierLabel} eligible
                        </div>
                      </div>

                      {/* Nav items */}
                      {[
                        { icon: '📊', label: 'Dashboard',         path: '/dashboard' },
                        { icon: '🕘', label: 'Interview history',  path: '/history' },
                        { icon: '🏆', label: 'Leaderboard',        path: '/leaderboard' },
                        { icon: '📈', label: 'Analytics',          path: '/analytics' },
                        { icon: '🎯', label: 'New interview',       path: '/interview' },
                      ].map(item => (
                        <button
                          key={item.path}
                          className="mm-drop-item"
                          onClick={() => { setDropOpen(false); navigate(item.path); }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 9,
                            background: C.cardAlt, border: `1px solid ${C.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, flexShrink: 0,
                          }}>{item.icon}</div>
                          {item.label}
                        </button>
                      ))}

                      <div style={{ height: 1, background: C.border, margin: '6px 0' }} />

                      <button className="mm-drop-item danger" onClick={() => { setDropOpen(false); logout(); }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 9,
                          background: C.redTint, border: `1px solid rgba(220,38,38,0.14)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, flexShrink: 0,
                        }}>🚪</div>
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile hamburger */}
                <button
                  className={`mm-ham mm-mobile-only${mobileOpen ? ' open' : ''}`}
                  onClick={() => setMobileOpen(!mobileOpen)}
                  aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                >
                  <span className="bar" />
                  <span className="bar" />
                  <span className="bar" />
                </button>
              </>
            ) : (
              <a href={`${API_BASE}/auth/google`} className="mm-login">
                <span className="mm-g">G</span>
                Sign in with Google
              </a>
            )}
          </div>
        </div>

        {/* ── Mobile drawer ── */}
        {mobileOpen && user && (
          <div className="mm-drawer">

            {/* User mini card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 16, marginBottom: 12,
              boxShadow: C.shadow,
            }}>
              <div className="mm-av-ring" style={{ width: 38, height: 38, fontSize: 14 }}>
                <div className="mm-av-inner" style={{ width: 34, height: 34, fontSize: 14 }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.text }}>
                  {user.name?.split(' ')[0]}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>
                  {user.college ?? 'MockMate User'}
                </div>
              </div>
              <div style={{
                fontFamily: F.mono, fontSize: 9, fontWeight: 700,
                color: C.blue600, letterSpacing: '0.4px',
                background: C.blue50, border: `1px solid ${C.borderMd}`,
                borderRadius: 100, padding: '2px 9px',
              }}>{tierLabel}</div>
            </div>

            {/* Mobile stat row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'IRS',    val: irs,          color: scoreColor(irs), bg: C.blue50,    border: C.borderMd },
                { label: 'AVG',    val: avgScore ?? '—', color: C.cyan500,    bg: C.cyanTint,  border: '#A0E8FA' },
                { label: 'STREAK', val: `🔥 ${streak}`, color: C.orange,     bg: '#FFF7ED',   border: '#FDBA74' },
              ].map(s => (
                <div key={s.label} style={{
                  textAlign: 'center', padding: '10px 6px',
                  background: s.bg, border: `1px solid ${s.border}`,
                  borderRadius: 14,
                }}>
                  <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 2, letterSpacing: '0.5px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Nav links */}
            {NAV_LINKS.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`mm-mobile-link${isActive(link.path) ? ' active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile CTA */}
            <button
              onClick={() => { setMobileOpen(false); navigate('/interview'); }}
              className="mm-cta"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center', padding: '14px 20px', fontSize: 14.5, borderRadius: 16 }}
            >
              <span className="mm-cta-dot" />
              New Interview
            </button>

            <div style={{ height: 1, background: C.border, margin: '14px 0 10px' }} />

            <button
              onClick={() => { setMobileOpen(false); logout(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '12px 16px',
                background: C.redTint, border: `1px solid rgba(220,38,38,0.15)`,
                borderRadius: 14,
                fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.red,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
              onMouseLeave={e => e.currentTarget.style.background = C.redTint}
            >
              🚪 Logout
            </button>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;
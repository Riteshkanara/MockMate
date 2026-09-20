import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';
import CommandPalette from './CommandPalette';

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  violet400: '#8B7CFF',
  violet500: '#6C5CE8',
  violet700: '#4A3CC4',
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
  { label: 'Dashboard',   path: '/dashboard',   icon: 'grid'  },
  { label: 'History',     path: '/history',     icon: 'clock' },
  { label: 'Coach',       path: '/coach',       icon: 'chat',  badge: 'AI' },
  { label: 'Leaderboard', path: '/leaderboard', icon: 'trophy' },
  { label: 'Analytics',   path: '/analytics',   icon: 'chart' },
];

const HIDDEN_ROUTES = ['/auth/callback', '/onboarding'];

const scoreColor = (s) => {
  const score = Number(s) || 0;
  if (score >= 80) return C.green;
  if (score >= 60) return C.blue500;
  if (score >= 40) return C.amber;
  return C.orange;
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const NavIcon = ({ name, size = 16 }) => {
  const common = {
    width: size, height: size,
    viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2.2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  const paths = {
    grid:       <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    clock:      <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
    trophy:     <><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.5v1.5A3.5 3.5 0 0 0 9 11"/><path d="M16 6h2.5v1.5A3.5 3.5 0 0 1 15 11"/><path d="M12 12.5V17"/><path d="M9 20h6"/><path d="M9.5 17h5"/></>,
    chart:      <><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></>,
    chat:       <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"/><circle cx="9" cy="9.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="12.5" cy="9.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="16" cy="9.5" r="1.05" fill="currentColor" stroke="none"/></>,
    mic:        <><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/></>,
    logout:     <><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10"/><path d="M14 8l4 4-4 4M18 12H9"/></>,
    flame:      <><path d="M13.2 2.8c.4 3-1.1 4.7-2.7 6.2-1.9 1.8-3.6 3.4-3.6 6.2A5.2 5.2 0 0 0 12 20.4a5.3 5.3 0 0 0 5.2-5.3c0-2.7-1.5-4.7-3.2-6.5-.8-.9-1-2.5-.8-5.8Z"/><path d="M11.9 11.4c-.8 1-1.6 2-1.6 3.5a1.8 1.8 0 0 0 3.6 0c0-1.3-.8-2.4-2-3.5Z"/></>,
    spark:      <><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z"/><path d="m19 14 .6 2 1.9.9-1.9.9-.6 2-.6-2-1.9-.9 1.9-.9.6-2Z"/></>,
    arrowRight: <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>,
    chevDown:   <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>,
    close:      <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    user:       <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>,
    trend:      <><path d="M4 16.5 9 11l3.5 3.5L20 7"/><path d="M15.5 7H20v4.5"/></>,
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

const Logomark = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <rect width="42" height="42" rx="10" fill="#0057E8" />
    <path
      d="M11 30V14l10 9 10-9v16"
      stroke="#ffffff"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Score Ring ───────────────────────────────────────────────────────────────
const ScoreRing = ({ value = 0, size = 20, strokeW = 2, id = 'sr' }) => {
  const radius = (size - strokeW * 2) / 2;
  const circ   = 2 * Math.PI * radius;
  const pct    = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circ - (pct / 100) * circ;
  const accent = scoreColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={accent}/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={C.border} strokeWidth={strokeW}/>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`url(#sg-${id})`}
        strokeWidth={strokeW} strokeDasharray={circ}
        strokeDashoffset={pct > 0 ? offset : circ} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}/>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════════
const NAVBAR_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  :root { --navbar-h: 75px; }
  body { padding-top: var(--navbar-h); }

  @keyframes mmDropIn    { from { opacity:0; transform:translateY(-8px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes mmSlideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes mmSheen     { 0% { transform:translateX(-120%) skewX(-14deg); } 100% { transform:translateX(260%) skewX(-14deg); } }
  @keyframes mmItemRise  { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
  @keyframes mmOverlayIn { from { opacity:0; } to { opacity:1; } }
  @keyframes mmPulse     { 0%,100% { opacity:1; } 50% { opacity:.45; } }

  /* ── Root shell ───────────────────────────────────────────── */
  .mm-root {
    position: fixed; top: 0; left: 0; right: 0;
    z-index: 1000;
    padding: max(10px, env(safe-area-inset-top)) 20px 10px;
    pointer-events: none;
  }

  .mm-backdrop {
    position: fixed; inset: 0; z-index: 999;
    background: rgba(10, 22, 40, 0.38);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: mmOverlayIn .2s ease;
    pointer-events: auto; cursor: pointer;
  }

  /* ── Capsule ──────────────────────────────────────────────── */
  .mm-capsule {
    position: relative;
    width: min(1440px, 100%); margin: 0 auto;
    padding: 6px 6px 6px 8px;
    display: flex; align-items: center; min-height: 64px;
    border-radius: 20px;
    border: 1px solid rgba(205,218,246,0.85);
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(36px) saturate(200%);
    -webkit-backdrop-filter: blur(36px) saturate(200%);
    box-shadow:
      0 1px 0 rgba(255,255,255,.95) inset,
      0 2px 8px rgba(0,31,107,.04),
      0 4px 20px rgba(0,31,107,.06);
    transition: box-shadow .4s cubic-bezier(.22,1,.36,1), background .4s ease, border-color .4s ease;
    pointer-events: auto;
  }
  .mm-capsule::before {
    content: '';
    position: absolute; left: 6%; right: 6%; top: 0;
    height: 1px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(26,110,255,.4), rgba(0,200,240,.32), rgba(26,110,255,.4), transparent);
    opacity: .65; pointer-events: none;
  }

  /* ── Brand ────────────────────────────────────────────────── */
  .mm-brand {
    display: flex; align-items: center; gap: 11px;
    text-decoration: none; padding: 5px 14px 5px 6px;
    border-radius: 15px; flex-shrink: 0;
    transition: background .18s ease, transform .18s cubic-bezier(.22,1,.36,1);
  }
  .mm-brand:hover { background: rgba(235,242,255,.7); }
  .mm-brand:hover .mm-brand-ring { box-shadow: 0 0 0 5px rgba(26,110,255,.10); }
  .mm-brand:active { transform: scale(.98); }
  .mm-brand-ring {
    border-radius: 12px; box-shadow: 0 0 0 0 rgba(26,110,255,0);
    transition: box-shadow .22s cubic-bezier(.22,1,.36,1); display: flex; flex-shrink: 0;
  }
  .mm-brand-word  { display: flex; flex-direction: column; gap: 3px; }
  .mm-brand-title {
    font-family: ${F.display}; font-size: 21px; font-weight: 800;
    letter-spacing: -.035em; line-height: 1; white-space: nowrap; color: ${C.text};
  }
  .mm-brand-tag {
    display: inline-flex; align-items: center;
    font: 500 10.5px ${F.body}; letter-spacing: 0.1px;
    color: ${C.muted}; white-space: nowrap; width: fit-content;
  }

  /* ── Desktop nav pill track ───────────────────────────────── */
  .mm-nav {
    flex: 1; display: flex; align-items: center; justify-content: center;
    min-width: 0; padding: 0 14px; gap: 8px;
  }
  .mm-nav-track {
    position: relative; display: flex; align-items: center;
    gap: 2px; padding: 4px; border-radius: 14px;
    background: rgba(244,248,255,.75); border: 1px solid rgba(210,222,248,.55);
    box-shadow: inset 0 1px 2px rgba(0,31,107,.03);
    overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
  }
  .mm-nav-track::-webkit-scrollbar { display: none; }
  .mm-pill {
    position: absolute; top: 50%; height: 38px;
    border-radius: 10px; transform: translateY(-50%);
    background: linear-gradient(160deg, rgba(110,168,255,.22) 0%, rgba(26,110,255,.13) 45%, rgba(0,68,196,.10) 100%);
    border: 1px solid rgba(26,110,255,.30);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.6), inset 0 -1px 0 rgba(26,110,255,.12), 0 3px 16px rgba(26,110,255,.20), 0 0 0 1px rgba(26,110,255,.06);
    pointer-events: none; overflow: hidden;
    transition: left .42s cubic-bezier(.22,1,.36,1), width .42s cubic-bezier(.22,1,.36,1), opacity .2s ease;
  }
  .mm-pill::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 55%);
    border-radius: inherit; pointer-events: none;
  }
  .mm-pill::after {
    content: ''; position: absolute; left: 20%; right: 20%; bottom: 0;
    height: 1.5px; border-radius: 999px; background: ${C.blue400};
    box-shadow: 0 0 8px rgba(26,110,255,.55);
  }
  .mm-link {
    position: relative; z-index: 2;
    display: inline-flex; align-items: center; justify-content: center;
    gap: 6px; height: 38px; flex: 1 1 auto; min-width: 80px; padding: 0 14px;
    border: none; border-radius: 10px; background: transparent; color: ${C.muted};
    text-decoration: none; font: 500 13px ${F.body}; letter-spacing: -.008em;
    white-space: nowrap; cursor: pointer;
    transition: color .18s ease, background .18s ease, transform .18s cubic-bezier(.22,1,.36,1);
  }
  .mm-link:hover:not(.active) { color: ${C.sub}; background: rgba(255,255,255,.55); transform: translateY(-0.5px); }
  .mm-link:active  { transform: translateY(0) scale(.98); }
  .mm-link.active  { color: ${C.blue600}; font-weight: 700; }
  .mm-link-badge {
    padding: 1.5px 5px; border: 1px solid rgba(0,173,224,.22); border-radius: 4px;
    color: ${C.cyan500}; background: rgba(0,200,240,.07);
    font: 700 7px ${F.mono}; letter-spacing: .3px;
  }
  .mm-link.active .mm-link-badge { color: ${C.blue600}; border-color: rgba(26,110,255,.3); background: rgba(26,110,255,.08); }

  .mm-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 10px;
  justify-content: flex-end;
}
 .mm-right .mm-cta {
  margin-left: 2px;
}

.mm-right .mm-profile-wrap {
  margin-left: 1px;
}
  .mm-sep {
    width: 1px; height: 22px; background: rgba(210,222,248,.8);
    border-radius: 999px; flex-shrink: 0; margin: 0 2px;
  }

  /* ── Stats chip ───────────────────────────────────────────── */
  .mm-statschip {
    display: flex; align-items: center; gap: 0;
    height: 40px; padding: 0 3px;
    border: 1px solid rgba(195,214,245,.9); border-radius: 13px;
    background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(247,251,255,.9));
    cursor: default; transition: border-color .18s ease;
  }
  .mm-schip-seg   { display: flex; align-items: center; gap: 5px; padding: 0 10px; height: 100%; }
  .mm-schip-label { font: 600 10px ${F.mono}; letter-spacing: .4px; text-transform: uppercase; color: ${C.muted}; line-height: 1; }
  .mm-schip-val   { font: 700 14px ${F.display}; letter-spacing: -.04em; line-height: 1; }
  .mm-schip-sep   { width: 1px; height: 16px; background: ${C.border}; flex-shrink: 0; }

 /* ── CTA — Frosted Elevated "New Interview" ─────────────── */
.mm-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;

  height: 42px;
  min-width: 128px;
  padding: 0 13px 0 6px;

  border: 1px solid rgba(180, 205, 246, 0.92);
  border-radius: 13px;

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.98) 0%,
      rgba(248,251,255,0.96) 100%
    );

  color: ${C.blue700};

  font: 700 13px ${F.body};
  letter-spacing: -0.012em;
  white-space: nowrap;
  cursor: pointer;

  box-shadow:
    0 1px 0 rgba(255,255,255,0.98) inset,
    0 2px 5px rgba(0,31,107,0.06),
    0 5px 14px rgba(26,110,255,0.08);

  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);

  transition:
    transform .2s cubic-bezier(.22,1,.36,1),
    box-shadow .2s ease,
    border-color .2s ease,
    background .2s ease,
    color .2s ease;

  flex-shrink: 0;
  overflow: hidden;
}

/* subtle glass highlight */
.mm-cta::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.62) 0%,
      rgba(255,255,255,0.00) 58%
    );
}

/* tiny blue glow at bottom */
.mm-cta::after {
  content: '';
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: -1px;
  height: 1px;

  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(26,110,255,0.55),
    transparent
  );

  opacity: .65;
}

/* hover */
.mm-cta:hover {
  transform: translateY(-1.5px);

  border-color: rgba(26,110,255,0.38);

  background:
    linear-gradient(
      180deg,
      #ffffff 0%,
      #f5f9ff 100%
    );

  color: ${C.blue600};

  box-shadow:
    0 0 0 3px rgba(26,110,255,0.07),
    0 5px 14px rgba(26,110,255,0.12),
    0 10px 24px rgba(26,110,255,0.10),
    inset 0 1px 0 rgba(255,255,255,1);
}

/* active */
.mm-cta:active {
  transform: translateY(0) scale(.98);

  box-shadow:
    0 0 0 2px rgba(26,110,255,0.08),
    0 3px 8px rgba(26,110,255,0.10),
    inset 0 1px 0 rgba(255,255,255,0.9);
}

/* blue icon box — Option D style */
.mm-cta-icon {
  position: relative;
  z-index: 2;

  width: 28px;
  height: 28px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 8px;

  color: #ffffff;

  background:
    linear-gradient(
      145deg,
      ${C.blue500} 0%,
      ${C.blue700} 100%
    );

  border: 1px solid rgba(0,87,232,0.20);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.24),
    0 2px 6px rgba(0,87,232,0.18);

  flex-shrink: 0;

  transition:
    transform .2s cubic-bezier(.22,1,.36,1),
    box-shadow .2s ease;
}

.mm-cta:hover .mm-cta-icon {
  transform: scale(1.04);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.28),
    0 3px 9px rgba(0,87,232,0.24);
}

.mm-cta-text {
  position: relative;
  z-index: 2;

  color: inherit;
  font-weight: 700;
}

/* ── Frosted Elevated profile trigger ─────────────────────── */
.mm-profile-wrap {
  position: relative;
  flex-shrink: 0;
}

.mm-av-btn {
  position: relative;

  width: 42px;
  height: 42px;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 6px;

  border: 1px solid rgba(180,205,246,0.92);
  border-radius: 13px;

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.98) 0%,
      rgba(247,251,255,0.96) 100%
    );

  cursor: pointer;
  overflow: hidden;

  box-shadow:
    0 1px 0 rgba(255,255,255,0.98) inset,
    0 2px 6px rgba(0,31,107,0.05),
    0 5px 14px rgba(26,110,255,0.07);

  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);

  transition:
    transform .2s cubic-bezier(.22,1,.36,1),
    border-color .18s ease,
    box-shadow .18s ease,
    background .18s ease;
}

.mm-av-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;

  border-radius: inherit;

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.62),
      rgba(255,255,255,0)
    );
}

.mm-av-btn:hover {
  transform: translateY(-1.5px);

  border-color: rgba(26,110,255,0.40);

  background:
    linear-gradient(
      180deg,
      #ffffff 0%,
      #f5f9ff 100%
    );

  box-shadow:
    0 0 0 3px rgba(26,110,255,0.07),
    0 6px 16px rgba(26,110,255,0.12),
    0 10px 24px rgba(26,110,255,0.08),
    inset 0 1px 0 rgba(255,255,255,1);
}

.mm-av-btn:active {
  transform: translateY(0) scale(.96);
}

.mm-av-btn[aria-expanded="true"] {
  border-color: rgba(26,110,255,0.48);

  box-shadow:
    0 0 0 3px rgba(26,110,255,0.09),
    0 6px 16px rgba(26,110,255,0.12),
    inset 0 1px 0 rgba(255,255,255,1);
}

/* small blue avatar tile */
.mm-av-initial {
  position: relative;
  z-index: 2;

  width: 28px;
  height: 28px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 9px;

  background:
    linear-gradient(
      145deg,
      ${C.blue500} 0%,
      ${C.blue700} 100%
    );

  color: #ffffff;

  font: 800 12px ${F.display};
  letter-spacing: -.02em;

  border: 1px solid rgba(0,87,232,0.18);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.24),
    0 2px 7px rgba(0,87,232,0.18);
}

  /* ══ DESKTOP DROPDOWN ═════════════════════════════════════════════════════ */
  .mm-drop {
    position: absolute; top: calc(100% + 10px); right: 0;
    width: 310px;
    border: 1px solid rgba(210,222,248,.9); border-radius: 22px;
    background: rgba(255,255,255,.98);
    backdrop-filter: blur(36px) saturate(200%);
    -webkit-backdrop-filter: blur(36px) saturate(200%);
    box-shadow: 0 0 0 1px rgba(26,110,255,.06), 0 8px 24px rgba(0,31,107,.10), 0 28px 64px rgba(0,31,107,.18), inset 0 1px 0 rgba(255,255,255,.96);
    animation: mmDropIn .22s cubic-bezier(.22,1,.36,1);
    z-index: 100; overflow: hidden;
    max-height: min(640px, calc(100vh - 96px));
    display: flex; flex-direction: column;
  }
  .mm-drop-scroll { flex: 1; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .mm-drop-head {
    padding: 16px 16px 12px; border-bottom: 1px solid ${C.border};
    background: linear-gradient(145deg, rgba(235,242,255,.6), rgba(255,255,255,.9));
  }
  .mm-drop-toprow { display: flex; align-items: center; gap: 11px; }
  .mm-drop-avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(145deg, ${C.blue500}, ${C.blue800});
    display: flex; align-items: center; justify-content: center;
    color: #fff; font: 700 16px ${F.display};
    box-shadow: 0 3px 12px rgba(26,110,255,.28), inset 0 1px 0 rgba(255,255,255,.22);
  }
  .mm-drop-user-info { flex: 1; min-width: 0; }
  .mm-drop-name { font: 700 14px ${F.display}; color: ${C.text}; letter-spacing: -.012em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-drop-sub  { font: 500 11px ${F.body}; color: ${C.muted}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-drop-close {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid ${C.border}; background: rgba(248,250,255,.85);
    color: ${C.muted}; cursor: pointer;
    transition: background .14s ease, color .14s ease, border-color .14s ease;
  }
  .mm-drop-close:hover { background: ${C.redTint}; color: ${C.red}; border-color: rgba(220,38,38,.2); }
  .mm-drop-tier {
    display: inline-flex; align-items: center; gap: 5px;
    margin-top: 10px; padding: 4px 10px 4px 7px; border-radius: 999px;
    background: linear-gradient(100deg, rgba(108,92,232,.08), rgba(26,110,255,.09));
    border: 1px solid rgba(108,92,232,.2); color: ${C.violet700};
    font: 600 10px ${F.body}; letter-spacing: .08px;
  }
  .mm-drop-tier-icon {
    width: 14px; height: 14px; display: grid; place-items: center; border-radius: 50%;
    background: linear-gradient(135deg, ${C.violet500}, ${C.blue500}); color: #fff; flex-shrink: 0;
  }
  .mm-drop-tier b { color: ${C.blue700}; font-weight: 800; }
  .mm-drop-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
  .mm-drop-stat {
    padding: 8px 4px 7px; text-align: center;
    border: 1px solid ${C.border}; border-radius: 11px; background: rgba(255,255,255,.9);
    transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease; cursor: default;
  }
  .mm-drop-stat:hover { border-color: rgba(26,110,255,.26); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(26,110,255,.10); }
  .mm-drop-stat-val   { font: 800 15px ${F.display}; letter-spacing: -.03em; line-height: 1.1; }
  .mm-drop-stat-label { font: 600 8px ${F.body}; letter-spacing: .18px; color: ${C.muted}; margin-top: 3px; text-transform: uppercase; }
  .mm-drop-section-label { font: 700 9.5px ${F.mono}; letter-spacing: .55px; text-transform: uppercase; color: ${C.faint}; padding: 10px 14px 5px; }
  .mm-drop-menu { padding: 4px 6px 6px; }
  .mm-drop-item {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border: none; border-radius: 11px;
    background: transparent; color: ${C.sub}; font: 500 13px ${F.body};
    text-align: left; cursor: pointer; text-decoration: none;
    transition: background .13s ease, color .13s ease, transform .13s ease;
    animation: mmItemRise .26s cubic-bezier(.22,1,.36,1) backwards;
  }
  .mm-drop-item:hover  { color: ${C.blue700}; background: ${C.blue50}; transform: translateX(2px); }
  .mm-drop-item:active { transform: translateX(2px) scale(.99); }
  .mm-drop-item.active-page { color: ${C.blue600}; background: rgba(26,110,255,.07); font-weight: 650; }
  .mm-drop-item-arrow { margin-left: auto; opacity: 0; transform: translateX(-3px); transition: all .14s ease; color: ${C.faint}; }
  .mm-drop-item:hover .mm-drop-item-arrow { opacity: 1; transform: translateX(0); }
  .mm-drop-item.active-page .mm-drop-item-arrow { opacity: .5; transform: translateX(0); }
  .mm-drop-icon {
    width: 30px; height: 30px; display: grid; place-items: center;
    border: 1px solid ${C.border}; border-radius: 9px;
    background: rgba(248,250,255,.9); flex-shrink: 0; color: ${C.sub};
    transition: background .13s ease, border-color .13s ease, color .13s ease;
  }
  .mm-drop-item:hover .mm-drop-icon { background: ${C.blue50}; border-color: rgba(26,110,255,.26); color: ${C.blue600}; }
  .mm-drop-item.active-page .mm-drop-icon { background: rgba(26,110,255,.10); border-color: rgba(26,110,255,.22); color: ${C.blue600}; }
  .mm-drop-divider { height: 1px; background: ${C.border}; margin: 5px 10px; }
  .mm-drop-footer {
    flex-shrink: 0; padding: 8px 10px 10px;
    border-top: 1px solid rgba(210,220,245,.65);
    background: linear-gradient(180deg, rgba(250,252,255,.97), rgba(246,249,255,.98));
  }
  .mm-drop-signout {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; border-radius: 14px;
    border: 1px solid rgba(220,38,38,.14);
    background: linear-gradient(135deg, rgba(254,242,242,.9), rgba(255,248,248,.97));
    color: ${C.red}; font: 650 13px ${F.body}; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background .15s ease, border-color .15s ease, transform .15s ease, box-shadow .15s ease;
  }
  .mm-drop-signout:hover { background: rgba(254,226,226,.95); border-color: rgba(220,38,38,.28); transform: translateX(1.5px); box-shadow: 0 4px 14px rgba(220,38,38,.10); }
  .mm-drop-signout:active { transform: scale(.98); }
  .mm-drop-signout-icon {
    width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
    display: grid; place-items: center;
    background: rgba(220,38,38,.08); border: 1px solid rgba(220,38,38,.14); color: ${C.red};
    transition: background .15s ease, border-color .15s ease;
  }
  .mm-drop-signout:hover .mm-drop-signout-icon { background: rgba(220,38,38,.14); border-color: rgba(220,38,38,.28); }
  .mm-drop-signout-label { flex: 1; text-align: left; font-size: 13px; font-weight: 650; }
  .mm-drop-signout-arrow { color: rgba(220,38,38,.45); transition: transform .15s ease, color .15s ease; }
  .mm-drop-signout:hover .mm-drop-signout-arrow { transform: translateX(2px); color: ${C.red}; }
  .mm-drop-cmd-hint {
    display: flex; align-items: center; justify-content: center; gap: 5px;
    padding: 6px 0 2px; font: 500 10px ${F.mono}; color: ${C.faint};
  }
  .mm-drop-cmd-hint kbd {
    padding: 1px 5px; border: 1px solid ${C.border}; border-radius: 4px;
    font: inherit; font-size: 9.5px; background: rgba(255,255,255,.8); color: ${C.muted};
  }

  /* ── Login button ─────────────────────────────────────────── */
  .mm-login {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    height: 40px; padding: 0 15px 0 8px;
    border: 1px solid rgba(26,110,255,.22); border-radius: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(246,250,255,.96));
    color: #111827 !important; text-decoration: none;
    font: 650 13px ${F.body};
    box-shadow: 0 2px 8px rgba(0,31,107,.05), 0 5px 14px rgba(26,110,255,.06), inset 0 1px 0 rgba(255,255,255,.96);
    transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, border-color .2s ease, background .2s ease;
    white-space: nowrap; flex-shrink: 1; min-width: 0; overflow: hidden;
  }
  .mm-login-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .mm-login:hover { color: #111827 !important; transform: translateY(-1.5px); border-color: rgba(26,110,255,.42); background: linear-gradient(180deg, #fff, #f3f8ff); box-shadow: 0 0 0 3px rgba(26,110,255,.07), 0 10px 26px rgba(26,110,255,.16), inset 0 1px 0 rgba(255,255,255,.98); }
  .mm-login:active { transform: translateY(0) scale(.98); }
  .mm-google-wrap {
    width: 26px; height: 26px; display: grid; place-items: center;
    border-radius: 7px; background: ${C.blue50}; border: 1px solid rgba(26,110,255,.10);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.8); flex-shrink: 0;
  }

  /* ── Goal ring utility ────────────────────────────────────── */
  .mm-util-wrap { position: relative; flex-shrink: 0; }
  .mm-util-btn {
    position: relative; width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(195,214,245,.9); border-radius: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(247,251,255,.9));
    color: ${C.sub}; cursor: pointer;
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s cubic-bezier(.22,1,.36,1), color .18s ease;
  }
  .mm-util-btn:hover { color: ${C.blue600}; border-color: rgba(26,110,255,.38); background: #fff; box-shadow: 0 4px 14px rgba(26,110,255,.14); transform: translateY(-1.5px); }
  .mm-util-btn:active { transform: translateY(0) scale(.94); }
  .mm-util-btn[aria-expanded="true"] { border-color: rgba(26,110,255,.5); color: ${C.blue600}; box-shadow: 0 0 0 3px rgba(26,110,255,.12); }
  .mm-goal-btn { padding: 0; }
  .mm-popover {
    position: absolute; top: calc(100% + 12px); right: 0; width: 300px;
    border: 1px solid rgba(210,222,248,.9); border-radius: 18px;
    background: rgba(255,255,255,.98);
    backdrop-filter: blur(28px) saturate(190%);
    -webkit-backdrop-filter: blur(28px) saturate(190%);
    box-shadow: 0 24px 58px rgba(0,31,107,.16), 0 6px 16px rgba(0,31,107,.07), inset 0 1px 0 rgba(255,255,255,.95);
    animation: mmDropIn .2s cubic-bezier(.22,1,.36,1); z-index: 100; overflow: visible;
    max-height: calc(100vh - 96px);
  }
  .mm-popover::before {
    content: ''; position: absolute; top: -6px; right: 16px; width: 12px; height: 12px;
    background: rgba(255,255,255,.98);
    border-left: 1px solid rgba(210,222,248,.9); border-top: 1px solid rgba(210,222,248,.9);
    transform: rotate(45deg); border-radius: 3px 0 0 0;
  }
  .mm-popover-inner { position: relative; border-radius: 18px; overflow: hidden; background: inherit; max-height: calc(100vh - 96px); overflow-y: auto; }
  .mm-popover-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px 11px; border-bottom: 1px solid ${C.border}; }
  .mm-popover-title { font: 700 13px ${F.display}; color: ${C.text}; letter-spacing: -.01em; }
  .mm-popover-sub   { font: 500 10.5px ${F.body}; color: ${C.muted}; margin-top: 1px; }
  .mm-goal-body { padding: 16px 14px; display: flex; align-items: center; gap: 14px; }
  .mm-goal-ring-big { flex-shrink: 0; }
  .mm-goal-copy-title { font: 700 14px ${F.display}; color: ${C.text}; }
  .mm-goal-copy-sub   { font: 500 11.5px ${F.body}; color: ${C.muted}; margin-top: 3px; line-height: 1.4; }
  .mm-goal-cta {
    display: inline-flex; align-items: center; gap: 6px;
    margin: 0 14px 14px; padding: 9px 12px; border-radius: 11px;
    border: 1px solid rgba(26,110,255,.24); background: ${C.blue50}; color: ${C.blue700};
    font: 650 12px ${F.body}; cursor: pointer; width: calc(100% - 28px); justify-content: center;
    transition: background .15s ease, border-color .15s ease, transform .15s ease, box-shadow .15s ease;
  }
  .mm-goal-cta:hover { background: #dfe9ff; border-color: rgba(26,110,255,.4); transform: translateY(-1.5px); box-shadow: 0 6px 16px rgba(26,110,255,.16); }
  .mm-goal-cta:active { transform: translateY(0) scale(.98); }

  /* ── Mobile controls row ──────────────────────────────────── */
.mm-mobile-controls {
  display: none;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}


/* ═══════════════════════════════════════════════════════════
   MOBILE INTERVIEW — Frosted Elevated
   Desktop remains completely untouched.
   ═══════════════════════════════════════════════════════════ */

.mm-mobile-interview-pill {
  position: relative;

  display: inline-flex;
  align-items: center;
  gap: 8px;

  height: 40px;
  padding: 4px 11px 4px 4px;

  border-radius: 13px;

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.98) 0%,
      rgba(247,251,255,0.96) 100%
    );

  border: 1px solid rgba(180,205,246,0.92);

  box-shadow:
    0 1px 0 rgba(255,255,255,0.98) inset,
    0 2px 6px rgba(0,31,107,0.05),
    0 5px 14px rgba(26,110,255,0.08);

  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);

  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;

  -webkit-tap-highlight-color: transparent;

  transition:
    transform .2s cubic-bezier(.22,1,.36,1),
    box-shadow .18s ease,
    border-color .18s ease,
    background .18s ease;
}


/* subtle top glass highlight */
.mm-mobile-interview-pill::before {
  content: '';
  position: absolute;
  inset: 0;

  border-radius: inherit;
  pointer-events: none;

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.68),
      rgba(255,255,255,0)
    );
}


/* tiny blue bottom accent */
.mm-mobile-interview-pill::after {
  content: '';
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 0;

  height: 1px;
  border-radius: 999px;

  background: linear-gradient(
    90deg,
    transparent,
    rgba(26,110,255,.55),
    transparent
  );

  opacity: .7;
}


.mm-mobile-interview-pill:hover {
  transform: translateY(-1.5px);

  border-color: rgba(26,110,255,.38);

  background:
    linear-gradient(
      180deg,
      #ffffff 0%,
      #f5f9ff 100%
    );

  box-shadow:
    0 0 0 3px rgba(26,110,255,.07),
    0 6px 16px rgba(26,110,255,.13),
    0 10px 24px rgba(26,110,255,.08),
    inset 0 1px 0 rgba(255,255,255,1);
}


.mm-mobile-interview-pill:active {
  transform: scale(.97);
}


/* blue icon square */
.mm-pill-icon-box {
  position: relative;
  z-index: 2;

  width: 30px;
  height: 30px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 8px;

  background:
    linear-gradient(
      145deg,
      ${C.blue500},
      ${C.blue700}
    );

  color: #ffffff;

  border: 1px solid rgba(0,87,232,.18);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.24),
    0 2px 7px rgba(0,87,232,.20);

  flex-shrink: 0;

  transition:
    transform .2s cubic-bezier(.22,1,.36,1),
    box-shadow .18s ease;
}


.mm-mobile-interview-pill:hover .mm-pill-icon-box {
  transform: scale(1.04);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.28),
    0 3px 9px rgba(0,87,232,.24);
}


.mm-pill-label {
  position: relative;
  z-index: 2;

  padding: 0;

  font: 700 13px ${F.body};
  letter-spacing: -.015em;

  color: ${C.text};
  white-space: nowrap;
}


/* ═══════════════════════════════════════════════════════════
   MOBILE MENU / DROPDOWN TRIGGER — Frosted Elevated
   ═══════════════════════════════════════════════════════════ */

.mm-ham {
  position: relative;

  width: 40px;
  height: 40px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;

  padding: 0;

  border-radius: 13px;
  border: 1px solid rgba(180,205,246,0.92);

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.98) 0%,
      rgba(247,251,255,0.96) 100%
    );

  box-shadow:
    0 1px 0 rgba(255,255,255,0.98) inset,
    0 2px 6px rgba(0,31,107,0.05),
    0 5px 14px rgba(26,110,255,0.07);

  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);

  cursor: pointer;
  flex-shrink: 0;

  -webkit-tap-highlight-color: transparent;

  transition:
    transform .2s cubic-bezier(.22,1,.36,1),
    box-shadow .18s ease,
    border-color .18s ease,
    background .18s ease;
}


.mm-ham:hover {
  transform: translateY(-1.5px);

  border-color: rgba(26,110,255,.38);

  background:
    linear-gradient(
      180deg,
      #ffffff 0%,
      #f5f9ff 100%
    );

  box-shadow:
    0 0 0 3px rgba(26,110,255,.07),
    0 6px 16px rgba(26,110,255,.12),
    0 10px 22px rgba(26,110,255,.08),
    inset 0 1px 0 rgba(255,255,255,1);
}


.mm-ham:active {
  transform: scale(.94);
}


/* hamburger lines */
.mm-ham .bar {
  width: 16px;
  height: 1.8px;

  border-radius: 999px;

  background: ${C.blue700};

  transition:
    transform .24s cubic-bezier(.22,1,.36,1),
    opacity .18s ease,
    background .18s ease;
}


/* open state */
.mm-ham.open {
  border-color: rgba(26,110,255,.42);

  box-shadow:
    0 0 0 3px rgba(26,110,255,.08),
    0 6px 16px rgba(26,110,255,.12),
    inset 0 1px 0 rgba(255,255,255,1);
}


.mm-ham.open .bar:nth-child(1) {
  transform: rotate(45deg) translate(4px, 4px);
}

.mm-ham.open .bar:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}

.mm-ham.open .bar:nth-child(3) {
  transform: rotate(-45deg) translate(4px, -4px);
}


/* ── Very small phones ───────────────────────────────────── */
@media (max-width: 400px) {
  .mm-pill-label {
    display: none;
  }

  .mm-mobile-interview-pill {
    width: 40px;
    padding: 4px;
    justify-content: center;
  }
}
  /* ── Panel header: user identity ──────────────────────────── */
  .mm-panel-head {
    flex-shrink: 0; padding: 14px 14px 12px;
    border-bottom: 1px solid rgba(210,220,245,.65);
    background: linear-gradient(145deg, rgba(235,242,255,.5), rgba(255,255,255,.9));
  }
  .mm-panel-user {
    display: flex; align-items: center; gap: 10px;
  }
  .mm-panel-avatar {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(145deg, ${C.blue500}, ${C.blue800});
    display: flex; align-items: center; justify-content: center;
    color: #fff; font: 800 17px ${F.display};
    box-shadow: 0 3px 12px rgba(26,110,255,.28), inset 0 1px 0 rgba(255,255,255,.2);
  }
  .mm-panel-identity { flex: 1; min-width: 0; }
  .mm-panel-name     { font: 700 14.5px ${F.display}; color: ${C.text}; letter-spacing: -.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-panel-college  { font: 500 11px ${F.body}; color: ${C.muted}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-panel-tier-badge {
    font: 700 9px ${F.mono}; color: ${C.blue600};
    background: ${C.blue50}; border: 1px solid rgba(26,110,255,.22);
    border-radius: 999px; padding: 4px 10px; flex-shrink: 0; white-space: nowrap;
    letter-spacing: .1px;
  }

  /* ── Scrollable body ──────────────────────────────────────── */
  .mm-panel-scroll {
    flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain; padding: 14px 12px 8px;
  }

  /* ── Stats row ────────────────────────────────────────────── */
  .mm-panel-stats {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-bottom: 14px;
  }
  .mm-panel-stat {
    padding: 10px 5px 9px; text-align: center;
    border: 1px solid ${C.border}; border-radius: 13px; background: #fff;
    transition: border-color .14s ease, transform .14s ease; cursor: default;
  }
  .mm-panel-stat:hover { border-color: rgba(26,110,255,.22); transform: translateY(-1px); }
  .mm-panel-stat-val   { font: 800 16px ${F.display}; letter-spacing: -.04em; line-height: 1.1; }
  .mm-panel-stat-label { font: 600 7.5px ${F.mono}; letter-spacing: .4px; color: ${C.muted}; margin-top: 3px; text-transform: uppercase; }

  /* ── Goal progress bar (replaces ring — more compact on mobile) ─── */
  .mm-panel-goal {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; margin-bottom: 14px;
    border: 1px solid ${C.border}; border-radius: 13px;
    background: rgba(248,250,255,.7);
  }
  .mm-panel-goal-ring { flex-shrink: 0; }
  .mm-panel-goal-info { flex: 1; min-width: 0; }
  .mm-panel-goal-title { font: 700 12px ${F.body}; color: ${C.text}; }
  .mm-panel-goal-sub   { font: 500 10.5px ${F.body}; color: ${C.muted}; margin-top: 2px; }
  .mm-panel-goal-bar-track {
    height: 3px; border-radius: 999px; background: ${C.border};
    margin-top: 6px; overflow: hidden;
  }
  .mm-panel-goal-bar-fill {
    height: 100%; border-radius: 999px;
    background: linear-gradient(90deg, ${C.blue500}, ${C.cyan400});
    transition: width .5s cubic-bezier(.22,1,.36,1);
  }

  /* ── Nav section label ────────────────────────────────────── */
  .mm-panel-section-label {
    font: 700 9.5px ${F.mono}; letter-spacing: .55px; text-transform: uppercase;
    color: ${C.faint}; margin-bottom: 8px; padding: 0 2px;
  }

  /* ── 2-column nav tile grid ───────────────────────────────── */
  .mm-panel-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 8px; margin-bottom: 6px;
  }
  .mm-panel-tile {
    position: relative;
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 9px; padding: 13px 13px 12px;
    border: 1px solid ${C.border}; border-radius: 16px;
    background: #fff; text-decoration: none; min-height: 88px;
    transition: border-color .14s ease, background .14s ease, transform .14s cubic-bezier(.22,1,.36,1), box-shadow .14s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .mm-panel-tile:hover:not(.mm-tile-active) {
    border-color: rgba(26,110,255,.28); background: ${C.blue50};
    transform: translateY(-1px); box-shadow: 0 4px 12px rgba(26,110,255,.10);
  }
  .mm-panel-tile:active { transform: scale(.97); }
  /* Active tile: solid blue fill */
  .mm-tile-active {
    background: linear-gradient(145deg, ${C.blue500}, ${C.blue700});
    border-color: transparent;
    box-shadow: 0 6px 18px rgba(26,110,255,.30);
  }
  .mm-panel-tile-icon {
    width: 34px; height: 34px; border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    color: ${C.blue600}; background: ${C.blue50};
    border: 1px solid rgba(26,110,255,.12); flex-shrink: 0;
    transition: background .14s ease, color .14s ease, border-color .14s ease;
  }
  .mm-tile-active .mm-panel-tile-icon { color: rgba(255,255,255,.9); background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.2); }
  .mm-panel-tile-label { font: 650 13px ${F.body}; color: ${C.sub}; letter-spacing: -.01em; }
  .mm-tile-active .mm-panel-tile-label { color: #fff; font-weight: 700; }
  .mm-panel-tile-badge {
    position: absolute; top: 11px; right: 11px;
    font: 700 7px ${F.mono}; letter-spacing: .3px;
    padding: 2px 5px; border-radius: 4px;
    color: ${C.cyan500}; background: rgba(0,200,240,.09); border: 1px solid rgba(0,173,224,.22);
  }
  .mm-tile-active .mm-panel-tile-badge { color: rgba(255,255,255,.9); background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.3); }

  /* ── Panel footer: sign out ───────────────────────────────── */
  .mm-panel-footer {
    flex-shrink: 0; padding: 10px 12px 14px;
    border-top: 1px solid rgba(210,220,245,.65);
    background: linear-gradient(180deg, rgba(250,252,255,.97), rgba(246,249,255,.99));
  }
  .mm-panel-signout {
    width: 100%; display: flex; align-items: center; gap: 12px;
    padding: 13px 15px; border-radius: 16px;
    border: 1px solid rgba(220,38,38,.14);
    background: linear-gradient(135deg, rgba(254,242,242,.92), rgba(255,250,250,.97));
    color: ${C.red}; font: 650 13.5px ${F.body}; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background .15s ease, border-color .15s ease, transform .15s ease, box-shadow .15s ease;
  }
  .mm-panel-signout:hover { background: rgba(254,226,226,.92); border-color: rgba(220,38,38,.26); box-shadow: 0 4px 14px rgba(220,38,38,.10); }
  .mm-panel-signout:active { transform: scale(.98); }
  .mm-panel-signout-icon {
    width: 34px; height: 34px; border-radius: 11px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(220,38,38,.07); border: 1px solid rgba(220,38,38,.14); color: ${C.red};
    transition: background .15s ease, border-color .15s ease;
  }
  .mm-panel-signout:hover .mm-panel-signout-icon { background: rgba(220,38,38,.13); border-color: rgba(220,38,38,.26); }
  .mm-panel-signout-text { flex: 1; text-align: left; }
  .mm-panel-signout-sub  { font: 500 10px ${F.body}; color: rgba(220,38,38,.6); margin-top: 1px; }
  .mm-panel-signout-arrow { color: rgba(220,38,38,.4); transition: transform .15s ease, color .15s ease; }
  .mm-panel-signout:hover .mm-panel-signout-arrow { transform: translateX(2px); color: ${C.red}; }

  .mm-panel-cmd-hint {
    display: flex; align-items: center; justify-content: center; gap: 5px;
    padding: 8px 0 0; font: 500 10px ${F.mono}; color: ${C.faint};
  }
  .mm-panel-cmd-hint kbd {
    padding: 1px 5px; border: 1px solid ${C.border}; border-radius: 4px;
    font: inherit; font-size: 9.5px; background: rgba(255,255,255,.8); color: ${C.muted};
  }

  /* ── Focus ────────────────────────────────────────────────── */
  .mm-focus { -webkit-tap-highlight-color: transparent; }
  .mm-focus:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255,255,255,.9), 0 0 0 4px rgba(26,110,255,.55);
  }
  .mm-brand:focus-visible { border-radius: 15px; }

  /* ── Responsive ───────────────────────────────────────────── */
  @media (min-width: 1441px) { .mm-capsule { width: min(1520px, calc(100% - 40px)); } }
  @media (max-width: 1160px) { .mm-brand-tag { display: none; } }
  @media (max-width: 1020px) { .mm-link { min-width: 52px; padding: 0 8px; font-size: 12px; } }
  @media (max-width: 900px)  { .mm-schip-label { display: none; } .mm-statschip { padding: 0 2px; } .mm-schip-seg { padding: 0 7px; } }

  /* ── Mobile breakpoint ≤830px ─────────────────────────────── */
  @media (max-width: 830px) {
    body { padding-top: 88px; }
    .mm-root { padding: max(8px, env(safe-area-inset-top)) 12px 8px; }
    .mm-nav              { display: none; }
    .mm-profile-wrap     { display: none; }
    .mm-cta.desktop-only { display: none; }
    .mm-sep              { display: none; }
    .mm-mobile-controls  { display: flex; }
    .mm-right            { margin-left: auto; }
    .mm-util-wrap        { display: none !important; }
    .mm-statschip.desktop-only { display: none !important; }
    .mm-popover { position: fixed; top: 82px; left: 12px; right: 12px; width: auto; max-width: 100%; }
    .mm-popover::before { display: none; }
  }
  @media (min-width: 831px) {
    .mm-mobile-controls { display: none !important; }
    .mm-mobile-panel    { display: none !important; }
    .mm-backdrop        { display: none !important; }
  }

  /* ── Small phones ≤560px ──────────────────────────────────── */
  @media (max-width: 560px) {
    .mm-root { padding: max(8px, env(safe-area-inset-top)) 8px 8px; }
    .mm-brand-title { font-size: 17px; }
    .mm-brand { padding: 5px 8px 5px 6px; gap: 8px; }
    .mm-statschip { display: none; }
    .mm-right { overflow: hidden; min-width: 0; flex-shrink: 1; }
    .mm-login { padding: 0 12px 0 7px; gap: 7px; font-size: 12px; }
    .mm-google-wrap { width: 22px; height: 22px; flex-shrink: 0; }
  }

  /* ── Very small ≤400px ────────────────────────────────────── */
  @media (max-width: 400px) {
    .mm-brand-title { font-size: 15px; }
    .mm-login-text-full  { display: none; }
    .mm-login-text-short { display: inline; }
    .mm-panel-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 401px) { .mm-login-text-short { display: none; } }

  @media (max-width: 380px) {
    .mm-brand-title { font-size: 14px; letter-spacing: -.04em; }
    .mm-panel-grid  { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Navbar Component
// ═══════════════════════════════════════════════════════════════════════════════
const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen,   setDropOpen]   = useState(false);
  const [goalOpen,   setGoalOpen]   = useState(false);

  const dropRef  = useRef(null);
  const goalRef  = useRef(null);
  const shellRef = useRef(null);
  const linkRefs = useRef({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const irs      = user?.irs ?? user?.readinessScore ?? 0;
  const avgScore = user?.averageScore ?? null;
  const streak   = user?.streak?.current ?? 0;
  const accent   = scoreColor(irs);
  const initials = user?.name?.[0]?.toUpperCase() || 'M';

  const tierLabel =
    user?.tierLabel ??
    (irs >= 80 ? '₹20 LPA+' : irs >= 60 ? '₹12–20 LPA' : irs >= 38 ? '₹6–12 LPA' : '₹3–6 LPA');

  const goalTarget    = user?.dailyGoal?.target    ?? 3;
  const goalCompleted = user?.dailyGoal?.completed ?? 0;
  const goalDone      = goalCompleted >= goalTarget;
  const goalPct       = Math.min(100, Math.round((goalCompleted / Math.max(1, goalTarget)) * 100));

  // ── Side-effects ────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (goalRef.current && !goalRef.current.contains(e.target)) setGoalOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false); setDropOpen(false); setGoalOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setMobileOpen(false); setDropOpen(false); setGoalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const active = linkRefs.current[location.pathname];
      if (!active) { setIndicator(prev => ({ ...prev, opacity: 0 })); return; }
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth, opacity: 1 });
    };
    updateIndicator();
    const shell  = shellRef.current;
    const active = linkRefs.current[location.pathname];
    if (shell && active) {
      const sb = shell.getBoundingClientRect();
      const ab = active.getBoundingClientRect();
      if (ab.left < sb.left || ab.right > sb.right)
        active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
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

  const DROPDOWN_ITEMS = [
    { icon: 'grid',   label: 'Dashboard',   path: '/dashboard'   },
    { icon: 'clock',  label: 'History',     path: '/history'     },
    { icon: 'chart',  label: 'Analytics',   path: '/analytics'   },
    { icon: 'trophy', label: 'Leaderboard', path: '/leaderboard' },
    { icon: 'chat',   label: 'AI Coach',    path: '/coach',      badge: 'AI' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{NAVBAR_CSS}</style>

      {mobileOpen && user && (
        <div className="mm-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true"/>
      )}

      <nav className="mm-root" aria-label="Main navigation">
        <div className="mm-capsule">

          {/* ── Brand ─────────────────────────────────────────── */}
          <Link to={user ? '/dashboard' : '/'} className="mm-brand mm-focus">
            <div className="mm-brand-ring"><Logomark size={40}/></div>
            <div className="mm-brand-word">
              <div className="mm-brand-title">MockMate</div>
              <div className="mm-brand-tag">Practice. Improve. Get hired.</div>
            </div>
          </Link>

          {/* ── Desktop nav track ──────────────────────────────── */}
          {user && (
            <div className="mm-nav">
              <div ref={shellRef} className="mm-nav-track" role="list">
                <div className="mm-pill"
                  style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
                />
                {NAV_LINKS.map((link) => (
                  <Link key={link.path}
                    ref={(el) => { linkRefs.current[link.path] = el; }}
                    to={link.path}
                    className={`mm-link mm-focus${isActive(link.path) ? ' active' : ''}`}
                    role="listitem"
                    aria-current={isActive(link.path) ? 'page' : undefined}
                  >
                    {link.label}
                    {link.badge && <span className="mm-link-badge">{link.badge}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Right section ──────────────────────────────────── */}
          <div className="mm-right">
            {user ? (
              <>
                {/* Daily goal ring — desktop only, when not done */}
                {!goalDone && (
                  <div ref={goalRef} className="mm-util-wrap">
                    <button type="button"
                      className="mm-util-btn mm-goal-btn mm-focus"
                      onClick={() => setGoalOpen(v => !v)}
                      aria-expanded={goalOpen}
                      aria-haspopup="menu"
                      aria-label={`Daily goal: ${goalCompleted} of ${goalTarget} done`}
                    >
                      <svg width={24} height={24} viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="12" cy="12" r="9.5" fill="none" stroke={C.border} strokeWidth="2.4"/>
                        <circle cx="12" cy="12" r="9.5" fill="none" stroke={C.blue500} strokeWidth="2.4"
                          strokeDasharray={2 * Math.PI * 9.5}
                          strokeDashoffset={2 * Math.PI * 9.5 * (1 - goalPct / 100)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.22,1,.36,1)' }}
                        />
                      </svg>
                    </button>
                    {goalOpen && (
                      <div className="mm-popover" role="menu">
                        <div className="mm-popover-inner">
                          <div className="mm-popover-head">
                            <div>
                              <div className="mm-popover-title">Today's goal</div>
                              <div className="mm-popover-sub">{goalCompleted} of {goalTarget} interviews</div>
                            </div>
                          </div>
                          <div className="mm-goal-body">
                            <svg width={54} height={54} viewBox="0 0 54 54"
                              className="mm-goal-ring-big" style={{ transform: 'rotate(-90deg)' }}>
                              <circle cx="27" cy="27" r="23" fill="none" stroke={C.border} strokeWidth="5"/>
                              <circle cx="27" cy="27" r="23" fill="none" stroke={C.blue500} strokeWidth="5"
                                strokeDasharray={2 * Math.PI * 23}
                                strokeDashoffset={2 * Math.PI * 23 * (1 - goalPct / 100)}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
                              />
                            </svg>
                            <div>
                              <div className="mm-goal-copy-title">{goalTarget - goalCompleted} more to go</div>
                              <div className="mm-goal-copy-sub">Practicing daily keeps your IRS climbing steadily.</div>
                            </div>
                          </div>
                          <button type="button" className="mm-goal-cta mm-focus"
                            onClick={() => { setGoalOpen(false); navigate('/interview'); }}>
                            <NavIcon name="mic" size={13}/> Start now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats chip — desktop */}
                <div className="mm-statschip desktop-only" aria-label="Your stats">
                  <div className="mm-schip-seg">
                    <span style={{ fontSize: 13 }}>🔥</span>
                    <div>
                      <div className="mm-schip-label">Streak</div>
                      <div className="mm-schip-val" style={{ color: C.orange }}>{streak}d</div>
                    </div>
                  </div>
                  <div className="mm-schip-sep"/>
                  <div className="mm-schip-seg">
                    <div>
                      <div className="mm-schip-label">IRS</div>
                      <div className="mm-schip-val" style={{ color: accent }}>{irs}</div>
                    </div>
                  </div>
                  {avgScore !== null && (
                    <>
                      <div className="mm-schip-sep"/>
                      <div className="mm-schip-seg">
                        <div>
                          <div className="mm-schip-label">Avg</div>
                          <div className="mm-schip-val" style={{ color: C.cyan500 }}>{avgScore}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Cmd+K — hidden trigger */}
                <div style={{ display: 'none' }}><CommandPalette /></div>

                <div className="mm-sep" aria-hidden="true"/>

               <button
  type="button"
  className="mm-cta desktop-only mm-focus"
  onClick={() => navigate('/interview')}
  aria-label="Start a new interview"
>
  <span className="mm-cta-icon">
    <NavIcon name="mic" size={14} />
  </span>

  <span className="mm-cta-text">
    New Interview
  </span>
</button>

                {/* ── Profile avatar + dropdown ──────────────── */}
                <div ref={dropRef} className="mm-profile-wrap">
                  <button type="button"
                    className="mm-av-btn mm-focus"
                    onClick={() => setDropOpen(v => !v)}
                    aria-expanded={dropOpen}
                    aria-haspopup="menu"
                    aria-label={dropOpen ? 'Close profile menu' : 'Open profile menu'}
                  >
                    <div className="mm-av-initial">{initials}</div>
                  </button>

                  {dropOpen && (
                    <div className="mm-drop" role="menu" aria-label="Profile and navigation">
                      <div className="mm-drop-head">
                        <div className="mm-drop-toprow">
                          <div className="mm-drop-avatar">{initials}</div>
                          <div className="mm-drop-user-info">
                            <div className="mm-drop-name">{user.name?.split(' ')[0]}</div>
                            <div className="mm-drop-sub">{user.college ?? 'MockMate User'}</div>
                          </div>
                          <button type="button"
                            className="mm-drop-close mm-focus"
                            onClick={() => setDropOpen(false)}
                            aria-label="Close profile menu"
                          >
                            <NavIcon name="close" size={13}/>
                          </button>
                        </div>
                        <div className="mm-drop-tier">
                          <span className="mm-drop-tier-icon"><NavIcon name="spark" size={9}/></span>
                          Tracking toward <b>{tierLabel}</b>
                        </div>
                        <div className="mm-drop-stats-row">
                          {[
                            { val: `${streak}d`, color: C.orange,  icon: '🔥', label: 'Streak'   },
                            { val: irs,           color: accent,    icon: null,  label: 'IRS'      },
                            { val: avgScore ?? '—', color: C.cyan500, icon: null, label: 'Avg'    },
                          ].map(({ val, color, icon, label }) => (
                            <div className="mm-drop-stat" key={label}>
                              <div className="mm-drop-stat-val" style={{ color }}>
                                {icon && <span style={{ marginRight: 2 }}>{icon}</span>}{val}
                              </div>
                              <div className="mm-drop-stat-label">{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mm-drop-scroll">
                        <div className="mm-drop-section-label">Navigate</div>
                        <div className="mm-drop-menu">
                          {DROPDOWN_ITEMS.map((item, i) => (
                            <Link key={item.path} to={item.path}
                              className={`mm-drop-item mm-focus${isActive(item.path) ? ' active-page' : ''}`}
                              role="menuitem"
                              style={{ animationDelay: `${i * 24}ms` }}
                              onClick={() => setDropOpen(false)}
                            >
                              <span className="mm-drop-icon"><NavIcon name={item.icon} size={14}/></span>
                              {item.label}
                              {item.badge && (
                                <span style={{
                                  fontSize: 7, fontFamily: F.mono, fontWeight: 700,
                                  color: C.cyan500, background: 'rgba(0,200,240,.09)',
                                  border: '1px solid rgba(0,173,224,.22)',
                                  borderRadius: 4, padding: '2px 5px', letterSpacing: '.3px', marginLeft: 2,
                                }}>{item.badge}</span>
                              )}
                              <span className="mm-drop-item-arrow"><NavIcon name="arrowRight" size={12}/></span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      <div className="mm-drop-footer">
                        <button type="button"
                          className="mm-drop-signout mm-focus"
                          role="menuitem"
                          onClick={() => { setDropOpen(false); logout(); }}
                        >
                          <span className="mm-drop-signout-icon"><NavIcon name="logout" size={14}/></span>
                          <span className="mm-drop-signout-label">Sign out of MockMate</span>
                          <span className="mm-drop-signout-arrow"><NavIcon name="arrowRight" size={12}/></span>
                        </button>
                        <div className="mm-drop-cmd-hint">
                          Press <kbd>⌘</kbd><kbd>K</kbd> to jump anywhere
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mm-mobile-controls">
  <button
    type="button"
    className="mm-mobile-interview-pill mm-focus"
    onClick={() => navigate('/interview')}
    aria-label="Start new interview"
  >
    <span className="mm-pill-icon-box">
      <NavIcon name="mic" size={15} />
    </span>
    <span className="mm-pill-label">Interview</span>
  </button>

  <button
    type="button"
    className={`mm-ham mm-focus${mobileOpen ? ' open' : ''}`}
    onClick={() => setMobileOpen(v => !v)}
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
                <span className="mm-google-wrap"><GoogleG size={16}/></span>
                <span className="mm-login-text">
                  <span className="mm-login-text-full">Sign in with Google</span>
                  <span className="mm-login-text-short">Google</span>
                </span>
              </a>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════
              MOBILE PANEL
              ══════════════════════════════════════════════════════ */}
          {mobileOpen && user && (
            <div className="mm-mobile-panel" role="dialog" aria-label="Navigation menu">

              {/* ── Header: user identity ──────────────────────── */}
              <div className="mm-panel-head">
                <div className="mm-panel-user">
                  <div className="mm-panel-avatar">{initials}</div>
                  <div className="mm-panel-identity">
                    <div className="mm-panel-name">{user.name ?? 'MockMate User'}</div>
                    <div className="mm-panel-college">{user.college ?? 'Ready to practice'}</div>
                  </div>
                  <span className="mm-panel-tier-badge">{tierLabel}</span>
                </div>
              </div>

              {/* ── Scrollable body ────────────────────────────── */}
              <div className="mm-panel-scroll">

                {/* Stats row */}
                <div className="mm-panel-stats">
                  <div className="mm-panel-stat">
                    <div className="mm-panel-stat-val" style={{ color: C.orange }}>🔥 {streak}</div>
                    <div className="mm-panel-stat-label">Streak</div>
                  </div>
                  <div className="mm-panel-stat">
                    <div className="mm-panel-stat-val" style={{ color: accent }}>{irs}</div>
                    <div className="mm-panel-stat-label">IRS</div>
                  </div>
                  <div className="mm-panel-stat">
                    <div className="mm-panel-stat-val" style={{ color: C.cyan500 }}>{avgScore ?? '—'}</div>
                    <div className="mm-panel-stat-label">Avg score</div>
                  </div>
                </div>

                {/* Goal progress (compact bar) — when not done */}
                {!goalDone && (
                  <div className="mm-panel-goal">
                    <svg width={30} height={30} viewBox="0 0 34 34"
                      className="mm-panel-goal-ring"
                      style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                      <circle cx="17" cy="17" r="14" fill="none" stroke={C.border} strokeWidth="3.5"/>
                      <circle cx="17" cy="17" r="14" fill="none" stroke={C.blue500} strokeWidth="3.5"
                        strokeDasharray={2 * Math.PI * 14}
                        strokeDashoffset={2 * Math.PI * 14 * (1 - goalPct / 100)}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.22,1,.36,1)' }}
                      />
                    </svg>
                    <div className="mm-panel-goal-info">
                      <div className="mm-panel-goal-title">Today's goal</div>
                      <div className="mm-panel-goal-sub">{goalCompleted} of {goalTarget} interviews done</div>
                      <div className="mm-panel-goal-bar-track">
                        <div className="mm-panel-goal-bar-fill" style={{ width: `${goalPct}%` }}/>
                      </div>
                    </div>
                  </div>
                )}

                {/* Nav section label */}
                <div className="mm-panel-section-label">Navigate</div>

                {/* 2-column tile grid — all 5 pages */}
                <div className="mm-panel-grid">
                  {NAV_LINKS.map(link => (
                    <Link key={link.path} to={link.path}
                      className={`mm-panel-tile mm-focus${isActive(link.path) ? ' mm-tile-active' : ''}`}
                      aria-current={isActive(link.path) ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.badge && (
                        <span className="mm-panel-tile-badge">{link.badge}</span>
                      )}
                      <span className="mm-panel-tile-icon">
                        <NavIcon name={link.icon} size={18}/>
                      </span>
                      <span className="mm-panel-tile-label">{link.label}</span>
                    </Link>
                  ))}
                </div>

              </div>

              {/* ── Footer: sign out ───────────────────────────── */}
              <div className="mm-panel-footer">
                <button type="button"
                  className="mm-panel-signout mm-focus"
                  onClick={() => { setMobileOpen(false); logout(); }}
                >
                  <span className="mm-panel-signout-icon">
                    <NavIcon name="logout" size={16}/>
                  </span>
                  <span className="mm-panel-signout-text">
                    <div>Sign out of MockMate</div>
                    <div className="mm-panel-signout-sub">You'll be taken back to the home screen</div>
                  </span>
                  <span className="mm-panel-signout-arrow">
                    <NavIcon name="arrowRight" size={14}/>
                  </span>
                </button>
                <div className="mm-panel-cmd-hint">
                  Press <kbd>⌘</kbd><kbd>K</kbd> to jump anywhere
                </div>
              </div>

            </div>
          )}

        </div>
      </nav>
    </>
  );
};

export default Navbar;
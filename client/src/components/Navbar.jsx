import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';
import CommandPalette from './CommandPalette';

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
  { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  { label: 'History',   path: '/history',   icon: 'clock' },
  { label: 'Coach',     path: '/coach',     icon: 'chat',   badge: 'AI' },
  { label: 'Leaderboard', path: '/leaderboard', icon: 'trophy' },
  { label: 'Analytics', path: '/analytics', icon: 'chart' },
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
    grid:       <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    clock:      <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
    trophy:     <><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.5v1.5A3.5 3.5 0 0 0 9 11"/><path d="M16 6h2.5v1.5A3.5 3.5 0 0 1 15 11"/><path d="M12 12.5V17"/><path d="M9 20h6"/><path d="M9.5 17h5"/></>,
    chart:      <><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></>,
    chat:       <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"/><circle cx="9" cy="9.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="12.5" cy="9.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="16" cy="9.5" r="1.05" fill="currentColor" stroke="none"/></>,
    mic:        <><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/></>,
    bell:       <><path d="M6 8.5a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z"/><path d="M9.5 18.5a2.5 2.5 0 0 0 5 0"/></>,
    logout:     <><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10"/><path d="M14 8l4 4-4 4M18 12H9"/></>,
    flame:      <><path d="M13.2 2.8c.4 3-1.1 4.7-2.7 6.2-1.9 1.8-3.6 3.4-3.6 6.2A5.2 5.2 0 0 0 12 20.4a5.3 5.3 0 0 0 5.2-5.3c0-2.7-1.5-4.7-3.2-6.5-.8-.9-1-2.5-.8-5.8Z"/><path d="M11.9 11.4c-.8 1-1.6 2-1.6 3.5a1.8 1.8 0 0 0 3.6 0c0-1.3-.8-2.4-2-3.5Z"/></>,
    trend:      <><path d="M4 16.5 9 11l3.5 3.5L20 7"/><path d="M15.5 7H20v4.5"/></>,
    user:       <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>,
    arrowRight: <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>,
    chevDown:   <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>,
    spark:      <><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z"/><path d="m19 14 .6 2 1.9.9-1.9.9-.6 2-.6-2-1.9-.9 1.9-.9.6-2Z"/></>,
    command:    <><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9Z"/><path d="M15 9h2.5A2.5 2.5 0 1 0 15 6.5V9Z"/><path d="M15 15v2.5a2.5 2.5 0 1 0 2.5-2.5H15Z"/><path d="M9 15H6.5A2.5 2.5 0 1 0 9 17.5V15Z"/></>,
    search:     <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    settings:   <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
    close:      <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    arrowReturn:<path d="M9 10 4 15l5 5M4 15h11a4 4 0 0 0 4-4V5" strokeLinecap="round" strokeLinejoin="round"/>,
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

// ─── Logomark ─────────────────────────────────────────────────────────────

const Logomark = ({ size = 36, uid = 'default' }) => {
  const barId    = `lm-bar-${uid}`;
  const pinId    = `lm-pin-${uid}`;
  const clipId   = `lm-clip-${uid}`;
  const shadowId = `lm-pinshadow-${uid}`;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 40 40">
        <defs>
          <linearGradient id={barId} x1="15%" y1="0%" x2="75%" y2="100%">
            <stop offset="0%"   stopColor="#F2FAFE"/>
            <stop offset="30%"  stopColor="#8FCBEC"/>
            <stop offset="100%" stopColor="#0198F4"/>
          </linearGradient>
          <linearGradient id={pinId} x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%"   stopColor="#C3DAF5"/>
            <stop offset="45%"  stopColor="#4099EA"/>
            <stop offset="100%" stopColor="#0059F9"/>
          </linearGradient>
          <filter id={shadowId} x="-60%" y="-20%" width="220%" height="180%">
            <feGaussianBlur stdDeviation="0.9"/>
          </filter>
          <clipPath id={clipId}>
            <rect x="1.2" y="1.2" width="37.6" height="37.6" rx="6.5"/>
          </clipPath>
        </defs>

        <rect x="1.2" y="1.2" width="37.6" height="37.6" rx="6.5"
          fill="#F5F9FE" stroke="#1D6FD1" strokeOpacity="0.45" strokeWidth="0.6"/>

        <g clipPath={`url(#${clipId})`}>
          <rect x="6" y="6" width="28" height="28" rx="4" fill="none"
            stroke="#1D6FD1" strokeOpacity="0.42" strokeWidth="0.45" strokeDasharray="0.45 1"/>
          <circle cx="20" cy="20" r="14.5" fill="none"
            stroke="#1D6FD1" strokeOpacity="0.38" strokeWidth="0.4" strokeDasharray="0.4 0.95"/>
          <circle cx="20" cy="20" r="9" fill="none"
            stroke="#1D6FD1" strokeOpacity="0.28" strokeWidth="0.35" strokeDasharray="0.35 0.9"/>
          <line x1="20" y1="1.2" x2="20" y2="38.8"
            stroke="#1D6FD1" strokeOpacity="0.32" strokeWidth="0.4" strokeDasharray="0.4 0.95"/>
          <line x1="1.2" y1="20" x2="38.8" y2="20"
            stroke="#1D6FD1" strokeOpacity="0.32" strokeWidth="0.4" strokeDasharray="0.4 0.95"/>
        </g>

        <ellipse cx="24.2" cy="27.2" rx="3.7" ry="5.8"
          fill="#0059F9" opacity="0.4" filter={`url(#${shadowId})`}/>

        <path
          d="M11.7 13.8 L22.4 11.7 C23.3 11.55 24 12.2 23.7 13.1 L21.5 17.15 L23.05 18.1
             C23.7 18.5 23.85 19.3 23.4 19.9 L16 30.5 C15.2 31.6 13.6 31 13.45 29.7
             L10.75 15.4 C10.6 14.6 10.9 13.9 11.7 13.8 Z"
          fill={`url(#${barId})`}/>
        <path
          d="M12.3 14.35 L21.85 12.35 C22.3 12.28 22.6 12.6 22.45 13 L20.4 16.3"
          fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round"/>

        <path
          d="M24.6 14.15 C27.7 14.15 30 16.35 30 19 C30 21.5 26.7 24.4 24.75 27.65
             C22.8 24.4 19.5 21.5 19.5 19 C19.5 16.35 21.5 14.15 24.6 14.15 Z"
          fill={`url(#${pinId})`}/>
        <ellipse cx="22.6" cy="17.05" rx="2" ry="1.4" fill="#FFFFFF" opacity="0.5"
          transform="rotate(-25 22.6 17.05)"/>
      </svg>
    </div>
  );
};

// ─── Score Ring ────────────────────────────────────────────────────────────

const ScoreRing = ({ value = 0, size = 20, strokeW = 2, id = 'sr' }) => {
  const r     = (size - strokeW * 2) / 2;
  const circ  = 2 * Math.PI * r;
  const pct   = Math.max(0, Math.min(100, Number(value) || 0));
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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={strokeW}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#sg-${id})`}
        strokeWidth={strokeW} strokeDasharray={circ}
        strokeDashoffset={pct > 0 ? offset : circ} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}/>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const NAVBAR_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { padding-top: 75px; }

  @keyframes mmDropIn    { from { opacity:0; transform:translateY(-8px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes mmSlideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes mmSheen     { 0% { transform:translateX(-120%) skewX(-14deg); } 100% { transform:translateX(260%) skewX(-14deg); } }
  @keyframes mmMeshDrift { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-3%,3%) rotate(6deg); } }
  @keyframes mmItemRise  { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
  @keyframes mmPulseRing { 0% { box-shadow: 0 0 0 0 rgba(26,110,255,.35); } 70% { box-shadow: 0 0 0 6px rgba(26,110,255,0); } 100% { box-shadow: 0 0 0 0 rgba(26,110,255,0); } }
  @keyframes mmLogoBreathe { 0%,100% { filter: drop-shadow(0 0 0px rgba(26,110,255,0)); } 50% { filter: drop-shadow(0 0 5px rgba(26,110,255,.4)); } }
  @keyframes mmOverlayIn { from { opacity:0; } to { opacity:1; } }

  .mm-root {
    position: fixed; top: 0; left: 0; right: 0;
    z-index: 1000;
    padding: max(10px, env(safe-area-inset-top)) 20px 10px;
    pointer-events: none;
  }

  .mm-backdrop {
    position: fixed; inset: 0;
    z-index: 999;
    background: rgba(10, 22, 40, 0.35);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    animation: mmOverlayIn .2s ease;
    pointer-events: auto;
    cursor: pointer;
  }

  .mm-capsule {
    position: relative;
    width: min(1440px, 100%);
    margin: 0 auto;
    padding: 6px 6px 6px 8px;
    display: flex;
    align-items: center;
    min-height: 64px;
    border-radius: 20px;
    border: 1px solid rgba(205,218,246,0.85);
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(36px) saturate(200%);
    -webkit-backdrop-filter: blur(36px) saturate(200%);
    box-shadow:
      0 1px 0 rgba(255,255,255,.95) inset,
      0 2px 10px rgba(0,31,107,.05),
      0 8px 28px rgba(0,31,107,.05);
    transition: box-shadow .4s cubic-bezier(.22,1,.36,1), background .4s ease, border-color .4s ease;
    pointer-events: auto;
  }

  .mm-capsule.scrolled {
    background: rgba(255,255,255,0.97);
    border-color: rgba(190,206,240,0.95);
    box-shadow:
      0 1px 0 rgba(255,255,255,1) inset,
      0 4px 16px rgba(0,31,107,.08),
      0 16px 48px rgba(0,31,107,.12);
    min-height: 60px;
  }

  .mm-capsule.scrolled .mm-brand  { padding-top: 3px; padding-bottom: 3px; }
  .mm-capsule.scrolled .mm-link   { height: 36px; }
  .mm-capsule.scrolled .mm-pill   { height: 36px; }
  .mm-capsule.scrolled .mm-cta    { height: 40px; }
  .mm-capsule.scrolled .mm-util-btn,
  .mm-capsule.scrolled .mm-statschip,
  .mm-capsule.scrolled .mm-av-btn { height: 39px; }

  .mm-capsule::before {
    content: '';
    position: absolute; left: 6%; right: 6%; top: 0;
    height: 1px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(26,110,255,.4), rgba(0,200,240,.32), rgba(26,110,255,.4), transparent);
    opacity: .65; pointer-events: none;
  }

  .mm-brand {
    display: flex; align-items: center; gap: 11px;
    text-decoration: none;
    padding: 5px 14px 5px 6px;
    border-radius: 15px; flex-shrink: 0;
    transition: background .18s ease, transform .18s cubic-bezier(.22,1,.36,1);
  }
  .mm-brand:hover { background: rgba(235,242,255,.7); }
  .mm-brand:hover .mm-brand-ring { box-shadow: 0 0 0 5px rgba(26,110,255,.10); }
  .mm-brand:active { transform: scale(.98); }

  .mm-brand-ring {
    border-radius: 12px;
    box-shadow: 0 0 0 0 rgba(26,110,255,0);
    transition: box-shadow .22s cubic-bezier(.22,1,.36,1);
    display: flex; flex-shrink: 0;
    animation: mmLogoBreathe 4.5s ease-in-out infinite;
  }

  .mm-brand-word  { display: flex; flex-direction: column; gap: 3px; }
  .mm-brand-title {
    font-family: ${F.display};
    font-size: 21px; font-weight: 800;
    letter-spacing: -.035em; line-height: 1;
    white-space: nowrap; color: ${C.text};
  }
  .mm-brand-tag {
    display: inline-flex; align-items: center;
    font: 500 10.5px ${F.body};
    letter-spacing: 0.1px; color: ${C.muted};
    white-space: nowrap; width: fit-content;
  }

  .mm-nav {
    flex: 1; display: flex; align-items: center; justify-content: center;
    min-width: 0; padding: 0 14px; gap: 8px;
  }

  .mm-nav-track {
    position: relative; display: flex; align-items: center;
    gap: 2px; padding: 4px; border-radius: 14px;
    background: rgba(244,248,255,.75);
    border: 1px solid rgba(210,222,248,.55);
    box-shadow: inset 0 1px 2px rgba(0,31,107,.03);
    overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
  }
  .mm-nav-track::-webkit-scrollbar { display: none; }

  .mm-pill {
    position: absolute; top: 50%; height: 38px;
    border-radius: 10px; transform: translateY(-50%);
    background: linear-gradient(160deg, rgba(110,168,255,.22) 0%, rgba(26,110,255,.13) 45%, rgba(0,68,196,.10) 100%);
    border: 1px solid rgba(26,110,255,.30);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.6),
      inset 0 -1px 0 rgba(26,110,255,.12),
      0 3px 16px rgba(26,110,255,.20),
      0 0 0 1px rgba(26,110,255,.06);
    pointer-events: none; overflow: hidden;
    transition: left .42s cubic-bezier(.22,1,.36,1), width .42s cubic-bezier(.22,1,.36,1), opacity .2s ease;
  }
  .mm-pill::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 55%);
    border-radius: inherit; pointer-events: none;
  }
  .mm-pill::after {
    content: '';
    position: absolute; left: 20%; right: 20%; bottom: 0;
    height: 1.5px; border-radius: 999px;
    background: ${C.blue400};
    box-shadow: 0 0 8px rgba(26,110,255,.55);
  }

  .mm-link {
    position: relative; z-index: 2;
    display: inline-flex; align-items: center; justify-content: center;
    gap: 6px; height: 38px;
    flex: 1 1 auto; min-width: 80px; padding: 0 14px;
    border: none; border-radius: 10px; background: transparent;
    color: ${C.muted}; text-decoration: none;
    font: 500 13px ${F.body}; letter-spacing: -.008em;
    white-space: nowrap; cursor: pointer;
    transition: color .18s ease, background .18s ease, transform .18s cubic-bezier(.22,1,.36,1);
  }
  .mm-link:hover:not(.active) { color: ${C.sub}; background: rgba(255,255,255,.55); transform: translateY(-0.5px); }
  .mm-link:active  { transform: translateY(0) scale(.98); }
  .mm-link.active  { color: ${C.blue600}; font-weight: 700; }

  .mm-link-badge {
    padding: 1.5px 5px;
    border: 1px solid rgba(0,173,224,.22); border-radius: 4px;
    color: ${C.cyan500}; background: rgba(0,200,240,.07);
    font: 700 7px ${F.mono}; letter-spacing: .3px;
  }
  .mm-link.active .mm-link-badge {
    color: ${C.blue600}; border-color: rgba(26,110,255,.3); background: rgba(26,110,255,.08);
  }

  .mm-right {
    display: flex; align-items: center; gap: 7px;
    flex-shrink: 0; margin-left: auto; padding-left: 8px;
    justify-content: flex-end;
  }
  .mm-right .mm-cta            { margin-left: 3px; }
  .mm-right .mm-profile-wrap   { margin-left: 2px; }

  .mm-sep {
    width: 1px; height: 22px;
    background: rgba(210,222,248,.8);
    border-radius: 999px; flex-shrink: 0;
    margin: 0 2px;
  }

    .mm-cta {
    position: relative; overflow: hidden;
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    height: 42px; padding: 0 16px 0 6px;
    border: 1px solid rgba(0,66,184,.55); border-radius: 13px;
    color: #fff;
    background: linear-gradient(135deg, ${C.blue600} 0%, ${C.cyan400} 100%);
    font: 700 13px ${F.body}; letter-spacing: -.012em;
    white-space: nowrap; cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.32),
      0 4px 10px rgba(0,87,232,.18),
      0 8px 22px rgba(0,87,232,.18);
    transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, filter .2s ease;
    flex-shrink: 0;
  }
  .mm-cta::before {
    content: '';
    position: absolute; top: -20%; bottom: -20%; left: -40%;
    width: 26%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
    transform: skewX(-14deg); opacity: 0; pointer-events: none;
  }
   .mm-cta:hover {
    transform: translateY(-1.5px);
    filter: saturate(1.06) brightness(1.03);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.38),
      0 0 0 3px rgba(0,87,232,.10),
      0 10px 28px rgba(0,87,232,.28);
  }
  .mm-cta:hover::before { opacity: 1; animation: mmSheen .8s ease-out; }
    .mm-cta:active {
    transform: translateY(0) scale(.98); filter: brightness(.98);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.25),
      0 0 0 3px rgba(0,87,232,.10),
      0 3px 10px rgba(0,87,232,.2);
  }
    .mm-cta-icon {
    position: relative; z-index: 1;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 9px; color: #fff;
    background: linear-gradient(145deg, rgba(255,255,255,.42), rgba(255,255,255,.18));
    border: 1px solid rgba(255,255,255,.4);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 2px 8px rgba(0,31,107,.22);
    flex-shrink: 0;
    transition: transform .2s cubic-bezier(.22,1,.36,1), background .2s ease;
  }
  .mm-cta:hover .mm-cta-icon { transform: scale(1.06) rotate(-2deg); background: rgba(255,255,255,.3); }
  .mm-cta-text { position: relative; z-index: 1; }

  .mm-profile-wrap { position: relative; flex-shrink: 0; }
  .mm-av-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 41px; height: 41px;
    border: 1.5px solid rgba(26,110,255,.46); border-radius: 50%;
    background: linear-gradient(145deg, rgba(32,198,244,.92), rgba(0,89,249,.95));
    cursor: pointer;
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s cubic-bezier(.22,1,.36,1), filter .18s ease;
    overflow: hidden; padding: 2px; flex-shrink: 0;
  }
  .mm-av-btn:hover {
    border-color: rgba(0,89,249,.72); filter: brightness(1.03) saturate(1.05);
    box-shadow: 0 0 0 3px rgba(26,110,255,.09), 0 7px 18px rgba(26,110,255,.22);
    transform: translateY(-1.5px);
  }
  .mm-av-btn:active { transform: translateY(0) scale(.96); }
  .mm-av-btn[aria-expanded="true"] {
    border-color: rgba(0,89,249,.88);
    box-shadow: 0 0 0 3px rgba(26,110,255,.14), 0 7px 18px rgba(26,110,255,.18);
  }
  .mm-av-initial {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    background: linear-gradient(145deg, #F7FBFF, #E9F3FF);
    color: ${C.blue700}; font: 800 14px ${F.display};
    letter-spacing: -.01em;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.92);
  }

  /* ══════════════════════════════════════════════════════════════
     Dropdown — now scroll-safe: fixed max-height relative to
     viewport with its own scroll container, so the header/stats/
     menu never gets clipped off-screen on shorter laptop displays.
     ══════════════════════════════════════════════════════════════ */
  .mm-drop {
    position: absolute; top: calc(100% + 10px); right: 0;
    width: 296px; padding: 0;
    border: 1px solid rgba(210,222,248,.9); border-radius: 20px;
    background: rgba(255,255,255,.98);
    backdrop-filter: blur(30px) saturate(190%);
    -webkit-backdrop-filter: blur(30px) saturate(190%);
    box-shadow: 0 28px 64px rgba(0,31,107,.18), 0 6px 18px rgba(0,31,107,.08), inset 0 1px 0 rgba(255,255,255,.95);
    animation: mmDropIn .22s cubic-bezier(.22,1,.36,1);
    z-index: 100; overflow: hidden;
    /* never let the popover exceed the viewport */
    max-height: min(560px, calc(100vh - 96px));
  }
  .mm-drop-scroll {
    max-height: min(560px, calc(100vh - 96px));
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .mm-drop-mesh {
    position: relative; padding: 18px 16px 14px;
    overflow: hidden; border-bottom: 1px solid ${C.border};
  }
  .mm-drop-mesh::before {
    content: '';
    position: absolute; inset: -40%;
    background:
      radial-gradient(circle at 18% 22%, rgba(26,110,255,.16), transparent 45%),
      radial-gradient(circle at 82% 15%, rgba(0,200,240,.14), transparent 42%),
      radial-gradient(circle at 60% 85%, rgba(108,92,232,.10), transparent 48%);
    animation: mmMeshDrift 14s ease-in-out infinite;
    pointer-events: none;
  }
  .mm-drop-mesh-inner { position: relative; z-index: 1; }

  .mm-drop-toprow { display: flex; align-items: center; gap: 11px; }
  .mm-drop-avatar-wrap { position: relative; flex-shrink: 0; }
  .mm-drop-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(145deg, ${C.blue500}, ${C.blue800});
    display: flex; align-items: center; justify-content: center;
    color: #fff; font: 700 17px ${F.display};
    box-shadow: 0 4px 14px rgba(26,110,255,.3), inset 0 1px 0 rgba(255,255,255,.25);
  }
  .mm-drop-name { font: 700 15px ${F.display}; color: ${C.text}; letter-spacing: -.01em; }
  .mm-drop-sub  { font: 500 11.5px ${F.body}; color: ${C.muted}; margin-top: 2px; }

  .mm-drop-close {
    width: 28px; height: 28px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid ${C.border}; background: rgba(248,250,255,.85);
    color: ${C.muted}; cursor: pointer; flex-shrink: 0;
    transition: background .14s ease, color .14s ease, border-color .14s ease;
    margin-left: auto;
  }
  .mm-drop-close:hover { background: ${C.redTint}; color: ${C.red}; border-color: rgba(220,38,38,.2); }

  .mm-drop-tier {
    display: inline-flex; align-items: center; gap: 5px;
    margin-top: 12px; padding: 4px 10px 4px 8px;
    border-radius: 999px;
    background: linear-gradient(100deg, rgba(108,92,232,.10), rgba(26,110,255,.10));
    border: 1px solid rgba(108,92,232,.22);
    color: ${C.violet700}; font: 700 9.5px ${F.body}; letter-spacing: .1px;
  }
  .mm-drop-tier-icon {
    width: 14px; height: 14px; display: grid; place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, ${C.violet500}, ${C.blue500});
    color: #fff; flex-shrink: 0;
  }
  .mm-drop-tier b { color: ${C.blue700}; font-weight: 800; }

  .mm-drop-stats {
    display: grid; grid-template-columns: repeat(3,1fr);
    gap: 6px; margin-top: 12px;
  }
  .mm-drop-stat {
    padding: 9px 4px 8px; text-align: center;
    border: 1px solid ${C.border}; border-radius: 12px;
    background: rgba(255,255,255,.85);
    transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
  }
  .mm-drop-stat:hover { border-color: rgba(26,110,255,.3); transform: translateY(-1.5px); box-shadow: 0 6px 16px rgba(26,110,255,.12); }
  .mm-drop-stat-val   { font: 800 16px ${F.display}; letter-spacing: -.03em; }
  .mm-drop-stat-label { font: 600 8px ${F.body}; letter-spacing: .2px; color: ${C.muted}; margin-top: 3px; text-transform: uppercase; }

  .mm-drop-menu { padding: 6px; }
  .mm-drop-item {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border: none; border-radius: 12px;
    background: transparent; color: ${C.sub};
    font: 500 12.5px ${F.body}; text-align: left; cursor: pointer;
    transition: background .14s ease, color .14s ease, transform .14s ease;
    animation: mmItemRise .28s cubic-bezier(.22,1,.36,1) backwards;
  }
  .mm-drop-item:hover  { color: ${C.blue700}; background: ${C.blue50}; transform: translateX(2px); }
  .mm-drop-item:active { transform: translateX(2px) scale(.99); }
  .mm-drop-item.danger { color: ${C.red}; }
  .mm-drop-item.danger:hover { background: ${C.redTint}; }

  .mm-drop-item-arrow {
    margin-left: auto; opacity: 0;
    transform: translateX(-3px);
    transition: all .16s ease; color: ${C.faint};
  }
  .mm-drop-item:hover .mm-drop-item-arrow { opacity: 1; transform: translateX(0); }

  .mm-drop-icon {
    width: 30px; height: 30px; display: grid; place-items: center;
    border: 1px solid ${C.border}; border-radius: 9px;
    background: rgba(248,250,255,.9); flex-shrink: 0;
    transition: background .14s ease, border-color .14s ease, color .14s ease;
  }
  .mm-drop-item:hover        .mm-drop-icon { background: ${C.blue50}; border-color: rgba(26,110,255,.28); color: ${C.blue600}; }
  .mm-drop-item.danger:hover .mm-drop-icon { background: #fecaca; border-color: #fca5a5; }

  .mm-drop-divider { height: 1px; background: ${C.border}; margin: 4px 8px; }

  .mm-login {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    height: 40px; padding: 0 15px 0 8px;
    border: 1px solid rgba(26,110,255,.22); border-radius: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(246,250,255,.96));
    color: #111827 !important; text-decoration: none;
    font: 650 13px ${F.body};
    box-shadow: 0 2px 8px rgba(0,31,107,.05), 0 5px 14px rgba(26,110,255,.06), inset 0 1px 0 rgba(255,255,255,.96);
    transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, border-color .2s ease, background .2s ease;
    white-space: nowrap;
  }
  .mm-login:hover {
    color: #111827 !important; transform: translateY(-1.5px);
    border-color: rgba(26,110,255,.42);
    background: linear-gradient(180deg, #fff, #f3f8ff);
    box-shadow: 0 0 0 3px rgba(26,110,255,.07), 0 10px 26px rgba(26,110,255,.16), inset 0 1px 0 rgba(255,255,255,.98);
  }
  .mm-login:active { transform: translateY(0) scale(.98); }
  .mm-google-wrap {
    width: 26px; height: 26px; display: grid; place-items: center;
    border-radius: 7px; background: ${C.blue50};
    border: 1px solid rgba(26,110,255,.10);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
    flex-shrink: 0;
  }

  .mm-util-wrap { position: relative; flex-shrink: 0; }
  .mm-util-btn {
    position: relative;
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(195,214,245,.9); border-radius: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(247,251,255,.9));
    color: ${C.sub}; cursor: pointer;
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s cubic-bezier(.22,1,.36,1), color .18s ease;
  }
  .mm-util-btn:hover {
    color: ${C.blue600}; border-color: rgba(26,110,255,.38); background: #fff;
    box-shadow: 0 4px 14px rgba(26,110,255,.14); transform: translateY(-1.5px);
  }
  .mm-util-btn:active { transform: translateY(0) scale(.94); }
  .mm-util-btn[aria-expanded="true"] {
    border-color: rgba(26,110,255,.5); color: ${C.blue600};
    box-shadow: 0 0 0 3px rgba(26,110,255,.12);
  }

  .mm-bell-dot {
    position: absolute; top: 7px; right: 7px;
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.red}; border: 2px solid #fff;
    animation: mmPulseRing 2.2s ease-out infinite;
  }

  .mm-goal-btn { padding: 0; }
  .mm-goal-svg { transform: rotate(-90deg); }

  .mm-popover {
    position: absolute; top: calc(100% + 12px); right: 0;
    width: 300px;
    border: 1px solid rgba(210,222,248,.9); border-radius: 18px;
    background: rgba(255,255,255,.98);
    backdrop-filter: blur(28px) saturate(190%);
    -webkit-backdrop-filter: blur(28px) saturate(190%);
    box-shadow: 0 24px 58px rgba(0,31,107,.16), 0 6px 16px rgba(0,31,107,.07), inset 0 1px 0 rgba(255,255,255,.95);
    animation: mmDropIn .2s cubic-bezier(.22,1,.36,1);
    z-index: 100; overflow: visible;
    max-height: calc(100vh - 96px);
  }
  .mm-popover::before {
    content: '';
    position: absolute; top: -6px; right: 16px;
    width: 12px; height: 12px;
    background: rgba(255,255,255,.98);
    border-left: 1px solid rgba(210,222,248,.9);
    border-top: 1px solid rgba(210,222,248,.9);
    transform: rotate(45deg); border-radius: 3px 0 0 0;
  }
  .mm-popover-inner { position: relative; border-radius: 18px; overflow: hidden; background: inherit; max-height: calc(100vh - 96px); overflow-y: auto; }
  .mm-popover-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 14px 11px; border-bottom: 1px solid ${C.border};
  }
  .mm-popover-title { font: 700 13px ${F.display}; color: ${C.text}; letter-spacing: -.01em; }
  .mm-popover-sub   { font: 500 10.5px ${F.body}; color: ${C.muted}; margin-top: 1px; }
  .mm-popover-badge {
    font: 700 9px ${F.mono}; letter-spacing: .3px;
    padding: 3px 7px; border-radius: 999px;
    background: ${C.blue50}; color: ${C.blue700};
    border: 1px solid rgba(26,110,255,.18);
  }

  .mm-notif-list { padding: 6px; max-height: 300px; overflow-y: auto; }
  .mm-notif-item {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 10px 8px; border-radius: 13px;
    transition: background .14s ease;
  }
  .mm-notif-item:hover { background: rgba(244,248,255,.9); }
  .mm-notif-icon {
    width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px;
    display: grid; place-items: center;
    background: ${C.blue50}; color: ${C.blue600};
    border: 1px solid rgba(26,110,255,.16);
  }
  .mm-notif-icon.streak { background: #FFF4E8; color: ${C.orange}; border-color: rgba(234,88,12,.18); }
  .mm-notif-text { font: 500 13px ${F.body}; color: ${C.sub}; line-height: 1.4; }
  .mm-notif-time { font: 500 10px ${F.body}; color: ${C.faint}; margin-top: 3px; }
  .mm-notif-empty { padding: 30px 16px; text-align: center; color: ${C.muted}; font: 500 13px ${F.body}; }
  .mm-notif-empty-icon { font-size: 22px; margin-bottom: 6px; }

  .mm-goal-body { padding: 16px 14px; display: flex; align-items: center; gap: 14px; }
  .mm-goal-ring-big { flex-shrink: 0; }
  .mm-goal-copy-title { font: 700 14px ${F.display}; color: ${C.text}; }
  .mm-goal-copy-sub   { font: 500 11.5px ${F.body}; color: ${C.muted}; margin-top: 3px; line-height: 1.4; }
  .mm-goal-cta {
    display: inline-flex; align-items: center; gap: 6px;
    margin: 0 14px 14px; padding: 9px 12px;
    border-radius: 11px; border: 1px solid rgba(26,110,255,.24);
    background: ${C.blue50}; color: ${C.blue700};
    font: 650 12px ${F.body}; cursor: pointer; width: calc(100% - 28px);
    justify-content: center;
    transition: background .15s ease, border-color .15s ease, transform .15s ease, box-shadow .15s ease;
  }
  .mm-goal-cta:hover { background: #dfe9ff; border-color: rgba(26,110,255,.4); transform: translateY(-1.5px); box-shadow: 0 6px 16px rgba(26,110,255,.16); }
  .mm-goal-cta:active { transform: translateY(0) scale(.98); }

  .mm-statschip {
    display: flex; align-items: center; gap: 0;
    height: 40px; padding: 0 3px;
    border: 1px solid rgba(195,214,245,.9); border-radius: 13px;
    background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(247,251,255,.9));
    cursor: pointer;
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s cubic-bezier(.22,1,.36,1);
  }
  .mm-statschip:hover             { border-color: rgba(26,110,255,.35); background: #fff; box-shadow: 0 4px 14px rgba(26,110,255,.12); transform: translateY(-1.5px); }
  .mm-statschip:active            { transform: translateY(0) scale(.97); }
  .mm-statschip[aria-expanded="true"] { border-color: rgba(26,110,255,.5); box-shadow: 0 0 0 3px rgba(26,110,255,.12); }

  .mm-schip-seg   { display: flex; align-items: center; gap: 5px; padding: 0 10px; height: 100%; }
  .mm-schip-label { font: 600 10px ${F.mono}; letter-spacing: .4px; text-transform: uppercase; color: ${C.muted}; line-height: 1; }
  .mm-schip-val   { font: 700 14px ${F.display}; letter-spacing: -.04em; line-height: 1; }
  .mm-schip-sep   { width: 1px; height: 16px; background: ${C.border}; flex-shrink: 0; }

  .mm-stats-body      { padding: 14px; }
  .mm-stats-ring-row  { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid ${C.border}; }
  .mm-stats-delta     { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; font: 650 11px ${F.body}; }
  .mm-stats-grid      { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; margin-top: 12px; }
  .mm-stats-cell {
    padding: 10px; border: 1px solid ${C.border}; border-radius: 13px;
    background: rgba(248,250,255,.7);
    transition: border-color .15s ease, transform .15s ease;
  }
  .mm-stats-cell:hover      { border-color: rgba(26,110,255,.28); transform: translateY(-1px); }
  .mm-stats-cell-val        { font: 800 17px ${F.display}; letter-spacing: -.03em; }
  .mm-stats-cell-label      { font: 600 9px ${F.body}; letter-spacing: .2px; color: ${C.muted}; margin-top: 2px; text-transform: uppercase; }

  /* ── Mobile controls (hamburger) ── */
  .mm-mobile-controls { display: none; align-items: center; gap: 6px; flex-shrink: 0; }
  .mm-ham {
    width: 40px; height: 40px; border: 1px solid ${C.border};
    border-radius: 11px; background: rgba(255,255,255,.84);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4.5px;
    cursor: pointer;
    transition: border-color .18s ease, background .18s ease, transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease;
  }
  .mm-ham:hover  { background: #fff; border-color: rgba(26,110,255,.38); box-shadow: 0 4px 14px rgba(26,110,255,.12); transform: translateY(-1.5px); }
  .mm-ham:active { transform: translateY(0) scale(.94); }
  .mm-ham .bar   { width: 16px; height: 1.8px; border-radius: 3px; background: ${C.blue600}; transition: all .24s cubic-bezier(.22,1,.36,1); }
  .mm-ham.open .bar:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
  .mm-ham.open .bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
  .mm-ham.open .bar:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }

  /* ══════════════════════════════════════════════════════════════
     Mobile panel — redesigned
     ══════════════════════════════════════════════════════════════ */
  .mm-mobile-panel {
    position: absolute; left: 8px; right: 8px; top: calc(100% + 8px);
    padding: 12px; border: 1px solid ${C.border}; border-radius: 20px;
    background: rgba(255,255,255,.98); backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    box-shadow: 0 24px 60px rgba(0,31,107,.16);
    animation: mmSlideDown .22s cubic-bezier(.22,1,.36,1);
    max-height: calc(100vh - 110px); overflow-y: auto;
    overscroll-behavior: contain;
  }

  .mm-mobile-notif {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 11px; border-radius: 13px; margin-bottom: 8px;
    background: #FFF9F0; border: 1px solid rgba(234,88,12,.2);
  }
  .mm-mobile-notif-icon {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg,#FFB74D,#EA580C); color: #fff;
  }
  .mm-mobile-notif-text { font: 650 11.5px ${F.body}; color: ${C.text}; line-height: 1.35; }
  .mm-mobile-notif-more { font: 550 10px ${F.body}; color: ${C.muted}; margin-top: 2px; }

  .mm-mobile-user {
    display: flex; align-items: center; gap: 10px;
    padding: 11px; border: 1px solid ${C.border}; border-radius: 15px;
    background: linear-gradient(145deg, ${C.blue50}, rgba(255,255,255,.8));
    margin-bottom: 10px;
  }
  .mm-mobile-user-name { font: 700 13.5px ${F.display}; color: ${C.text}; }
  .mm-mobile-user-sub  { font: 500 10.5px ${F.body}; color: ${C.muted}; margin-top: 2px; }
  .mm-mobile-tier {
    font: 600 8.5px ${F.mono}; color: ${C.blue600};
    background: ${C.blue50}; border: 1px solid rgba(26,110,255,.2);
    border-radius: 999px; padding: 4px 9px; flex-shrink: 0; white-space: nowrap;
  }

  .mm-mobile-stats {
    display: grid; grid-template-columns: repeat(3,1fr);
    gap: 6px; margin-bottom: 10px;
  }
  .mm-mobile-stat {
    padding: 9px 5px; text-align: center;
    border: 1px solid ${C.border}; border-radius: 12px; background: #fff;
  }
  .mm-mobile-stat-val   { font: 700 15px ${F.display}; letter-spacing: -.04em; }
  .mm-mobile-stat-label { font: 600 7px ${F.mono}; letter-spacing: .4px; color: ${C.muted}; margin-top: 2px; text-transform: uppercase; }

  .mm-mobile-goal {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 11px; margin-bottom: 12px;
    border: 1px solid ${C.border}; border-radius: 13px;
    background: rgba(248,250,255,.7);
  }
  .mm-mobile-goal-title { font: 700 11.5px ${F.body}; color: ${C.text}; }
  .mm-mobile-goal-sub   { font: 500 10px ${F.body}; color: ${C.muted}; margin-top: 1px; }

  .mm-mobile-section-label {
    font: 700 10px ${F.mono}; letter-spacing: .5px; text-transform: uppercase;
    color: ${C.muted}; padding: 0 2px; margin-bottom: 7px;
  }

  /* Navigate section: 2-col tile grid, easier to scan/tap than a flat list */
  .mm-mobile-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 8px; margin-bottom: 16px;
  }
  .mm-mobile-tile {
    position: relative;
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
    padding: 12px 12px 11px;
    border: 1px solid ${C.border}; border-radius: 14px;
    background: #fff; text-decoration: none;
    transition: background .14s ease, border-color .14s ease, transform .14s ease, box-shadow .14s ease;
  }
  .mm-mobile-tile:active { transform: scale(.97); }
  .mm-mobile-tile:not(.active):hover { border-color: rgba(26,110,255,.3); background: ${C.blue50}; }
  .mm-mobile-tile.active {
    background: linear-gradient(145deg, ${C.blue500}, ${C.blue700});
    border-color: transparent;
    box-shadow: 0 8px 20px rgba(26,110,255,.28);
  }
  .mm-mobile-tile-icon {
    width: 32px; height: 32px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    color: ${C.blue600}; background: ${C.blue50}; flex-shrink: 0;
    transition: background .14s ease, color .14s ease;
  }
  .mm-mobile-tile.active .mm-mobile-tile-icon { color: #fff; background: rgba(255,255,255,.2); }
  .mm-mobile-tile-label { font: 650 12.5px ${F.body}; color: ${C.sub}; letter-spacing: -.006em; }
  .mm-mobile-tile.active .mm-mobile-tile-label { color: #fff; font-weight: 700; }
  .mm-mobile-tile-badge {
    position: absolute; top: 10px; right: 10px;
    font: 700 7px ${F.mono}; letter-spacing: .3px;
    padding: 2px 5px; border-radius: 4px;
    color: ${C.cyan500}; background: rgba(0,200,240,.09);
    border: 1px solid rgba(0,173,224,.22);
  }
  .mm-mobile-tile.active .mm-mobile-tile-badge {
    color: #fff; background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.35);
  }

  /* Account section: compact list, visually distinct from Navigate grid */
  .mm-mobile-list { display: flex; flex-direction: column; gap: 4px; }
  .mm-mobile-link {
    display: flex; align-items: center; gap: 11px;
    width: 100%; padding: 11px 10px;
    border: none; border-radius: 13px;
    background: transparent; color: ${C.sub};
    text-decoration: none; font: 500 13px ${F.body}; cursor: pointer;
    transition: background .14s ease, color .14s ease;
  }
  .mm-mobile-link:hover { background: ${C.blue50}; color: ${C.blue700}; }
  .mm-mobile-link.active { background: ${C.blue50}; color: ${C.blue700}; font-weight: 700; }
  .mm-mobile-link-icon {
    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
    border-radius: 9px; color: ${C.blue600}; background: ${C.blue50}; flex-shrink: 0;
  }
  .mm-mobile-logout { color: ${C.red}; }
  .mm-mobile-logout:hover { background: ${C.redTint}; color: ${C.red}; }

  .mm-focus { -webkit-tap-highlight-color: transparent; }
  .mm-focus:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255,255,255,.9), 0 0 0 4px rgba(26,110,255,.55);
  }
  .mm-brand:focus-visible { border-radius: 15px; }

  @media (min-width: 1441px) {
    .mm-capsule { width: min(1520px, calc(100% - 40px)); }
  }

  @media (max-width: 1160px) { .mm-brand-tag { display: none; } }
  @media (max-width: 1020px) {
    .mm-link { min-width: 52px; padding: 0 8px; font-size: 12px; }
  }
  @media (max-width: 900px) {
    .mm-schip-label { display: none; }
    .mm-statschip   { padding: 0 2px; }
    .mm-schip-seg   { padding: 0 7px; }
  }
  @media (max-width: 830px) {
    body { padding-top: 88px; }
    .mm-root { padding: max(8px, env(safe-area-inset-top)) 12px 8px; }
    .mm-nav               { display: none; }
    .mm-profile-wrap      { display: none; }
    .mm-cta.desktop-only  { display: none; }
    .mm-sep               { display: none; }
    .mm-mobile-controls   { display: flex; }
    .mm-right             { margin-left: auto; }
    .mm-popover           { width: min(300px, calc(100vw - 24px)); right: -8px; }
  }
  @media (min-width: 831px) {
    .mm-mobile-controls { display: none !important; }
    .mm-mobile-panel    { display: none !important; }
    .mm-backdrop        { display: none !important; }
  }
  @media (max-width: 560px) {
    .mm-root        { padding: max(8px, env(safe-area-inset-top)) 8px 8px; }
    .mm-brand-title { font-size: 16.5px; }
    .mm-statschip   { display: none; }
    .mm-mobile-stat-val { font-size: 14px; }
    .mm-mobile-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 380px) {
    .mm-mobile-grid { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// Navbar Component
// ═══════════════════════════════════════════════════════════════════════════

const Navbar = () => {
  const { user, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [scrolled,    setScrolled]    = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [dropOpen,    setDropOpen]    = useState(false);
  const [bellOpen,    setBellOpen]    = useState(false);
  const [goalOpen,    setGoalOpen]    = useState(false);
  const [statsOpen,   setStatsOpen]   = useState(false);

  const dropRef  = useRef(null);
  const bellRef  = useRef(null);
  const goalRef  = useRef(null);
  const statsRef = useRef(null);
  const shellRef = useRef(null);
  const linkRefs = useRef({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const irs       = user?.irs ?? user?.readinessScore ?? 0;
  const avgScore  = user?.averageScore ?? null;
  const streak    = user?.streak?.current ?? 0;
  const bestStreak = user?.streak?.best ?? streak;
  const accent    = scoreColor(irs);
  const initials  = user?.name?.[0]?.toUpperCase() || 'M';

  const tierLabel =
    user?.tierLabel ??
    (irs >= 80 ? '₹20 LPA+' : irs >= 60 ? '₹12–20 LPA' : irs >= 38 ? '₹6–12 LPA' : '₹3–6 LPA');

  const irsDelta = user?.irsDeltaWeek ?? null;

  const goalTarget    = user?.dailyGoal?.target    ?? 3;
  const goalCompleted = user?.dailyGoal?.completed ?? 0;
  const goalDone  = goalCompleted >= goalTarget;
  const goalPct   = Math.min(100, Math.round((goalCompleted / Math.max(1, goalTarget)) * 100));

  const notificationsLoaded = user !== null && user !== undefined;
  const notifications = useMemo(() => {
    if (!notificationsLoaded) return [];
    if (Array.isArray(user?.notifications)) return user.notifications;
    const list = [];
    if (streak > 0 && user?.streak?.atRisk) {
      list.push({ id: 'streak-risk', type: 'streak', text: `Your ${streak}-day streak ends today — squeeze in one interview.`, time: 'Today', read: false });
    }
    if (user?.lastInterview?.feedbackReady) {
      list.push({ id: 'feedback', type: 'feedback', text: 'Feedback is ready for your last interview.', time: 'Recently', read: false });
    }
    return list;
  }, [user, streak, notificationsLoaded]);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current  && !dropRef.current.contains(e.target))  setDropOpen(false);
      if (bellRef.current  && !bellRef.current.contains(e.target))  setBellOpen(false);
      if (goalRef.current  && !goalRef.current.contains(e.target))  setGoalOpen(false);
      if (statsRef.current && !statsRef.current.contains(e.target)) setStatsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropOpen(false);
    setBellOpen(false);
    setGoalOpen(false);
    setStatsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setMobileOpen(false);
      setDropOpen(false);
      setBellOpen(false);
      setGoalOpen(false);
      setStatsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
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
      const shellBox = shell.getBoundingClientRect();
      const linkBox  = active.getBoundingClientRect();
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

  const closeAll = () => {
    setDropOpen(false);
    setBellOpen(false);
    setGoalOpen(false);
    setStatsOpen(false);
  };

  // Trimmed desktop dropdown menu — Dashboard/Leaderboard/Analytics live in
  // the top nav already, so the account menu only holds what's NOT there.
  const DROPDOWN_ITEMS = [
    { icon: 'clock',    label: 'Interview history', path: '/history' },
    { icon: 'settings', label: 'Settings',           path: '/settings' },
  ];

  return (
    <>
      <style>{NAVBAR_CSS}</style>

      {mobileOpen && user && (
        <div className="mm-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true"/>
      )}

      <nav className="mm-root" aria-label="Main navigation">
        <div className={`mm-capsule${scrolled ? ' scrolled' : ''}`}>

          <Link to={user ? '/dashboard' : '/'} className="mm-brand mm-focus">
            <div className="mm-brand-ring">
              <Logomark size={40} uid="navbar"/>
            </div>
            <div className="mm-brand-word">
              <div className="mm-brand-title">MockMate</div>
              <div className="mm-brand-tag">Practice. Improve. Get hired.</div>
            </div>
          </Link>

          {user && (
            <div className="mm-nav">
              <div ref={shellRef} className="mm-nav-track" role="list">
                <div className="mm-pill"
                  style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
                />
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.path}
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

          <div className="mm-right">
            {user ? (
              <>
                {notificationsLoaded && unreadCount > 0 && (
                  <div ref={bellRef} className="mm-util-wrap">
                    <button type="button"
                      className="mm-util-btn mm-focus"
                      onClick={() => { setBellOpen(v => !v); setGoalOpen(false); setStatsOpen(false); }}
                      aria-expanded={bellOpen}
                      aria-haspopup="menu"
                      aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
                    >
                      <NavIcon name="bell" size={17}/>
                      <span className="mm-bell-dot"/>
                    </button>

                    {bellOpen && (
                      <div className="mm-popover" role="menu">
                        <div className="mm-popover-inner">
                          <div className="mm-popover-head">
                            <div>
                              <div className="mm-popover-title">Notifications</div>
                              <div className="mm-popover-sub">{unreadCount} new</div>
                            </div>
                            <span className="mm-popover-badge">{unreadCount}</span>
                          </div>
                          <div className="mm-notif-list">
                            {notifications.length === 0 ? (
                              <div className="mm-notif-empty">
                                <div className="mm-notif-empty-icon">✅</div>
                                You're all caught up
                              </div>
                            ) : notifications.map((n) => (
                              <div className="mm-notif-item" key={n.id}>
                                <span className={`mm-notif-icon${n.type === 'streak' ? ' streak' : ''}`}>
                                  <NavIcon name={n.type === 'streak' ? 'flame' : 'chat'} size={14}/>
                                </span>
                                <div>
                                  <div className="mm-notif-text">{n.text}</div>
                                  <div className="mm-notif-time">{n.time}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!goalDone && (
                  <div ref={goalRef} className="mm-util-wrap">
                    <button type="button"
                      className="mm-util-btn mm-goal-btn mm-focus"
                      onClick={() => { setGoalOpen(v => !v); setBellOpen(false); setStatsOpen(false); }}
                      aria-expanded={goalOpen}
                      aria-haspopup="menu"
                      aria-label={`Daily goal: ${goalCompleted} of ${goalTarget} interviews done`}
                    >
                      <svg width={24} height={24} viewBox="0 0 24 24" className="mm-goal-svg">
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
                            <NavIcon name="mic" size={13}/>
                            Start now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div ref={statsRef} className="mm-util-wrap">
                  <button type="button"
                    className="mm-statschip mm-focus"
                    onClick={() => { setStatsOpen(v => !v); setBellOpen(false); setGoalOpen(false); }}
                    aria-expanded={statsOpen}
                    aria-haspopup="menu"
                    aria-label="View progress details"
                  >
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
                  </button>

                  {statsOpen && (
                    <div className="mm-popover" role="menu">
                      <div className="mm-popover-inner">
                        <div className="mm-popover-head">
                          <div>
                            <div className="mm-popover-title">Your progress</div>
                            <div className="mm-popover-sub">Tracking toward {tierLabel}</div>
                          </div>
                        </div>
                        <div className="mm-stats-body">
                          <div className="mm-stats-ring-row">
                            <ScoreRing value={irs} size={46} strokeW={4} id="chip-irs"/>
                            <div>
                              <div className="mm-goal-copy-title" style={{ fontSize: 20, color: accent }}>
                                {irs}<span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}> IRS</span>
                              </div>
                              {irsDelta !== null && (
                                <div className="mm-stats-delta" style={{ color: irsDelta >= 0 ? C.green : C.red }}>
                                  <NavIcon name="trend" size={12}/>
                                  {irsDelta >= 0 ? '+' : ''}{irsDelta} this week
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mm-stats-grid">
                            <div className="mm-stats-cell">
                              <div className="mm-stats-cell-val" style={{ color: C.orange }}>{streak}d</div>
                              <div className="mm-stats-cell-label">Current streak</div>
                            </div>
                            <div className="mm-stats-cell">
                              <div className="mm-stats-cell-val" style={{ color: C.cyan500 }}>{bestStreak}d</div>
                              <div className="mm-stats-cell-label">Best streak</div>
                            </div>
                            <div className="mm-stats-cell">
                              <div className="mm-stats-cell-val" style={{ color: C.blue600 }}>{avgScore ?? '—'}</div>
                              <div className="mm-stats-cell-label">Avg score</div>
                            </div>
                            <div className="mm-stats-cell">
                              <div className="mm-stats-cell-val" style={{ color: C.violet500 }}>{goalCompleted}/{goalTarget}</div>
                              <div className="mm-stats-cell-label">Today's goal</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <CommandPalette />
                <div className="mm-sep" aria-hidden="true"/>
                <button type="button"
                  className="mm-cta desktop-only mm-focus"
                  onClick={() => navigate('/interview')}
                >
                  <span className="mm-cta-icon" style={{ fontSize: 14 }}>🎙️</span>
                  <span className="mm-cta-text">New Interview</span>
                </button>

                {/* Profile dropdown — trimmed, scroll-safe */}
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
                    <div className="mm-drop" role="menu">
                      <div className="mm-drop-scroll">
                        <div className="mm-drop-mesh">
                          <div className="mm-drop-mesh-inner">
                            <div className="mm-drop-toprow">
                              <div className="mm-drop-avatar-wrap">
                                <div className="mm-drop-avatar">{initials}</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="mm-drop-name">{user.name?.split(' ')[0]}</div>
                                <div className="mm-drop-sub">{user.college ?? 'MockMate User'}</div>
                              </div>
                              <ScoreRing value={irs} size={32} strokeW={2.4} id="drop-irs"/>
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

                            <div className="mm-drop-stats">
                              {[
                                { val: irs,           color: accent,    label: 'IRS' },
                                { val: avgScore ?? '—', color: C.cyan500, label: 'Avg score' },
                                { val: `${streak}d`,  color: C.orange,  label: 'Streak' },
                              ].map(({ val, color, label }) => (
                                <div className="mm-drop-stat" key={label}>
                                  <div className="mm-drop-stat-val" style={{ color }}>{val}</div>
                                  <div className="mm-drop-stat-label">{label}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mm-drop-menu">
                          {DROPDOWN_ITEMS.map((item, i) => (
                            <button type="button" key={item.path}
                              className="mm-drop-item mm-focus"
                              role="menuitem"
                              style={{ animationDelay: `${i * 28}ms` }}
                              onClick={() => { setDropOpen(false); navigate(item.path); }}
                            >
                              <span className="mm-drop-icon"><NavIcon name={item.icon} size={14}/></span>
                              {item.label}
                              <span className="mm-drop-item-arrow"><NavIcon name="arrowRight" size={12}/></span>
                            </button>
                          ))}

                          <div className="mm-drop-divider"/>

                          <button type="button"
                            className="mm-drop-item danger mm-focus"
                            role="menuitem"
                            style={{ animationDelay: '60ms' }}
                            onClick={() => { setDropOpen(false); logout(); }}
                          >
                            <span className="mm-drop-icon"><NavIcon name="logout" size={14}/></span>
                            Logout
                            <span className="mm-drop-item-arrow"><NavIcon name="arrowRight" size={12}/></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mm-mobile-controls">
                  <button type="button"
                    className="mm-cta mm-focus"
                    style={{ height: 40, padding: '0 12px 0 5px' }}
                    onClick={() => navigate('/interview')}
                  >
                    <span className="mm-cta-icon" style={{ width: 26, height: 26, fontSize: 13 }}>🎙️</span>
                    <span className="mm-cta-text">New</span>
                  </button>
                  <button type="button"
                    className={`mm-ham mm-focus${mobileOpen ? ' open' : ''}`}
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

          {/* ══════════════════════════════════════════════════════════════
             Mobile panel — redesigned: Account card → CTA → Navigate
             section (grid) → Account section (Settings/Logout), clear
             visual grouping instead of one long undifferentiated list.
             ══════════════════════════════════════════════════════════════ */}
          {mobileOpen && user && (
            <div className="mm-mobile-panel">
              {notificationsLoaded && unreadCount > 0 && (
                <div className="mm-mobile-notif">
                  <div className="mm-mobile-notif-icon">
                    <NavIcon name="bell" size={14}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mm-mobile-notif-text">{notifications[0]?.text}</div>
                    {notifications.length > 1 && (
                      <div className="mm-mobile-notif-more">+{notifications.length - 1} more</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mm-mobile-user">
                <div className="mm-drop-avatar" style={{ width: 40, height: 40 }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mm-mobile-user-name">{user.name?.split(' ')[0]}</div>
                  <div className="mm-mobile-user-sub">{user.college ?? 'MockMate User'}</div>
                </div>
                <span className="mm-mobile-tier">{tierLabel}</span>
              </div>

              <div className="mm-mobile-stats">
                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-val" style={{ color: C.orange }}>🔥{streak}</div>
                  <div className="mm-mobile-stat-label">Streak</div>
                </div>
                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-val" style={{ color: accent }}>{irs}</div>
                  <div className="mm-mobile-stat-label">IRS</div>
                </div>
                <div className="mm-mobile-stat">
                  <div className="mm-mobile-stat-val" style={{ color: C.cyan500 }}>{avgScore ?? '—'}</div>
                  <div className="mm-mobile-stat-label">Avg</div>
                </div>
              </div>

              {!goalDone && (
                <div className="mm-mobile-goal">
                  <svg width={32} height={32} viewBox="0 0 34 34"
                    style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                    <circle cx="17" cy="17" r="14" fill="none" stroke={C.border} strokeWidth="3.5"/>
                    <circle cx="17" cy="17" r="14" fill="none" stroke={C.blue500} strokeWidth="3.5"
                      strokeDasharray={2 * Math.PI * 14}
                      strokeDashoffset={2 * Math.PI * 14 * (1 - goalPct / 100)}
                      strokeLinecap="round"/>
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div className="mm-mobile-goal-title">Today's goal</div>
                    <div className="mm-mobile-goal-sub">{goalCompleted} of {goalTarget} interviews done</div>
                  </div>
                </div>
              )}

             <button type="button"
  className="mm-cta desktop-only mm-focus"
  onClick={() => navigate('/interview')}
>
  <span className="mm-cta-icon" style={{ fontSize: 14 }}>🎙️</span>
  <span className="mm-cta-text">New Interview</span>
</button>

              <div className="mm-mobile-section-label">Navigate</div>
              <div className="mm-mobile-grid">
                {NAV_LINKS.map(link => (
                  <Link key={link.path} to={link.path}
                    className={`mm-mobile-tile mm-focus${isActive(link.path) ? ' active' : ''}`}
                    aria-current={isActive(link.path) ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.badge && <span className="mm-mobile-tile-badge">{link.badge}</span>}
                    <span className="mm-mobile-tile-icon"><NavIcon name={link.icon} size={18}/></span>
                    <span className="mm-mobile-tile-label">{link.label}</span>
                  </Link>
                ))}
              </div>

              <div className="mm-mobile-section-label">Account</div>
              <div className="mm-mobile-list">
                <Link to="/settings"
                  className={`mm-mobile-link mm-focus${isActive('/settings') ? ' active' : ''}`}
                  aria-current={isActive('/settings') ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="mm-mobile-link-icon"><NavIcon name="settings" size={16}/></span>
                  Settings
                  <span className="mm-drop-item-arrow" style={{ opacity: 1, transform: 'none' }}>
                    <NavIcon name="arrowRight" size={13}/>
                  </span>
                </Link>

                <button type="button"
                  className="mm-mobile-link mm-mobile-logout mm-focus"
                  onClick={() => { setMobileOpen(false); logout(); }}
                >
                  <span className="mm-mobile-link-icon" style={{ background: C.redTint, color: C.red }}>
                    <NavIcon name="logout" size={16}/>
                  </span>
                  Logout
                  <span className="mm-drop-item-arrow" style={{ opacity: 1, transform: 'none' }}>
                    <NavIcon name="arrowRight" size={13}/>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
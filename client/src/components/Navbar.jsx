import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';
import CommandPalette from './CommandPalette';

// ─── Design tokens ─────────────────────────────────────────────────────────────
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
  { label: 'Dashboard',   path: '/dashboard',   emoji: '🏠' },
  { label: 'History',     path: '/history',     emoji: '📋' },
  { label: 'Coach',       path: '/coach',       emoji: '🤖', badge: 'AI' },
  { label: 'Leaderboard', path: '/leaderboard', emoji: '🏆' },
  { label: 'Analytics',   path: '/analytics',   emoji: '📊' },
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
const GoogleG = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.69 28.18A13.96 13.96 0 0 1 10.93 24c0-1.45.25-2.86.76-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
  </svg>
);

const Logomark = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mm-logo-g" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0057E8"/>
        <stop offset="100%" stopColor="#00C8F0"/>
      </linearGradient>
    </defs>
    <rect width="52" height="52" rx="13" fill="url(#mm-logo-g)"/>
    <rect x="1" y="1" width="50" height="50" rx="12.5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"/>
    <path d="M13 36V19l13 10 13-10v17" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="13" cy="19" r="2.2" fill="white" opacity="0.65"/>
    <circle cx="39" cy="19" r="2.2" fill="white" opacity="0.65"/>
    <path d="M18 39h16" stroke="rgba(255,255,255,0.40)" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const MicGlyph = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="8.5" y="2" width="7" height="12" rx="3.5" fill="white" opacity="0.95"/>
    <path d="M5 12.5a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <line x1="12" y1="19.5" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <line x1="8.5" y1="22" x2="15.5" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ChevronDown = ({ size = 14, open }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transition: 'transform .22s cubic-bezier(.22,1,.36,1)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

const CloseIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

// ─── Score ring ───────────────────────────────────────────────────────────────
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
          <stop offset="0%" stopColor={accent} stopOpacity="0.35"/>
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
  @keyframes mmSheen     { 0% { transform:translateX(-120%) skewX(-14deg); } 100% { transform:translateX(260%) skewX(-14deg); } }
  @keyframes mmOverlayIn { from { opacity:0; } to { opacity:1; } }
  @keyframes mmItemRise  { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

  /* ── Root shell ─────────────────────────────────────────── */
  .mm-root {
    position: fixed; top: 0; left: 0; right: 0;
    z-index: 1000;
    padding: max(10px, env(safe-area-inset-top)) 20px 10px;
    pointer-events: none;
  }

  /* ── Backdrop (mobile overlay) ──────────────────────────── */
  .mm-backdrop {
    position: fixed; inset: 0; z-index: 1099;
    background: rgba(10,22,40,0.40);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: mmOverlayIn .2s ease;
    pointer-events: auto; cursor: pointer;
  }

  /* ── Capsule ────────────────────────────────────────────── */
  .mm-capsule {
    position: relative;
    width: min(1440px, 100%); margin: 0 auto;
    padding: 6px 6px 6px 8px;
    display: flex; align-items: center; min-height: 64px;
    border-radius: 20px;
    border: 1px solid rgba(205,218,246,0.85);
    background: rgba(255,255,255,0.94);
    backdrop-filter: blur(40px) saturate(210%);
    -webkit-backdrop-filter: blur(40px) saturate(210%);
    box-shadow:
      0 1px 0 rgba(255,255,255,.98) inset,
      0 2px 8px rgba(0,31,107,.04),
      0 6px 24px rgba(0,31,107,.07),
      0 0 0 1px rgba(26,110,255,.04);
    transition: box-shadow .4s cubic-bezier(.22,1,.36,1);
    pointer-events: auto;
  }
  .mm-capsule::before {
    content: '';
    position: absolute; left: 5%; right: 5%; top: 0;
    height: 1.5px; border-radius: 999px;
    background: linear-gradient(90deg,
      transparent, rgba(91,163,255,.60), rgba(0,200,240,.50),
      rgba(91,163,255,.60), transparent);
    opacity: .80; pointer-events: none;
  }

  /* ── Brand ──────────────────────────────────────────────── */
  .mm-brand {
    display: flex; align-items: center; gap: 11px;
    text-decoration: none; padding: 5px 14px 5px 5px;
    border-radius: 15px; flex-shrink: 0;
    transition: background .18s ease, transform .18s cubic-bezier(.22,1,.36,1);
  }
  .mm-brand:hover { background: rgba(235,242,255,.75); transform: translateY(-0.5px); }
  .mm-brand:active { transform: scale(.98); }
  .mm-brand-mark {
    flex-shrink: 0;
    filter: drop-shadow(0 2px 8px rgba(17,98,245,.32));
    transition: filter .3s ease, transform .25s cubic-bezier(.22,1,.36,1);
  }
  .mm-brand:hover .mm-brand-mark {
    filter: drop-shadow(0 4px 14px rgba(17,98,245,.48));
    transform: translateY(-1px) scale(1.03);
  }
  .mm-brand-word  { display: flex; flex-direction: column; gap: 3px; }
  .mm-brand-title {
    font-family: ${F.display}; font-size: 21px; font-weight: 800;
    letter-spacing: -.035em; line-height: 1; white-space: nowrap; color: ${C.text};
  }
  .mm-brand-tag {
    font: 500 10.5px ${F.body}; letter-spacing: 0.08px;
    color: ${C.muted}; white-space: nowrap;
  }
  .mm-brand-ring {
    border-radius: 12px;
    box-shadow: 0 0 0 0 rgba(37,99,235,0), 0 2px 8px rgba(37,99,235,.18);
    transition: box-shadow .22s, transform .22s cubic-bezier(.22,1,.36,1);
    display: flex; flex-shrink: 0;
  }
  .mm-brand:hover .mm-brand-ring {
    box-shadow: 0 0 0 5px rgba(37,99,235,.10), 0 6px 16px rgba(37,99,235,.24);
    transform: translateY(-1px);
  }

  /* ── Desktop nav pill track ─────────────────────────────── */
  .mm-nav {
    flex: 1; display: flex; align-items: center; justify-content: center;
    min-width: 0; padding: 0 14px; gap: 8px;
  }
  .mm-nav-track {
    position: relative; display: flex; align-items: center;
    gap: 1px; padding: 4px; border-radius: 14px;
    background: rgba(244,248,255,.85);
    border: 1px solid rgba(210,222,248,.65);
    box-shadow: inset 0 1px 2px rgba(0,31,107,.05);
    overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
  }
  .mm-nav-track::-webkit-scrollbar { display: none; }
  .mm-pill {
    position: absolute; top: 50%; height: 34px;
    border-radius: 10px; transform: translateY(-50%);
    background: linear-gradient(155deg, rgba(91,163,255,.18) 0%, rgba(37,99,235,.11) 100%);
    border: 1px solid rgba(59,130,246,.24);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.70), 0 2px 8px rgba(59,130,246,.14);
    pointer-events: none; overflow: hidden;
    transition: left .42s cubic-bezier(.22,1,.36,1), width .42s cubic-bezier(.22,1,.36,1), opacity .2s ease;
  }
  .mm-pill::after {
    content: ''; position: absolute; left: 22%; right: 22%; bottom: 0;
    height: 1.5px; border-radius: 999px;
    background: linear-gradient(90deg, #0057E8, #00C8F0);
    box-shadow: 0 0 6px rgba(0,87,232,.45);
  }
  .mm-link {
    position: relative; z-index: 2;
    display: inline-flex; align-items: center; justify-content: center;
    gap: 5px; height: 34px; flex: 1 1 auto;
    min-width: 0; padding: 0 11px;
    border: none; border-radius: 10px;
    background: transparent; color: ${C.muted};
    text-decoration: none; font: 500 12.5px ${F.body}; letter-spacing: -.010em;
    white-space: nowrap; cursor: pointer;
    transition: color .15s ease, background .15s ease, transform .15s cubic-bezier(.22,1,.36,1);
  }
  .mm-link:hover:not(.active) { color: ${C.sub}; background: rgba(255,255,255,.70); transform: translateY(-0.5px); }
  .mm-link:active { transform: translateY(0) scale(.97); }
  .mm-link.active { color: #2563EB; font-weight: 650; }
  .mm-link-emoji { font-size: 13px; line-height: 1; transition: transform .15s ease; }
  .mm-link.active .mm-link-emoji, .mm-link:hover .mm-link-emoji { transform: scale(1.12); }
  .mm-link-badge {
    padding: 1px 4px; border-radius: 3px;
    font: 700 6.5px ${F.mono}; letter-spacing: .3px;
    color: #7C3AED; background: rgba(139,92,246,.09);
    border: 1px solid rgba(139,92,246,.24);
  }
  .mm-link.active .mm-link-badge { color: #2563EB; border-color: rgba(59,130,246,.28); background: rgba(59,130,246,.10); }

  /* ── Right cluster ──────────────────────────────────────── */
  .mm-right {
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0; margin-left: auto; padding-left: 10px; justify-content: flex-end;
  }
  .mm-sep { width: 1px; height: 22px; background: rgba(210,222,248,.9); border-radius: 999px; flex-shrink: 0; margin: 0 2px; }

  /* ── Stats chip (desktop) ───────────────────────────────── */
  .mm-statschip {
    display: flex; align-items: center; gap: 0;
    height: 40px; padding: 0 3px;
    border: 1px solid rgba(200,218,248,.9); border-radius: 13px;
    background: linear-gradient(180deg, rgba(255,255,255,.97), rgba(247,251,255,.92));
    box-shadow: 0 1px 3px rgba(0,31,107,.05);
    cursor: default;
  }
  .mm-schip-seg   { display: flex; align-items: center; gap: 5px; padding: 0 10px; height: 100%; }
  .mm-schip-emoji { font-size: 14px; line-height: 1; }
  .mm-schip-label { font: 600 9.5px ${F.mono}; letter-spacing: .4px; text-transform: uppercase; color: ${C.muted}; line-height: 1; }
  .mm-schip-val   { font: 800 14px ${F.display}; letter-spacing: -.04em; line-height: 1; }
  .mm-schip-sep   { width: 1px; height: 16px; background: ${C.border}; flex-shrink: 0; }

  /* ── Desktop CTA ────────────────────────────────────────── */
  .mm-cta {
    position: relative; overflow: hidden; isolation: isolate;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 44px; padding: 0 20px 0 14px;
    border: 1px solid rgba(0,66,184,0.55); border-radius: 14px; color: #fff;
    background: linear-gradient(135deg, #0057E8 0%, #00C8F0 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), 0 4px 10px rgba(0,87,232,.18), 0 8px 22px rgba(0,87,232,.18);
    font: 700 13.5px ${F.body}; letter-spacing: -.012em;
    white-space: nowrap; cursor: pointer; flex-shrink: 0;
    transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease, filter .22s ease;
  }
  .mm-cta::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 55%);
  }
  .mm-cta::after {
    content: ''; position: absolute; top: -20%; bottom: -20%; left: -55%; width: 30%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);
    transform: skewX(-14deg); opacity: 0; pointer-events: none;
  }
  .mm-cta:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), 0 8px 24px rgba(0,87,232,.34); filter: brightness(1.04); }
  .mm-cta:hover::after { opacity: 1; animation: mmSheen .7s ease-out; }
  .mm-cta:active { transform: translateY(0) scale(.983); filter: brightness(.94); }
  .mm-cta-glyph {
    position: relative; z-index: 1; display: flex; flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0,40,120,.30));
    transition: transform .22s cubic-bezier(.22,1,.36,1);
  }
  .mm-cta:hover .mm-cta-glyph { transform: translateY(-.5px) scale(1.10); }
  .mm-cta-text { position: relative; z-index: 1; text-shadow: 0 1px 3px rgba(0,40,120,.18); }

  /* ── Desktop goal ring button ───────────────────────────── */
  .mm-util-wrap { position: relative; flex-shrink: 0; }
  .mm-util-btn {
    position: relative; width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid rgba(195,214,245,.9); border-radius: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(247,251,255,.9));
    color: ${C.sub}; cursor: pointer;
    transition: border-color .18s, background .18s, box-shadow .18s, transform .18s cubic-bezier(.22,1,.36,1), color .18s;
  }
  .mm-util-btn:hover { color: #3B82F6; border-color: rgba(59,130,246,.42); background: #fff; box-shadow: 0 4px 14px rgba(59,130,246,.16); transform: translateY(-1.5px); }
  .mm-util-btn:active { transform: scale(.94); }
  .mm-util-btn[aria-expanded="true"] { border-color: rgba(59,130,246,.55); color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }

  /* Goal popover */
  .mm-popover {
    position: absolute; top: calc(100% + 12px); right: 0; width: 300px;
    border: 1px solid rgba(210,222,248,.95); border-radius: 18px;
    background: rgba(255,255,255,.99);
    backdrop-filter: blur(28px) saturate(190%);
    box-shadow: 0 24px 58px rgba(0,31,107,.18), 0 6px 16px rgba(0,31,107,.08), inset 0 1px 0 rgba(255,255,255,.96);
    animation: mmDropIn .2s cubic-bezier(.22,1,.36,1); z-index: 100; overflow: hidden;
  }
  .mm-popover-inner { border-radius: 18px; overflow: hidden; background: inherit; }
  .mm-popover-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px 11px; border-bottom: 1px solid ${C.border}; }
  .mm-popover-title { font: 700 13px ${F.display}; color: ${C.text}; }
  .mm-popover-sub   { font: 500 10.5px ${F.body}; color: ${C.muted}; margin-top: 1px; }
  .mm-goal-body { padding: 16px 14px; display: flex; align-items: center; gap: 14px; }
  .mm-goal-copy-title { font: 700 14px ${F.display}; color: ${C.text}; }
  .mm-goal-copy-sub   { font: 500 11.5px ${F.body}; color: ${C.muted}; margin-top: 3px; line-height: 1.4; }
  .mm-goal-cta {
    display: inline-flex; align-items: center; gap: 7px;
    margin: 0 14px 14px; padding: 10px 14px; border-radius: 12px; border: none;
    background: linear-gradient(130deg, #0057E8 0%, #00C8F0 100%);
    color: #fff; font: 700 12.5px ${F.body}; cursor: pointer;
    width: calc(100% - 28px); justify-content: center;
    box-shadow: 0 4px 14px rgba(0,87,232,.28);
    transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
  }
  .mm-goal-cta:hover { transform: translateY(-1.5px); box-shadow: 0 8px 22px rgba(0,87,232,.38); filter: brightness(1.04); }

  /* ── Desktop avatar button ──────────────────────────────── */
  .mm-profile-wrap { position: relative; flex-shrink: 0; }
  .mm-av-btn {
    position: relative; width: 42px; height: 42px;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 5px; border: 1.5px solid rgba(0,66,184,0.45); border-radius: 14px;
    background: rgba(0,87,232,0.08); cursor: pointer; overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.90), 0 2px 6px rgba(0,87,232,.12);
    transition: transform .2s cubic-bezier(.22,1,.36,1), border-color .18s, box-shadow .18s, background .18s;
  }
  .mm-av-btn::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,0));
  }
  .mm-av-btn:hover { transform: translateY(-1.5px); border-color: rgba(0,199,240,.60); background: rgba(0,87,232,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 0 0 3px rgba(0,87,232,.10), 0 6px 18px rgba(0,87,232,.22); }
  .mm-av-btn:active { transform: scale(.95); }
  .mm-av-btn[aria-expanded="true"] { border-color: rgba(0,199,240,.55); background: rgba(0,87,232,.14); box-shadow: 0 0 0 3.5px rgba(0,87,232,.14), 0 4px 12px rgba(0,87,232,.20); }
  .mm-av-initial {
    position: relative; z-index: 2;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 10px;
    background: linear-gradient(135deg, #0057E8 0%, #00C8F0 100%);
    color: #ffffff; font: 800 14px ${F.display}; letter-spacing: -.02em;
    border: 1px solid rgba(0,66,184,.35);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), 0 2px 8px rgba(0,87,232,.30);
  }

  /* ── Desktop Dropdown ───────────────────────────────────── */
  .mm-drop {
    position: absolute; top: calc(100% + 12px); right: 0; width: 310px;
    border: 1px solid rgba(168,216,255,.70); border-radius: 24px;
    background: rgba(248,252,255,.98);
    backdrop-filter: blur(48px) saturate(220%);
    -webkit-backdrop-filter: blur(48px) saturate(220%);
    box-shadow: 0 0 0 1px rgba(96,180,255,.12), 0 4px 16px rgba(58,154,255,.08), 0 16px 40px rgba(30,100,200,.12), 0 40px 80px rgba(0,40,140,.16), inset 0 1px 0 rgba(255,255,255,.99);
    animation: mmDropIn .22s cubic-bezier(.22,1,.36,1);
    z-index: 100; overflow: hidden; display: flex; flex-direction: column;
  }
  .mm-drop::before {
    content: ''; position: absolute; left: 8%; right: 8%; top: 0; height: 1.5px;
    border-radius: 999px; pointer-events: none; z-index: 2;
    background: linear-gradient(90deg, transparent, #A8D8FF, #60B4FF, #00C8F0, #60B4FF, #A8D8FF, transparent);
    opacity: .85;
  }
  .mm-drop-head {
    padding: 18px 16px 16px;
    background: linear-gradient(145deg, rgba(220,240,255,.82), rgba(235,248,255,.90), rgba(255,255,255,.99));
  }
  .mm-drop-toprow { display: flex; align-items: center; gap: 11px; }
  .mm-drop-avatar {
    width: 44px; height: 44px; border-radius: 14px; flex-shrink: 0;
    background: linear-gradient(135deg, #0057E8 0%, #00C8F0 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font: 800 18px ${F.display};
    box-shadow: 0 4px 18px rgba(0,87,232,.34), inset 0 1px 0 rgba(255,255,255,.32);
    border: 1px solid rgba(0,66,184,.35);
  }
  .mm-drop-user-info { flex: 1; min-width: 0; }
  .mm-drop-name { font: 700 14px ${F.display}; color: ${C.text}; letter-spacing: -.012em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-drop-sub  { font: 500 11px ${F.body}; color: ${C.muted}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-drop-close {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid ${C.border}; background: rgba(248,250,255,.9);
    color: ${C.muted}; cursor: pointer;
    transition: background .14s, color .14s, border-color .14s;
  }
  .mm-drop-close:hover { background: ${C.redTint}; color: ${C.red}; border-color: rgba(220,38,38,.22); }
  .mm-drop-tier {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 12px; padding: 5px 11px 5px 7px; border-radius: 999px;
    background: linear-gradient(100deg, rgba(168,216,255,.18), rgba(96,180,255,.16));
    border: 1px solid rgba(100,180,255,.38); color: #1558CC;
    font: 600 10.5px ${F.body}; letter-spacing: .06px;
  }
  .mm-drop-tier-icon {
    width: 16px; height: 16px; display: grid; place-items: center; border-radius: 50%;
    background: linear-gradient(135deg, #A8D8FF, #3A9AFF); color: #fff; flex-shrink: 0; font-size: 9px;
  }
  .mm-drop-tier b { color: #1558CC; font-weight: 800; }
  .mm-drop-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 12px; }
  .mm-drop-stat {
    padding: 10px 5px 9px; text-align: center;
    border: 1px solid ${C.border}; border-radius: 12px; background: rgba(255,255,255,.95);
    transition: border-color .15s, transform .15s, box-shadow .15s; cursor: default;
  }
  .mm-drop-stat:hover { border-color: rgba(96,180,255,.30); transform: translateY(-1.5px); box-shadow: 0 4px 14px rgba(96,180,255,.14); }
  .mm-drop-stat-val   { font: 800 15px ${F.display}; letter-spacing: -.03em; line-height: 1.1; }
  .mm-drop-stat-label { font: 600 8px ${F.body}; letter-spacing: .18px; color: ${C.muted}; margin-top: 3px; text-transform: uppercase; }
  .mm-drop-stat-emoji { font-size: 13px; }
  .mm-drop-footer {
    padding: 14px 12px 14px;
    border-top: 1px solid rgba(168,216,255,.35);
    background: linear-gradient(180deg, rgba(245,251,255,.99), rgba(238,248,255,.99));
  }
  .mm-drop-signout {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
    padding: 12px 16px; border-radius: 13px; border: none;
    background: linear-gradient(135deg, #EF4444 0%, #DC2626 55%, #B91C1C 100%);
    color: #ffffff; font: 700 13.5px ${F.body}; cursor: pointer;
    box-shadow: 0 2px 8px rgba(185,28,28,.22), 0 6px 18px rgba(220,38,38,.20);
    transition: transform .16s, box-shadow .16s, filter .16s;
  }
  .mm-drop-signout:hover { filter: brightness(1.06); transform: translateY(-1.5px); box-shadow: 0 4px 14px rgba(185,28,28,.30), 0 10px 26px rgba(220,38,38,.28); }
  .mm-drop-signout:active { transform: scale(.98); filter: brightness(.94); }

  /* ── Login button (guest) ───────────────────────────────── */
  .mm-login {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    height: 40px; padding: 0 15px 0 8px;
    border: 1px solid rgba(59,130,246,.24); border-radius: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(246,250,255,.97));
    color: #111827 !important; text-decoration: none; font: 650 13px ${F.body};
    box-shadow: 0 2px 8px rgba(0,31,107,.06), 0 5px 14px rgba(59,130,246,.07), inset 0 1px 0 rgba(255,255,255,.97);
    transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s, border-color .2s;
    white-space: nowrap; flex-shrink: 1; min-width: 0; overflow: hidden;
  }
  .mm-login:hover { color: #111827 !important; transform: translateY(-1.5px); border-color: rgba(59,130,246,.44); box-shadow: 0 0 0 3px rgba(59,130,246,.08), 0 10px 26px rgba(59,130,246,.17), inset 0 1px 0 rgba(255,255,255,.99); }
  .mm-login:active { transform: translateY(0) scale(.98); }
  .mm-google-wrap {
    width: 26px; height: 26px; display: grid; place-items: center;
    border-radius: 7px; background: ${C.blue50}; border: 1px solid rgba(59,130,246,.10);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.85); flex-shrink: 0;
  }
  .mm-login-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

  /* ── Mobile controls ────────────────────────────────────── */
  .mm-mobile-controls {
    display: none;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }

  /* ── "New" interview pill (mobile) ──────────────────────── */
  .mm-mob-new-btn {
    position: relative; overflow: hidden;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    height: 40px; padding: 0 14px 0 10px;
    border-radius: 13px;
    background: linear-gradient(135deg, #0057E8 0%, #00C8F0 100%);
    border: 1px solid rgba(0,66,184,.45);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.28),
      0 3px 8px rgba(0,87,232,.22),
      0 6px 18px rgba(0,87,232,.16);
    cursor: pointer; flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: transform .2s cubic-bezier(.22,1,.36,1), filter .18s ease, box-shadow .2s;
  }
  .mm-mob-new-btn::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 55%);
  }
  .mm-mob-new-btn::after {
    content: ''; position: absolute; top: -20%; bottom: -20%; left: -55%; width: 30%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.26), transparent);
    transform: skewX(-14deg); opacity: 0; pointer-events: none;
  }
  .mm-mob-new-btn:hover { transform: translateY(-1.5px); filter: brightness(1.06); }
  .mm-mob-new-btn:hover::after { opacity: 1; animation: mmSheen .65s ease-out; }
  .mm-mob-new-btn:active { transform: scale(.93); filter: brightness(.92); }

  .mm-mob-new-icon {
    position: relative; z-index: 2;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; line-height: 1;
  }
  .mm-mob-new-text {
    position: relative; z-index: 2;
    font: 700 13px ${F.body}; color: #fff;
    letter-spacing: -.01em; white-space: nowrap;
    text-shadow: 0 1px 3px rgba(0,40,120,.18);
  }

  /* ── Hamburger (mobile) ─────────────────────────────────── */
  .mm-ham {
    position: relative; width: 40px; height: 40px;
    display: inline-flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 4.5px;
    padding: 0; border-radius: 12px;
    border: 1.5px solid rgba(147,197,253,.90);
    background: linear-gradient(180deg, rgba(235,242,255,.95), rgba(219,234,254,.90));
    box-shadow: 0 2px 6px rgba(37,99,235,.06);
    cursor: pointer; flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .18s, border-color .18s;
  }
  .mm-ham:hover { transform: translateY(-1px); border-color: rgba(59,130,246,.50); box-shadow: 0 0 0 3px rgba(59,130,246,.10), 0 4px 12px rgba(59,130,246,.14); }
  .mm-ham:active { transform: scale(.94); }
  .mm-ham .mm-bar { width: 15px; height: 1.8px; border-radius: 999px; background: #2563EB; transition: transform .24s cubic-bezier(.22,1,.36,1), opacity .18s; }
  .mm-ham.open .mm-bar:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
  .mm-ham.open .mm-bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
  .mm-ham.open .mm-bar:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }

  /* ── Mobile dropdown panel ──────────────────────────────── */
  .mm-mob-panel {
    position: fixed;
    top: 80px;
    right: 10px;
    left: auto;
    width: 300px;
    max-height: calc(100dvh - 96px);
    display: flex; flex-direction: column;
    border: 1px solid rgba(200,218,248,.95); border-radius: 22px;
    background: rgba(255,255,255,.99);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    box-shadow:
      0 0 0 1px rgba(59,130,246,.06),
      0 8px 24px rgba(0,31,107,.10),
      0 24px 60px rgba(0,31,107,.20),
      inset 0 1px 0 rgba(255,255,255,.99);
    animation: mmDropIn .22s cubic-bezier(.22,1,.36,1);
    z-index: 1100;
    overflow: hidden;
  }
  .mm-mob-panel::before {
    content: ''; position: absolute; left: 8%; right: 8%; top: 0; height: 1.5px;
    border-radius: 999px; pointer-events: none; z-index: 2;
    background: linear-gradient(90deg, transparent, #0057E8, #00C8F0, #0057E8, transparent);
    opacity: .75;
  }

  /* ── User card header ───────────────────────────────────── */
  .mm-mob-head {
    flex-shrink: 0;
    background: linear-gradient(135deg, #0057E8 0%, #0096D4 55%, #00C8F0 100%);
    position: relative; overflow: hidden;
  }
  .mm-mob-head::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(130% 200% at 0% 0%, rgba(255,255,255,.22) 0%, transparent 50%);
  }
  .mm-mob-head-row {
    position: relative; z-index: 1;
    padding: 14px 14px 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .mm-mob-avatar {
    width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
    background: rgba(255,255,255,.20); border: 1.5px solid rgba(255,255,255,.30);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font: 800 15px ${F.display};
    box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 2px 8px rgba(0,0,0,.14);
  }
  .mm-mob-identity { flex: 1; min-width: 0; }
  .mm-mob-name  { font: 700 13.5px ${F.display}; color: #fff; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-mob-email { font: 500 10.5px ${F.body}; color: rgba(255,255,255,.65); margin-top: 1.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-mob-tier-pill {
    font: 700 7.5px ${F.mono}; color: rgba(255,255,255,.88);
    background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.26);
    border-radius: 999px; padding: 3.5px 7px; flex-shrink: 0; white-space: nowrap;
  }

  /* Stats stripe */
  .mm-mob-stats {
    display: grid; grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid rgba(255,255,255,.14);
    position: relative; z-index: 1;
  }
  .mm-mob-stat { padding: 8px 4px 9px; text-align: center; border-right: 1px solid rgba(255,255,255,.12); }
  .mm-mob-stat:last-child { border-right: none; }
  .mm-mob-stat-val   { font: 800 13.5px ${F.display}; letter-spacing: -.04em; color: #fff; line-height: 1.1; }
  .mm-mob-stat-label { font: 600 7px ${F.mono}; letter-spacing: .45px; color: rgba(255,255,255,.55); margin-top: 3px; text-transform: uppercase; }

  /* ── Nav grid ───────────────────────────────────────────── */
  .mm-mob-body {
    flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
    padding: 12px 10px 10px;
    display: flex; flex-direction: column; gap: 10px;
    min-height: 0; scrollbar-width: none;
  }
  .mm-mob-body::-webkit-scrollbar { display: none; }
  .mm-mob-section-label {
    font: 700 8px ${F.mono}; letter-spacing: .55px; text-transform: uppercase;
    color: ${C.muted}; padding: 0 3px;
  }
  .mm-mob-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;
  }
  .mm-mob-tile {
    position: relative; overflow: hidden;
    display: flex; align-items: center; gap: 8px; padding: 10px 11px;
    border: 1px solid rgba(206,220,246,.90); border-radius: 13px;
    background: linear-gradient(180deg, #fff, #FAFCFF);
    text-decoration: none;
    box-shadow: 0 1px 3px rgba(0,31,107,.04);
    transition: border-color .15s, background .15s, transform .15s cubic-bezier(.22,1,.36,1), box-shadow .15s;
    -webkit-tap-highlight-color: transparent;
    animation: mmItemRise .22s cubic-bezier(.22,1,.36,1) both;
  }
  .mm-mob-tile:nth-child(1) { animation-delay: .03s; }
  .mm-mob-tile:nth-child(2) { animation-delay: .06s; }
  .mm-mob-tile:nth-child(3) { animation-delay: .09s; }
  .mm-mob-tile:nth-child(4) { animation-delay: .12s; }
  .mm-mob-tile:nth-child(5) { animation-delay: .15s; }
  .mm-mob-tile:hover:not(.mm-mob-tile-active) {
    border-color: rgba(0,87,232,.24);
    background: linear-gradient(180deg, #fff, #EBF2FF);
    transform: translateY(-1.5px);
    box-shadow: 0 4px 12px rgba(0,87,232,.10);
  }
  .mm-mob-tile:active { transform: scale(.975); }
  .mm-mob-tile-active {
    background: linear-gradient(135deg, #0057E8 0%, #00C8F0 100%);
    border-color: rgba(0,66,184,.35);
    box-shadow: 0 4px 14px rgba(0,87,232,.28);
  }
  .mm-mob-tile-active::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: radial-gradient(120% 180% at 0% 0%, rgba(255,255,255,.18) 0%, transparent 55%);
  }
  .mm-mob-tile-emoji {
    position: relative; z-index: 1;
    width: 28px; height: 28px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; line-height: 1;
    background: rgba(255,255,255,.88); border: 1px solid rgba(0,0,0,.06);
    box-shadow: 0 1px 3px rgba(0,0,0,.07); flex-shrink: 0;
  }
  .mm-mob-tile-active .mm-mob-tile-emoji { background: rgba(255,255,255,.20); border-color: rgba(255,255,255,.28); }
  .mm-mob-tile-label {
    position: relative; z-index: 1;
    font: 600 12px ${F.body}; color: #4A5878; letter-spacing: -.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mm-mob-tile-active .mm-mob-tile-label { color: #fff; font-weight: 700; }
  .mm-mob-tile-badge {
    position: absolute; top: 6px; right: 7px; z-index: 2;
    font: 700 6.5px ${F.mono}; padding: 1px 4px; border-radius: 3px;
    color: #7C3AED; background: rgba(139,92,246,.11); border: 1px solid rgba(139,92,246,.22);
  }
  .mm-mob-tile-active .mm-mob-tile-badge { color: #fff; background: rgba(255,255,255,.20); border-color: rgba(255,255,255,.28); }

  /* Last tile spans full width when odd count */
  .mm-mob-grid .mm-mob-tile:last-child:nth-child(odd) { grid-column: 1 / -1; }

  /* ── Footer ─────────────────────────────────────────────── */
  .mm-mob-footer { flex-shrink: 0; padding: 0 10px 12px; }
  .mm-mob-signout {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 16px; border-radius: 13px; border: none;
    background: linear-gradient(135deg, #EF4444 0%, #DC2626 55%, #B91C1C 100%);
    color: #fff; font: 700 13px ${F.body}; cursor: pointer;
    box-shadow: 0 2px 6px rgba(185,28,28,.20), 0 4px 12px rgba(220,38,38,.16);
    -webkit-tap-highlight-color: transparent;
    transition: filter .15s, transform .15s, box-shadow .15s;
  }
  .mm-mob-signout:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(185,28,28,.28), 0 8px 22px rgba(220,38,38,.22); }
  .mm-mob-signout:active { transform: scale(.98); filter: brightness(.93); }

  /* ── Responsive breakpoints ─────────────────────────────── */
  @media (max-width: 830px) {
    .mm-nav            { display: none !important; }
    .mm-statschip      { display: none !important; }
    .mm-cta            { display: none !important; }
    .mm-util-wrap      { display: none !important; }
    .mm-av-btn         { display: none !important; }
    .mm-sep            { display: none !important; }
    .mm-mobile-controls { display: flex !important; }
  }

  @media (min-width: 831px) {
    .mm-mobile-controls { display: none !important; }
    .mm-mob-panel       { display: none !important; }
    .mm-backdrop        { display: none !important; }
  }

  @media (max-width: 560px) {
    .mm-root { padding: max(6px, env(safe-area-inset-top)) 10px 6px; }
    .mm-brand { padding: 4px 8px 4px 4px; gap: 8px; }
    .mm-brand-title { font-size: 18px; }
    .mm-brand-tag { display: none; }
    .mm-brand-ring svg { width: 34px; height: 34px; }
  }
  @media (max-width: 400px) {
    .mm-brand-title { font-size: 16px; }
    .mm-brand-ring svg { width: 30px; height: 30px; }
    .mm-mob-panel { width: calc(100vw - 20px); right: 10px; }
    .mm-mob-new-btn { padding: 0 11px 0 9px; }
    .mm-mob-new-text { font-size: 12px; }
  }
  @media (max-width: 360px) {
    .mm-mob-new-text { display: none; }
    .mm-mob-new-btn { width: 40px; padding: 0; }
    .mm-mob-grid { grid-template-columns: 1fr; }
    .mm-mob-grid .mm-mob-tile:last-child:nth-child(odd) { grid-column: auto; }
  }

  @media (max-width: 1080px) {
    .mm-link { padding: 0 9px; font-size: 12px; gap: 4px; }
    .mm-link-emoji { display: none; }
  }
  @media (max-width: 960px) {
    .mm-link { padding: 0 8px; font-size: 11.5px; }
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
  const navigate  = useNavigate();

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

  const _now = new Date();
  const _planExpired = (user?.plan === 'pro' || user?.plan === 'college')
    && user?.planExpiry
    && new Date(user.planExpiry) < _now;
  const isProUser = !_planExpired && (user?.plan === 'pro' || user?.plan === 'college');

  const tierLabel =
    user?.tierLabel ??
    (irs >= 80 ? '₹20 LPA+' : irs >= 60 ? '₹12–20 LPA' : irs >= 38 ? '₹6–12 LPA' : '₹3–6 LPA');

  const goalTarget    = user?.dailyGoal?.target    ?? 3;
  const goalCompleted = user?.dailyGoal?.completed ?? 0;
  const goalDone      = goalCompleted >= goalTarget;
  const goalPct       = Math.min(100, Math.round((goalCompleted / Math.max(1, goalTarget)) * 100));

  // Prevent body scroll when mobile panel is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (goalRef.current && !goalRef.current.contains(e.target)) setGoalOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close all panels on route change
  useEffect(() => {
    setMobileOpen(false);
    setDropOpen(false);
    setGoalOpen(false);
  }, [location.pathname]);

  // Escape key closes everything
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setMobileOpen(false); setDropOpen(false); setGoalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Desktop sliding pill indicator
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

  return (
    <>
      <style>{NAVBAR_CSS}</style>

      {/* Mobile backdrop */}
      {mobileOpen && user && (
        <div
          className="mm-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="mm-root" aria-label="Main navigation">
        <div className="mm-capsule">

          {/* ── Brand ─────────────────────────────────────── */}
          <Link to={user ? '/dashboard' : '/'} className="mm-brand">
            <div className="mm-brand-ring">
              <Logomark size={40}/>
            </div>
            <div className="mm-brand-word">
              <div className="mm-brand-title">MockMate</div>
              <div className="mm-brand-tag">Practice. Improve. Get hired.</div>
            </div>
          </Link>

          {/* ── Desktop nav ────────────────────────────────── */}
          {user && (
            <div className="mm-nav">
              <div ref={shellRef} className="mm-nav-track" role="list">
                <div
                  className="mm-pill"
                  style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
                />
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    ref={(el) => { linkRefs.current[link.path] = el; }}
                    to={link.path}
                    className={`mm-link${isActive(link.path) ? ' active' : ''}`}
                    role="listitem"
                    aria-current={isActive(link.path) ? 'page' : undefined}
                  >
                    <span className="mm-link-emoji">{link.emoji}</span>
                    {link.label}
                    {link.badge && <span className="mm-link-badge">{link.badge}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Right cluster ──────────────────────────────── */}
          <div className="mm-right">
            {user ? (
              <>
                {/* Daily goal ring */}
                {!goalDone && (
                  <div ref={goalRef} className="mm-util-wrap">
                    <button
                      type="button"
                      className="mm-util-btn"
                      onClick={() => setGoalOpen(v => !v)}
                      aria-expanded={goalOpen}
                      aria-label={`Daily goal: ${goalCompleted} of ${goalTarget}`}
                    >
                      <svg width={24} height={24} viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="12" cy="12" r="9.5" fill="none" stroke={C.border} strokeWidth="2.4"/>
                        <circle cx="12" cy="12" r="9.5" fill="none" stroke="#3B82F6" strokeWidth="2.4"
                          strokeDasharray={2 * Math.PI * 9.5}
                          strokeDashoffset={2 * Math.PI * 9.5 * (1 - goalPct / 100)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.22,1,.36,1)' }}
                        />
                      </svg>
                    </button>

                    {goalOpen && (
                      <div className="mm-popover">
                        <div className="mm-popover-inner">
                          <div className="mm-popover-head">
                            <div>
                              <div className="mm-popover-title">🎯 Today's goal</div>
                              <div className="mm-popover-sub">{goalCompleted} of {goalTarget} interviews</div>
                            </div>
                          </div>
                          <div className="mm-goal-body">
                            <svg width={54} height={54} viewBox="0 0 54 54"
                              style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                              <circle cx="27" cy="27" r="23" fill="none" stroke={C.border} strokeWidth="5"/>
                              <circle cx="27" cy="27" r="23" fill="none" stroke="#3B82F6" strokeWidth="5"
                                strokeDasharray={2 * Math.PI * 23}
                                strokeDashoffset={2 * Math.PI * 23 * (1 - goalPct / 100)}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
                              />
                            </svg>
                            <div>
                              <div className="mm-goal-copy-title">{goalTarget - goalCompleted} more to go</div>
                              <div className="mm-goal-copy-sub">Daily practice keeps your IRS climbing steadily.</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="mm-goal-cta"
                            onClick={() => { setGoalOpen(false); navigate('/interview'); }}
                          >
                            🎙️ Start now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats chip */}
                <div className="mm-statschip">
                  <div className="mm-schip-seg">
                    <span className="mm-schip-emoji">🔥</span>
                    <div>
                      <div className="mm-schip-label">Streak</div>
                      <div className="mm-schip-val" style={{ color: C.orange }}>{streak}d</div>
                    </div>
                  </div>
                  <div className="mm-schip-sep"/>
                  <div className="mm-schip-seg">
                    <span className="mm-schip-emoji">⚡</span>
                    <div>
                      <div className="mm-schip-label">IRS</div>
                      <div className="mm-schip-val" style={{ color: accent }}>{irs}</div>
                    </div>
                  </div>
                  {avgScore !== null && (
                    <>
                      <div className="mm-schip-sep"/>
                      <div className="mm-schip-seg">
                        <span className="mm-schip-emoji">📈</span>
                        <div>
                          <div className="mm-schip-label">Avg</div>
                          <div className="mm-schip-val" style={{ color: C.cyan500 }}>{avgScore}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Hidden Cmd+K */}
                <div style={{ display: 'none' }}><CommandPalette /></div>

                <div className="mm-sep" aria-hidden="true"/>

                {/* CTA desktop */}
                <button
                  type="button"
                  className="mm-cta"
                  onClick={() => navigate('/interview')}
                  aria-label="Start a new interview"
                >
                  <span className="mm-cta-glyph" style={{ fontSize: 16, lineHeight: 1 }}>🎙️</span>
                  <span className="mm-cta-text">New Interview</span>
                </button>

                {/* Avatar + desktop dropdown */}
                <div ref={dropRef} className="mm-profile-wrap">
                  <button
                    type="button"
                    className="mm-av-btn"
                    onClick={() => setDropOpen(v => !v)}
                    aria-expanded={dropOpen}
                    aria-haspopup="menu"
                    aria-label={dropOpen ? 'Close profile menu' : 'Open profile menu'}
                  >
                    <div className="mm-av-initial">{initials}</div>
                  </button>

                  {dropOpen && (
                    <div className="mm-drop" role="menu">
                      <div className="mm-drop-head">
                        <div className="mm-drop-toprow">
                          <div className="mm-drop-avatar">{initials}</div>
                          <div className="mm-drop-user-info">
                            <div className="mm-drop-name">{user.name?.split(' ')[0]}</div>
                            <div className="mm-drop-sub">{user.college ?? 'MockMate User'}</div>
                          </div>
                          <button
                            type="button"
                            className="mm-drop-close"
                            onClick={() => setDropOpen(false)}
                            aria-label="Close"
                          >
                            <CloseIcon size={13}/>
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                          <div className="mm-drop-tier" style={{ marginTop: 0 }}>
                            <span className="mm-drop-tier-icon">✦</span>
                            Tracking toward <b>{tierLabel}</b>
                          </div>
                          {isProUser && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '4px 9px', borderRadius: 999,
                              background: 'linear-gradient(135deg, #1A6EFF 0%, #0044C4 100%)',
                              color: '#fff', fontSize: 9.5, fontWeight: 800, letterSpacing: .3,
                              boxShadow: '0 2px 8px rgba(26,110,255,.32)',
                            }}>
                              ⚡ PRO
                            </span>
                          )}
                        </div>

                        <div className="mm-drop-stats-row">
                          {[
                            { val: `${streak}d`, color: C.orange,       emoji: '🔥', label: 'Streak' },
                            { val: irs,           color: accent,         emoji: '⚡', label: 'IRS'    },
                            { val: avgScore ?? '—', color: C.cyan500,    emoji: '📊', label: 'Avg'    },
                          ].map(({ val, color, emoji, label }) => (
                            <div className="mm-drop-stat" key={label}>
                              <div className="mm-drop-stat-val" style={{ color }}>
                                <span className="mm-drop-stat-emoji">{emoji}</span> {val}
                              </div>
                              <div className="mm-drop-stat-label">{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mm-drop-footer">
                        <button
                          type="button"
                          onClick={() => { setDropOpen(false); navigate('/pricing'); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8, padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(26,110,255,.22)',
                            background: 'rgba(235,242,255,.85)', color: '#1A6EFF',
                            font: `600 13px ${F.body}`, cursor: 'pointer', marginBottom: 8,
                          }}
                        >
                          <span>⚡</span>
                          <span>{isProUser ? 'Manage plan' : 'Upgrade to Pro'}</span>
                        </button>
                        <button
                          type="button"
                          className="mm-drop-signout"
                          role="menuitem"
                          onClick={() => { setDropOpen(false); logout(); }}
                        >
                          <span>🚪</span>
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Mobile controls (hidden on desktop via CSS) ── */}
                <div className="mm-mobile-controls">
                  <button
                    type="button"
                    className="mm-mob-new-btn"
                    onClick={() => navigate('/interview')}
                    aria-label="Start new interview"
                  >
                    <span className="mm-mob-new-icon" aria-hidden="true">🎙️</span>
                    <span className="mm-mob-new-text">New</span>
                  </button>

                  <button
                    type="button"
                    className={`mm-ham${mobileOpen ? ' open' : ''}`}
                    onClick={() => setMobileOpen(v => !v)}
                    aria-expanded={mobileOpen}
                    aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                  >
                    <span className="mm-bar"/>
                    <span className="mm-bar"/>
                    <span className="mm-bar"/>
                  </button>
                </div>
              </>
            ) : (
              /* ── Guest login ── */
              <a href={`${API_BASE}/auth/google`} className="mm-login">
                <span className="mm-google-wrap"><GoogleG size={16}/></span>
                <span className="mm-login-text">Sign in with Google</span>
              </a>
            )}
          </div>

        </div>
      </nav>

      {/* ── Mobile dropdown panel ──────────────────────────── */}
      {mobileOpen && user && (
        <div className="mm-mob-panel" role="dialog" aria-label="Navigation menu" aria-modal="true">

          {/* User card */}
          <div className="mm-mob-head">
            <div className="mm-mob-head-row">
              <div className="mm-mob-avatar">{initials}</div>
              <div className="mm-mob-identity">
                <div className="mm-mob-name">{user.name ?? 'MockMate User'}</div>
                <div className="mm-mob-email">{user.college ?? 'Ready to practice'}</div>
              </div>
              <span className="mm-mob-tier-pill">{tierLabel}</span>
            </div>

            <div className="mm-mob-stats">
              <div className="mm-mob-stat">
                <div className="mm-mob-stat-val">🔥 {streak}</div>
                <div className="mm-mob-stat-label">Streak</div>
              </div>
              <div className="mm-mob-stat">
                <div className="mm-mob-stat-val">⚡ {irs}</div>
                <div className="mm-mob-stat-label">IRS</div>
              </div>
              <div className="mm-mob-stat">
                <div className="mm-mob-stat-val">📊 {avgScore ?? '—'}</div>
                <div className="mm-mob-stat-label">Avg</div>
              </div>
            </div>
          </div>

          {/* Nav grid */}
          <div className="mm-mob-body">
            <div className="mm-mob-section-label">Navigate</div>
            <div className="mm-mob-grid">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`mm-mob-tile${isActive(link.path) ? ' mm-mob-tile-active' : ''}`}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="mm-mob-tile-emoji">{link.emoji}</span>
                  <span className="mm-mob-tile-label">{link.label}</span>
                  {link.badge && (
                    <span className="mm-mob-tile-badge">{link.badge}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Sign out */}
          <div className="mm-mob-footer">
            <button
              type="button"
              className="mm-mob-signout"
              onClick={() => { setMobileOpen(false); logout(); }}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      )}
    </>
  );
};

export default Navbar;
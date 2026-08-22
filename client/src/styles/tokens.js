/**
 * MockMate Design Tokens
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth for colors, fonts, and shadows.
 * Import this in every page/component instead of copy-pasting C and F.
 *
 * Usage:
 *   import { C, F } from '../styles/tokens';
 */

export const C = {
  bg:        '#F0F4FF',
  bgDeep:    '#E8EEFF',

  card:      '#FFFFFF',
  cardAlt:   '#F8FAFF',
  cardGlass: 'rgba(255,255,255,0.82)',

  text:  '#0A1628',
  sub:   '#3D5280',
  muted: '#7A8BAF',
  faint: '#A8B8D4',

  border:    '#DDE5F7',
  borderMd:  '#B8CAF0',
  borderStr: '#7FA3E8',

  blue50:  '#EBF2FF',
  blue100: '#C7DAFF',
  blue200: '#9DBFFF',
  blue300: '#6FA5FF',
  blue400: '#4D8FFF',
  blue500: '#1A6EFF',
  blue600: '#0057E8',
  blue700: '#0044C4',
  blue900: '#001F6B',

  cyan300:  '#5FE0FF',
  cyan400:  '#00C8F0',
  cyan500:  '#00ADE0',
  cyan600:  '#0093C4',
  cyanTint: '#E6F9FF',

  green:     '#059669',
  greenTint: '#ECFDF5',
  greenGlow: 'rgba(5,150,105,0.18)',

  amber:      '#D97706',
  amberTint:  '#FFFBEB',
  orange:     '#EA580C',
  orangeTint: '#FFF7ED',

  red:     '#DC2626',
  redTint: '#FEF2F2',

  // Badge tiers — distinct from score colors so a badge never reads as a score
  bronze:       '#B0703B',
  bronzeTint:   '#FBF1E7',
  silver:       '#7C8AA3',
  silverTint:   '#F2F4F8',
  gold:         '#C89416',
  goldTint:     '#FDF7E6',
  platinum:     '#5D6CE0',
  platinumTint: '#EEF0FE',

  shadow:   '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
};

export const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

/**
 * Global CSS string — inject once via <style>{GLOBAL_CSS}</style>
 * in your root layout or in App.jsx.
 */
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.borderMd}; border-radius: 99px; }

  @keyframes mmLivePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.80)} }
  @keyframes mmHeroScan  { 0%{transform:translateX(-100%)} 100%{transform:translateX(500%)} }
  @keyframes mmFadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  @media (max-width: 1000px) {
    .mm-irs-grid      { grid-template-columns: 1fr !important; gap: 40px !important; }
    .mm-tiers-grid    { grid-template-columns: repeat(2, 1fr) !important; }
    .mm-features-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .mm-pricing-grid  { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 760px) {
    .mm-hero-inner    { gap: 36px !important; }
    .mm-tiers-grid    { grid-template-columns: 1fr !important; }
    .mm-dims-grid     { grid-template-columns: repeat(2, 1fr) !important; }
    .mm-features-grid { grid-template-columns: 1fr !important; }
    .mm-streak-box    { flex-direction: column !important; gap: 28px !important; }
    .mm-strip-right   { display: none !important; }
  }
  @media (max-width: 540px) {
    .mm-dims-grid  { grid-template-columns: 1fr !important; }
    .mm-badge-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
`;
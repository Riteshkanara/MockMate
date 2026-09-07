/**
 * MockMate Design Tokens — JS mirror
 * Single source of truth for all color/font/shadow tokens across the app.
 * Use ONLY where CSS variables can't reach: recharts, <canvas>, dynamic SVG fills.
 * Everywhere else, use Tailwind classes from token.css.
 * Keep in sync with token.css — same names, same values.
 */

export const C = {
  bg:            '#F0F4FF',
  bgDeep:        '#E8EEFF',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F8FAFF',
  surfaceGlass:  'rgba(255,255,255,0.82)',

  text:      '#0A1628',
  textSub:   '#3D5280',
  textMuted: '#7A8BAF',
  textFaint: '#A8B8D4',

  border:       '#DDE5F7',
  borderMd:     '#B8CAF0',
  borderStrong: '#7FA3E8',

  brand50:  '#EBF2FF',
  brand100: '#C7DAFF',
  brand200: '#9DBFFF',
  brand300: '#6FA5FF',
  brand400: '#4D8FFF',
  brand500: '#1A6EFF',
  brand600: '#0057E8',
  brand700: '#0044C4',
  brand900: '#001F6B',

  accentTint: '#E6F9FF',
  accent300:  '#5FE0FF',
  accent400:  '#00C8F0',
  accent500:  '#00ADE0',
  accent600:  '#0093C4',

  // Extended palette — ScoreCard, Interview, Analytics
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
  indigo:     '#4338CA',
  indigoTint: '#EEF2FF',
  teal:       '#0D9488',
  tealTint:   '#F0FDFA',

  success:     '#059669',
  successTint: '#ECFDF5',
  successGlow: 'rgba(5,150,105,0.18)',

  warning:     '#D97706',
  warningTint: '#FFFBEB',

  caution:     '#EA580C',
  cautionTint: '#FFF7ED',

  danger:     '#DC2626',
  dangerTint: '#FEF2F2',

  bronze:       '#B0703B',
  bronzeTint:   '#FBF1E7',
  silver:       '#7C8AA3',
  silverTint:   '#F2F4F8',
  gold:         '#C89416',
  goldTint:     '#FDF7E6',
  platinum:     '#5D6CE0',
  platinumTint: '#EEF0FE',
};

export const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

export const SHADOW = {
  sm: '0 1px 12px rgba(26,110,255,0.07)',
  md: '0 6px 28px rgba(26,110,255,0.12)',
  lg: '0 16px 56px rgba(0,31,107,0.18)',
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24 };

export const CHART_SERIES = [C.brand500, C.accent400, C.success, C.warning, C.platinum, C.danger];

// ─── Aliases ──────────────────────────────────────────────────────────────────
// Legacy names used across pages/components — all resolve to canonical values
// above so there is exactly one place to change any color in the whole app.
Object.assign(C, {
  // Surface aliases
  card:      C.surface,
  cardAlt:   C.surfaceAlt,
  bgSubtle:  C.surfaceAlt,
  bgSection: C.bg,

  // Text aliases
  sub:   C.textSub,
  muted: C.textMuted,
  faint: C.textFaint,

  // Border aliases
  borderStr: C.borderStrong,  // shorthand used by several pages

  // Brand blue aliases (legacy "blue" naming)
  blue50:  C.brand50,  blue100: C.brand100, blue200: C.brand200,
  blue300: C.brand300, blue400: C.brand400, blue500: C.brand500,
  blue600: C.brand600, blue700: C.brand700, blue800: '#002E96', blue900: C.brand900,

  // Accent cyan aliases
  cyan300: C.accent300, cyan400: C.accent400, cyan500: C.accent500, cyan600: C.accent600,
  cyanTint: C.accentTint,

  // Semantic color aliases
  green:  C.success,
  amber:  C.warning,
  orange: C.caution,
  red:    C.danger,

  greenTint:  C.successTint,
  greenGlow:  C.successGlow,
  amberTint:  C.warningTint,
  orangeTint: C.cautionTint,
  redTint:    C.dangerTint,

  // Shadow shortcuts (string form, for inline styles)
  shadow:   '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
});
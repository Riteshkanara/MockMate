import PropTypes from 'prop-types';
import { useEffect, useId, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { C, F as TOKENS_F } from '../../styles/token';

// WHY: Same font injection as before so the card renders outside Result.jsx too.
// Plus Jakarta Sans now matches the rest of the app (token.js display font).
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap';
if (typeof document !== 'undefined' && !document.getElementById('mm9-fonts')) {
  const link = document.createElement('link');
  link.id = 'mm9-fonts';
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

// `serif` is a legacy key (other files import F from here) — it now points at the display face.
export const F = {
  serif:   TOKENS_F.display,
  display: TOKENS_F.display,
  body:    TOKENS_F.body,
  mono:    TOKENS_F.mono,
};

export const CARD_W = 420;
const COMPACT_MIN_H = 525; // 4:5 feed post at 420 wide — grows if content is taller, never crops
const STORY_MIN_H = 746; // 9:16 at 420 wide — grows if content is taller, never crops
export const MIN_CANDIDATES_FOR_PERCENT = 10; // "Top 1%" of 3 people is not a flex, it's misleading

export const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
export const round = (v) => Math.round(Number(v) || 0);

// ─── Level themes — one per package tier. The base is always the app's light blue;
// each level swaps the accent ribbon, ring, glow and the warm/cool tint of the backdrop.
// Mirrored in server/services/ogImage.js — change both together.
const THEMES = [
  { match: '₹3',  level: 'ROOKIE',     icon: '🥉', accent: '#F26A21', accent2: '#FFA63D', tint: '#FFF1E5', glow: 'rgba(242,106,33,0.26)',  bg: ['#F6F9FF', '#E8F0FF', '#FFE6D2'] },
  { match: '₹6',  level: 'CHALLENGER', icon: '🥈', accent: '#1A6EFF', accent2: '#00C2F0', tint: '#E6F0FF', glow: 'rgba(26,110,255,0.26)',  bg: ['#F4F9FF', '#DDEBFF', '#C6EFFF'] },
  { match: '₹12', level: 'ELITE',      icon: '🥇', accent: '#E39A00', accent2: '#FF6B2C', tint: '#FFF6DD', glow: 'rgba(240,160,0,0.28)',   bg: ['#F6F9FF', '#E8F0FF', '#FFEFBF'] },
  { match: '₹20', level: 'LEGEND',     icon: '💎', accent: '#6D4DFF', accent2: '#00B8E6', tint: '#EFEAFF', glow: 'rgba(109,77,255,0.28)',  bg: ['#F5F5FF', '#E4E2FF', '#CBF0FF'] },
];
export const themeFor = (tier) => THEMES.find((t) => tier?.label?.startsWith(t.match)) || THEMES[1];

const DEFAULT_DIMENSIONS = [
  { key: 'technical',      label: 'Technical Depth', score: 0, hasData: false },
  { key: 'problemSolving', label: 'Problem Solving', score: 0, hasData: false },
  { key: 'communication',  label: 'Communication',   score: 0, hasData: false },
  { key: 'behavioral',     label: 'Behavioral',      score: 0, hasData: false },
  { key: 'design',         label: 'System Design',   score: 0, hasData: false },
  { key: 'fundamentals',   label: 'CS Fundamentals', score: 0, hasData: false },
];

// One colour per dimension so the radar reads like a colourful constellation.
const DIM_COLORS = ['#1A6EFF', '#00B4E6', '#6D5BEE', '#0D9488', '#F59E0B', '#EC5B8E'];

const shortLabel = (label) =>
  label === 'Technical Depth' ? 'Technical'
  : label === 'Problem Solving' ? 'Problem'
  : label === 'Communication' ? 'Comm.'
  : label === 'CS Fundamentals' ? 'CS Core'
  : label === 'System Design' ? 'Design'
  : label;

const ARCHETYPE_ICON = {
  inconsistentGenius: '✦', consistentClimber: '↗', speedRunner: '⚡', deepThinker: '◈', pressureCooker: '◆',
};

const SOFT_SHADOW = '0 4px 18px rgba(26,110,255,0.09)';

export const GlobalStyles = () => (
  <style>{`
    @keyframes mm9-rise   { from { opacity:0; transform:translateY(10px);} to {opacity:1; transform:translateY(0);} }
    @keyframes mm9-sheen  { 0% { transform: translateX(-130%) skewX(-18deg);} 60%,100% { transform: translateX(330%) skewX(-18deg);} }
    @keyframes mm9-flame  { 0%,100% { transform: scale(1) rotate(-2deg);} 50% { transform: scale(1.12) rotate(3deg);} }
    @keyframes mm9-pop    { 0% { transform: scale(.6); opacity:0;} 70% { transform: scale(1.08);} 100% { transform: scale(1); opacity:1;} }
    @keyframes mm9-twinkle{ 0%,100% { transform: scale(1) rotate(0deg); opacity:.95;} 50% { transform: scale(.7) rotate(25deg); opacity:.55;} }
    .mm9-rise  { animation: mm9-rise .55s cubic-bezier(.16,1,.3,1) both; }
    .mm9-sheen { animation: mm9-sheen 4.6s ease-in-out 1.2s infinite; }
    .mm9-flame { display:inline-block; animation: mm9-flame 1.4s ease-in-out infinite; }
    .mm9-pop   { animation: mm9-pop .5s cubic-bezier(.16,1,.3,1) both; }
    .mm9-twinkle { animation: mm9-twinkle 3.2s ease-in-out infinite; }
    .mm9-still * { animation: none !important; transition: none !important; }
    @media (prefers-reduced-motion: reduce) {
      .mm9-rise,.mm9-sheen,.mm9-flame,.mm9-pop,.mm9-twinkle { animation: none !important; }
    }
  `}</style>
);

const CountUp = ({ value, duration = 1.0, still, style, prefix = '', suffix = '' }) => {
  const reduced = useReducedMotion();
  const target = round(value);
  const [disp, setDisp] = useState(still ? target : 0);
  useEffect(() => {
    if (reduced || still) { setDisp(target); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      setDisp(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced, still]);
  return <span style={style}>{prefix}{disp}{suffix}</span>;
};
CountUp.propTypes = {
  value: PropTypes.number.isRequired, duration: PropTypes.number, still: PropTypes.bool,
  style: PropTypes.object, prefix: PropTypes.string, suffix: PropTypes.string,
};

// ─── Tiny inline icons (plain SVG so they survive the PNG export) ────────────
const Ico = ({ size = 14, color = 'currentColor', fill = 'none', sw = 1.8, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    {children}
  </svg>
);
Ico.propTypes = { size: PropTypes.number, color: PropTypes.string, fill: PropTypes.string, sw: PropTypes.number, children: PropTypes.node };

const IconGlobe = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" /></Ico>;
const IconCap = (p) => <Ico {...p}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" /></Ico>;
const IconPin = (p) => <Ico {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></Ico>;
const IconShield = (p) => <Ico {...p}><path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6z" /><path d="M8.7 12l2.4 2.4L15.6 9.8" /></Ico>;
const IconBolt = (p) => <Ico {...p} fill={p.color || 'currentColor'} sw={1}><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" /></Ico>;
const IconTarget = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" fill={p.color || 'currentColor'} /></Ico>;

const Sparkle = ({ size, color, style, twinkle }) => (
  <svg className={twinkle ? 'mm9-twinkle' : undefined} width={size} height={size} viewBox="-10 -10 20 20" style={{ position: 'absolute', pointerEvents: 'none', ...style }}>
    <path d="M0 -9 C1 -2.5 2.5 -1 9 0 C2.5 1 1 2.5 0 9 C-1 2.5 -2.5 1 -9 0 C-2.5 -1 -1 -2.5 0 -9Z" fill={color} />
  </svg>
);
Sparkle.propTypes = { size: PropTypes.number.isRequired, color: PropTypes.string.isRequired, style: PropTypes.object, twinkle: PropTypes.bool };

// ─── IRS ring ────────────────────────────────────────────────────────────────
const ScoreRing = ({ score, theme, still }) => {
  const gid = `mm9ring${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const size = 138, stroke = 11, r = (size - stroke) / 2 - 4, circ = 2 * Math.PI * r;
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 80); return () => clearTimeout(t); }, []);
  const filled = (still || on) ? clamp(score) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.accent} />
            <stop offset="100%" stopColor={theme.accent2} />
          </linearGradient>
        </defs>
        {/* decorative dashed halo */}
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 1.5} fill="none" stroke={C.brand100} strokeWidth="1.2" strokeDasharray="2 5" strokeLinecap="round" />
        {/* white dial */}
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 + 1} fill="#FFFFFF" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4EDFC" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - filled / 100)}
            style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.16,1,.3,1)' }}
          />
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <CountUp value={score} still={still} style={{ fontFamily: F.display, fontSize: 46, fontWeight: 900, color: C.text, lineHeight: 1, letterSpacing: '-2px' }} />
        <span style={{ marginTop: 4, fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '1.4px', color: theme.accent }}>READINESS</span>
        <span style={{ marginTop: 1, fontFamily: F.mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.6px', color: C.textMuted }}>OUT OF 100</span>
      </div>
    </div>
  );
};
ScoreRing.propTypes = { score: PropTypes.number.isRequired, theme: PropTypes.object.isRequired, still: PropTypes.bool };

// ─── Skill radar ─────────────────────────────────────────────────────────────
const Radar = ({ dims, theme }) => {
  const gid = `mm9radar${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const W = 330, H = 254, cx = W / 2, cy = 125, R = 74, n = dims.length;
  const pt = (i, v, rad = R) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    const k = (rad * v) / 100;
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
  };
  const poly = (vals) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  const scores = dims.map((d) => (d.hasData ? Math.max(8, clamp(d.score)) : 4));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={theme.accent2} stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <polygon points={poly(dims.map(() => 100))} fill="#F3F8FF" stroke="#CFE0FA" strokeWidth="1" />
      {[75, 50, 25].map((lv) => (
        <polygon key={lv} points={poly(dims.map(() => lv))} fill="none" stroke="#DCE8FB" strokeWidth="1" />
      ))}
      {dims.map((d, i) => { const [x, y] = pt(i, 100); return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#DCE8FB" strokeWidth="1" />; })}
      <polygon points={poly(scores)} fill={`url(#${gid})`} stroke={theme.accent} strokeWidth="2.2" strokeLinejoin="round" />
      {dims.map((d, i) => {
        const [x, y] = pt(i, scores[i]);
        const [lx, ly] = pt(i, 100, R + 27);
        const anchor = lx < cx - 8 ? 'end' : lx > cx + 8 ? 'start' : 'middle';
        const col = DIM_COLORS[i % DIM_COLORS.length];
        return (
          <g key={d.key}>
            {d.hasData && <circle cx={x} cy={y} r="4.4" fill={col} stroke="#fff" strokeWidth="2" />}
            <text x={lx} y={ly - 2} textAnchor={anchor} fontFamily={F.body} fontSize="10.5" fontWeight="700" fill={C.textSub}>{shortLabel(d.label)}</text>
            <text x={lx} y={ly + 12} textAnchor={anchor} fontFamily={F.display} fontSize="13" fontWeight="800" fill={d.hasData ? col : C.textFaint}>{d.hasData ? round(d.score) : '–'}</text>
          </g>
        );
      })}
    </svg>
  );
};
Radar.propTypes = { dims: PropTypes.array.isRequired, theme: PropTypes.object.isRequired };

const Sparkline = ({ trend, theme }) => {
  const gid = `mm9spark${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pts = (trend || []).slice(-10).map((s) => clamp(s.score));
  if (pts.length < 2) return null;
  const W = 124, H = 38;
  const min = Math.min(...pts), max = Math.max(...pts, min + 1);
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * (W - 10) + 5, H - 6 - ((v - min) / (max - min)) * (H - 14)]);
  const last = xy[xy.length - 1];
  const line = xy.map((p) => p.join(',')).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.30" />
          <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${xy[0][0]},${H} ${line} ${last[0]},${H}`} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={theme.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.6" fill="#fff" stroke={theme.accent} strokeWidth="2.2" />
    </svg>
  );
};
Sparkline.propTypes = { trend: PropTypes.array, theme: PropTypes.object.isRequired };

const RANK_STYLES = {
  all: { color: C.brand500, tint: C.brand50,    Icon: IconGlobe },
  col: { color: C.violet,   tint: C.violetTint, Icon: IconCap },
  st:  { color: C.teal,     tint: C.tealTint,   Icon: IconPin },
};

const RankTile = ({ kind, label, rank, total }) => {
  const s = RANK_STYLES[kind] || RANK_STYLES.all;
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '10px 11px 11px', borderRadius: 16, background: '#fff', border: `1px solid ${s.color}30`, boxShadow: SOFT_SHADOW, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 3, background: s.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 22, height: 22, borderRadius: 8, background: s.tint, color: s.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <s.Icon size={13} color={s.color} />
        </span>
        <span style={{ minWidth: 0, fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.7px', color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: rank === 1 ? s.color : C.text, lineHeight: 1, letterSpacing: '-0.8px' }}>#{rank}</span>
        <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, color: C.textMuted }}>of {total}</span>
      </div>
    </div>
  );
};
RankTile.propTypes = { kind: PropTypes.string, label: PropTypes.string.isRequired, rank: PropTypes.number.isRequired, total: PropTypes.number.isRequired };

const STAT_STYLES = {
  streak:   { bg: '#FFF3E8', border: '#FFD9B8', color: '#EA580C' },
  best:     { bg: '#FFF8DB', border: '#F7E39A', color: '#B7791F' },
  sessions: { bg: C.brand50, border: C.brand100, color: C.brand600 },
  badges:   { bg: C.violetTint, border: '#D9D3FF', color: C.violet },
};
const Stat = ({ kind, icon, value, label, flame }) => {
  const s = STAT_STYLES[kind];
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '10px 4px 9px', borderRadius: 14, background: s.bg, border: `1px solid ${s.border}` }}>
      <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: '-0.4px', whiteSpace: 'nowrap' }}>
        {flame ? <span className="mm9-flame">{icon}</span> : icon} {value}
      </div>
      <div style={{ marginTop: 5, fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.8px', color: C.textSub }}>{label}</div>
    </div>
  );
};
Stat.propTypes = { kind: PropTypes.string.isRequired, icon: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, label: PropTypes.string.isRequired, flame: PropTypes.bool };

const panelBase = { borderRadius: 20, background: '#fff', border: `1px solid ${C.border}`, boxShadow: SOFT_SHADOW };

// ─── The card itself (this exact node is what gets exported as an image) ─────
export const PlayerCard = ({ profile, user, theme, story, compact, still, shareUrl }) => {
  const {
    name, college, totalInterviews, nextTier, archetype, heroBadge, dimensionProfile, scoreTrend,
    rank, totalCandidates, beatCount, collegeRank, collegeTotal, stateName, stateRank, stateTotal,
    streak, badgesUnlocked, badgesTotal, bestScore,
  } = profile;

  const dims = dimensionProfile?.length ? dimensionProfile : DEFAULT_DIMENSIONS;
  const irs = round(profile.irs ?? profile.averageScore ?? 0);
  const displayName = name || user?.name || 'Candidate';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'M';
  const showPercent = profile.topPercent != null && totalCandidates >= MIN_CANDIDATES_FOR_PERCENT;
  const topPct = showPercent ? profile.topPercent : null;
  const active = dims.filter((d) => d.hasData);
  const strongest = profile.strongestDim || [...active].sort((a, b) => b.score - a.score)[0] || null;
  const weakest = profile.weakestDim || [...active].sort((a, b) => a.score - b.score)[0] || null;
  const tiles = [
    rank != null && totalCandidates > 0 && { key: 'all', label: 'OVERALL', rank, total: totalCandidates },
    collegeRank != null && collegeTotal > 0 && { key: 'col', label: (college || 'COLLEGE').toUpperCase(), rank: collegeRank, total: collegeTotal },
    stateRank != null && stateTotal > 0 && { key: 'st', label: (stateName || 'STATE').toUpperCase(), rank: stateRank, total: stateTotal },
  ].filter(Boolean);
  const rarity = !showPercent ? null
    : topPct <= 1 ? { label: 'LEGENDARY', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' }
    : topPct <= 5 ? { label: 'EPIC', color: '#A21CAF', bg: '#FAE8FF', border: '#F0ABFC' }
    : topPct <= 20 ? { label: 'RARE', color: '#0369A1', bg: '#E0F2FE', border: '#7DD3FC' }
    : null;
  const trendScores = (scoreTrend || []).map((t) => clamp(t.score));
  const delta = trendScores.length >= 2 ? Math.round(trendScores[trendScores.length - 1] - trendScores[trendScores.length - 2]) : null;
  const cleanUrl = (shareUrl || 'mockmate.app').replace(/^https?:\/\//, '');
  const showSpark = scoreTrend?.length >= 2;
  const sparkCount = Math.min(10, scoreTrend?.length || 0);
  const gap = story ? 16 : compact ? 9 : 12;
  const heroLen = showPercent ? `Top ${topPct}%`.length : (rank != null ? `#${rank}`.length : `${irs}`.length);
  const heroSize = heroLen <= 4 ? 52 : heroLen <= 6 ? 44 : heroLen === 7 ? 38 : 32; // never wraps, whatever the font

  return (
    <div
      className={still ? 'mm9-still' : ''}
      style={{
        position: 'relative', overflow: 'hidden', width: CARD_W, borderRadius: 28,
        minHeight: story ? STORY_MIN_H : compact ? COMPACT_MIN_H : undefined,
        display: 'flex', flexDirection: 'column',
        background: `linear-gradient(165deg, ${theme.bg[0]} 0%, ${theme.bg[1]} 52%, ${theme.bg[2]} 100%)`,
        border: `1px solid ${C.brand100}`, boxShadow: `0 24px 64px ${theme.glow}`,
        fontFamily: F.body, color: C.text,
      }}
    >
      {/* atmosphere: colour blobs + dot grid + sparkles + sheen */}
      <div style={{ position: 'absolute', top: -120, right: -100, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,240,0.34), rgba(0,200,240,0) 66%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 260, left: -140, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,91,238,0.20), rgba(109,91,238,0) 66%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 40, right: -120, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent2}33, ${theme.accent2}00 66%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(26,110,255,0.16) 1px, transparent 1px)', backgroundSize: '17px 17px', opacity: 0.5, pointerEvents: 'none' }} />
      <Sparkle size={16} color={C.accent400} twinkle style={{ top: 66, right: 112 }} />
      <Sparkle size={11} color={C.violet} twinkle style={{ top: 30, right: 150 }} />
      <Sparkle size={13} color={theme.accent2} twinkle style={{ top: 150, left: 14 }} />
      <Sparkle size={10} color={C.brand400} twinkle style={{ top: 410, right: 12 }} />
      {!still && <div className="mm9-sheen" style={{ position: 'absolute', top: 0, bottom: 0, width: 80, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.65), rgba(255,255,255,0))', pointerEvents: 'none' }} />}

      <div style={{ position: 'relative', padding: '18px 18px 0', display: 'flex', flexDirection: 'column', flex: 1, gap }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: `linear-gradient(135deg, ${C.brand600}, ${C.accent400})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: 16, fontWeight: 900, boxShadow: '0 6px 14px rgba(0,87,232,0.30)' }}>M</div>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: '-0.3px' }}>Mock<span style={{ color: C.brand500 }}>Mate</span></div>
              <div style={{ marginTop: 3, fontFamily: F.mono, fontSize: 8, fontWeight: 700, letterSpacing: '1.6px', color: C.textMuted }}>PLAYER CARD</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`, color: '#fff', fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', boxShadow: `0 6px 16px ${theme.glow}` }}>
            <span style={{ fontSize: 12 }}>{theme.icon}</span> {theme.level}
          </div>
        </div>

        {/* hero panel: identity + ring + brag line */}
        <div style={{ ...panelBase, borderRadius: 24, padding: '15px 16px 16px', boxShadow: `0 10px 30px ${theme.glow}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 13, borderBottom: `1px dashed ${C.brand100}` }}>
            <div style={{ width: 46, height: 46, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff', fontFamily: F.display, fontSize: 22, fontWeight: 900, boxShadow: `0 6px 14px ${theme.glow}` }}>
              {initial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.15, letterSpacing: '-0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ marginTop: 3, fontSize: 11.5, color: C.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[college, stateName].filter(Boolean).join(' · ') || 'MockMate candidate'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            <ScoreRing score={irs} theme={theme} still={still} />
            <div style={{ minWidth: 0, flex: 1 }}>
              {showPercent ? (
                <>
                  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '1.4px', color: C.textMuted }}>YOU&apos;RE IN THE</div>
                  <div style={{ marginTop: 2, fontFamily: F.display, fontSize: heroSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2px', color: theme.accent, paddingBottom: 3, whiteSpace: 'nowrap' }}>
                    Top {topPct}%
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '1.4px', color: C.textMuted }}>CURRENT RANK</div>
                  <div style={{ marginTop: 2, fontFamily: F.display, fontSize: heroSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2px', color: theme.accent, paddingBottom: 3, whiteSpace: 'nowrap' }}>
                    {rank != null ? `#${rank}` : `${irs}`}
                  </div>
                  {rank != null && totalCandidates > 0 && (
                    <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: C.textMuted }}>of {totalCandidates} candidates</div>
                  )}
                </>
              )}
              <div style={{ height: 4, width: 54, borderRadius: 999, marginTop: 4, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }} />
              {(rarity || delta) ? (
                <div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {rarity && (
                    <span className="mm9-pop" style={{ padding: '3px 9px', borderRadius: 999, fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '1px', color: rarity.color, background: rarity.bg, border: `1px solid ${rarity.border}` }}>
                      ◆ {rarity.label}
                    </span>
                  )}
                  {delta ? (
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: delta > 0 ? C.success : C.danger, background: delta > 0 ? C.successTint : C.dangerTint, border: `1px solid ${delta > 0 ? '#A7F3D0' : '#FECACA'}` }}>
                      {delta > 0 ? '▲ +' : '▼ '}{delta} vs last
                    </span>
                  ) : null}
                </div>
              ) : null}
              {beatCount > 0 ? (
                <div style={{ marginTop: 8, fontSize: 12, color: C.textSub, lineHeight: 1.4 }}>
                  Outscored <strong style={{ color: C.text }}>{beatCount}</strong> {beatCount === 1 ? 'candidate' : 'candidates'} on MockMate
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: C.textSub }}>Just getting started — the climb begins.</div>
              )}
            </div>
          </div>
        </div>

        {/* rank tiles (real data only) */}
        {tiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {tiles.map((t) => <RankTile key={t.key} kind={t.key} label={t.label} rank={t.rank} total={t.total} />)}
          </div>
        )}

        {/* radar + callouts (full card only) */}
        {!compact && (
        <div style={{ ...panelBase, padding: '12px 10px 12px' }}>
          <div style={{ padding: '0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '1.3px', color: C.brand600 }}>SKILL FINGERPRINT</span>
            <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.6px', color: C.textMuted }}>{active.length}/{dims.length} MEASURED</span>
          </div>
          <Radar dims={dims} theme={theme} />
          <div style={{ display: 'flex', gap: 8, padding: '0 6px' }}>
            {strongest && (
              <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 13, background: C.successTint, border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconBolt size={13} color={C.success} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.8px', color: C.success }}>SUPERPOWER</div>
                  <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{strongest.label}</div>
                </div>
              </div>
            )}
            {weakest && weakest.key !== strongest?.key && (
              <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 13, background: theme.tint, border: `1px solid ${theme.accent}40`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconTarget size={13} color={theme.accent} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.8px', color: theme.accent }}>NEXT QUEST</div>
                  <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{weakest.label}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
        {/* compact: just the two callouts */}
        {compact && (
          <div style={{ display: 'flex', gap: 8, padding: 0 }}>
            {strongest && (
              <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 13, background: C.successTint, border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconBolt size={13} color={C.success} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.8px', color: C.success }}>SUPERPOWER</div>
                  <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{strongest.label}</div>
                </div>
              </div>
            )}
            {weakest && weakest.key !== strongest?.key && (
              <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 13, background: theme.tint, border: `1px solid ${theme.accent}40`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconTarget size={13} color={theme.accent} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.8px', color: theme.accent }}>NEXT QUEST</div>
                  <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{weakest.label}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* archetype + momentum */}
        {!compact && (archetype || showSpark) && (
          <div style={{ ...panelBase, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px' }}>
            {archetype && (
              <span style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.violet}, ${C.brand500})`, color: '#fff', fontSize: 18, fontWeight: 700, boxShadow: '0 6px 14px rgba(109,91,238,0.30)' }}>
                {ARCHETYPE_ICON[archetype.id] || '◆'}
              </span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '1px', color: C.textMuted }}>{archetype ? 'INTERVIEW CLASS' : 'MOMENTUM'}</div>
              <div style={{ marginTop: 2, fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{archetype ? archetype.label : 'Score trend'}</div>
            </div>
            {showSpark && (
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <Sparkline trend={scoreTrend} theme={theme} />
                <div style={{ marginTop: 1, fontFamily: F.mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.7px', color: C.textMuted }}>LAST {sparkCount} SESSIONS</div>
              </div>
            )}
          </div>
        )}

        {/* stats strip */}
        {!compact && <div style={{ display: 'flex', gap: 7 }}>
          {streak?.current > 0 && <Stat kind="streak" icon="🔥" flame value={`${streak.current}d`} label="STREAK" />}
          <Stat kind="best" icon="★" value={round(bestScore)} label="BEST" />
          <Stat kind="sessions" icon="◎" value={totalInterviews} label="SESSIONS" />
          {badgesTotal > 0 && <Stat kind="badges" icon="🏅" value={`${badgesUnlocked}/${badgesTotal}`} label="BADGES" />}
        </div>}

        {/* next level progress */}
        {!compact && (nextTier ? (
          <div style={{ ...panelBase, padding: '11px 14px 13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.9px', color: C.textSub }}>NEXT LEVEL · <span style={{ color: C.text }}>{nextTier.label}</span></span>
              <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: theme.accent }}>{clamp(nextTier.readinessPct)}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: '#E4EDFC', overflow: 'hidden' }}>
              <div style={{ width: `${clamp(nextTier.readinessPct)}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }} />
            </div>
          </div>
        ) : (
          <div style={{ ...panelBase, textAlign: 'center', padding: '11px 14px', fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', color: theme.accent, background: theme.tint }}>★ MAX LEVEL REACHED ★</div>
        ))}

        {!compact && heroBadge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 16, background: 'rgba(255,255,255,0.75)', border: `1px solid ${C.brand100}`, fontSize: 11.5, color: C.textSub, lineHeight: 1.35 }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0, boxShadow: SOFT_SHADOW }}>{heroBadge.icon}</span>
            <span><strong style={{ color: C.text }}>{heroBadge.label}</strong> — {heroBadge.desc}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
      </div>

      {/* challenge footer */}
      <div style={{ position: 'relative', overflow: 'hidden', marginTop: compact ? 8 : 16, padding: '15px 18px 16px', background: `linear-gradient(100deg, ${C.brand700} 0%, ${C.brand500} 55%, ${C.accent400} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.13)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 70, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>Think you can beat {irs}?</div>
          <div style={{ marginTop: 6, display: 'inline-block', maxWidth: 230, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.40)', fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: '#fff', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' }}>{cleanUrl}</div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <IconShield size={22} color="#fff" />
          <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.9px', color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>VERIFIED<br />SESSION DATA</div>
        </div>
      </div>
    </div>
  );
};
PlayerCard.propTypes = {
  profile: PropTypes.object.isRequired, user: PropTypes.object, theme: PropTypes.object.isRequired,
  story: PropTypes.bool, compact: PropTypes.bool, still: PropTypes.bool, shareUrl: PropTypes.string,
};

// Caption that goes next to the shared image. `opts.bold` adds WhatsApp-style *bold*
// (leave it off for X / LinkedIn / the native share sheet so no stray asterisks show).
export const buildShareText = (profile, theme, url, opts = {}) => {
  const b = (s) => (opts.bold ? `*${s}*` : s);
  const irs = round(profile.irs ?? profile.averageScore ?? 0);
  const showPercent = profile.topPercent != null && profile.totalCandidates >= MIN_CANDIDATES_FOR_PERCENT;
  const lines = [
    `${theme.icon} ${b(`I just hit ${theme.level} level on MockMate!`)}`,
    `📊 Interview Readiness: ${b(`${irs}/100`)}`,
    showPercent ? `🏆 ${b(`Top ${profile.topPercent}%`)} of ${profile.totalCandidates} candidates` : (profile.rank ? `🏆 Ranked ${b(`#${profile.rank}`)} of ${profile.totalCandidates}` : null),
    profile.collegeRank && profile.college ? `🏫 #${profile.collegeRank} at ${profile.college}` : null,
    profile.stateRank && profile.stateName ? `📍 #${profile.stateRank} in ${profile.stateName}` : null,
    profile.streak?.current > 0 ? `🔥 ${profile.streak.current}-day streak` : null,
    '',
    `⚔️ Think you can beat ${irs}? Take the free AI mock interview 👇`,
    url,
  ];
  return lines.filter((l) => l !== null).join('\n');
};


export default PlayerCard;

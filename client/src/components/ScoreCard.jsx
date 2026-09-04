/**
 * MockMate — Interview Readiness Report Card  v7
 * ─────────────────────────────────────────────
 * Drop-in replacement for the old ScoreCard.jsx.
 * Zero new dependencies beyond what was already in the project:
 *   framer-motion, html-to-image (toPng), react-hot-toast, useAuth
 *
 * Google Fonts (Space Grotesk + Inter) are loaded via a <link> injected
 * once into <head> — no CSS import needed.
 *
 * Props (all optional — card degrades gracefully):
 *   totalScore        number        Raw session score (0-100)
 *   questions         array         Questions answered this session
 *   previousScore     number|null   Previous session score for delta
 *   irs               number|null   Cross-session Interview Readiness Score
 *   tier              object|null   { label, minIRS, color }
 *   tiers             array         Full tier list (DEFAULT_TIERS used if omitted)
 *   archetype         object|null   { id, label }
 *   dimensionProfile  array|null    Six-axis dim objects from scoringModel
 *   scoreTrend        array|null    [{ interview, score }, …]
 *   totalInterviews   number|null
 *   strongestDim      object|null
 *   weakestDim        object|null
 *   badges            array|null
 *   percentile        number|null   0-100 — "better than X% of users"
 *                                   If null, derived heuristically from IRS
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  motion,
  MotionConfig,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from 'framer-motion';
import { toPng } from 'html-to-image';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { getMyProfile } from '../Services/profileServices';

// ─── Font injection (runs once) ──────────────────────────────────────────────
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap';
if (typeof document !== 'undefined' && !document.getElementById('mm7-fonts')) {
  const link = document.createElement('link');
  link.id = 'mm7-fonts';
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  // Void blacks — true optical black so glass depth reads properly
  void:   '#05060F',
  void2:  '#080B1A',
  void3:  '#0C1028',

  // Aurora accent palette
  indigo: '#6C52FF',
  violet: '#A855F7',
  cyan:   '#06B6D4',
  teal:   '#10B981',
  gold:   '#F59E0B',
  rose:   '#F43F5E',

  // Glass surfaces
  glassW:  'rgba(255,255,255,0.06)',
  glassB:  'rgba(255,255,255,0.10)',
  glassS:  'rgba(255,255,255,0.14)',
  border:  'rgba(255,255,255,0.11)',
  borderG: 'rgba(108,82,255,0.40)',

  // Typography
  hi:   '#FFFFFF',
  mid:  'rgba(255,255,255,0.65)',
  lo:   'rgba(255,255,255,0.38)',
  mute: 'rgba(255,255,255,0.22)',

  // Semantic
  good: '#34D399',
  warn: '#FBBF24',
  bad:  '#FB7185',
};

const FONT_HEAD = "'Space Grotesk', sans-serif";
const FONT_BODY = "'Inter', sans-serif";

const HOLO = `linear-gradient(135deg, ${T.indigo} 0%, ${T.violet} 40%, ${T.cyan} 80%, ${T.teal} 100%)`;
const HOLO_VIVID = `linear-gradient(135deg, ${T.indigo} 0%, ${T.violet} 35%, ${T.cyan} 65%, ${T.teal} 100%)`;

const PANEL_H = 500; // px — fixed height per panel for share capture

// ─── Static defaults ──────────────────────────────────────────────────────────
const DEFAULT_TIERS = [
  { label: '₹3–6 LPA',   minIRS: 0,  color: '#94A3B8' },
  { label: '₹6–12 LPA',  minIRS: 38, color: '#F59E0B' },
  { label: '₹12–20 LPA', minIRS: 60, color: '#06B6D4' },
  { label: '₹20 LPA+',   minIRS: 80, color: '#A855F7' },
];

const DEFAULT_DIMENSIONS = [
  { key: 'technical',      label: 'Technical Depth',  icon: '⚙️',  score: 0, hasData: false },
  { key: 'problemSolving', label: 'Problem Solving',  icon: '🔍', score: 0, hasData: false },
  { key: 'communication',  label: 'Communication',    icon: '💬', score: 0, hasData: false },
  { key: 'behavioral',     label: 'Behavioral',       icon: '🤝', score: 0, hasData: false },
  { key: 'design',         label: 'System Design',    icon: '🏗️',  score: 0, hasData: false },
  { key: 'fundamentals',   label: 'CS Fundamentals',  icon: '📚', score: 0, hasData: false },
];

const DEFAULT_BADGES = [
  { id: 'first_rep',    label: 'First Rep',    icon: '🎬', desc: 'Completed your first mock.',       unlocked: true,  progress: 1    },
  { id: 'iron_streak',  label: 'Iron Streak',  icon: '🔥', desc: '14-day practice streak.',          unlocked: false, progress: 0.40 },
  { id: 'full_marks',   label: 'Full Marks',   icon: '💯', desc: 'Scored a perfect 100.',            unlocked: false, progress: 0.35 },
  { id: 'elite_pass',   label: 'Elite Pass',   icon: '🏆', desc: 'Hit a 90+ session score.',         unlocked: false, progress: 0.72 },
];

const DIM_COLORS = {
  technical:      T.indigo,
  problemSolving: T.violet,
  communication:  T.cyan,
  behavioral:     T.teal,
  design:         T.gold,
  fundamentals:   T.rose,
};

const ARCHETYPE_LINE = {
  inconsistentGenius: 'Brilliant on your best day — repeat it.',
  consistentClimber:  'Steady upward trend. Compounding beats spikes.',
  speedRunner:        'Fast under pressure. Depth is the next unlock.',
  deepThinker:        'Thorough and deliberate. Speed follows reps.',
  pressureCooker:     'Handles tough rounds. Consistency is the frontier.',
};

// ─── Utility helpers ─────────────────────────────────────────────────────────
const clamp  = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const round  = (v) => Math.round(Number(v) || 0);

const resolveTier = (irs, tiers) => {
  const sorted = [...tiers].sort((a, b) => a.minIRS - b.minIRS);
  return sorted.filter((t) => irs >= t.minIRS).at(-1) || sorted[0];
};

const nextTier = (irs, tiers) => {
  const sorted = [...tiers].sort((a, b) => a.minIRS - b.minIRS);
  return sorted.find((t) => t.minIRS > irs) || null;
};

/**
 * Heuristic percentile from IRS when server doesn't send one.
 * Loosely modelled on a beta distribution skewed toward lower scores —
 * most candidates cluster 30-55, top 10% are 70+.
 */
const irsToPercentile = (irs) => {
  if (irs >= 90) return 98;
  if (irs >= 80) return Math.round(90 + (irs - 80) * 0.8);
  if (irs >= 70) return Math.round(78 + (irs - 70) * 1.2);
  if (irs >= 60) return Math.round(60 + (irs - 60) * 1.8);
  if (irs >= 50) return Math.round(40 + (irs - 50) * 2.0);
  if (irs >= 38) return Math.round(20 + (irs - 38) * 1.7);
  return Math.round(Math.max(1, irs * 0.4));
};

const dimColor  = (d) => DIM_COLORS[d.key] || T.indigo;
const scoreCol  = (s) => (s >= 70 ? T.good : s >= 45 ? T.warn : T.bad);

// ─── Global CSS ──────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes mm7-aurora   { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(20px,-15px) scale(1.06)} 66%{transform:translate(-12px,18px) scale(0.95)} }
    @keyframes mm7-ringpop  { from{stroke-dashoffset:var(--full)} to{stroke-dashoffset:var(--target)} }
    @keyframes mm7-countup  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
    @keyframes mm7-panel    { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
    @keyframes mm7-dna-pop  { from{transform:scaleY(0)} to{transform:scaleY(1)} }
    @keyframes mm7-pulsering{ 0%,100%{box-shadow:0 0 0 0 rgba(108,82,255,0)} 50%{box-shadow:0 0 0 6px rgba(108,82,255,0.18)} }

    .mm7-aurora-blob { animation: mm7-aurora 13s ease-in-out infinite; border-radius:50%; filter:blur(82px); }
    .mm7-panel-in    { animation: mm7-panel 0.28s cubic-bezier(0.16,1,0.3,1); }
    .mm7-dna-bar     { transform-origin:bottom; animation: mm7-dna-pop 0.6s cubic-bezier(0.16,1,0.3,1) both; }

    @media (prefers-reduced-motion:reduce) {
      .mm7-aurora-blob { animation:none !important; }
      .mm7-panel-in    { animation:none !important; }
      .mm7-dna-bar     { animation:none !important; }
    }
  `}</style>
);

// ─── Count-up number ─────────────────────────────────────────────────────────
const CountUp = ({ value, duration = 1.2, style, suffix = '' }) => {
  const reduced      = useReducedMotion();
  const motionVal    = useMotionValue(0);
  const rounded      = useTransform(motionVal, (v) => round(v));
  const [disp, setDisp] = useState(reduced ? round(value) : 0);

  useEffect(() => {
    if (reduced) { setDisp(round(value)); return; }
    const ctrl = animate(motionVal, value, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsub = rounded.on('change', setDisp);
    return () => { ctrl.stop(); unsub(); };
  }, [value, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span style={style}>{disp}{suffix}</span>;
};

// ─── Aurora background ───────────────────────────────────────────────────────
const Aurora = () => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
    {[
      { w:380, h:270, bg:T.indigo, top:'-70px', left:'-90px', delay:'0s',   opacity:0.22 },
      { w:310, h:310, bg:T.violet, top:'30%',   right:'-100px', delay:'-4s', opacity:0.18 },
      { w:260, h:200, bg:T.cyan,   bottom:'-50px', left:'18%',  delay:'-7s', opacity:0.16 },
      { w:200, h:200, bg:T.teal,   bottom:'8%',    right:'8%',  delay:'-2s', opacity:0.11 },
    ].map((b, i) => (
      <div
        key={i}
        className="mm7-aurora-blob"
        style={{
          position: 'absolute', width: b.w, height: b.h,
          background: b.bg, opacity: b.opacity,
          top: b.top, left: b.left, right: b.right, bottom: b.bottom,
          animationDelay: b.delay,
        }}
      />
    ))}
  </div>
);

// ─── Glass panel wrapper ─────────────────────────────────────────────────────
const Glass = ({ children, style, ...rest }) => (
  <div
    style={{
      background: T.glassW,
      border: `1px solid ${T.border}`,
      borderRadius: 18,
      padding: '14px 16px',
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

// ─── Section micro-label ─────────────────────────────────────────────────────
const Tag = ({ children }) => (
  <div style={{ fontFamily: FONT_HEAD, fontSize: 9.5, fontWeight: 600, color: T.lo, letterSpacing: '1.1px', marginBottom: 10 }}>
    {children}
  </div>
);

// ─── Radar chart (canvas, drawn via ref) ────────────────────────────────────
const RadarCanvas = ({ dims, size = 168 }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, maxR = size / 2 - 28;
    const n = dims.length;
    const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
    const pt    = (i, v) => {
      const r = (clamp(v) / 100) * maxR;
      const a = angle(i);
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };

    // Grid rings
    [25, 50, 75, 100].forEach((level) => {
      ctx.beginPath();
      dims.forEach((_, i) => { const [x, y] = pt(i, level); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Axes
    dims.forEach((_, i) => {
      const [x, y] = pt(i, 100);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
    });

    // Data fill
    const fillGrad = ctx.createLinearGradient(0, 0, size, size);
    fillGrad.addColorStop(0,   'rgba(108,82,255,0.50)');
    fillGrad.addColorStop(0.5, 'rgba(168,85,247,0.42)');
    fillGrad.addColorStop(1,   'rgba(6,182,212,0.38)');

    ctx.beginPath();
    dims.forEach((d, i) => {
      const [x, y] = pt(i, d.hasData ? d.score : 0);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.strokeStyle = T.indigo;
    ctx.lineWidth   = 2.2;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // Data dots
    dims.forEach((d, i) => {
      const [x, y] = pt(i, d.hasData ? d.score : 0);
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle   = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = T.cyan;
      ctx.lineWidth   = 1.8;
      ctx.stroke();
    });

    // Labels
    dims.forEach((d, i) => {
      const a  = angle(i);
      const lx = cx + (maxR + 20) * Math.cos(a);
      const ly = cy + (maxR + 20) * Math.sin(a);
      const short = d.key === 'problemSolving' ? 'Prob.' :
                    d.key === 'communication'  ? 'Comm.' :
                    d.key === 'fundamentals'   ? 'CS F.' :
                    d.label.split(' ')[0];
      ctx.fillStyle   = 'rgba(255,255,255,0.58)';
      ctx.font        = `700 7.5px Inter`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(short, lx, ly);
    });
  }, [dims, size]);

  return <canvas ref={ref} />;
};

// ─── Trend line chart (canvas) ───────────────────────────────────────────────
const TrendCanvas = ({ trend, height = 86 }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!trend || trend.length < 2) return;
    const canvas = ref.current;
    if (!canvas) return;
    const W   = canvas.parentElement?.offsetWidth || 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const scores = trend.map((s) => clamp(s.score ?? s));
    const n   = scores.length;
    const pad = { l: 22, r: 12, t: 10, b: 10 };
    const max = Math.max(...scores, 10);
    const min = Math.min(...scores, 0);
    const rng = Math.max(max - min, 1);
    const xFor = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
    const yFor = (v) => height - pad.b - ((v - min) / rng) * (height - pad.t - pad.b);
    const pts  = scores.map((v, i) => [xFor(i), yFor(v)]);

    // Grid lines
    [30, 50, 70, 90].forEach((g) => {
      const gy = yFor(g);
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.setLineDash([3, 6]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font = `500 8px Inter`; ctx.textAlign = 'right';
      ctx.fillText(g, pad.l - 4, gy + 3);
    });

    // Area fill
    const fillGrad = ctx.createLinearGradient(0, pad.t, 0, height - pad.b);
    fillGrad.addColorStop(0,   'rgba(108,82,255,0.40)');
    fillGrad.addColorStop(1,   'rgba(108,82,255,0.00)');
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.lineTo(pts[n - 1][0], height - pad.b);
    ctx.lineTo(pts[0][0],     height - pad.b);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Line
    const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
    lineGrad.addColorStop(0, T.indigo);
    lineGrad.addColorStop(0.5, T.violet);
    lineGrad.addColorStop(1, T.cyan);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();

    // Dots
    pts.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, i === n - 1 ? 4.5 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = i === n - 1 ? T.cyan : 'rgba(255,255,255,0.42)';
      ctx.fill();
    });
  }, [trend, height]);

  if (!trend || trend.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.lo, fontFamily: FONT_BODY, fontSize: 10.5 }}>
        Complete more sessions to see your trend
      </div>
    );
  }
  return <canvas ref={ref} style={{ display: 'block' }} />;
};

// ─── Readiness DNA strip (canvas) — unique per user ──────────────────────────
const DNACanvas = ({ dims, height = 62 }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W   = canvas.parentElement?.offsetWidth || 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const segW  = W / dims.length;
    const ROWS  = 8;
    const bH    = 5, gap = 2.5;
    const totalBH = ROWS * bH + (ROWS - 1) * gap;
    const startY  = (height - totalBH - 12) / 2;

    dims.forEach((d, col) => {
      const filled = Math.round((d.hasData ? d.score : 0) / 100 * ROWS);
      const color  = dimColor(d);
      const bW     = segW * 0.70;
      const bX     = col * segW + (segW - bW) / 2;

      for (let row = 0; row < ROWS; row++) {
        const by = startY + (ROWS - 1 - row) * (bH + gap);
        const active = row < filled;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bX, by, bW, bH, 2);
        } else {
          ctx.rect(bX, by, bW, bH);
        }
        ctx.fillStyle = active ? color : 'rgba(255,255,255,0.06)';
        ctx.globalAlpha = active ? 0.92 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Dim short label
      ctx.fillStyle   = 'rgba(255,255,255,0.30)';
      ctx.font        = `600 7px Inter`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'alphabetic';
      const short = d.key === 'problemSolving' ? 'Prob' :
                    d.key === 'communication'  ? 'Comm' :
                    d.key === 'fundamentals'   ? 'CSF'  :
                    d.label.split(' ')[0].slice(0, 5);
      ctx.fillText(short, col * segW + segW / 2, height - 2);

      // Score
      if (d.hasData) {
        ctx.fillStyle   = color;
        ctx.font        = `700 8px Space Grotesk`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(d.score, col * segW + segW / 2, startY - 3);
      }
    });
  }, [dims, height]);

  return <canvas ref={ref} style={{ display: 'block', borderRadius: 12 }} />;
};

// ─── IRS Score ring (SVG) ─────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 118 }) => {
  const r   = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamp(score) / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="mm7-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={T.indigo} />
            <stop offset="40%"  stopColor={T.violet} />
            <stop offset="80%"  stopColor={T.cyan}   />
            <stop offset="100%" stopColor={T.teal}   />
          </linearGradient>
          <filter id="mm7-ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={9}
        />
        {/* Arc */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="url(#mm7-ring-grad)"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter="url(#mm7-ring-glow)"
        />
        {/* Inner disc */}
        <circle cx={size / 2} cy={size / 2} r={r - 8} fill="rgba(8,11,26,0.90)" />
      </svg>
      {/* Score number overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 30, fontWeight: 700, color: T.hi, letterSpacing: '-1px', lineHeight: 1 }}>
          <CountUp value={clamp(score)} duration={1.4} />
        </div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 8.5, fontWeight: 500, color: T.lo, letterSpacing: '1.2px', marginTop: 3 }}>
          IRS
        </div>
      </div>
    </div>
  );
};

// ─── Percentile arc (SVG semi-circle) ────────────────────────────────────────
const PercentileArc = ({ pct }) => {
  const W = 160, H = 88;
  const cx = W / 2, cy = H - 8, r = 68;
  const circ    = Math.PI * r; // semi-circle
  const offset  = circ - (clamp(pct) / 100) * circ;
  const color   = pct >= 80 ? T.good : pct >= 55 ? T.warn : T.rose;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="mm7-pct-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={T.indigo} />
            <stop offset="100%" stopColor={color}    />
          </linearGradient>
          <filter id="mm7-pct-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Fill arc */}
        <motion.path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#mm7-pct-grad)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          filter="url(#mm7-pct-glow)"
        />
        {/* Labels */}
        <text x={cx - r - 2} y={cy + 14} textAnchor="middle" fontSize={8} fill={T.lo} fontFamily="Inter">0</text>
        <text x={cx + r + 2} y={cy + 14} textAnchor="middle" fontSize={8} fill={T.lo} fontFamily="Inter">100</text>
        {/* Big number */}
        <text x={cx} y={cy - 14} textAnchor="middle" fontSize={26} fontWeight="700" fontFamily="Space Grotesk" fill={T.hi}>{pct}</text>
        <text x={cx} y={cy + 2}  textAnchor="middle" fontSize={9}  fontWeight="500" fontFamily="Space Grotesk" fill={color}>percentile</text>
      </svg>
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.mid, textAlign: 'center', lineHeight: 1.45, maxWidth: 220 }}>
        Better than <span style={{ color: T.hi, fontWeight: 600 }}>{pct}%</span> of candidates on MockMate
      </div>
    </div>
  );
};

// ─── Stat tile ────────────────────────────────────────────────────────────────
const StatTile = ({ tag, value, sub, gradient, style: sx }) => (
  <div style={{ flex: 1, minWidth: 0, borderRadius: 14, padding: '13px 12px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: gradient, ...sx }}>
    <div style={{ position: 'absolute', top: -20, right: -20, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
    <div style={{ fontFamily: FONT_HEAD, fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.52)', letterSpacing: '0.8px', marginBottom: 6 }}>{tag}</div>
    <div style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, color: T.hi, lineHeight: 1, letterSpacing: '-0.4px' }}>
      <CountUp value={typeof value === 'number' ? value : 0} duration={0.9} />
    </div>
    <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: 'rgba(255,255,255,0.42)', marginTop: 4 }}>{sub}</div>
  </div>
);

// ─── Badge tile ───────────────────────────────────────────────────────────────
const BadgeTile = ({ badge }) => (
  <div
    title={badge.unlocked ? badge.desc : `Locked — ${badge.desc}`}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: '11px 6px', borderRadius: 13,
      background: badge.unlocked ? T.glassS : T.glassW,
      border: `1px solid ${badge.unlocked ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
      opacity: badge.unlocked ? 1 : 0.6,
    }}
  >
    <span style={{ fontSize: 20, marginBottom: 5, filter: badge.unlocked ? 'none' : 'grayscale(1) opacity(0.4)' }}>
      {badge.icon}
    </span>
    <span style={{ fontFamily: FONT_HEAD, fontSize: 7.5, fontWeight: 700, color: badge.unlocked ? T.hi : T.lo, lineHeight: 1.3 }}>
      {badge.label}
    </span>
    {!badge.unlocked && badge.progress != null && (
      <div style={{ marginTop: 5, width: '100%', height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
        <div style={{ width: `${round(badge.progress * 100)}%`, height: '100%', background: T.cyan, borderRadius: 999 }} />
      </div>
    )}
  </div>
);

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TabBar = ({ tabs, active, onChange }) => {
  const onKey = (e, i) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange((i + 1) % tabs.length); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); onChange((i - 1 + tabs.length) % tabs.length); }
    if (e.key === 'Home')       { e.preventDefault(); onChange(0); }
    if (e.key === 'End')        { e.preventDefault(); onChange(tabs.length - 1); }
  };

  return (
    <div role="tablist" aria-label="Report sections" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {tabs.map((t, i) => (
        <button
          key={t}
          role="tab"
          aria-selected={i === active}
          aria-controls={`mm7-panel-${i}`}
          id={`mm7-tab-${i}`}
          tabIndex={i === active ? 0 : -1}
          onClick={() => onChange(i)}
          onKeyDown={(e) => onKey(e, i)}
          style={{
            flex: 1, border: 'none', borderRadius: 11, padding: '9px 6px', cursor: 'pointer',
            fontFamily: FONT_HEAD, fontSize: 10.5, fontWeight: 700, transition: 'all .18s ease',
            background:   i === active ? T.glassS                      : T.glassW,
            color:        i === active ? T.hi                           : T.lo,
            borderColor:  i === active ? T.borderG                      : T.border,
            borderWidth:  1, borderStyle: 'solid',
            boxShadow:    i === active ? '0 0 14px rgba(108,82,255,0.18)' : 'none',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL 1 — Score + Percentile + Trend
// ═══════════════════════════════════════════════════════════════════════════════
const ScorePanel = ({ score, tier, delta, trend, user, authLoading, archetype, percentile }) => (
  <div
    className="mm7-panel-in"
    style={{
      position: 'relative', borderRadius: 20, overflow: 'hidden',
      background: `linear-gradient(145deg, ${T.void} 0%, ${T.void3} 40%, ${T.void2} 70%, ${T.void3} 100%)`,
      padding: '20px 18px', height: PANEL_H, display: 'flex', flexDirection: 'column',
    }}
  >
    {/* Ambient glows */}
    <div style={{ position: 'absolute', top: -80, right: -60, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${T.violet}3A, transparent 70%)`, pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', bottom: -70, left: -50, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${T.cyan}28, transparent 70%)`, pointerEvents: 'none' }} />

    {/* Top bar */}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.glassW, border: `1px solid ${T.border}`, borderRadius: 999, padding: '5px 12px 5px 6px' }}>
        <div style={{ width: 22, height: 22, borderRadius: 8, background: HOLO, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, color: '#fff' }}>M</div>
        <span style={{ fontFamily: FONT_HEAD, fontSize: 9.5, fontWeight: 600, color: T.mid, letterSpacing: '0.6px' }}>MOCKMATE</span>
      </div>
      <div style={{
        padding: '5px 12px', borderRadius: 999, fontFamily: FONT_HEAD, fontSize: 10, fontWeight: 700,
        background: `${tier.color}1E`, border: `1px solid ${tier.color}50`, color: tier.color,
      }}>
        {tier.label} track
      </div>
    </div>

    {/* User */}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: HOLO, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 16, color: '#fff',
        boxShadow: `0 0 0 2px ${T.borderG}`,
      }}>
        {(user?.name || 'C')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {authLoading
          ? <div style={{ width: 90, height: 12, borderRadius: 4, background: T.glassW }} />
          : <>
              <div style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color: T.hi }}>{user?.name || 'Candidate'}</div>
              {user?.college && <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.lo, marginTop: 1 }}>{user.college}</div>}
            </>
        }
      </div>
      {archetype && (
        <div style={{ padding: '4px 11px', borderRadius: 999, fontFamily: FONT_HEAD, fontSize: 9.5, fontWeight: 700, background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.35)', color: '#C084FC', whiteSpace: 'nowrap' }}>
          {archetype.label}
        </div>
      )}
    </div>

    {/* Score + delta */}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
      <ScoreRing score={score} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, color: T.hi, lineHeight: 1.15 }}>
          Interview<br />Readiness Report
        </div>
        {delta != null && (
          <div style={{
            marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999, fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700,
            background: delta >= 0 ? 'rgba(52,211,153,0.14)' : 'rgba(251,113,133,0.14)',
            border: `1px solid ${delta >= 0 ? 'rgba(52,211,153,0.30)' : 'rgba(251,113,133,0.30)'}`,
            color: delta >= 0 ? T.good : T.bad,
          }}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts vs last session
          </div>
        )}
        {archetype && (
          <div style={{ marginTop: 8, fontFamily: FONT_BODY, fontSize: 10.5, color: T.lo, lineHeight: 1.5 }}>
            {ARCHETYPE_LINE[archetype.id] || ''}
          </div>
        )}
      </div>
    </div>

    {/* Percentile arc */}
    <Glass style={{ padding: '14px 12px', marginBottom: 14 }}>
      <PercentileArc pct={percentile} />
    </Glass>

    {/* Trend */}
    <Glass style={{ padding: '12px 14px', flex: 1, minHeight: 0 }}>
      <Tag>SCORE TREND</Tag>
      <TrendCanvas trend={trend} height={72} />
    </Glass>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
      <span style={{ fontFamily: FONT_HEAD, fontSize: 8.5, color: T.mute, letterSpacing: '0.5px' }}>#MOCKMATE · #INTERVIEWREADY</span>
      <span style={{ fontFamily: FONT_HEAD, fontSize: 8.5, color: T.mute }}>mockmate.app</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL 2 — Skill profile (Radar + DNA + dimension table)
// ═══════════════════════════════════════════════════════════════════════════════
const ProfilePanel = ({ dims, percentile }) => {
  const hasDims = dims.some((d) => d.hasData);

  return (
    <div className="mm7-panel-in" style={{ borderRadius: 20, background: T.void, border: `1px solid ${T.border}`, padding: '18px 16px', height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: T.hi }}>Skill Profile</div>
        <div style={{ padding: '4px 11px', borderRadius: 999, fontFamily: FONT_HEAD, fontSize: 10, fontWeight: 700, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.30)', color: T.cyan }}>
          top {100 - percentile}%
        </div>
      </div>

      {/* Radar */}
      <Glass style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', background: `linear-gradient(145deg, ${T.void2}, ${T.void3})` }}>
        <RadarCanvas dims={dims} size={158} />
        {/* Dimension table alongside */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {dims.map((d) => {
            const color = scoreCol(d.score);
            return (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                <span style={{ fontSize: 12, width: 16, flexShrink: 0, textAlign: 'center' }}>{d.icon}</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: T.mid, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.label.split(' ')[0]}
                </span>
                <span style={{ fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, color, width: 26, textAlign: 'right', flexShrink: 0 }}>
                  {d.hasData ? d.score : '—'}
                </span>
                <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.09)', overflow: 'hidden', flexShrink: 0 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${d.hasData ? d.score : 0}%` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%', background: dimColor(d), borderRadius: 999 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Glass>

      {/* DNA strip */}
      <Glass style={{ padding: '12px 14px' }}>
        <Tag>READINESS DNA — YOUR UNIQUE FINGERPRINT</Tag>
        <DNACanvas dims={dims} height={66} />
        {!hasDims && (
          <div style={{ marginTop: 8, fontFamily: FONT_BODY, fontSize: 10.5, color: T.lo, textAlign: 'center' }}>
            Complete more interviews to fill in your profile
          </div>
        )}
      </Glass>

      {/* Strong / Weak */}
      <Glass style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Strongest', dim: [...dims].filter(d => d.hasData).sort((a, b) => b.score - a.score)[0], col: T.good },
            { label: 'Growth area', dim: [...dims].filter(d => d.hasData).sort((a, b) => a.score - b.score)[0], col: T.bad },
          ].map(({ label, dim, col }) => (
            <div key={label} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 9.5, color: T.lo, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: FONT_HEAD, fontSize: 12.5, fontWeight: 700, color: col }}>
                {dim ? `${dim.label} · ${dim.score}` : '—'}
              </div>
            </div>
          ))}
        </div>
      </Glass>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <span style={{ fontFamily: FONT_HEAD, fontSize: 8.5, color: T.mute, letterSpacing: '0.5px' }}>#MOCKMATE · #SKILLPROFILE</span>
        <span style={{ fontFamily: FONT_HEAD, fontSize: 8.5, color: T.mute }}>mockmate.app</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL 3 — Tiers + Stats + Badges
// ═══════════════════════════════════════════════════════════════════════════════
const TiersPanel = ({ score, tier, upcomingTier, tiers, totalInterviews, dims, badges, percentile }) => {
  const sortedTiers = [...tiers].sort((a, b) => a.minIRS - b.minIRS);
  const tierIdx     = sortedTiers.findIndex((t) => t.label === tier.label);
  const progressPct = upcomingTier
    ? Math.min(100, round(((score - tier.minIRS) / (upcomingTier.minIRS - tier.minIRS)) * 100))
    : 100;

  const strong = [...dims].filter(d => d.hasData).sort((a, b) => b.score - a.score)[0];

  return (
    <div className="mm7-panel-in" style={{
      position: 'relative', borderRadius: 20, overflow: 'hidden',
      background: `linear-gradient(145deg, ${T.void} 0%, ${T.void3} 40%, ${T.void2} 70%, ${T.void3} 100%)`,
      padding: '18px 16px', height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ position: 'absolute', top: -60, right: -50, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${T.violet}28, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: T.hi }}>
        Tier Progress
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'flex', gap: 10 }}>
        <StatTile
          tag="SESSIONS"
          value={totalInterviews ?? 0}
          sub="interviews completed"
          gradient={`linear-gradient(135deg, rgba(108,82,255,0.28), rgba(168,85,247,0.16))`}
        />
        <StatTile
          tag="PERCENTILE"
          value={percentile}
          sub="rank among candidates"
          gradient={`linear-gradient(135deg, rgba(6,182,212,0.22), rgba(16,185,129,0.14))`}
        />
        {strong && (
          <StatTile
            tag="TOP SKILL"
            value={strong.score}
            sub={strong.label.split(' ')[0]}
            gradient={`linear-gradient(135deg, rgba(245,158,11,0.22), rgba(244,63,94,0.12))`}
          />
        )}
      </div>

      {/* Tier ladder */}
      <Glass style={{ padding: '14px 14px' }}>
        <Tag>SALARY TIER TRACK</Tag>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {sortedTiers.map((t, i) => (
            <div key={t.label} style={{
              flex: 1, borderRadius: 10, padding: '8px 5px', textAlign: 'center',
              background: i === tierIdx ? `${t.color}1E` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${i === tierIdx ? `${t.color}55` : 'rgba(255,255,255,0.07)'}`,
            }}>
              <div style={{ fontFamily: FONT_HEAD, fontSize: 8.5, fontWeight: 700, color: i <= tierIdx ? t.color : T.lo }}>{t.label}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 7.5, color: T.lo, marginTop: 2 }}>IRS {t.minIRS}+</div>
            </div>
          ))}
        </div>

        {/* Progress bar to next tier */}
        <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%', borderRadius: 999, background: HOLO_VIVID }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.lo }}>Current: {tier.label}</span>
          <span style={{ fontFamily: FONT_HEAD, fontSize: 10, fontWeight: 600, color: T.cyan }}>
            {upcomingTier ? `${upcomingTier.minIRS - score} pts → ${upcomingTier.label}` : '🎉 Top tier reached'}
          </span>
        </div>
      </Glass>

      {/* Badges */}
      <Glass style={{ flex: 1, minHeight: 0, padding: '12px 14px' }}>
        <Tag>ACHIEVEMENT BADGES</Tag>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {badges.map((b) => <BadgeTile key={b.id} badge={b} />)}
        </div>
      </Glass>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <span style={{ fontFamily: FONT_HEAD, fontSize: 8.5, color: T.mute, letterSpacing: '0.5px' }}>#MOCKMATE · #PLACEMENTREADY</span>
        <span style={{ fontFamily: FONT_HEAD, fontSize: 8.5, color: T.mute }}>mockmate.app</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const ScoreCard = ({
  totalScore      = 0,
  questions       = [],
  previousScore   = null,
  irs             = null,
  tier            = null,
  tiers           = DEFAULT_TIERS,
  archetype       = null,
  dimensionProfile = null,
  scoreTrend      = null,
  totalInterviews = null,
  strongestDim    = null,
  weakestDim      = null,
  badges          = null,
  percentile      = null,
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const cardRef = useRef(null);
  const [sharing,     setSharing]     = useState(false);
  const [activePanel, setActivePanel] = useState(0);

  // Cross-session profile self-fetch
  const [fetchedProfile, setFetchedProfile] = useState(null);
  const [profileLoading,  setProfileLoading] = useState(irs == null && dimensionProfile == null);

  useEffect(() => {
    if (irs != null || dimensionProfile != null) { setProfileLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyProfile();
        if (!cancelled && data?.hasData) setFetchedProfile(data);
      } catch (err) {
        console.error('ScoreCard: profile fetch failed', err);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve all data with graceful fallback chain
  const effIrs          = irs            ?? fetchedProfile?.irs            ?? null;
  const effTier         = tier           || fetchedProfile?.tier           || null;
  const effArchetype    = archetype      || fetchedProfile?.archetype      || null;
  const effDimProfile   = dimensionProfile || fetchedProfile?.dimensionProfile || null;
  const effTotalInt     = totalInterviews  ?? fetchedProfile?.totalInterviews  ?? null;
  const effBadges       = (badges && badges.length) ? badges : DEFAULT_BADGES;

  const resolvedScore   = clamp(effIrs ?? totalScore);
  const dims            = (effDimProfile && effDimProfile.length) ? effDimProfile : DEFAULT_DIMENSIONS;
  const resolvedTier    = effTier || resolveTier(resolvedScore, tiers);
  const upcomingTier    = nextTier(resolvedScore, tiers);
  const effPercentile   = percentile ?? fetchedProfile?.percentile ?? irsToPercentile(resolvedScore);

  const trend = useMemo(() => {
    if (scoreTrend && scoreTrend.length) return scoreTrend;
    if (questions.length) return [{ interview: 1, score: totalScore }];
    return [];
  }, [scoreTrend, questions, totalScore]);

  const delta = previousScore != null ? round(resolvedScore - clamp(previousScore)) : null;

  // ── Capture the currently-visible panel only ──────────────────────────────
  const generateImage = useCallback(async () => {
    if (!cardRef.current) throw new Error('Card not mounted');
    // Wait for animations to settle (count-up + draw-ins can take ~1.5s)
    await new Promise((r) => setTimeout(r, 1500));
    return toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: T.void,
      width:  cardRef.current.offsetWidth,
      height: cardRef.current.offsetHeight,
    });
  }, []);

  const shareText = useMemo(() => {
    const pctLine = `🏅 Better than ${effPercentile}% of candidates on MockMate`;
    const strong  = [...dims].filter(d => d.hasData).sort((a, b) => b.score - a.score)[0];
    const weak    = [...dims].filter(d => d.hasData).sort((a, b) => a.score - b.score)[0];
    return [
      '🚀 My MockMate Interview Readiness Report',
      '',
      `IRS: ${resolvedScore}/100 — tracking for ${resolvedTier.label}`,
      effArchetype ? `Archetype: ${effArchetype.label}` : '',
      pctLine,
      '',
      strong ? `💪 Strongest: ${strong.label} (${strong.score})` : '',
      weak   ? `🎯 Growth area: ${weak.label} (${weak.score})`   : '',
      effTotalInt != null ? `📊 ${effTotalInt} interviews completed` : '',
      '',
      '#MockMate #InterviewPrep #PlacementReady',
    ].filter(Boolean).join('\n');
  }, [resolvedScore, resolvedTier, effArchetype, effPercentile, dims, effTotalInt]);

  const handleDownload = async () => {
    const id = toast.loading('Creating your report card…');
    try {
      const url  = await generateImage();
      const link = document.createElement('a');
      link.download = `mockmate-report-${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.dismiss(id);
      toast.success('Report card saved!');
    } catch (err) {
      toast.dismiss(id);
      console.error('ScoreCard export failed:', err);
      toast.error('Could not create the report card.');
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const url = await generateImage();
      if (navigator.share && window.File) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'mockmate-report.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'My MockMate Interview Readiness Report', text: shareText, files: [file] });
          return;
        }
      }
      await navigator.clipboard?.writeText(shareText);
      const link = document.createElement('a');
      link.download = `mockmate-report-${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.success('Downloaded + share text copied!');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Share failed:', err);
      toast.error('Share failed — try Download instead.');
    } finally {
      setSharing(false);
    }
  };

  const panels = [
    <ScorePanel
      key="score"
      score={resolvedScore}
      tier={resolvedTier}
      delta={delta}
      trend={trend}
      user={user}
      authLoading={authLoading}
      archetype={effArchetype}
      percentile={effPercentile}
    />,
    <ProfilePanel
      key="profile"
      dims={dims}
      percentile={effPercentile}
    />,
    <TiersPanel
      key="tiers"
      score={resolvedScore}
      tier={resolvedTier}
      upcomingTier={upcomingTier}
      tiers={tiers}
      totalInterviews={effTotalInt}
      dims={dims}
      badges={effBadges}
      percentile={effPercentile}
    />,
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ maxWidth: 400, margin: '0 auto', fontFamily: FONT_BODY }}>
        <GlobalStyles />

        <TabBar
          tabs={['Score', 'Skills', 'Tiers & Badges']}
          active={activePanel}
          onChange={setActivePanel}
        />

        {/* Capture target — only the panel content */}
        <div
          ref={cardRef}
          key={activePanel}
          role="tabpanel"
          id={`mm7-panel-${activePanel}`}
          aria-labelledby={`mm7-tab-${activePanel}`}
          style={{ position: 'relative', borderRadius: 20, overflow: 'hidden' }}
        >
          {/* Aurora sits behind the panel */}
          {activePanel !== 1 && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
              <Aurora />
            </div>
          )}
          {panels[activePanel]}
        </div>

        {/* Action row — outside capture target */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={handleDownload}
            style={{
              flex: 1, border: 'none', borderRadius: 13, padding: '12px 20px', cursor: 'pointer',
              fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 700, color: '#fff',
              background: HOLO, boxShadow: '0 10px 28px rgba(108,82,255,0.32)',
            }}
          >
            ↓ Download card
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              flex: '0 0 auto', padding: '12px 20px', borderRadius: 13, cursor: sharing ? 'wait' : 'pointer',
              fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 700,
              background: 'rgba(108,82,255,0.12)', border: `1px solid rgba(108,82,255,0.40)`, color: '#C4B5FD',
            }}
          >
            {sharing ? 'Sharing…' : '↑ Share'}
          </button>
        </div>
      </div>
    </MotionConfig>
  );
};

export default ScoreCard;
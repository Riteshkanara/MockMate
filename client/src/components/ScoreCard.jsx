import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionConfig, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { toPng } from 'html-to-image';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { getMyProfile } from '../Services/profileServices';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — INTERVIEW READINESS REPORT (viral share card) v6
// Fixed-height, tabbed (Instagram-story style) — never a long scroll.
// 3 panels: Score+Trend / Six-Axis Profile / Tiers+Badges. Each panel is a
// self-contained 480px card. Mascots are real CSS-animated (float / bounce /
// pulse), not static SVG.
//
// Built directly against the REAL public-profile data pipeline:
//   server/controllers/publicProfileController.js -> getPublicProfileBySlug
//   server/utils/scoringModel.js -> buildDimensionProfile / computeIRS / TIERS
// Self-fetches via Services/profileService.js so no Result.jsx changes are
// required — falls back to per-session props/defaults if the fetch fails or
// the account has no sessions yet.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  indigo: '#4F3FF0',
  blue: '#2F6BFF',
  cyan: '#00D4FF',
  violet: '#A855F7',
  sky: '#38BDF8',
  pink: '#FF4FD8',

  navy: '#080B22',
  navy2: '#0E1440',
  navy3: '#171F5C',

  ink: '#0F1230',
  text: '#1E2340',
  sub: '#5B6280',
  muted: '#8A90AC',
  faint: '#B7BCD4',

  white: '#FFFFFF',
  paper: '#F6F8FC',
  line: '#E4E7F5',
  borderIndigo: '#C7D2FE',

  indigoSoft: '#EEF0FF',
  blueSoft: '#EAF1FF',

  green: '#00E38C',
  amber: '#FFB020',
  red: '#FF4D5E',
  orange: '#FF7A3D',
  yellow: '#FFD93D',
};

const FONT_HEAD = "'Plus Jakarta Sans', sans-serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'JetBrains Mono', monospace";

const HOLO = `linear-gradient(120deg, ${C.indigo} 0%, ${C.blue} 30%, ${C.cyan} 62%, ${C.pink} 100%)`;
const HOLO_VIVID = `linear-gradient(135deg, ${C.violet} 0%, ${C.blue} 25%, ${C.cyan} 55%, ${C.green} 78%, ${C.yellow} 100%)`;

const PANEL_HEIGHT = 480;

const DEFAULT_TIERS = [
  { label: '\u20B93\u20136 LPA', minIRS: 0, color: '#7A8BAF' },
  { label: '\u20B96\u201312 LPA', minIRS: 38, color: '#D97706' },
  { label: '\u20B912\u201320 LPA', minIRS: 60, color: '#1A6EFF' },
  { label: '\u20B920 LPA+', minIRS: 80, color: '#00ADE0' },
];

const DEFAULT_DIMENSIONS = [
  { key: 'technical', label: 'Technical Depth', icon: '\u2699', score: 0, hasData: false },
  { key: 'problemSolving', label: 'Problem Solving', icon: '\u{1F50D}', score: 0, hasData: false },
  { key: 'communication', label: 'Communication', icon: '\u{1F4AC}', score: 0, hasData: false },
  { key: 'behavioral', label: 'Behavioral', icon: '\u{1F91D}', score: 0, hasData: false },
  { key: 'design', label: 'System Design', icon: '\u{1F3D7}', score: 0, hasData: false },
  { key: 'fundamentals', label: 'CS Fundamentals', icon: '\u{1F4DA}', score: 0, hasData: false },
];

const DEFAULT_BADGES = [
  { id: 'first_rep', label: 'First Rep', icon: '\u{1F3AC}', desc: 'Completed your first mock interview.', unlocked: true },
  { id: 'full_marks', label: 'Full Marks', icon: '\u{1F4AF}', desc: 'Nailed a question with a perfect 100 score.', unlocked: false, progress: 0.4 },
  { id: 'iron_streak', label: 'Iron Streak', icon: '\u{1F525}', desc: 'Kept a 14-day practice streak alive.', unlocked: false, progress: 0.2 },
  { id: 'elite_pass', label: 'Elite Pass', icon: '\u{1F3C6}', desc: 'Hit a 90+ session score.', unlocked: false, progress: 0.6 },
];

const ARCHETYPE_TAGLINE = {
  inconsistentGenius: 'Brilliant on your best day \u2014 the goal now is repeating it.',
  consistentClimber: 'Steady upward trend. Compounding beats spikes.',
  speedRunner: 'Fast under pressure. Depth is the next unlock.',
  deepThinker: 'Thorough and deliberate. Speed catches up with reps.',
  pressureCooker: 'Handles the tough rounds. Consistency is the frontier.',
};

// ─── Helpers ────────────────────────────────────────────────────────────

const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));

const resolveTier = (irs, tiers) => {
  const sorted = [...tiers].sort((a, b) => a.minIRS - b.minIRS);
  const reached = sorted.filter((t) => irs >= t.minIRS);
  return reached[reached.length - 1] || sorted[0];
};

const nextTier = (irs, tiers) => {
  const sorted = [...tiers].sort((a, b) => a.minIRS - b.minIRS);
  return sorted.find((t) => t.minIRS > irs) || null;
};

const moodForScore = (score) => {
  if (score >= 80) return 'celebrate';
  if (score >= 55) return 'focused';
  return 'determined';
};

// ─── Mascot — Lottie character per mood, with the original hand-drawn SVG
// kept as an automatic fallback (shown if no URL is configured yet, or if
// the Lottie file fails to load). Fill in MASCOT_SOURCES with your own
// picks from lottiefiles.com (Free filter = Lottie Simple License, clear
// for commercial use, no attribution needed):
//   celebrate  -> search "confetti character" / "celebrating mascot"
//   focused    -> search "studying character" / "thinking mascot"
//   determined -> search "workout character" / "focused mascot running"
// Grab the "Lottie Animation URL" (ends in .json or .lottie) from a
// listing's download panel — no account needed for Free files.

const MASCOT_SOURCES = {
  celebrate: null, // e.g. 'https://lottie.host/xxxx/celebrate.lottie'
  focused: null,
  determined: null,
};

const MascotStyles = () => (
  <style>{`
    @keyframes mm6-float { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-7px) rotate(1deg); } }
    @keyframes mm6-bounce { 0%, 100% { transform: translateY(0) scale(1); } 45% { transform: translateY(-12px) scale(1.03); } 60% { transform: translateY(0) scale(0.98); } }
    @keyframes mm6-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    @keyframes mm6-armswing { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-6deg); } }
    @keyframes mm6-sparkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
    @keyframes mm6-tabfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes mm6-bgshift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    .mm6-mascot-celebrate { animation: mm6-bounce 1.6s ease-in-out infinite; transform-origin: center bottom; }
    .mm6-mascot-focused { animation: mm6-float 3.2s ease-in-out infinite; }
    .mm6-mascot-determined { animation: mm6-pulse 1.8s ease-in-out infinite; }
    .mm6-sparkle { animation: mm6-sparkle 1.3s ease-in-out infinite; }
    .mm6-panel-enter { animation: mm6-tabfade 0.28s ease-out; }
    .mm6-breathing-bg { background-size: 200% 200%; animation: mm6-bgshift 8s ease-in-out infinite; }

    /* Respect the OS-level reduced-motion preference — stop continuous/
       decorative animation, keep instant state changes (no motion sickness
       risk) but drop the infinite loops and long transitions. */
    @media (prefers-reduced-motion: reduce) {
      .mm6-mascot-celebrate, .mm6-mascot-focused, .mm6-mascot-determined,
      .mm6-sparkle, .mm6-breathing-bg {
        animation: none !important;
      }
      .mm6-panel-enter {
        animation-duration: 0.01ms !important;
      }
    }
  `}</style>
);

// ─── Original hand-drawn SVG mascots — automatic fallback ────────────────

const MascotCelebrate = ({ size = 60 }) => (
  <svg className="mm6-mascot-celebrate" width={size} height={size} viewBox="0 0 96 96" fill="none">
    <defs>
      <linearGradient id="mm6-a" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={C.cyan} />
        <stop offset="100%" stopColor={C.violet} />
      </linearGradient>
    </defs>
    <path className="mm6-sparkle" d="M14 20 L20 8" stroke={C.yellow} strokeWidth="4" strokeLinecap="round" />
    <path className="mm6-sparkle" style={{ animationDelay: '.3s' }} d="M82 18 L76 6" stroke={C.yellow} strokeWidth="4" strokeLinecap="round" />
    <circle className="mm6-sparkle" style={{ animationDelay: '.15s' }} cx="10" cy="34" r="2.6" fill={C.cyan} />
    <circle className="mm6-sparkle" style={{ animationDelay: '.5s' }} cx="86" cy="36" r="2.2" fill={C.cyan} />
    <path d="M28 46 Q14 30 18 16" stroke="url(#mm6-a)" strokeWidth="9" strokeLinecap="round" />
    <path d="M68 46 Q82 30 78 16" stroke="url(#mm6-a)" strokeWidth="9" strokeLinecap="round" />
    <ellipse cx="48" cy="56" rx="30" ry="28" fill="url(#mm6-a)" />
    <circle cx="38" cy="50" r="4.2" fill={C.navy} />
    <circle cx="58" cy="50" r="4.2" fill={C.navy} />
    <path d="M34 64 Q48 78 62 64" stroke={C.navy} strokeWidth="5" strokeLinecap="round" fill="none" />
  </svg>
);

const MascotFocused = ({ size = 60 }) => (
  <svg className="mm6-mascot-focused" width={size} height={size} viewBox="0 0 96 96" fill="none">
    <defs>
      <linearGradient id="mm6-b" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={C.blue} />
        <stop offset="100%" stopColor={C.sky} />
      </linearGradient>
    </defs>
    <rect x="62" y="40" width="20" height="26" rx="3" fill={C.white} stroke={C.borderIndigo} strokeWidth="2" />
    <rect x="67" y="36" width="10" height="6" rx="2" fill={C.indigo} />
    <path d="M66 50 L73 50 M66 56 L78 56 M66 61 L75 61" stroke={C.borderIndigo} strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="42" cy="56" rx="30" ry="28" fill="url(#mm6-b)" />
    <path d="M60 58 Q70 54 68 46" stroke="url(#mm6-b)" strokeWidth="9" strokeLinecap="round" />
    <path d="M27 47 L37 50" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
    <path d="M53 50 L43 47" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="52" r="3.4" fill={C.navy} />
    <circle cx="48" cy="52" r="3.4" fill={C.navy} />
    <path d="M32 66 Q40 70 48 66" stroke={C.navy} strokeWidth="4.5" strokeLinecap="round" fill="none" />
  </svg>
);

const MascotDetermined = ({ size = 60 }) => (
  <svg className="mm6-mascot-determined" width={size} height={size} viewBox="0 0 96 96" fill="none">
    <defs>
      <linearGradient id="mm6-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={C.indigo} />
        <stop offset="100%" stopColor={C.sky} />
      </linearGradient>
    </defs>
    <rect x="12" y="52" width="10" height="10" rx="2" fill={C.violet} />
    <rect x="74" y="52" width="10" height="10" rx="2" fill={C.violet} />
    <rect x="20" y="55" width="56" height="5" rx="2.5" fill={C.borderIndigo} />
    <g style={{ animation: 'mm6-armswing 1.4s ease-in-out infinite', transformOrigin: '48px 50px' }}>
      <ellipse cx="48" cy="58" rx="30" ry="26" fill="url(#mm6-c)" />
      <path d="M28 50 Q22 44 26 38" stroke="url(#mm6-c)" strokeWidth="9" strokeLinecap="round" />
      <path d="M68 50 Q74 44 70 38" stroke="url(#mm6-c)" strokeWidth="9" strokeLinecap="round" />
      <path d="M32 48 L42 51" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
      <path d="M64 48 L54 51" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
      <circle cx="38" cy="54" r="3.4" fill={C.navy} />
      <circle cx="58" cy="54" r="3.4" fill={C.navy} />
      <path d="M38 68 Q48 65 58 68" stroke={C.navy} strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </g>
  </svg>
);

const FallbackMascot = ({ mood, size }) => {
  if (mood === 'celebrate') return <MascotCelebrate size={size} />;
  if (mood === 'determined') return <MascotDetermined size={size} />;
  return <MascotFocused size={size} />;
};

// Lottie wrapper — swaps to the hand-drawn SVG if no URL is set for this
// mood yet, or if the remote file fails to load (network blip, bad URL,
// 404). DotLottieReact has no onError prop — the real API surfaces load
// failures through dotLottieRefCallback -> the player instance's
// 'loadError' event (confirmed against the documented event list), so
// that's the wiring used here rather than a prop that doesn't exist.
const Mascot = ({ mood, size }) => {
  const src = MASCOT_SOURCES[mood];
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <FallbackMascot mood={mood} size={size} />;

  return (
    <div style={{ width: size, height: size }}>
      <DotLottieReact
        src={src}
        loop
        autoplay
        style={{ width: size, height: size }}
        dotLottieRefCallback={(dotLottie) => {
          if (!dotLottie) return;
          dotLottie.addEventListener('loadError', () => setFailed(true));
        }}
      />
    </div>
  );
};

// ─── Radar chart — 6-axis, built from real dimensionProfile ──────────────

const RadarChart = ({ dimensions, size = 220 }) => {
  const center = size / 2;
  const maxR = size / 2 - 46;
  const n = dimensions.length;
  const angleFor = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const pointFor = (i, value) => {
    const r = (clamp(value) / 100) * maxR;
    const a = angleFor(i);
    return [center + r * Math.cos(a), center + r * Math.sin(a)];
  };

  const ringLevels = [25, 50, 75, 100];
  const dataPoints = dimensions.map((d, i) => pointFor(i, d.hasData ? d.score : 0));
  const dataPath = dataPoints.map((p) => p.join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="mm6-radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.65" />
          <stop offset="55%" stopColor={C.violet} stopOpacity="0.5" />
          <stop offset="100%" stopColor={C.pink} stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="mm6-radar-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.cyan} />
          <stop offset="100%" stopColor={C.violet} />
        </linearGradient>
        <filter id="mm6-radar-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {ringLevels.map((level) => {
        const pts = dimensions.map((_, i) => pointFor(i, level));
        return <polygon key={level} points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1" />;
      })}

      {dimensions.map((_, i) => {
        const [x, y] = pointFor(i, 100);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,.16)" strokeWidth="1" />;
      })}

      <motion.polygon
        points={dataPath}
        fill="url(#mm6-radar-fill)"
        stroke="url(#mm6-radar-stroke)"
        strokeWidth="2.4"
        strokeLinejoin="round"
        filter="url(#mm6-radar-glow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: `${center}px ${center}px` }}
      />
      {dataPoints.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="3.4"
          fill="#fff"
          stroke={C.cyan}
          strokeWidth="1.8"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.55 + i * 0.06 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}

      {dimensions.map((d, i) => {
        const a = angleFor(i);
        const lx = center + (maxR + 26) * Math.cos(a);
        const ly = center + (maxR + 26) * Math.sin(a);
        const shortLabel = d.key === 'communication' ? 'Comm.' : d.key === 'fundamentals' ? 'CS Fund.' : d.key === 'problemSolving' ? 'Problem' : d.label.split(' ')[0];
        return (
          <text key={d.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fontFamily={FONT_MONO} fontWeight="700" fill="rgba(255,255,255,.75)">
            {shortLabel}
          </text>
        );
      })}
    </svg>
  );
};

// ─── Mini line chart — real score trend ────────────────────────────────

const LineChart = ({ scoreTrend, width = 320, height = 120 }) => {
  if (!scoreTrend || scoreTrend.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint, fontFamily: FONT_MONO, fontSize: 10 }}>
        Not enough sessions yet for a trend line
      </div>
    );
  }

  const pad = 10;
  const scores = scoreTrend.map((s) => clamp(s.score));
  const max = Math.max(...scores, 10);
  const min = Math.min(...scores, 0);
  const range = Math.max(max - min, 1);

  const pointFor = (v, i) => {
    const x = pad + (i / (scores.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  };

  const points = scores.map((v, i) => pointFor(v, i));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0]},${height - pad} L ${points[0][0]},${height - pad} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mm6-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.45" />
          <stop offset="100%" stopColor={C.cyan} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mm6-line-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={C.violet} />
          <stop offset="100%" stopColor={C.cyan} />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill="url(#mm6-line-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="url(#mm6-line-stroke)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
      {points.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 4.5 : 2.4}
          fill={i === points.length - 1 ? C.cyan : 'rgba(255,255,255,.55)'}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.3 + (i / points.length) * 1.1 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </svg>
  );
};

// ─── Count-up number — animates from 0 to its target when it mounts, using
// framer-motion (already a project dependency). Handles numeric AND
// string values (e.g. "84%", "8/8") by animating the numeric part only and
// re-appending any suffix/prefix, so it drops into any value slot safely.

const CountUpNumber = ({ value, duration = 1.1, style }) => {
  const numericMatch = typeof value === 'string' ? value.match(/-?\d+(\.\d+)?/) : null;
  const target = typeof value === 'number' ? value : numericMatch ? parseFloat(numericMatch[0]) : null;
  const prefix = numericMatch ? value.slice(0, numericMatch.index) : '';
  const suffix = numericMatch ? value.slice(numericMatch.index + numericMatch[0].length) : '';

  const prefersReducedMotion = useReducedMotion();
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target == null) return;

    // Respect the OS reduced-motion setting — jump straight to the final
    // value instead of animating the count.
    if (prefersReducedMotion) {
      setDisplay(target);
      return;
    }

    const controls = animate(motionVal, target, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, prefersReducedMotion]);

  if (target == null) return <span style={style}>{value}</span>; // non-numeric value (e.g. "—") — render as-is

  return (
    <span style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
};

// ─── Color-blocked stat tile ──────────────────────────────────────────────

const StatTile = ({ tag, value, label, gradient, foreground = '#fff' }) => (
  <div style={{ flex: 1, minWidth: 0, background: gradient, borderRadius: 14, padding: '13px 14px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>
    <div style={{ position: 'absolute', top: -20, right: -20, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.16)' }} />
    <div style={{ position: 'relative', display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,.2)', color: foreground, fontFamily: FONT_MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: '.6px', marginBottom: 10 }}>
      {tag}
    </div>
    <div style={{ position: 'relative', fontFamily: FONT_HEAD, fontSize: 26, fontWeight: 900, color: foreground, letterSpacing: '-0.5px', lineHeight: 1 }}>
      <CountUpNumber value={value} />
    </div>
    <div style={{ position: 'relative', marginTop: 5, fontFamily: FONT_BODY, fontSize: 9.5, color: foreground, opacity: 0.9 }}>{label}</div>
  </div>
);

// ─── Badge tile ─────────────────────────────────────────────────────────

const BadgeTile = ({ badge }) => (
  <div
    title={badge.unlocked ? badge.desc : `Locked \u2014 ${badge.desc}`}
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 6px', borderRadius: 14, background: badge.unlocked ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)', border: `1px solid ${badge.unlocked ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)'}`, opacity: badge.unlocked ? 1 : 0.55, position: 'relative' }}
  >
    <span style={{ fontSize: 20, marginBottom: 5, filter: badge.unlocked ? 'none' : 'grayscale(1)' }}>{badge.icon}</span>
    <span style={{ fontFamily: FONT_HEAD, fontSize: 8, fontWeight: 800, color: badge.unlocked ? '#fff' : 'rgba(255,255,255,.5)', lineHeight: 1.25 }}>{badge.label}</span>
    {!badge.unlocked && badge.progress != null && (
      <div style={{ marginTop: 5, width: '100%', height: 3, borderRadius: 999, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(badge.progress * 100)}%`, height: '100%', background: C.cyan }} />
      </div>
    )}
  </div>
);

// ─── Tab bar ──────────────────────────────────────────────────────────

const TabBar = ({ tabs, active, onChange }) => {
  const handleKeyDown = (e, i) => {
    // Standard tablist keyboard behavior: arrow keys move focus + selection,
    // Home/End jump to the first/last tab.
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange((i + 1) % tabs.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange((i - 1 + tabs.length) % tabs.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(tabs.length - 1);
    }
  };

  return (
    <div role="tablist" aria-label="Report sections" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      {tabs.map((t, i) => (
        <button
          key={t}
          role="tab"
          aria-selected={i === active}
          aria-controls={`mm6-panel-${i}`}
          id={`mm6-tab-${i}`}
          tabIndex={i === active ? 0 : -1}
          onClick={() => onChange(i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 10,
            padding: '9px 6px',
            background: i === active ? C.ink : C.paper,
            color: i === active ? '#fff' : C.sub,
            fontFamily: FONT_HEAD,
            fontSize: 10.5,
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all .18s ease',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
};

// ─── Panel 1 — Score + trend + archetype ──────────────────────────────

const ScorePanel = ({ resolvedScore, resolvedTier, delta, trend, user, authLoading, effArchetype, mood }) => (
  <div
    className="mm6-panel-enter mm6-breathing-bg"
    style={{
      position: 'relative',
      borderRadius: 18,
      overflow: 'hidden',
      background: `linear-gradient(120deg, ${C.navy} 0%, ${C.navy3} 30%, ${C.navy2} 60%, ${C.navy3} 100%)`,
      padding: '22px 20px',
      height: PANEL_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div style={{ position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${C.violet}3D, transparent 70%)` }} />
    <div style={{ position: 'absolute', bottom: -60, left: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${C.cyan}2E, transparent 70%)` }} />
    <div style={{ position: 'absolute', top: 60, left: 30, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle, ${C.pink}22, transparent 70%)` }} />

    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: HOLO, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>M</div>
        <span style={{ color: 'rgba(255,255,255,.55)', fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '1px' }}>MOCKMATE</span>
      </div>
      <div style={{ padding: '5px 11px', borderRadius: 999, background: `${resolvedTier.color}26`, border: `1px solid ${resolvedTier.color}55`, color: resolvedTier.color, fontFamily: FONT_HEAD, fontSize: 10.5, fontWeight: 800 }}>
        {resolvedTier.label} track
      </div>
    </div>

    <div style={{ position: 'relative', color: 'rgba(255,255,255,.5)', fontFamily: FONT_BODY, fontSize: 10.5, marginTop: 6, minHeight: 14 }}>
      {authLoading ? (
        <span style={{ display: 'inline-block', width: 90, height: 10, borderRadius: 4, background: 'rgba(255,255,255,.12)' }} />
      ) : (
        <>
          {user?.name || 'Candidate'}
          {user?.college ? ` \u00b7 ${user.college}` : ''}
        </>
      )}
    </div>

    <div style={{ position: 'relative', fontFamily: FONT_HEAD, fontSize: 27, fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginTop: 8, lineHeight: 1.1 }}>
      Interview Readiness Report
    </div>

    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, marginTop: 22, flexWrap: 'wrap' }}>
      <div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: '-10px', background: HOLO_VIVID, opacity: 0.35, filter: 'blur(24px)', zIndex: 0 }} />
          <div style={{ position: 'relative', fontFamily: FONT_HEAD, fontSize: 58, fontWeight: 900, letterSpacing: '-2.5px', lineHeight: 1, background: HOLO_VIVID, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            <CountUpNumber value={resolvedScore} duration={1.3} />
          </div>
        </div>
        <div style={{ marginTop: 4, color: 'rgba(255,255,255,.45)', fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '1px' }}>IRS SCORE</div>
        {delta != null && (
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: delta >= 0 ? 'rgba(18,183,106,.18)' : 'rgba(240,68,56,.18)', color: delta >= 0 ? '#4ADE80' : '#FCA5A5', fontFamily: FONT_HEAD, fontSize: 9.5, fontWeight: 800 }}>
            {delta >= 0 ? '\u2191' : '\u2193'} {Math.abs(delta)} vs last
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <LineChart scoreTrend={trend} height={72} />
        <div style={{ marginTop: 2, color: 'rgba(255,255,255,.4)', fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '.6px' }}>SCORE TREND</div>
      </div>
    </div>

    <div style={{ marginTop: 'auto' }}>
      {effArchetype && (
        <div style={{ position: 'relative', padding: '13px 15px', borderRadius: 13, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', gap: 13 }}>
          <Mascot mood={mood} size={50} />
          <div>
            <div style={{ color: C.cyan, fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 800 }}>{effArchetype.label}</div>
            <div style={{ marginTop: 3, color: 'rgba(255,255,255,.55)', fontFamily: FONT_BODY, fontSize: 10.5 }}>{ARCHETYPE_TAGLINE[effArchetype.id] || ''}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ color: C.faint, fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '1px' }}>#MOCKMATE #INTERVIEWREADY</span>
        <span style={{ color: C.faint, fontFamily: FONT_MONO, fontSize: 8.5 }}>mockmate.app</span>
      </div>
    </div>
  </div>
);

// ─── Panel 2 — Six-axis radar + dimension table ────────────────────────

const ProfilePanel = ({ dims, profileLoading, mood }) => (
  <div className="mm6-panel-enter" style={{ borderRadius: 18, background: C.white, border: `1px solid ${C.line}`, padding: 18, height: PANEL_HEIGHT, display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ color: C.muted, fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '1.2px' }}>SIX-AXIS PROFILE</div>
      <Mascot mood={mood} size={34} />
    </div>

    <div
      style={{
        borderRadius: 15,
        background: `linear-gradient(165deg, ${C.navy} 0%, ${C.navy2} 100%)`,
        padding: '10px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 208,
      }}
    >
      {profileLoading ? (
        <div style={{ color: 'rgba(255,255,255,.4)', fontFamily: FONT_MONO, fontSize: 9.5 }}>Loading your profile...</div>
      ) : (
        <RadarChart dimensions={dims} size={200} />
      )}
    </div>

    {!profileLoading && !dims.some((d) => d.hasData) && (
      <div style={{ marginTop: 8, color: C.muted, fontFamily: FONT_BODY, fontSize: 10, textAlign: 'center' }}>Complete a few more interviews to fill in your profile</div>
    )}

    <div style={{ marginTop: 12, flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.6fr 0.9fr', gap: 6, padding: '0 4px 7px', borderBottom: `1px solid ${C.line}` }}>
        {['Dimension', 'Score', 'Signal'].map((h) => (
          <span key={h} style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: C.muted, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase' }}>
            {h}
          </span>
        ))}
      </div>
      {dims.map((d, i) => {
        const color = d.score >= 70 ? C.green : d.score >= 45 ? C.amber : C.red;
        return (
          <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.6fr 0.9fr', gap: 6, alignItems: 'center', padding: '7px 4px', borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 11 }}>{d.icon}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            </div>
            <span style={{ fontFamily: FONT_HEAD, fontSize: 11.5, fontWeight: 800, color }}>
              {d.hasData ? <CountUpNumber value={d.score} duration={0.8} /> : '\u2014'}
            </span>
            <div style={{ height: 5, borderRadius: 999, background: C.line, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${d.hasData ? d.score : 0}%` }}
                transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', background: color, borderRadius: 999 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Panel 3 — Tiers + badges ─────────────────────────────────────────

const TiersPanel = ({ resolvedScore, resolvedTier, upcoming, strong, effTotalInterviews, questions, badges, mood }) => (
  <div
    className="mm6-panel-enter mm6-breathing-bg"
    style={{
      position: 'relative',
      borderRadius: 18,
      overflow: 'hidden',
      background: `linear-gradient(120deg, ${C.navy} 0%, ${C.navy3} 35%, ${C.navy2} 65%, ${C.navy3} 100%)`,
      padding: 18,
      height: PANEL_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div style={{ position: 'absolute', top: -60, right: -50, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${C.pink}2A, transparent 70%)` }} />

    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ color: 'rgba(255,255,255,.5)', fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '1.2px' }}>TIER PROGRESS</div>
      <Mascot mood={mood} size={36} />
    </div>

    <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
      <StatTile tag="SESSIONS" value={effTotalInterviews != null ? effTotalInterviews : questions.length ? 1 : 0} label="interviews logged" gradient={`linear-gradient(135deg, ${C.orange}, #FF4D8D)`} />
      <StatTile tag="STRONGEST" value={strong ? strong.score : '\u2014'} label={strong ? strong.label : 'Not enough data'} gradient={`linear-gradient(135deg, ${C.violet}, ${C.indigo})`} />
    </div>

    {upcoming && (
      <div style={{ position: 'relative', marginTop: 10, padding: '13px 15px', borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_HEAD, fontSize: 11.5, fontWeight: 800, color: '#fff' }}>Next: {upcoming.label} track</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.cyan }}>{upcoming.minIRS - resolvedScore} pts away</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (resolvedScore / upcoming.minIRS) * 100)}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%', background: HOLO_VIVID, borderRadius: 999 }}
          />
        </div>
      </div>
    )}

    <div style={{ position: 'relative', marginTop: 14, color: 'rgba(255,255,255,.5)', fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '1.2px' }}>BADGES</div>
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
      {badges.map((b) => (
        <BadgeTile key={b.id} badge={b} />
      ))}
    </div>

    <div style={{ position: 'relative', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: C.faint, fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '1px' }}>#MOCKMATE #INTERVIEWREADY</span>
      <span style={{ color: C.faint, fontFamily: FONT_MONO, fontSize: 8.5 }}>mockmate.app</span>
    </div>
  </div>
);

// ─── Main report card ─────────────────────────────────────────────────

const ScoreCard = ({
  totalScore,
  questions = [],
  previousScore = null,
  irs = null,
  tier = null,
  tiers = DEFAULT_TIERS,
  archetype = null,
  dimensionProfile = null,
  scoreTrend = null,
  totalInterviews = null,
  strongestDim = null,
  weakestDim = null,
  badges = null,
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [activePanel, setActivePanel] = useState(0);

  // ─── Self-fetch cross-session profile data ─────────────────────────────
  const [fetchedProfile, setFetchedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(irs == null && dimensionProfile == null);

  useEffect(() => {
    if (irs != null || dimensionProfile != null) {
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyProfile();
        if (!cancelled && data?.hasData) setFetchedProfile(data);
      } catch (error) {
        console.error('Could not load profile stats for share card:', error);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Resolve real data with graceful fallbacks ─────────────────────────
  const effIrs = irs != null ? irs : fetchedProfile?.irs ?? null;
  const effTier = tier || fetchedProfile?.tier || null;
  const effArchetype = archetype || fetchedProfile?.archetype || null;
  const effDimensionProfile = dimensionProfile || fetchedProfile?.dimensionProfile || null;
  const effTotalInterviews = totalInterviews != null ? totalInterviews : fetchedProfile?.totalInterviews ?? null;
  const effStrongestDim = strongestDim || fetchedProfile?.strongestDim || null;
  const effWeakestDim = weakestDim || fetchedProfile?.weakestDim || null;
  const resolvedBadges = badges && badges.length ? badges : DEFAULT_BADGES;

  const resolvedScore = clamp(effIrs != null ? effIrs : totalScore);
  const dims = effDimensionProfile && effDimensionProfile.length ? effDimensionProfile : DEFAULT_DIMENSIONS;
  const resolvedTier = effTier || resolveTier(resolvedScore, tiers);
  const upcoming = nextTier(resolvedScore, tiers);
  const mood = moodForScore(resolvedScore);

  const trend = useMemo(() => {
    if (scoreTrend && scoreTrend.length) return scoreTrend;
    if (questions.length) return [{ interview: 1, score: totalScore }];
    return [];
  }, [scoreTrend, questions, totalScore]);

  const strong = effStrongestDim || [...dims].filter((d) => d.hasData).sort((a, b) => b.score - a.score)[0];
  const weak = effWeakestDim || [...dims].filter((d) => d.hasData).sort((a, b) => a.score - b.score)[0];
  const delta = previousScore != null ? Math.round(resolvedScore - clamp(previousScore)) : null;

  // ─── Export / share ─────────────────────────────────────────────────
  // Exports only the CURRENTLY ACTIVE panel (each is a self-contained
  // 480px card) — not the tab bar or buttons — so the downloaded image
  // is exactly what's on screen, not the whole tabbed shell.

  const generateImage = async () => {
    if (!cardRef.current) throw new Error('Score card is not available.');

    // Wait for in-panel entrance animations (count-up numbers, bar/radar/
    // line-chart draw-ins, panel fade-in) to fully settle before capturing.
    // The slowest of these is the line chart's staggered dot pop-in on the
    // Score panel (up to ~1.4s) — capturing earlier than that risks a PNG
    // with half-drawn bars or a mid-count number, which defeats the point
    // of a "download this card" feature.
    await new Promise((resolve) => setTimeout(resolve, 1450));

    return toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: activePanel === 1 ? C.white : C.navy,
      width: cardRef.current.offsetWidth,
      height: cardRef.current.offsetHeight,
    });
  };

  const shareText = useMemo(() => {
    return [
      `\u{1F680} My MockMate Interview Readiness Report`,
      '',
      `IRS: ${resolvedScore}/100 \u2014 tracking for ${resolvedTier.label}`,
      effArchetype ? `Archetype: ${effArchetype.label}` : '',
      '',
      strong ? `\u{1F4AA} Strongest: ${strong.label} (${strong.score})` : '',
      weak ? `\u{1F3AF} Growth area: ${weak.label} (${weak.score})` : '',
      effTotalInterviews != null ? `\u{1F4CA} ${effTotalInterviews} interviews completed` : '',
      '',
      '#MockMate #InterviewPrep #PlacementReady',
    ]
      .filter(Boolean)
      .join('\n');
  }, [resolvedScore, resolvedTier, effArchetype, strong, weak, effTotalInterviews]);

  const handleDownload = async () => {
    const toastId = toast.loading('Creating your report card...');
    try {
      const dataUrl = await generateImage();
      const link = document.createElement('a');
      link.download = `mockmate-report-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.dismiss(toastId);
      toast.success('Report card saved!');
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Report export failed:', error);
      toast.error('Could not create the report card.');
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const dataUrl = await generateImage();
      if (navigator.share && window.File) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'mockmate-report.png', { type: 'image/png' });
        const canShareFile = navigator.canShare ? navigator.canShare({ files: [file] }) : false;
        if (canShareFile) {
          await navigator.share({ title: 'My MockMate Interview Readiness Report', text: shareText, files: [file] });
          return;
        }
      }
      await navigator.clipboard?.writeText(shareText);
      const link = document.createElement('a');
      link.download = `mockmate-report-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Report downloaded and share text copied.');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('Share failed:', error);
      toast.error('Sharing failed. Try Download instead.');
    } finally {
      setSharing(false);
    }
  };

  const panels = [
    <ScorePanel key="score" resolvedScore={resolvedScore} resolvedTier={resolvedTier} delta={delta} trend={trend} user={user} authLoading={authLoading} effArchetype={effArchetype} mood={mood} />,
    <ProfilePanel key="profile" dims={dims} profileLoading={profileLoading} mood={mood} />,
    <TiersPanel
      key="tiers"
      resolvedScore={resolvedScore}
      resolvedTier={resolvedTier}
      upcoming={upcoming}
      strong={strong}
      effTotalInterviews={effTotalInterviews}
      questions={questions}
      badges={resolvedBadges}
      mood={mood}
    />,
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="mockmate-share-shell" style={{ maxWidth: 400, margin: '0 auto', fontFamily: FONT_BODY }}>
        <MascotStyles />

        <TabBar tabs={['Score', 'Profile', 'Tiers & Badges']} active={activePanel} onChange={setActivePanel} />

        <div
          ref={cardRef}
          className="mockmate-score-card"
          key={activePanel}
          role="tabpanel"
          id={`mm6-panel-${activePanel}`}
          aria-labelledby={`mm6-tab-${activePanel}`}
        >
          {panels[activePanel]}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            onClick={handleDownload}
            className="mockmate-share-button"
            style={{ border: 'none', borderRadius: 11, background: HOLO, color: '#fff', padding: '11px 22px', fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 26px rgba(67,56,202,.28)' }}
          >
            &darr; Download this card
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="mockmate-share-button"
            style={{ border: `1px solid ${C.borderIndigo}`, borderRadius: 11, background: C.indigoSoft, color: C.indigo, padding: '11px 20px', fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 800, cursor: sharing ? 'wait' : 'pointer' }}
          >
            {sharing ? 'Sharing...' : '\u2191 Share'}
          </button>
        </div>
      </div>
    </MotionConfig>
  );
};

export default ScoreCard;
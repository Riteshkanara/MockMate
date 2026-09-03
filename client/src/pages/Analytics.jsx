import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useNavigate } from "react-router-dom";
import BookLoader from "../components/BookLoader";
import { getAIFreeform, getAnalytics, getLastSessionBreakdown, getBlindSpots, getSessionWarmup } from "../Services/interviewService";

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE ANALYTICS — READINESS INTELLIGENCE v5
// War-room aesthetic — deep indigo/violet accent distinguishes this page
// from Dashboard's blueprint-blue. Same IRS formula, distinct visual identity.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg:       "#F0F4FF",
  bgDeep:   "#E8EEFF",
  card:     "#FFFFFF",
  cardAlt:  "#F8FAFF",

  text:     "#0A1628",
  sub:      "#3D5280",
  muted:    "#7A8BAF",
  faint:    "#A8B8D4",

  border:   "#DDE5F7",
  borderMd: "#B8CAF0",
  borderStr:"#7FA3E8",

  blue50:   "#EBF2FF",
  blue100:  "#C7DAFF",
  blue200:  "#9DBFFF",
  blue300:  "#6FA5FF",
  blue400:  "#4D8FFF",
  blue500:  "#1A6EFF",
  blue600:  "#0057E8",
  blue700:  "#0044C4",
  blue900:  "#001F6B",

  // War-room violet accent — differentiates Analytics from Dashboard's cyan
  violet:     "#1A6EFF",
  violetLight:"#00C8F0",
  violetTint: "#EBF2FF",
  violetMid:  "#0057E8",
  violetDeep: "#0044C4",

  cyan400:  "#00C8F0",
  cyan500:  "#00ADE0",
  cyan600:  "#0093C4",
  cyanTint: "#E6F9FF",

  green:    "#059669",
  greenTint:"#ECFDF5",
  greenGlow:"rgba(5,150,105,0.18)",

  amber:    "#D97706",
  amberTint:"#FFFBEB",
  orange:   "#EA580C",
  orangeTint:"#FFF7ED",

  red:      "#DC2626",
  redTint:  "#FEF2F2",

  // Per-dimension vivid colors — each dimension gets its own identity
  dimColors: {
    technical:      "#1A6EFF",
    problemSolving: "#1A6EFF",
    communication:  "#059669",
    behavioral:     "#D97706",
    design:         "#0093C4",
    fundamentals:   "#DC2626",
  },

  shadow:   "0 1px 12px rgba(26,110,255,0.07)",
  shadowMd: "0 6px 28px rgba(26,110,255,0.12)",
  shadowLg: "0 16px 56px rgba(0,31,107,0.18)",
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const DIMENSION_META = [
  { key: "technical",      label: "Technical Depth", icon: "⚙",  weight: 0.28, tip: "Core CS fundamentals — the first thing technical screeners test." },
  { key: "problemSolving", label: "Problem Solving", icon: "🔍", weight: 0.22, tip: "How you break down unknowns — decisive in live coding rounds." },
  { key: "communication",  label: "Communication",   icon: "💬", weight: 0.18, tip: "Clarity of thought — interviewers notice it fast." },
  { key: "behavioral",     label: "Behavioral",      icon: "🤝", weight: 0.12, tip: "Situational judgment and self-awareness under HR scrutiny." },
  { key: "design",         label: "System Design",   icon: "🏗",  weight: 0.10, tip: "Matters at ₹12 LPA+ — often the differentiator between tiers." },
  { key: "fundamentals",   label: "CS Fundamentals", icon: "📚", weight: 0.10, tip: "Breadth of core knowledge — separates prepared from lucky." },
];

const TIER_META = {
  "₹3–6 LPA":   { color: "#7A8BAF", bg: C.blue50,    gradient: "linear-gradient(135deg, #EBF2FF, #F0F4FF)" },
  "₹6–12 LPA":  { color: C.amber,   bg: C.amberTint, gradient: "linear-gradient(135deg, #FFFBEB, #FEF3C7)" },
  "₹12–20 LPA": { color: C.blue500, bg: C.blue50,    gradient: "linear-gradient(135deg, #EBF2FF, #DBEAFE)" },
  "₹20 LPA+":   { color: C.violet,  bg: C.violetTint,gradient: "linear-gradient(135deg, #EBF2FF, #DBEAFE)" },
};

const ARCHETYPES = [
  { id: "inconsistentGenius", label: "Inconsistent Genius", icon: "🎲", desc: "High variance — brilliant when in flow, needs to build a floor.", fix: "Consistency drills: hold 65+ on every session before chasing 90+." },
  { id: "consistentClimber",  label: "Consistent Climber",  icon: "📈", desc: "Steady, reliable improvement — the archetype that wins campus placements.", fix: "Keep the streak; add harder topic rotations to keep growing." },
  { id: "speedRunner",        label: "Speed Runner",        icon: "⚡", desc: "Fast answers but sometimes sacrifices depth for pace.", fix: "Practise 'think aloud' — say your reasoning before your answer." },
  { id: "deepThinker",        label: "Deep Thinker",        icon: "🧠", desc: "Thorough and accurate — needs to improve time management.", fix: "Run timed drills: 2-minute cap per answer in quick-fire mode." },
  { id: "pressureCooker",     label: "Pressure Cooker",     icon: "🔥", desc: "Scores improve under timed, competitive conditions.", fix: "Channel this by joining live contest platforms weekly." },
];

const COMPANY_PROFILES = [
  { id: "service",     label: "Service (TCS / Infosys / Wipro)",           icon: "🏢", scores: { technical: 55, problemSolving: 50, communication: 65, behavioral: 60, design: 25, fundamentals: 55 } },
  { id: "product_mid", label: "Mid Product (Flipkart / Swiggy / PhonePe)", icon: "🚀", scores: { technical: 72, problemSolving: 70, communication: 60, behavioral: 55, design: 55, fundamentals: 65 } },
  { id: "faang",       label: "FAANG-adjacent (Google / Amazon / Microsoft)",icon: "🏆", scores: { technical: 85, problemSolving: 88, communication: 65, behavioral: 62, design: 75, fundamentals: 78 } },
  { id: "startup",     label: "Early-Stage Startup",                        icon: "⚡", scores: { technical: 68, problemSolving: 65, communication: 72, behavioral: 65, design: 45, fundamentals: 58 } },
];

// ─── Maths helpers ────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));
const ewma = (values, alpha = 0.35) => {
  if (!values.length) return 0;
  return values.reduce((acc, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * acc), values[0]);
};
const stdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (values.length - 1));
};
const trendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xMean) * (v - yMean), 0);
  const den = values.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
  return den ? num / den : 0;
};
const deriveArchetype = (scoreTrend, avgTimePerQ, avgScore) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1];
  const sd = stdDev(scores);
  const slope = trendSlope(scores);
  if (sd > 18) return ARCHETYPES[0];
  if (slope > 2) return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};
const topicROI = (topic, dimensionProfile) => {
  const dim = dimensionProfile.find(d =>
    (d.contributingTopics || []).some(ct => ct.toLowerCase() === topic.toLowerCase())
  );
  const w = dim?.weight ?? 0.1;
  const score = dim ? (dimensionProfile.find(d => d.key === dim.key)?.score ?? 0) : 0;
  return w * (100 - score);
};
const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;
const lerp = (a, b, t) => a + (b - a) * t;

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Animated ring ────────────────────────────────────────────────────────────
const AnimatedRing = ({ score, size = 160, strokeWidth = 14 }) => {
  const [displayed, setDisplayed] = useState(0);
  const r = size / 2 - strokeWidth;
  const circ = 2 * Math.PI * r;
  const offset = circ - (displayed / 100) * circ;
  const color = scoreColor(score);

  useEffect(() => {
    let start = null;
    const duration = 1400;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(lerp(0, score, ease)));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={C.violet} stopOpacity="0.6" />
          <stop offset="100%" stopColor={C.blue400} />
        </linearGradient>
        <filter id="ringGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#ringGrad)" strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.05s linear", filter: "url(#ringGlow)" }}
      />
      <g transform={`rotate(90, ${size / 2}, ${size / 2})`}>
        <text x={size / 2} y={size / 2 - 10} textAnchor="middle"
          fill={color} fontSize={34} fontWeight={900} fontFamily={F.display} dominantBaseline="middle"
        >{displayed}</text>
        <text x={size / 2} y={size / 2 + 18} textAnchor="middle"
          fill={C.muted} fontSize={9} fontWeight={700} letterSpacing="1.5" fontFamily={F.mono}
        >IRS SCORE</text>
      </g>
    </svg>
  );
};

// ─── Living Skill Aura ────────────────────────────────────────────────────────
const LivingAura = ({ data: radarData, irs, scoreTrend = [], onDrillDimension, companyOverlay = null }) => {
  const [pulse, setPulse] = useState(0);
  const [hoveredDim, setHoveredDim] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let t = 0;
    const tick = () => {
      t += 0.016;
      setPulse(Math.sin(t));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const ghostScores = useMemo(() => {
    const now = Date.now();
    const msDay = 86400000;
    const recentWindow = scoreTrend.filter(s => { const age = now - new Date(s.date).getTime(); return age >= 0 && age <= 7 * msDay; });
    const oldWindow = scoreTrend.filter(s => { const age = now - new Date(s.date).getTime(); return age > 14 * msDay && age <= 28 * msDay; });
    if (!oldWindow.length || !recentWindow.length) return null;
    const recentAvg = recentWindow.reduce((a, s) => a + (s.score || 0), 0) / recentWindow.length;
    const oldAvg = oldWindow.reduce((a, s) => a + (s.score || 0), 0) / oldWindow.length;
    const delta = recentAvg - oldAvg;
    return radarData.map(d => Math.max(0, Math.min(100, (d.score || 0) - delta)));
  }, [scoreTrend, radarData]);

  const hasGhost = ghostScores !== null;
  const N = radarData.length;
  const cx = 200, cy = 200, maxR = 142;

  const pointsForScaleData = (dataArr, scale) =>
    dataArr.map((score, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const r = (score / 100) * maxR * scale;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });

  const pointsForScale = (scale) =>
    radarData.map((d, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const r = (d.score / 100) * maxR * scale;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });

  const companyPts = companyOverlay
    ? pointsForScaleData(radarData.map(d => companyOverlay.scores[d.key] ?? 50), 1)
    : null;

  const toPath = (pts) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + "Z";

  const outerPts = pointsForScale(1);
  const midPts = pointsForScale(0.70 + pulse * 0.022);
  const innerPts = pointsForScale(0.42 + pulse * 0.016);
  const corePts = pointsForScale(0.22);
  const ghostPts = hasGhost ? pointsForScaleData(ghostScores, 1) : null;

  const labelPts = radarData.map((d, i) => {
    const angle = (2 * Math.PI * i) / N - Math.PI / 2;
    const r = maxR + 28;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), ...d };
  });

  const gridRings = [0.25, 0.5, 0.75, 1.0];
  const gridPolygon = (scale) =>
    Array.from({ length: N }, (_, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const r = maxR * scale;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 18, height: 3, borderRadius: 2, background: C.violet }} />
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.sub }}>NOW</span>
        </div>
        {hasGhost && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 18, height: 2, borderRadius: 2, background: C.amber, borderTop: `2px dashed ${C.amber}` }} />
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.sub }}>14 DAYS AGO</span>
          </div>
        )}
        {companyOverlay && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 18, height: 2, borderRadius: 2, background: C.green, borderTop: `2px dotted ${C.green}` }} />
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green }}>{companyOverlay.icon} TARGET</span>
          </div>
        )}
        {onDrillDimension && <div style={{ fontSize: 9, color: C.muted, fontFamily: F.mono }}>· Click label to drill</div>}
      </div>

      <svg viewBox="0 0 400 400" width="100%" style={{ maxWidth: 420, overflow: "visible" }}>
        <defs>
          <linearGradient id="auraRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.violet} stopOpacity="0.7" />
            <stop offset="100%" stopColor={C.blue400} />
          </linearGradient>
          <radialGradient id="auraCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.violet} stopOpacity="0.4" />
            <stop offset="100%" stopColor={C.violetMid} stopOpacity="0.04" />
          </radialGradient>
          <radialGradient id="auraMid" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.violetLight} stopOpacity="0.2" />
            <stop offset="100%" stopColor={C.blue400} stopOpacity="0.02" />
          </radialGradient>
          <radialGradient id="auraOuter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.blue300} stopOpacity="0.1" />
            <stop offset="100%" stopColor={C.blue200} stopOpacity="0.01" />
          </radialGradient>
          <filter id="auraGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {gridRings.map((s, i) => (
          <polygon key={i} points={gridPolygon(s)} fill="none" stroke={C.border}
            strokeWidth={i === gridRings.length - 1 ? 1.5 : 0.8} strokeOpacity={0.8} />
        ))}
        {gridRings.map((s, i) => {
          const angle = -Math.PI / 2;
          return <text key={i} x={cx + maxR * s * Math.cos(angle) + 4} y={cy + maxR * s * Math.sin(angle)}
            fill={C.faint} fontSize={7} fontFamily={F.mono}>{s * 100}</text>;
        })}
        {radarData.map((_, i) => {
          const angle = (2 * Math.PI * i) / N - Math.PI / 2;
          return <line key={i} x1={cx} y1={cy} x2={cx + maxR * Math.cos(angle)} y2={cy + maxR * Math.sin(angle)}
            stroke={C.border} strokeWidth={0.8} strokeOpacity={0.7} />;
        })}

        {hasGhost && ghostPts && (
          <path d={toPath(ghostPts)} fill={C.amber} fillOpacity={0.06}
            stroke={C.amber} strokeWidth={1.5} strokeOpacity={0.55} strokeDasharray="5 3" />
        )}
        {companyPts && (
          <path d={toPath(companyPts)} fill={C.green} fillOpacity={0.05}
            stroke={C.green} strokeWidth={2} strokeOpacity={0.75} strokeDasharray="3 4" />
        )}

        <path d={toPath(outerPts)} fill="url(#auraOuter)" stroke={C.blue300} strokeWidth={1} strokeOpacity={0.25 + pulse * 0.05} />
        <path d={toPath(midPts)} fill="url(#auraMid)" stroke={C.violetLight} strokeWidth={1.5} strokeOpacity={0.4 + pulse * 0.1} filter="url(#softGlow)" />
        <path d={toPath(innerPts)} fill="url(#auraCore)" stroke={C.violet} strokeWidth={2} strokeOpacity={0.65 + pulse * 0.15} filter="url(#auraGlow)" />
        <path d={toPath(corePts)} fill={C.violet} fillOpacity={0.18} stroke={C.violetMid} strokeWidth={1.5} />
        <path d={toPath(outerPts)} fill="none" stroke="url(#auraRingGrad)" strokeWidth={2.5} strokeOpacity={0.95} filter="url(#softGlow)" />

        {outerPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4.5}
            fill={C.dimColors[radarData[i]?.key] || scoreColor(radarData[i]?.score || 0)}
            stroke="#fff" strokeWidth={1.5} filter="url(#softGlow)" />
        ))}

        {labelPts.map(({ x, y, label, score, icon, key, contributingTopics }, i) => {
          const isHovered = hoveredDim === key;
          const canDrill = onDrillDimension && (contributingTopics?.length > 0);
          const dimColor = C.dimColors[key] || scoreColor(score);
          return (
            <g key={i} style={{ cursor: canDrill ? "pointer" : "default" }}
              onClick={() => canDrill && onDrillDimension(radarData[i])}
              onMouseEnter={() => setHoveredDim(key)}
              onMouseLeave={() => setHoveredDim(null)}>
              {canDrill && (
                <ellipse cx={x} cy={y} rx={34} ry={14}
                  fill={isHovered ? `${dimColor}18` : "transparent"}
                  stroke={isHovered ? `${dimColor}60` : "transparent"} strokeWidth={1} />
              )}
              <text x={x} y={y - 8} textAnchor="middle" dominantBaseline="middle"
                fill={isHovered ? dimColor : C.text}
                fontSize={10} fontWeight={800} fontFamily={F.body}>
                {icon} {label}{canDrill && isHovered ? " ↗" : ""}
              </text>
              <text x={x} y={y + 8} textAnchor="middle" dominantBaseline="middle"
                fill={dimColor} fontSize={11} fontWeight={700} fontFamily={F.display}>{score}</text>
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r={38} fill="white" fillOpacity={0.96}
          stroke={C.borderStr} strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 4px 16px rgba(26,110,255,0.18))" }} />
        <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
          fill={C.violet} fontSize={22} fontWeight={900} fontFamily={F.display}>{irs}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
          fill={C.muted} fontSize={7} fontWeight={800} letterSpacing="1.4" fontFamily={F.mono}>IRS</text>
      </svg>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TopicIntelligenceGrid — MockMate Analytics
//
// Replaces the old card-hover grid with a TERRAIN MAP:
//   • Hexagonal cells sized by session count, colored by score tier
//   • One orchestrated entrance (stagger); motion only on user action after
//   • Click → slide-in detail panel with sparkline + next-action drill
//   • Keyboard navigable, reduced-motion respected
//
// Props
//   topicData  — array from backend topicPerformance:
//     { topic, avgScore, sessionCount, trend, lastScore, sessions[] }
//   onDrill    — (topic) => void, called when user clicks "Drill"
// ═══════════════════════════════════════════════════════════════════════════



// ── Score tier helpers ───────────────────────────────────────────────────
const tier = (s) => {
  const n = Number(s) || 0;
  if (n >= 80) return { label: 'Mastered', color: C.green,  glow: 'rgba(5,150,105,.30)',  bg: C.greenTint, key: 'mastered' };
  if (n >= 60) return { label: 'Solid',    color: C.blue500, glow: 'rgba(26,110,255,.28)', bg: C.blue50,    key: 'solid'    };
  if (n >= 40) return { label: 'Building', color: C.amber,   glow: 'rgba(217,119,6,.28)', bg: C.amberTint, key: 'building' };
  return         { label: 'Weak',    color: C.red,    glow: 'rgba(220,38,38,.30)',  bg: C.redTint,   key: 'weak'     };
};

const trendLabel = (t) => {
  if (!t || t === 0) return { icon: '→', color: C.muted,  word: 'Stable' };
  if (t > 0)         return { icon: '↑', color: C.green,  word: `+${t} pts` };
  return               { icon: '↓', color: C.red,    word: `${t} pts` };
};

// ── Seed data (used when no props passed — remove in production) ─────────
const SEED_TOPICS = [
  { topic: 'Arrays & Hashing',    avgScore: 84, sessionCount: 12, trend:  6, lastScore: 88, sessions: [72,76,80,82,84,86,88] },
  { topic: 'Dynamic Programming', avgScore: 51, sessionCount:  9, trend: -3, lastScore: 48, sessions: [60,55,58,52,50,53,48] },
  { topic: 'Trees & Graphs',      avgScore: 73, sessionCount: 11, trend:  4, lastScore: 77, sessions: [62,66,70,71,74,75,77] },
  { topic: 'System Design',       avgScore: 38, sessionCount:  6, trend: -5, lastScore: 34, sessions: [45,42,40,38,36,35,34] },
  { topic: 'OOP Concepts',        avgScore: 91, sessionCount: 14, trend:  2, lastScore: 93, sessions: [85,87,88,90,91,92,93] },
  { topic: 'SQL & Databases',     avgScore: 67, sessionCount:  8, trend:  8, lastScore: 73, sessions: [52,55,60,63,67,70,73] },
  { topic: 'OS Fundamentals',     avgScore: 44, sessionCount:  7, trend:  1, lastScore: 45, sessions: [40,41,43,44,44,45,45] },
  { topic: 'Recursion',           avgScore: 78, sessionCount: 10, trend:  3, lastScore: 81, sessions: [68,70,73,76,77,79,81] },
  { topic: 'Bit Manipulation',    avgScore: 29, sessionCount:  4, trend: -8, lastScore: 22, sessions: [38,34,30,26,22] },
  { topic: 'Greedy Algorithms',   avgScore: 62, sessionCount:  7, trend:  5, lastScore: 67, sessions: [50,53,57,60,63,65,67] },
  { topic: 'Two Pointers',        avgScore: 88, sessionCount: 13, trend:  1, lastScore: 89, sessions: [80,83,84,86,87,88,89] },
  { topic: 'Backtracking',        avgScore: 55, sessionCount:  8, trend:  6, lastScore: 60, sessions: [42,45,48,52,55,57,60] },
];

// ── Sparkline SVG ────────────────────────────────────────────────────────
const Sparkline = ({ values = [], color = C.blue500, width = 140, height = 38 }) => {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const W = width - pad * 2;
  const H = height - pad * 2;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * W,
    pad + H - ((v - min) / range) * H,
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const fill = [...pts, [pts[pts.length - 1][0], pad + H], [pts[0][0], pad + H]];
  const fillD = fill.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`spk-fill-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#spk-fill-${color.replace('#','')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last dot */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.5" fill={color} />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="6" fill={color} fillOpacity="0.18" />
    </svg>
  );
};

// ── Hex cell SVG path generator ─────────────────────────────────────────
// Flat-top hexagon with given radius
const hexPath = (r) => {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i);
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
};

// ── Hex cell component ───────────────────────────────────────────────────
const HexCell = ({ data, index, isSelected, onClick, reducedMotion }) => {
  const t = tier(data.avgScore);
  const trnd = trendLabel(data.trend);

  // Size scales with session count (6 → 14 sessions → r 46 → 60)
  const minR = 44, maxR = 62;
  const minSess = 4, maxSess = 14;
  const r = minR + ((Math.min(data.sessionCount, maxSess) - minSess) / (maxSess - minSess)) * (maxR - minR);
  const dim = r * 2 + 8;

  const [mounted, setMounted] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (reducedMotion) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(true), index * 60);
    return () => clearTimeout(t);
  }, [index, reducedMotion]);

  // Pulse only when selected
  useEffect(() => {
    if (!isSelected) { setPulsing(false); return; }
    setPulsing(true);
  }, [isSelected]);

  const path = hexPath(r);

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`${data.topic}: ${data.avgScore} score, ${t.label}`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        flexShrink: 0,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'scale(1) translateY(0)' : 'scale(0.72) translateY(12px)',
        transition: reducedMotion ? 'none' : `opacity .4s ease ${index * 60}ms, transform .5s cubic-bezier(.22,1,.36,1) ${index * 60}ms`,
        outline: 'none',
        position: 'relative',
        zIndex: isSelected ? 2 : 1,
      }}
      className="tig-hex-btn"
    >
      <svg
        width={dim}
        height={dim}
        viewBox={`${-dim/2} ${-dim/2} ${dim} ${dim}`}
        style={{ overflow: 'visible', display: 'block' }}
      >
        <defs>
          <radialGradient id={`hg-${index}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor={t.color} stopOpacity={isSelected ? '0.28' : '0.12'} />
            <stop offset="100%" stopColor={t.color} stopOpacity={isSelected ? '0.18' : '0.04'} />
          </radialGradient>
          <filter id={`hf-${index}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={isSelected ? '4' : '2'} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Glow ring (selected only) */}
        {isSelected && (
          <path
            d={hexPath(r + 5)}
            fill="none"
            stroke={t.color}
            strokeWidth="2"
            strokeOpacity="0.35"
            style={{ filter: `blur(4px)` }}
          />
        )}

        {/* Pulse ring */}
        {pulsing && !reducedMotion && (
          <path
            d={hexPath(r + 10)}
            fill="none"
            stroke={t.color}
            strokeWidth="1.5"
            strokeOpacity="0"
            style={{ animation: 'tig-pulse 1.8s ease-out forwards' }}
          />
        )}

        {/* Border hex */}
        <path
          d={path}
          fill={`url(#hg-${index})`}
          stroke={isSelected ? t.color : t.color + '55'}
          strokeWidth={isSelected ? 2 : 1.5}
          style={{
            transition: reducedMotion ? 'none' : 'stroke .22s ease, stroke-width .22s ease',
            filter: isSelected ? `drop-shadow(0 0 8px ${t.glow})` : 'none',
          }}
        />

        {/* Score arc */}
        {(() => {
          const arcR = r - 7;
          const circ = 2 * Math.PI * arcR;
          const pct = Math.max(0, Math.min(100, data.avgScore));
          const offset = circ - (pct / 100) * circ;
          return (
            <>
              <circle cx="0" cy="0" r={arcR} fill="none" stroke={t.color} strokeWidth="2.5" strokeOpacity="0.10" />
              <circle
                cx="0" cy="0" r={arcR}
                fill="none"
                stroke={t.color}
                strokeWidth="2.5"
                strokeOpacity="0.75"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90)"
                style={{ transition: reducedMotion ? 'none' : 'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)' }}
              />
            </>
          );
        })()}

        {/* Score number */}
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          y="-4"
          fill={t.color}
          style={{
            fontFamily: F.display,
            fontSize: r > 54 ? '20px' : '17px',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            filter: isSelected ? `drop-shadow(0 0 6px ${t.glow})` : 'none',
          }}
        >
          {data.avgScore}
        </text>

        {/* Trend indicator */}
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          y="13"
          fill={trnd.color}
          style={{ fontFamily: F.mono, fontSize: '9px', fontWeight: 700 }}
        >
          {trnd.icon} {trnd.word}
        </text>
      </svg>

      {/* Label below hex */}
      <div
        style={{
          position: 'absolute',
          bottom: -22,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          color: isSelected ? t.color : C.sub,
          fontFamily: F.body,
          fontSize: '10.5px',
          fontWeight: isSelected ? 800 : 600,
          letterSpacing: '-0.01em',
          transition: reducedMotion ? 'none' : 'color .2s ease, font-weight .2s ease',
          pointerEvents: 'none',
        }}
      >
        {data.topic.length > 16 ? data.topic.slice(0, 15) + '…' : data.topic}
      </div>
    </button>
  );
};

// ── Detail panel ─────────────────────────────────────────────────────────
const DetailPanel = ({ data, onClose, onDrill, reducedMotion }) => {
  const t = tier(data.avgScore);
  const trnd = trendLabel(data.trend);

  const drillSuggestions = {
    mastered: ['Tackle hard LeetCode variants', 'Attempt timed mock without hints', 'Teach-back: explain in 90 sec'],
    solid:    ['Focus on edge cases', 'Try company-tagged variants', 'Work 2 unseen problems this week'],
    building: ['Redo the pattern from scratch', 'Slow down: write the invariant first', 'Watch one focused 20-min tutorial'],
    weak:     ['Start with concept recall — no code yet', 'Solve 3 easy variants back-to-back', 'Flag for SOS session with Coach'],
  };

  const drills = drillSuggestions[t.key] || drillSuggestions.building;

  return (
    <div
      style={{
        width: '100%',
        padding: '20px',
        borderRadius: '20px',
        border: `1.5px solid ${t.color}30`,
        background: `linear-gradient(150deg, ${t.bg} 0%, #fff 55%)`,
        boxShadow: `0 16px 48px ${t.glow}, 0 4px 14px rgba(0,31,107,.06), inset 0 1px 0 rgba(255,255,255,.9)`,
        animation: reducedMotion ? 'none' : 'tig-panel-in .28s cubic-bezier(.22,1,.36,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent top stripe */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px', borderRadius: '0 0 4px 4px',
        background: `linear-gradient(90deg, transparent, ${t.color}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: F.display, fontSize: '15px', fontWeight: 900,
            color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1,
          }}>
            {data.topic}
          </div>
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: '999px',
              background: t.color + '18', border: `1px solid ${t.color}40`,
              color: t.color, fontFamily: F.mono, fontSize: '9px', fontWeight: 800,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
              {t.label}
            </span>
            <span style={{
              color: trnd.color, fontFamily: F.mono, fontSize: '9px', fontWeight: 700,
            }}>
              {trnd.icon} {trnd.word}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 28, height: 28, borderRadius: 9, border: `1px solid ${C.border}`,
            background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
            color: C.muted, flexShrink: 0, transition: 'all .16s ease',
            fontFamily: F.mono, fontSize: '12px',
          }}
          className="tig-close-btn"
        >
          ✕
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 16 }}>
        {[
          { label: 'Avg Score', value: data.avgScore, color: t.color },
          { label: 'Sessions',  value: data.sessionCount, color: C.blue500 },
          { label: 'Last',      value: data.lastScore ?? '—', color: data.lastScore >= data.avgScore ? C.green : C.red },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            padding: '9px 8px', borderRadius: 12,
            background: '#fff', border: `1px solid ${C.border}`,
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: F.display, fontSize: '17px', fontWeight: 900, color, letterSpacing: '-0.04em' }}>
              {value}
            </div>
            <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: '7.5px', fontWeight: 700, color: C.muted, letterSpacing: '0.4px' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      {data.sessions?.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: F.mono, fontSize: '8px', fontWeight: 700, color: C.muted, marginBottom: 6, letterSpacing: '0.6px' }}>
            SCORE TRAJECTORY
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: 12,
            background: '#fff', border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Sparkline values={data.sessions} color={t.color} width={140} height={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.mono, fontSize: '8px', color: C.muted, marginBottom: 3 }}>
                {data.sessions.length} sessions
              </div>
              <div style={{
                fontFamily: F.display, fontSize: '12px', fontWeight: 700, color: C.sub,
              }}>
                {data.sessions[data.sessions.length - 1] > data.sessions[0]
                  ? 'Improving over time'
                  : data.sessions[data.sessions.length - 1] === data.sessions[0]
                  ? 'Consistent performance'
                  : 'Needs attention'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill suggestions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: F.mono, fontSize: '8px', fontWeight: 700, color: C.muted, marginBottom: 6, letterSpacing: '0.6px' }}>
          NEXT ACTIONS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {drills.map((d, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 10px', borderRadius: 10,
              background: '#fff', border: `1px solid ${C.border}`,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 6, flexShrink: 0, marginTop: 1,
                background: t.color + '18', color: t.color,
                display: 'grid', placeItems: 'center',
                fontFamily: F.mono, fontSize: '8px', fontWeight: 800,
              }}>
                {i + 1}
              </span>
              <span style={{ fontFamily: F.body, fontSize: '11.5px', fontWeight: 500, color: C.sub, lineHeight: 1.4 }}>
                {d}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onDrill(data.topic)}
        style={{
          width: '100%', height: 42, borderRadius: 12, border: 'none',
          background: `linear-gradient(150deg, ${t.color}ee 0%, ${t.color} 100%)`,
          color: '#fff', cursor: 'pointer',
          fontFamily: F.body, fontSize: '12.5px', fontWeight: 700,
          letterSpacing: '-0.01em',
          boxShadow: `0 8px 22px ${t.glow}, inset 0 1px 0 rgba(255,255,255,.30)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: reducedMotion ? 'none' : 'transform .2s ease, box-shadow .2s ease',
          position: 'relative', overflow: 'hidden',
        }}
        className="tig-drill-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21M8.5 21h7" />
        </svg>
        Start Drill Session
      </button>
    </div>
  );
};

// ── Legend ────────────────────────────────────────────────────────────────
const Legend = () => (
  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
    {[
      { label: 'Mastered', color: C.green,  range: '80+' },
      { label: 'Solid',    color: C.blue500, range: '60–79' },
      { label: 'Building', color: C.amber,   range: '40–59' },
      { label: 'Weak',     color: C.red,     range: '< 40' },
    ].map(({ label, color, range }) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 24, height: 24, display: 'inline-block',
          background: `${color}18`, border: `1.5px solid ${color}55`,
          borderRadius: 5,
        }} />
        <span style={{ fontFamily: F.body, fontSize: '11px', fontWeight: 600, color: C.sub }}>
          {label}
          <span style={{ marginLeft: 4, fontFamily: F.mono, fontSize: '9px', color: C.muted }}>
            ({range})
          </span>
        </span>
      </div>
    ))}
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted }}>Cell size</span>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: C.border }} />
      <span style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted }}>= session count</span>
    </div>
  </div>
);

// ── Summary bar ───────────────────────────────────────────────────────────
const SummaryBar = ({ topics }) => {
  const counts = { mastered: 0, solid: 0, building: 0, weak: 0 };
  topics.forEach(t => { counts[tier(t.avgScore).key]++; });
  const total = topics.length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Progress bar */}
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: C.border, overflow: 'hidden', display: 'flex' }}>
        {[
          { key: 'mastered', color: C.green  },
          { key: 'solid',    color: C.blue500 },
          { key: 'building', color: C.amber   },
          { key: 'weak',     color: C.red     },
        ].map(({ key, color }) => (
          counts[key] > 0 && (
            <div key={key} style={{
              width: `${(counts[key] / total) * 100}%`, height: '100%',
              background: color, transition: 'width .8s cubic-bezier(.22,1,.36,1)',
            }} />
          )
        ))}
      </div>

      {/* Counts */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        {[
          { key: 'mastered', color: C.green,   label: `${counts.mastered} mastered` },
          { key: 'weak',     color: C.red,      label: `${counts.weak} weak`         },
        ].map(({ color, label }) => (
          <span key={label} style={{
            fontFamily: F.mono, fontSize: '9px', fontWeight: 700, color,
          }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
const TopicIntelligenceGrid = ({ topicData, onDrill }) => {
  const topics = topicData?.length ? topicData : SEED_TOPICS;
  const [selected, setSelected] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleSelect = useCallback((topic) => {
    setSelected(prev => prev?.topic === topic.topic ? null : topic);
  }, []);

  const handleDrill = useCallback((topicName) => {
    if (onDrill) onDrill(topicName);
    else alert(`Launching drill session: ${topicName}`);
  }, [onDrill]);

  // Sort: weak first (need attention), then building, solid, mastered
  const sorted = [...topics].sort((a, b) => {
    const order = { weak: 0, building: 1, solid: 2, mastered: 3 };
    return order[tier(a.avgScore).key] - order[tier(b.avgScore).key];
  });

  return (
    <>
      <style>{`
        @keyframes tig-pulse {
          0%   { stroke-opacity: 0.6; stroke-dashoffset: 0; }
          100% { stroke-opacity: 0; stroke-dashoffset: -60; }
        }
        @keyframes tig-panel-in {
          from { opacity: 0; transform: translateX(14px) scale(.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        .tig-hex-btn:focus-visible { outline: 2px solid #1A6EFF; outline-offset: 4px; border-radius: 6px; }
        .tig-hex-btn:hover > svg path:first-child,
        .tig-hex-btn:hover > svg circle:last-child {
          filter: brightness(1.1);
        }
        .tig-drill-btn:hover { transform: translateY(-2px); }
        .tig-drill-btn:active { transform: scale(.97); }
        .tig-close-btn:hover { background: #FEF2F2; border-color: #fca5a5; color: #DC2626; }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div style={{
        padding: '24px',
        borderRadius: '24px',
        background: C.card,
        border: `1px solid ${C.border}`,
        boxShadow: '0 8px 32px rgba(0,31,107,.07), 0 2px 8px rgba(0,31,107,.04)',
      }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <h2 style={{
                margin: 0, fontFamily: F.display, fontSize: '17px', fontWeight: 900,
                color: C.text, letterSpacing: '-0.04em',
              }}>
                Topic Intelligence
              </h2>
              <p style={{ margin: '4px 0 0', fontFamily: F.body, fontSize: '12px', color: C.muted, fontWeight: 500 }}>
                {topics.length} topics mapped · click any cell to drill down
              </p>
            </div>

            {/* Session count scale indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '6px 10px', borderRadius: 10, background: C.bgDeep, border: `1px solid ${C.border}`,
            }}>
              {[18, 24, 30].map((r, i) => (
                <div key={i} style={{
                  width: r, height: r, borderRadius: '50%',
                  background: `${C.blue500}${['12','1a','24'][i]}`,
                  border: `1.5px solid ${C.blue500}${['30','44','66'][i]}`,
                }} />
              ))}
              <span style={{ fontFamily: F.mono, fontSize: '8px', color: C.muted, fontWeight: 700 }}>sessions</span>
            </div>
          </div>

          <SummaryBar topics={topics} />
        </div>

        {/* Two-column layout: grid + panel */}
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 240px' : '1fr', gap: 20, alignItems: 'start' }}>

          {/* Hex terrain */}
          <div style={{ minWidth: 0 }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '36px 18px',
              padding: '12px 8px 36px',
              justifyContent: 'flex-start',
            }}>
              {sorted.map((topic, i) => (
                <HexCell
                  key={topic.topic}
                  data={topic}
                  index={i}
                  isSelected={selected?.topic === topic.topic}
                  onClick={() => handleSelect(topic)}
                  reducedMotion={reducedMotion}
                />
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div ref={panelRef} style={{ position: 'sticky', top: 100 }}>
              <DetailPanel
                data={selected}
                onClose={() => setSelected(null)}
                onDrill={handleDrill}
                reducedMotion={reducedMotion}
              />
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 4, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <Legend />
        </div>
      </div>
    </>
  );
};

// ─── Cold Start vs Warm Up ────────────────────────────────────────────────────
const ColdStartWarmUpCard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await getSessionWarmup()); }
      catch { /* silently fail */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !data?.available) return null;
  const { positions, pattern } = data;
  const patternConfig = {
    warmup:     { label: "Warm-Up Performer",   icon: "🔥", color: C.orange,  desc: "You score higher in your 2nd+ session. Let your brain warm up before high-stakes practice." },
    coldstart:  { label: "Cold Start Performer", icon: "⚡", color: C.blue500, desc: "You score highest in your 1st session. Use mornings for the hardest topics." },
    consistent: { label: "Consistent Performer", icon: "⚖️", color: C.green,  desc: "Session order doesn't affect your performance. You're mentally well-calibrated." },
  };
  const cfg = patternConfig[pattern] || patternConfig.consistent;
  const maxScore = Math.max(...positions.map(p => p.avgScore));

  return (
    <div style={{ ...S.card, marginBottom: 18 }}>
      <div style={{ ...S.eyebrow, color: C.violet }}>COLD START vs WARM UP</div>
      <h2 style={S.cardH2}>Does session order affect your score?</h2>
      <p style={{ ...S.cardSub, marginBottom: 14 }}>Based on your multi-session days.</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, background: `${cfg.color}10`, border: `1.5px solid ${cfg.color}35`, marginBottom: 16 }}>
        <span style={{ fontSize: 24 }}>{cfg.icon}</span>
        <div>
          <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{cfg.desc}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {positions.map(p => {
          const isMax = p.avgScore === maxScore;
          return (
            <div key={p.position} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 88, fontSize: 11.5, fontWeight: 700, color: C.text, flexShrink: 0 }}>{p.label}</div>
              <div style={{ flex: 1, height: 10, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${p.avgScore}%`, background: isMax ? cfg.color : C.blue200, borderRadius: 999, transition: "width 1s ease" }} />
              </div>
              <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: isMax ? cfg.color : C.muted, width: 34, textAlign: "right", flexShrink: 0 }}>{p.avgScore}</div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, width: 48, flexShrink: 0 }}>{p.count} session{p.count !== 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Skill Velocity Graph ─────────────────────────────────────────────────────
const VELOCITY_COLORS = {
  technical:      C.dimColors.technical,
  problemSolving: C.dimColors.problemSolving,
  communication:  C.dimColors.communication,
  behavioral:     C.dimColors.behavioral,
  design:         C.dimColors.design,
  fundamentals:   C.dimColors.fundamentals,
};
const VELOCITY_LABELS = {
  technical: "Technical", problemSolving: "Problem Solving",
  communication: "Communication", behavioral: "Behavioral",
  design: "System Design", fundamentals: "CS Fundamentals",
};

const SkillVelocityGraph = ({ scoreTrend }) => {
  const [activeDims, setActiveDims] = useState(new Set(["technical", "problemSolving", "communication"]));

  const chartData = useMemo(() => {
    if (!scoreTrend?.length) return [];
    return scoreTrend.map((s, i) => {
      const row = {
        session: `#${i + 1}`,
        date: s.date ? new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : `S${i + 1}`,
      };
      const ts = s.topicScores || {};
      Object.keys(VELOCITY_LABELS).forEach(key => { row[key] = ts[key] ?? null; });
      return row;
    });
  }, [scoreTrend]);

  const dimsWithData = useMemo(() =>
    Object.keys(VELOCITY_LABELS).filter(key => chartData.filter(r => r[key] !== null).length >= 2),
    [chartData]);

  const toggleDim = (key) => {
    setActiveDims(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  if (!chartData.length || !dimsWithData.length) return null;

  return (
    <div style={{ ...S.card, marginBottom: 18 }}>
      <div style={{ ...S.eyebrow, color: C.violet }}>SKILL VELOCITY</div>
      <h2 style={S.cardH2}>Rate of improvement per dimension</h2>
      <p style={{ ...S.cardSub, marginBottom: 14 }}>Steeper = faster growth. Toggle dimensions to focus.</p>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {dimsWithData.map(key => {
          const active = activeDims.has(key);
          const color = VELOCITY_COLORS[key];
          return (
            <button key={key} onClick={() => toggleDim(key)}
              className={`an-tab${active ? " an-tab-active" : ""}`}
              style={{
                border: `1.5px solid ${active ? color : C.border}`,
                borderRadius: 999, padding: "5px 13px",
                background: active ? `${color}15` : C.cardAlt,
                color: active ? color : C.muted,
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F.body,
              }}>
              {VELOCITY_LABELS[key]}
            </button>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 9, fontFamily: F.mono }} />
          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 9, fontFamily: F.mono }} />
          <Tooltip
            formatter={(v, name) => [v !== null ? `${v}/100` : "—", VELOCITY_LABELS[name] || name]}
            contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: F.body, fontSize: 11 }}
            labelStyle={{ color: C.sub, fontSize: 10 }}
          />
          {dimsWithData.filter(k => activeDims.has(k)).map(key => (
            <Line key={key} type="monotone" dataKey={key}
              stroke={VELOCITY_COLORS[key]} strokeWidth={2}
              dot={{ r: 3, fill: VELOCITY_COLORS[key], strokeWidth: 0 }}
              activeDot={{ r: 5 }} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Blind Spot Alert ─────────────────────────────────────────────────────────
const BlindSpotAlertCard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await getBlindSpots()); }
      catch { /* silently fail */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !data || !data.blindSpots?.length) return null;
  const { blindSpots, sessionsAnalyzed } = data;
  const severityConfig = {
    high:   { color: C.red,    bg: C.redTint,   icon: "🔴", label: "High" },
    medium: { color: C.orange, bg: C.orangeTint, icon: "🟠", label: "Medium" },
    low:    { color: C.amber,  bg: C.amberTint,  icon: "🟡", label: "Low" },
  };

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${C.red}`, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...S.eyebrow, color: C.red }}>🚨 RECURRING BLIND SPOT ALERT</div>
          <h2 style={S.cardH2}>These topics keep showing up as weaknesses</h2>
          <p style={S.cardSub}>Detected across your last {sessionsAnalyzed} sessions. These aren't random — they're patterns.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {blindSpots.map((spot, i) => {
          const cfg = severityConfig[spot.severity];
          return (
            <div key={spot.topic} style={{ padding: "12px 14px", borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, fontFamily: F.mono, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text, textTransform: "capitalize" }}>{spot.topic}</div>
                <div style={{ fontSize: 10, color: cfg.color, fontFamily: F.mono, marginTop: 2 }}>
                  {cfg.icon} {cfg.label} · {spot.sessionCount}/{sessionsAnalyzed} sessions
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11.5, color: C.sub, lineHeight: 1.6 }}>
        Blind spots require <strong style={{ color: C.text }}>targeted isolation drills</strong>, not just more sessions. Pick #1 and do a dedicated topic-mode session.
      </div>
    </div>
  );
};

// ─── Session Quality Breakdown ────────────────────────────────────────────────
const SessionQualityCard = () => {
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try { setBreakdown(await getLastSessionBreakdown()); }
      catch { setError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div style={S.card} className="an-card">
      <div style={{ ...S.eyebrow, color: C.violet }}>LAST SESSION QUALITY</div>
      <div style={{ color: C.muted, fontSize: 12, padding: "16px 0" }}>Loading session data…</div>
    </div>
  );
  if (error || !breakdown) return null;

  const { questions = [], sessionScore, avgTimeTaken, skipRate, sessionMode, sessionDate, totalQuestions } = breakdown;
  const answered = questions.filter(q => !q.skipped);
  const fast = answered.filter(q => q.timeTaken < 25).length;
  const slow = answered.filter(q => q.timeTaken > 55).length;
  const perfect = answered.filter(q => q.score >= 90).length;
  const struggle = answered.filter(q => q.score < 50).length;
  const timeLabel = avgTimeTaken < 25 ? "Fast paced ⚡" : avgTimeTaken > 55 ? "Methodical 🧠" : "Balanced ⚖️";
  const date = sessionDate ? new Date(sessionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

  return (
    <div style={S.card} className="an-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ ...S.eyebrow, color: C.violet }}>LAST SESSION QUALITY</div>
          <h2 style={S.cardH2}>Per-question breakdown · {date}</h2>
          <p style={{ ...S.cardSub, marginBottom: 12 }}>{totalQuestions} questions · {sessionMode} mode · session score {sessionScore}/100</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Avg time", value: `${avgTimeTaken}s`, sub: timeLabel, color: C.blue600 },
            { label: "Skip rate", value: `${skipRate}%`, sub: skipRate > 30 ? "High — review skips" : "Good coverage", color: skipRate > 30 ? C.orange : C.green },
            { label: "Perfect (90+)", value: perfect, sub: `of ${answered.length} answered`, color: C.green },
            { label: "Struggled (<50)", value: struggle, sub: `of ${answered.length} answered`, color: struggle > 2 ? C.red : C.muted },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ padding: "8px 12px", borderRadius: 10, background: C.cardAlt, border: `1px solid ${C.border}`, textAlign: "center", minWidth: 72 }}>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 1 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
        {questions.map((q, i) => {
          const barColor = q.skipped ? C.faint : scoreColor(q.score);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, width: 16, flexShrink: 0, textAlign: "right" }}>Q{q.index}</div>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: q.skipped ? "100%" : `${q.score}%`, background: q.skipped ? C.border : barColor, borderRadius: 999, opacity: q.skipped ? 0.4 : 1 }} />
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: barColor, width: 26, textAlign: "right", flexShrink: 0 }}>{q.skipped ? "skip" : q.score}</div>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, width: 30, textAlign: "right", flexShrink: 0 }}>{q.skipped ? "" : `${q.timeTaken}s`}</div>
              <div style={{ fontSize: 9, color: C.muted, width: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{q.topic}</div>
            </div>
          );
        })}
      </div>
      {answered.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: C.violetTint, border: `1px solid ${C.violet}20`, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: C.sub }}><strong style={{ color: C.blue600 }}>{fast}</strong> fast (&lt;25s)</div>
          <div style={{ fontSize: 11, color: C.sub }}><strong style={{ color: C.violet }}>{answered.length - fast - slow}</strong> normal</div>
          <div style={{ fontSize: 11, color: C.sub }}><strong style={{ color: C.amber }}>{slow}</strong> slow (&gt;55s)</div>
        </div>
      )}
    </div>
  );
};

// ─── Dimension Drill Panel ────────────────────────────────────────────────────
const DimensionDrillPanel = ({ dim, onClose, navigate }) => {
  if (!dim) return null;
  const topics = dim.contributingTopics || [];
  const score = dim.score || 0;
  const col = C.dimColors[dim.key] || scoreColor(score);

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "min(380px, 95vw)",
      background: C.card, borderLeft: `2px solid ${C.borderMd}`,
      boxShadow: C.shadowLg, zIndex: 9999,
      display: "flex", flexDirection: "column",
      animation: "slideInRight 0.25s cubic-bezier(.16,1,.3,1)", overflowY: "auto",
    }}>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ ...S.eyebrow, color: col }}>DIMENSION DRILL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <span style={{ fontSize: 22 }}>{dim.icon}</span>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text }}>{dim.label}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{Math.round((dim.weight ?? 0) * 100)}% IRS weight</div>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: `${col}10`, border: `1px solid ${col}30`, borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: C.sub, fontFamily: F.body, flexShrink: 0 }}>✕</button>
      </div>
      <div style={{ margin: "16px 20px", padding: "14px 16px", background: `${col}10`, border: `1.5px solid ${col}40`, borderRadius: 14, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: F.display, fontSize: 38, fontWeight: 900, color: col, lineHeight: 1 }}>{score}</div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
            {score >= 80 ? "Strong — above par" : score >= 60 ? "Developing — closing fast" : "Focus area — highest leverage"}
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{dim.tip}</div>
        </div>
      </div>
      <div style={{ padding: "0 20px", marginBottom: 16 }}>
        <div style={{ ...S.eyebrow, color: col }}>CONTRIBUTING TOPICS</div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {topics.length === 0 && <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>No topic data mapped yet.</div>}
          {topics.map((topic, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: `${col}08`, border: `1px solid ${col}25` }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{topic}</div>
              <div style={{ fontSize: 10, color: col, fontFamily: F.mono }}>→ {dim.label}</div>
            </div>
          ))}
        </div>
      </div>
      {dim.answeredCount != null && (
        <div style={{ margin: "0 20px 16px", padding: "12px 14px", background: `${col}08`, border: `1px solid ${col}25`, borderRadius: 12, fontSize: 11.5, color: C.sub, lineHeight: 1.6 }}>
          <strong style={{ color: col }}>Evidence:</strong> {dim.answeredCount} answered questions in this dimension.
          {dim.isProvisional && <span style={{ color: C.amber }}> Score is provisional — keep practicing to stabilize.</span>}
        </div>
      )}
      <div style={{ padding: "0 20px 24px", marginTop: "auto" }}>
        <button style={{ ...S.btnPrimary, width: "100%", textAlign: "center", display: "block", background: `linear-gradient(135deg, ${col}, ${col}CC)` }}
          onClick={() => { onClose(); navigate("/interview"); }}>
          ⚡ Drill {dim.label} now →
        </button>
      </div>
    </div>
  );
};

// ─── DNA Fingerprint ──────────────────────────────────────────────────────────
const DNAFingerprint = ({ profile }) => {
  const seed = profile.reduce((acc, d) => acc + d.score, 0);
  const paths = profile.map((d, i) => {
    const freq = 0.038 + (d.score / 100) * 0.07;
    const amp = 16 + (d.score / 100) * 30;
    const yBase = 22 + i * 30;
    const color = C.dimColors[d.key] || scoreColor(d.score);
    const pts = Array.from({ length: 80 }, (_, j) => {
      const x = (j / 79) * 340 + 10;
      const y = yBase + Math.sin(j * freq + (seed % 7)) * amp * (d.score / 100);
      return `${j === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return { pts, color, label: d.label, score: d.score, icon: d.icon };
  });

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox="0 0 360 212" width="100%" style={{ overflow: "visible" }}>
        <defs>
          <filter id="dnaGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {paths.map(({ pts, color, label, score: s, icon }, i) => (
          <g key={i}>
            <path d={pts} fill="none" stroke={color} strokeWidth={1.8} strokeOpacity={0.7} filter="url(#dnaGlow)" />
            <text x={352} y={22 + i * 30} textAnchor="end"
              fill={C.muted} fontSize={8} fontWeight={600} fontFamily={F.body} dominantBaseline="middle">
              {icon} {label} <tspan fill={color} fontWeight={800}>{s}</tspan>
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ─── Streak Calendar ──────────────────────────────────────────────────────────
const StreakCalendar = ({ scoreTrend }) => {
  const today = new Date();
  const WEEKS = 15;
  const DAYS = WEEKS * 7;
  const sessionMap = useMemo(() => {
    const map = {};
    (scoreTrend || []).forEach(s => {
      const raw = s.date || s.createdAt;
      if (!raw) return;
      const d = new Date(raw);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key] || (s.score || 0) > map[key]) map[key] = s.score || 0;
    });
    return map;
  }, [scoreTrend]);

  const cells = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (DAYS - 1 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return { date: d, score: sessionMap[key] ?? 0, hasData: key in sessionMap };
  });

  const heatColor = (score, hasData) => {
    if (!hasData) return C.border;
    if (score >= 85) return C.violetMid;
    if (score >= 70) return C.violet;
    if (score >= 55) return C.violetLight;
    if (score >= 40) return `${C.violet}70`;
    return `${C.violet}35`;
  };

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: WEEKS }, (_, w) => (
          <div key={w} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {cells.slice(w * 7, w * 7 + 7).map((cell, d) => (
              <div key={d}
                title={cell.hasData ? `${cell.date.toDateString()} · Score: ${cell.score}` : cell.date.toDateString()}
                style={{
                  width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                  background: heatColor(cell.score, cell.hasData),
                  cursor: cell.hasData ? "pointer" : "default",
                  transition: "transform 0.12s",
                  border: cell.hasData ? "none" : `1px solid ${C.border}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.45)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>Low</span>
        {[`${C.violet}35`, `${C.violet}70`, C.violetLight, C.violet, C.violetMid].map((bg, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: bg, flexShrink: 0 }} />
        ))}
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>High</span>
      </div>
    </div>
  );
};

// ─── Metric card ──────────────────────────────────────────────────────────────
const MetricCard = ({ icon, label, value, sub, color, accentColor }) => (
  <div className="an-stat-card" style={{
    display: "flex", alignItems: "center", gap: 14,
    padding: "20px 18px", background: C.card,
    border: `1px solid ${C.border}`, borderRadius: 18,
    boxShadow: "0 2px 16px rgba(26,110,255,0.06)",
    borderTop: `3px solid ${accentColor || color}`,
  }}>
    <div style={{
      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
      background: `${accentColor || color}15`,
      border: `1px solid ${accentColor || color}30`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21,
    }}>{icon}</div>
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: "0.8px", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: F.display, fontSize: 23, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.3px" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  </div>
);



// ─── Momentum badge ───────────────────────────────────────────────────────────
const getMomentum = (scoreTrend, topic) => {
  if (!scoreTrend || scoreTrend.length < 3) return "stable";
  const relevant = scoreTrend
    .filter(s => (s.topics || []).some(t => t.toLowerCase() === topic.toLowerCase()))
    .slice(-4).map(s => s.score || 0);
  if (relevant.length < 2) return "stable";
  const delta = relevant[relevant.length - 1] - relevant[0];
  if (delta > 8) return "rising";
  if (delta < -8) return "falling";
  return "stable";
};

const MomentumBadge = ({ momentum }) => {
  const cfg = {
    rising:  { icon: "↑", color: C.green,  bg: C.greenTint, label: "Rising" },
    falling: { icon: "↓", color: C.red,    bg: C.redTint,   label: "Falling" },
    stable:  { icon: "→", color: C.violet, bg: C.violetTint, label: "Stable" },
  }[momentum] || { icon: "→", color: C.muted, bg: C.border, label: "—" };
  return (
    <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 800, color: cfg.color, background: cfg.bg, whiteSpace: "nowrap", fontFamily: F.mono }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// ─── AnimatedSection: staggered scroll-triggered entrance ────────────────────
const AnimatedSection = ({ children, delay = 0, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.06 }
    );
    const t = setTimeout(() => observer.observe(el), delay);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [delay]);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── IRS Component Bar ────────────────────────────────────────────────────────
const IRSComponentBar = ({ label, value, weight, color }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{label}</span>
        <span style={{ marginLeft: 8, fontFamily: F.mono, fontSize: 9, color: C.muted }}>weight {Math.round(weight * 100)}%</span>
      </div>
      <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color }}>{value}</span>
    </div>
    <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 999, transition: "width 1s ease" }} />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// FULL AI PROFILE — War Room Edition
// Deep indigo shell, distinct from Dashboard's blue modal.
// Same prompts/logic, completely different visual identity.
// ═══════════════════════════════════════════════════════════════════════════
const FullAIProfileSection = ({ dimensionProfile, scoreTrend, archetype, totalSessions, irs, topTier, weakest, strongest }) => {
  const [boardSections, setBoardSections] = useState([]);
  const [boardRaw, setBoardRaw] = useState("");
  const [boardDone, setBoardDone] = useState(false);
  const [dnaSections, setDnaSections] = useState([]);
  const [dnaRaw, setDnaRaw] = useState("");
  const [dnaDone, setDnaDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const slope = trendSlope((scoreTrend || []).slice(-6).map(s => s.score || 0));
  const sd = stdDev((scoreTrend || []).map(s => s.score || 0));

  // War-room section accents — violet-forward instead of Dashboard's cyan
  const boardAccents = {
    "HONEST VERDICT":              C.violetLight,
    "THE REAL PROBLEM":            C.red,
    "WHAT'S ACTUALLY WORKING":     C.green,
    "YOUR NEXT 30 DAYS":           C.blue400,
    "ONE THING MOST COACHES WON'T SAY": C.amber,
    // fallback keys matching old prompt format
    "VERDICT":                     C.violetLight,
    "CRITICAL GAPS":               C.red,
    "STRENGTHS TO LEVERAGE":       C.green,
    "30-DAY BATTLE PLAN":          C.blue400,
    "MINDSET ALERT":               C.amber,
  };

  const boardIcons = {
    "HONEST VERDICT": "🎯", "THE REAL PROBLEM": "🚨",
    "WHAT'S ACTUALLY WORKING": "✨", "YOUR NEXT 30 DAYS": "📅",
    "ONE THING MOST COACHES WON'T SAY": "🧠",
    "VERDICT": "🎯", "CRITICAL GAPS": "🚨",
    "STRENGTHS TO LEVERAGE": "✨", "30-DAY BATTLE PLAN": "📅", "MINDSET ALERT": "🧠",
  };

  const dnaColors = {
    "RESPONSE STYLE": C.blue500, "PRESSURE RESPONSE": C.violet,
    "KNOWLEDGE PATTERN": C.green, "GROWTH EDGE": C.amber,
  };
  const dnaIcons = { "RESPONSE STYLE": "💬", "PRESSURE RESPONSE": "🔥", "KNOWLEDGE PATTERN": "📚", "GROWTH EDGE": "🎯" };

  const parseSections = (text, accentMap) =>
    text.split(/\n(?=[A-Z][A-Z ']{3,}\n)/).filter(Boolean)
      .map(section => {
        const lines = section.trim().split("\n");
        const heading = lines[0].trim();
        const body = lines.slice(1).join("\n").trim();
        return { heading, body, accent: accentMap[heading] || C.violet };
      }).filter(s => s.heading && s.body);

  const generateBoth = async () => {
    setLoading(true);
    setBoardDone(false); setDnaDone(false);
    setBoardSections([]); setDnaSections([]);
    setBoardRaw(""); setDnaRaw("");
    setDone(false);

    const topicLines = (dimensionProfile || []).filter(d => d.hasData).sort((a, b) => a.score - b.score)
      .map(d => {
        const gap = 100 - d.score;
        const urgency = d.score < 40 ? "🔴 critical" : d.score < 60 ? "🟠 weak" : d.score < 75 ? "🟡 developing" : "🟢 solid";
        const topics = (d.contributingTopics || []).slice(0, 3).join(", ");
        return `  ${d.label}: ${d.score}/100 [${urgency}] — IRS weight ${Math.round((d.weight ?? 0) * 100)}%, gap ${gap} pts${topics ? ` — covers: ${topics}` : ""}`;
      }).join("\n");

    const recentTrend = scoreTrend.slice(-5).map((s, i) => `S${scoreTrend.length - 4 + i}: ${s.score}`).join(" → ");
    const trendVerdict = slope > 3 ? "accelerating upward" : slope > 0.5 ? "slowly improving" : slope > -0.5 ? "flatlined" : "declining — needs urgent reset";
    const varianceVerdict = sd > 18 ? "dangerously inconsistent" : sd > 10 ? "moderately inconsistent" : "consistent — a real strength";
    const tierGap = topTier ? `currently at ${topTier.label}` : "tier not yet determined";
    const sessionVerdict = totalSessions < 5 ? "early stage" : totalSessions < 15 ? "building — patterns becoming clear" : "established — full behavioral picture available";

    const boardPrompt = `You are coach, MockMate's senior placement coach. You have coached 200+ Indian CS students through campus placements at companies ranging from TCS to Google. You speak directly, honestly, and personally — like a senior who genuinely wants this student to succeed, not a bot generating a report.

You are looking at this student's real data right now. Talk to them like you're sitting across the table.

STUDENT DATA:
- Sessions completed: ${totalSessions} (${sessionVerdict})
- Current IRS: ${irs}/100 | Package tier: ${topTier?.label}
- ${tierGap}
- Best ever score: ${strongest?.score ?? "—"}/100 | Weakest dimension: ${weakest?.label ?? "—"} at ${weakest?.score ?? "—"}/100
- Score trend (last 5): ${recentTrend || "not enough data"}
- Trend direction: ${trendVerdict}
- Score consistency: ${varianceVerdict} (std-dev: ${sd.toFixed(1)})
- Archetype: ${archetype?.label} — ${archetype?.desc}

DIMENSION BREAKDOWN (sorted weakest → strongest):
${topicLines || "  No dimension data yet"}

YOUR TASK:
Write a personal coaching message to this student. Not a report. Not bullet points. Talk to them.

Structure your response EXACTLY like this — use these exact heading names, each on its own line, followed by your message in plain conversational prose:

HONEST VERDICT
[2-3 sentences. Tell them exactly where they stand. Use their actual IRS number and tier. Don't soften it.]

THE REAL PROBLEM
[3-4 sentences. Identify the single root cause holding their IRS back most. Name the specific dimension, score, and why that gap matters in actual interviews.]

WHAT'S ACTUALLY WORKING
[2-3 sentences. Find the genuine strength. Reference their strongest dimension or best score. Tell them exactly how to weaponize it in interviews.]

YOUR NEXT 30 DAYS
[4 specific weekly actions. Each starts with "Week N:". Be concrete — name the topic, the mode, and the target score.]

ONE THING MOST COACHES WON'T SAY
[2-3 sentences. The uncomfortable truth about their pattern. What does this predict about their real interview performance if nothing changes?]

Rules:
- Every number must come from the data above — never invent stats
- Write as coach speaking to the student directly
- No markdown, no asterisks, no bullet dashes
- Total length: 350-450 words`;

    const dnaPrompt = `You are MockMate's behavioral analysis system. You have just finished reading ${totalSessions} completed mock interview sessions from one student. This is not a generic profile — this is derived from actual performance patterns.

BEHAVIORAL SIGNALS:
- Score std-dev: ${sd.toFixed(1)} → ${sd > 18 ? "HIGH variance" : sd > 10 ? "moderate variance" : "LOW variance"}
- Trend slope over last 6 sessions: ${slope.toFixed(2)} pts/session
- Archetype: ${archetype?.label} — ${archetype?.desc}
- Strongest area: ${strongest?.label ?? "unclear"} (${strongest?.score ?? "—"}/100)
- Biggest gap: ${weakest?.label ?? "unclear"} (${weakest?.score ?? "—"}/100)
- Session count: ${totalSessions}

Write EXACTLY 4 behavioral observations, using EXACTLY these headings:

RESPONSE STYLE
[One precise sentence about HOW they communicate answers — pace, structure, confidence pattern.]

PRESSURE RESPONSE
[One precise sentence about what the variance data reveals about performance under pressure.]

KNOWLEDGE PATTERN
[One precise sentence about dimension scores and knowledge structure — specialist vs generalist.]

GROWTH EDGE
[One precise sentence naming the single behavioral change that would move their IRS fastest.]

Rules: Write as an observer, reference actual numbers, each observation ONE sentence only, total under 150 words.`;

    try {
      const [boardResult, dnaResult] = await Promise.allSettled([
        getAIFreeform(boardPrompt, 1000),
        totalSessions >= 10 ? getAIFreeform(dnaPrompt, 600) : Promise.resolve(""),
      ]);

      const boardText = boardResult.status === "fulfilled" ? boardResult.value : "";
      const dnaText = dnaResult.status === "fulfilled" ? dnaResult.value : "";

      setBoardRaw(boardText || "Unable to generate the placement coach analysis.");
      setBoardSections(parseSections(boardText, boardAccents));
      setBoardDone(true);

      setDnaRaw(dnaText);
      setDnaSections(parseSections(dnaText, dnaColors));
      setDnaDone(true);
    } catch (err) {
      const msg = err?.isQuota
        ? "Gemini quota exhausted. Set GEMINI_MODEL=gemini-2.5-flash in server/.env and restart."
        : "Could not reach AI. Check your connection and try again.";
      setBoardRaw(msg);
      setBoardDone(true);
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  // War-room dark shell — deep indigo/violet, distinct from Dashboard's blue modal
  return (
    <section style={{
      background: "linear-gradient(145deg, #0D0A1E 0%, #120E2A 30%, #1A0E3A 60%, #0D1A35 100%)",
      borderRadius: 24, padding: "28px",
      boxShadow: "0 24px 72px rgba(0,68,196,0.35)",
      border: "1px solid rgba(26,110,255,0.25)",
      marginBottom: 18,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "1.8px", color: C.violetLight, marginBottom: 8 }}>
            ⚔️ ANALYTICS WAR ROOM
          </div>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            Placement Coach + Behavioral DNA
          </h2>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.5)", fontSize: 12.5, lineHeight: 1.65, maxWidth: 560 }}>
            Two AI analyses, one click. Left: your 30-day action plan. Right: behavioral fingerprint from {totalSessions} sessions.
            {totalSessions < 10 && (
              <span style={{ display: "block", marginTop: 6, color: C.amber, fontSize: 11.5 }}>
                ⚠ Interview DNA unlocks at 10 sessions — you have {totalSessions}. Coach analysis is available now.
              </span>
            )}
          </p>
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { label: "IRS", val: `${irs}/100`, color: irs >= 75 ? C.green : irs >= 55 ? C.violetLight : C.amber },
              { label: "ARCHETYPE", val: archetype?.label || "—", color: C.violetLight },
              { label: "VARIANCE", val: sd > 18 ? "HIGH" : sd > 10 ? "MED" : "LOW", color: sd > 18 ? C.red : sd > 10 ? C.amber : C.green },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "6px 11px", borderRadius: 8,
                background: "rgba(26,110,255,0.12)",
                border: "1px solid rgba(26,110,255,0.22)", textAlign: "center",
              }}>
                <div style={{ fontFamily: F.mono, fontSize: 7.5, letterSpacing: "0.8px", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, color: item.color, whiteSpace: "nowrap" }}>{item.val}</div>
              </div>
            ))}
          </div>
          <button onClick={generateBoth} disabled={loading} className="an-ai-generate-btn"
            style={{
              border: "none", borderRadius: 13,
              background: loading ? "rgba(255,255,255,0.07)" : `linear-gradient(135deg, ${C.violet}, ${C.violetMid})`,
              color: "#fff", padding: "13px 24px", fontSize: 13.5, fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : `0 4px 22px rgba(26,110,255,0.45)`,
              display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", fontFamily: F.body,
            }}>
            {loading ? (
              <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.22)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Generating…</>
            ) : done ? "↺ Regenerate Profile" : "⚔️ Generate War Room Profile"}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!done && !loading && (
        <div style={{ padding: "44px 20px", textAlign: "center", border: "1.5px dashed rgba(26,110,255,0.25)", borderRadius: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚔️</div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 auto", maxWidth: 480, lineHeight: 1.7 }}>
            Click <strong style={{ color: "rgba(255,255,255,0.7)" }}>Generate War Room Profile</strong> to get your placement coach's action plan and behavioral fingerprint — both computed from your real session data in parallel.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
            {[
              { icon: "🎯", label: "HONEST VERDICT", desc: "Where you truly stand" },
              { icon: "🚨", label: "REAL PROBLEM", desc: "Root cause identified" },
              { icon: "📅", label: "30-DAY PLAN", desc: "Concrete weekly targets" },
              { icon: "🧬", label: "INTERVIEW DNA", desc: "Behavioral fingerprint" },
            ].map(item => (
              <div key={item.label} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(26,110,255,0.08)", border: "1px solid rgba(26,110,255,0.15)", textAlign: "center", minWidth: 100 }}>
                <div style={{ fontSize: 18, marginBottom: 5 }}>{item.icon}</div>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.8px", color: C.violetLight, marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {[
            `Scanning IRS = ${irs}/100 across 6 dimensions…`,
            `Computing score variance (StdDev: ${sd.toFixed(1)})…`,
            `Mapping ${strongest?.label || "—"} strength vs ${weakest?.label || "—"} gap…`,
            "Drafting your 30-day battle plan…",
            "Mapping your behavioral fingerprint…",
          ].map((msg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(26,110,255,0.08)", border: "1px solid rgba(26,110,255,0.15)" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.violetLight, flexShrink: 0, animation: `livePulse 1.4s ease ${i * 0.22}s infinite` }} />
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11.5, fontFamily: F.mono }}>{msg}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {done && (
        <div style={{ display: "grid", gridTemplateColumns: totalSessions >= 10 ? "1fr 1fr" : "1fr", gap: 18, marginTop: 4 }} className="an-two-col">
          {/* Left — Placement Coach */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(26,110,255,0.2)" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.violet}, ${C.violetMid})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>⚡</div>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: "1.2px", color: C.violetLight, fontWeight: 700 }}>PLACEMENT COACH</div>
                <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: "#fff" }}>Action plan from your data</div>
              </div>
            </div>
            {boardSections.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {boardSections.map((s, i) => (
                  <div key={i} style={{ padding: "13px 15px", borderRadius: 12, background: "rgba(26,110,255,0.06)", border: "1px solid rgba(26,110,255,0.12)", borderLeft: `3px solid ${s.accent}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <span style={{ fontSize: 12 }}>{boardIcons[s.heading] || "•"}</span>
                      <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 800, letterSpacing: "1.3px", color: s.accent }}>{s.heading}</div>
                    </div>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 1.72, whiteSpace: "pre-line" }}>{s.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: 1.72, margin: 0, whiteSpace: "pre-line" }}>{boardRaw}</p>
            )}
          </div>

          {/* Right — Interview DNA */}
          {totalSessions >= 10 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(26,110,255,0.2)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.violetMid}, ${C.violet})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🧬</div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: "1.2px", color: C.violetLight, fontWeight: 700 }}>INTERVIEW DNA</div>
                  <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: "#fff" }}>Behavioral fingerprint — {totalSessions} sessions</div>
                </div>
              </div>
              {dnaSections.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {dnaSections.map((s, i) => (
                    <div key={i} style={{ padding: "13px 15px", borderRadius: 12, background: "rgba(26,110,255,0.06)", border: "1px solid rgba(26,110,255,0.12)", borderLeft: `3px solid ${s.accent}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                        <span style={{ fontSize: 12 }}>{dnaIcons[s.heading] || "🧬"}</span>
                        <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 800, letterSpacing: "1.3px", color: s.accent }}>{s.heading}</div>
                      </div>
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 1.72, whiteSpace: "pre-line" }}>{s.body}</p>
                    </div>
                  ))}
                </div>
              ) : dnaDone ? (
                <p style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: 1.72, margin: 0, whiteSpace: "pre-line" }}>{dnaRaw || "Unable to generate the Interview DNA analysis."}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Reading session variance patterns…", "Mapping response style indicators…", "Identifying pressure response signals…", "Writing behavioral fingerprint…"].map((msg, i) => (
                    <div key={i} style={{ padding: "9px 13px", borderRadius: 8, background: "rgba(26,110,255,0.06)", border: "1px solid rgba(26,110,255,0.12)", color: "rgba(255,255,255,0.38)", fontSize: 11, fontFamily: F.mono, animation: `livePulse 1.5s ease ${i * 0.25}s infinite` }}>{msg}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {done && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(26,110,255,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>Both analyses regenerate fresh on each click. DNA unlocks at 10 sessions.</p>
          <button onClick={generateBoth} disabled={loading} style={{ border: `1px solid rgba(26,110,255,0.25)`, borderRadius: 9, background: "rgba(26,110,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "7px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F.body }}>
            ↺ Regenerate both
          </button>
        </div>
      )}
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYTICS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const Analytics = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [drillDim, setDrillDim] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const hasFetched = useRef(false);

  // ── CRITICAL: always mount at top — prevents scroll-to-bottom from child effects
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // FIX: single ref-guarded useEffect — no more duplicate fetch
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    (async () => {
      try {
        const [result] = await Promise.all([
          getAnalytics(),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ]);
        setData(result);
      } catch (err) {
        console.error("Analytics load failed:", err);
        setError("Unable to load your performance data.");
      } finally {
        setLoading(false);
        requestAnimationFrame(() => setTimeout(() => setMounted(true), 50));
      }
    })();
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────
  const topicPerformance = useMemo(() => data?.topicPerformance ?? [], [data]);
  const scoreTrend       = useMemo(() => data?.scoreTrend ?? [], [data]);
  const averageScore     = data?.averageScore ?? 0;
  const totalSessions    = data?.totalSessions ?? 0;
  const avgTimePerQ      = data?.timePerformance?.averageTimePerQuestion ?? null;
  const highestScore     = data?.highestScore ?? data?.bestScore ?? Math.max(0, ...scoreTrend.map(s => s.score || 0));

  const irs = data?.irs ?? 0;
  const currentTierLabel = data?.currentTier ?? "₹3–6 LPA";
  const currentTierMeta  = TIER_META[currentTierLabel] ?? TIER_META["₹3–6 LPA"];
  const currentTier      = { label: currentTierLabel, ...currentTierMeta };

  const apiTiers    = data?.tiers ?? [];
  const nextTierApi = apiTiers.find(t => !t.isUnlocked && t.label !== currentTierLabel) ?? null;
  const nextTier    = nextTierApi
    ? { label: nextTierApi.label, minScore: nextTierApi.minIRS, color: TIER_META[nextTierApi.label]?.color ?? C.violet, advice: nextTierApi.advice, desc: nextTierApi.desc }
    : null;

  const dimensionProfile = useMemo(() => {
    const apiProfile = data?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const apiDim = apiProfile.find(d => d.key === meta.key);
      return {
        ...meta,
        score:              apiDim?.score ?? 0,
        hasData:            apiDim?.hasData ?? false,
        isProvisional:      apiDim?.isProvisional ?? false,
        answeredCount:      apiDim?.answeredCount ?? 0,
        contributingTopics: apiDim?.contributingTopics ?? [],
      };
    });
  }, [data]);

  const irsBreakdown   = data?.irsBreakdown ?? null;
  const irsComponents  = useMemo(() => {
    if (!irsBreakdown) return {};
    const c = irsBreakdown.components;
    return { dimScore: c.dimension.score, ewmaScore: c.ewma.score, breadth: c.breadth.score, consistency: c.consistency.score, rigor: c.rigor.score };
  }, [irsBreakdown]);
  const irsMaturity     = irsBreakdown?.maturity ?? null;
  const irsRawComposite = irsBreakdown?.rawComposite ?? null;
  const currentTierIsGated   = data?.currentTierIsGated ?? false;
  const currentTierRawLabel  = data?.currentTierRaw ?? currentTierLabel;
  const sessionsNeededForRaw = data?.sessionsNeededForRawTier ?? 0;

  const strongestDim = useMemo(() => [...dimensionProfile].filter(d => d.hasData).sort((a, b) => b.score - a.score)[0], [dimensionProfile]);
  const weakestDim   = useMemo(() => [...dimensionProfile].filter(d => d.hasData).sort((a, b) => a.score - b.score)[0], [dimensionProfile]);
  const archetype    = useMemo(() => deriveArchetype(scoreTrend, avgTimePerQ, averageScore), [scoreTrend, avgTimePerQ, averageScore]);

  const topicROIRanking = useMemo(() =>
    [...topicPerformance].map(t => ({ ...t, roi: topicROI(t.topic, dimensionProfile) })).sort((a, b) => b.roi - a.roi),
    [topicPerformance, dimensionProfile]);

  const chartData = useMemo(() =>
    scoreTrend.map((item, i) => ({ interview: `#${i + 1}`, score: item.score || 0, avg: averageScore })),
    [scoreTrend, averageScore]);

  const latestScore = chartData.at(-1)?.score ?? 0;
  const prevScore   = chartData.at(-2)?.score ?? latestScore;
  const delta       = latestScore - prevScore;
  const slope       = trendSlope(scoreTrend.map(s => s.score || 0));
  const sd          = stdDev(scoreTrend.map(s => s.score || 0));

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) return (
    <div style={S.page}>
      <div style={S.center}>
        <BookLoader />
        <p style={{ color: C.sub, marginTop: 14, fontSize: 13, fontFamily: F.body }}>Building your readiness profile…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={S.page}>
      <div style={S.emptyCard}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
        <h2 style={S.emptyTitle}>Something went wrong</h2>
        <p style={S.emptyText}>{error}</p>
        <button style={S.btnPrimary} className="an-btn-primary" onClick={() => window.location.reload()}>Try Again</button>
      </div>
    </div>
  );

  if (!data || totalSessions === 0) return (
    <div style={S.page}>
      <div style={S.emptyCard}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🧠</div>
        <div style={{ ...S.eyebrow, color: C.violet }}>READINESS INTELLIGENCE</div>
        <h1 style={S.emptyTitle}>Your interview fingerprint starts here.</h1>
        <p style={S.emptyText}>Complete your first mock interview and MockMate will compute your IRS, map your dimensions, and show you exactly which package tier you're ready for.</p>
        <button style={S.btnPrimary} className="an-btn-primary" onClick={() => navigate("/interview")}>Start First Interview →</button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes fadeUp      { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes livePulse   { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
        @keyframes barFill     { from { width:0; } }

        *, *::before, *::after { box-sizing: border-box; }
        ::selection { background: rgba(26,110,255,0.15); color: ${C.text}; }

        .an-page button:focus-visible, .an-page a:focus-visible {
          outline: 2px solid ${C.violet}; outline-offset: 3px; border-radius: 6px;
        }
        .an-page ::-webkit-scrollbar { width: 5px; height: 5px; }
        .an-page ::-webkit-scrollbar-track { background: transparent; }
        .an-page ::-webkit-scrollbar-thumb { background: ${C.borderMd}; border-radius: 4px; }

        .an-card {
          transition: box-shadow 0.22s ease, transform 0.22s cubic-bezier(.16,1,.3,1), border-color 0.22s ease !important;
        }
        .an-card:hover { box-shadow: 0 10px 36px rgba(26,110,255,0.1) !important; transform: translateY(-2px) !important; border-color: ${C.borderMd} !important; }

        .an-stat-card {
          transition: box-shadow 0.22s ease, transform 0.22s cubic-bezier(.16,1,.3,1), border-color 0.22s ease !important;
          position: relative; overflow: hidden;
        }
        .an-stat-card:hover { box-shadow: 0 8px 32px rgba(26,110,255,0.13) !important; transform: translateY(-3px) !important; }

        .an-tier-card {
          transition: box-shadow 0.2s ease, transform 0.2s cubic-bezier(.16,1,.3,1), border-color 0.2s ease !important;
        }
        .an-tier-card:hover { box-shadow: 0 6px 24px rgba(26,110,255,0.12) !important; transform: translateY(-2px) !important; }
        .an-tier-card-active:hover { box-shadow: 0 8px 28px rgba(26,110,255,0.22) !important; }

        .an-dim-row {
          transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease !important;
          cursor: default;
        }
        .an-dim-row:hover { background: ${C.violetTint} !important; border-color: ${C.borderMd} !important; transform: translateX(3px) !important; }

        .an-roi-row {
          transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease !important;
        }
        .an-roi-row:hover { background: ${C.violetTint} !important; border-color: ${C.borderMd} !important; box-shadow: 0 2px 12px rgba(26,110,255,0.07) !important; }

        .an-btn-primary {
          transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important;
        }
        .an-btn-primary:hover { box-shadow: 0 10px 28px rgba(26,110,255,0.38) !important; transform: translateY(-2px) !important; }

        .an-btn-secondary {
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease !important;
        }
        .an-btn-secondary:hover { background: ${C.violetTint} !important; border-color: ${C.violet}50 !important; transform: translateY(-1px) !important; }

        .an-btn-blue {
          transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important;
        }
        .an-btn-blue:hover { box-shadow: 0 8px 24px rgba(26,110,255,0.4) !important; transform: translateY(-2px) !important; }
        .an-btn-blue:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

        .an-tab {
          transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease !important;
        }
        .an-tab:hover:not(.an-tab-active) { color: ${C.violet} !important; background: ${C.violetTint} !important; }

        .an-bar-fill { transition: width 1.1s cubic-bezier(.16,1,.3,1) !important; }

        .an-irs-ring { transition: box-shadow 0.3s ease !important; }
        .an-irs-ring:hover { box-shadow: 0 0 0 4px rgba(26,110,255,0.18), 0 16px 48px rgba(0,68,196,0.24) !important; }

        .an-ai-generate-btn {
          transition: box-shadow 0.2s ease, transform 0.2s cubic-bezier(.16,1,.3,1) !important;
        }
        .an-ai-generate-btn:hover:not(:disabled) { box-shadow: 0 10px 30px rgba(26,110,255,0.45) !important; transform: translateY(-2px) !important; }

        .recharts-tooltip-wrapper { transition: transform 0.12s ease !important; }

        @media (prefers-reduced-motion: reduce) {
          .an-page * { animation: none !important; transition-duration: 0.01ms !important; }
        }
        @media (max-width: 960px) {
          .an-two-col { grid-template-columns: 1fr !important; }
          .an-hero-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          .an-stats { grid-template-columns: repeat(2,1fr) !important; }
          .an-tiers { grid-template-columns: repeat(2,1fr) !important; }
          .an-dims  { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .an-page  { padding: 16px 12px 60px !important; }
          .an-stats { grid-template-columns: 1fr !important; }
          .an-dims  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={S.container} className="an-page">
        <AnimatedSection delay={0}>
        {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...S.eyebrow, color: C.violet }}>READINESS INTELLIGENCE</div>
            <h1 style={S.pageTitle}>Understand exactly how interview-ready you are.</h1>
            <p style={{ maxWidth: 640, margin: "10px 0 0", color: C.sub, fontSize: 13.5, lineHeight: 1.65, fontFamily: F.body }}>
              IRS = weighted dimension avg · EWMA trend · topic breadth · consistency.
              Every number here is from the same formula your Dashboard uses.
            </p>
          </div>
          <button style={S.btnPrimary} className="an-btn-primary" onClick={() => navigate("/interview")}>🎯 New Interview</button>
        </div>

        </AnimatedSection>

        <AnimatedSection delay={60}>
        {/* ── HERO: LIVING AURA + IRS RING ─────────────────────────────── */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18, marginBottom: 18 }} className="an-hero-grid">
          <div style={{ ...S.card, background: `linear-gradient(145deg, ${C.card} 0%, ${C.violetTint} 100%)` }}>
            <div style={{ ...S.eyebrow, color: C.violet }}>LIVING SKILL AURA</div>
            <h2 style={{ ...S.cardH2, marginBottom: 4 }}>
              {irs >= 80 ? "Interview Ready" : irs >= 60 ? "Nearly Ready" : irs >= 40 ? "Building Readiness" : "Needs Focus"}
            </h2>
            <p style={{ ...S.cardSub, marginBottom: 16 }}>
              Each pulsing layer represents your real skill depth. Larger shape = stronger readiness.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, alignSelf: "center", marginRight: 2 }}>TARGET:</span>
              {COMPANY_PROFILES.map(cp => {
                const active = selectedCompany?.id === cp.id;
                return (
                  <button key={cp.id} onClick={() => setSelectedCompany(active ? null : cp)}
                    style={{
                      border: `1.5px solid ${active ? C.violet : C.border}`,
                      borderRadius: 999, padding: "3px 10px",
                      background: active ? `${C.violet}15` : C.cardAlt,
                      color: active ? C.violet : C.muted,
                      fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: F.body, transition: "all 0.15s",
                    }}>
                    {cp.icon} {cp.label.split(" (")[0]}
                  </button>
                );
              })}
            </div>
            <LivingAura data={dimensionProfile} irs={irs} scoreTrend={scoreTrend} onDrillDimension={setDrillDim} companyOverlay={selectedCompany} />
          </div>


          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* IRS ring */}
            <div className="an-card an-irs-ring" style={{ ...S.card, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ ...S.eyebrow, color: C.violet }}>INTERVIEW READINESS SCORE</div>
              <p style={{ margin: "4px 0 14px", color: C.sub, fontSize: 11, fontFamily: F.mono, letterSpacing: "0.3px" }}>4-component weighted composite</p>
              <AnimatedRing score={irs} size={150} strokeWidth={13} />
              <div style={{ marginTop: 12, width: "100%", padding: "11px 14px", borderRadius: 13, background: `${currentTier.color}15`, border: `1px solid ${currentTier.color}40`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: currentTier.color, fontFamily: F.display }}>{currentTier.label} eligible</div>
                  {nextTierApi?.desc && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>{nextTierApi.desc}</div>}
                </div>
              </div>
              {nextTier && (
                <div style={{ marginTop: 9, fontSize: 11, color: C.sub, fontFamily: F.mono }}>
                  {nextTier.minScore - irs} pts → <strong style={{ color: nextTier.color }}>{nextTier.label}</strong>
                </div>
              )}
            </div>

            {/* Archetype — violet accent */}
            <div className="an-card" style={{ ...S.card, flex: 1, borderTop: `3px solid ${C.violet}` }}>
              <div style={{ ...S.eyebrow, color: C.violet }}>INTERVIEW ARCHETYPE</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, fontSize: 22, background: C.violetTint, border: `1px solid ${C.violet}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {archetype.icon}
                </div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text }}>{archetype.label}</div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.55 }}>{archetype.desc}</div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.violet, lineHeight: 1.55 }}>Fix: {archetype.fix}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
        

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── IRS BREAKDOWN ────────────────────────────────────────────── */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ ...S.eyebrow, color: C.violet }}>IRS BREAKDOWN</div>
              <h2 style={S.cardH2}>How your {irs}/100 is computed</h2>
              <p style={S.cardSub}>Five statistical components, Bayesian-shrunk toward a neutral baseline until you've logged enough evidence.</p>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, lineHeight: 1.7, maxWidth: 340 }}>
              Weighted dim avg × 40%<br />
              EWMA trend (shrunk) × 22%<br />
              Topic breadth & depth × 13%<br />
              Consistency (1 − CV) × 15%<br />
              Difficulty-adjusted rigor × 10%
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 32px" }}>
            <IRSComponentBar label="Dimension-weighted avg"    value={irsComponents.dimScore}    weight={0.40} color={C.violet} />
            <IRSComponentBar label="EWMA recent trend"         value={irsComponents.ewmaScore}   weight={0.22} color={C.blue500} />
            <IRSComponentBar label="Topic breadth & depth"     value={irsComponents.breadth}     weight={0.13} color={C.amber} />
            <IRSComponentBar label="Consistency (1−CV)"        value={irsComponents.consistency} weight={0.15} color={C.green} />
            <IRSComponentBar label="Difficulty-adjusted rigor" value={irsComponents.rigor}       weight={0.10} color={C.sub} />
          </div>
          {irsMaturity != null && irsMaturity < 0.97 && (
            <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: "#FFF7E8", border: `1px solid #F0D8A8`, fontSize: 12, color: "#8A6414", lineHeight: 1.6 }}>
              <strong>Evidence gate active:</strong> raw composite is {irsRawComposite}/100, but with {data?.totalAnsweredQuestions ?? 0} answered questions, trusted IRS is scaled to <strong>{Math.round(irsMaturity * 100)}%</strong> confidence — <strong>{irs}/100</strong>.
            </div>
          )}
          {currentTierIsGated && (
            <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 12, background: C.violetTint, border: `1px solid ${C.violet}20`, fontSize: 12, color: C.violetMid, lineHeight: 1.6 }}>
              <strong>On track for {currentTierRawLabel}:</strong> your IRS math already crosses that band, but we need {sessionsNeededForRaw} more sessions to confirm — small samples can be misleading.
            </div>
          )}
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: C.violetTint, border: `1px solid ${C.violet}20`, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "SCORE STD-DEV", val: sd.toFixed(1), color: C.text },
              { label: "TREND SLOPE", val: `${slope >= 0 ? "+" : ""}${slope.toFixed(2)} pts/session`, color: slope >= 0 ? C.green : C.orange },
              { label: "TOPICS COVERED", val: `${topicPerformance.length}/8+`, color: C.text },
              { label: "SESSIONS", val: totalSessions, color: C.text },
              { label: "EVIDENCE CONFIDENCE", val: irsMaturity != null ? `${Math.round(irsMaturity * 100)}%` : "—", color: C.text },
            ].map(item => (
              <div key={item.label}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{item.label}</span><br />
                <strong style={{ color: item.color, fontSize: 14, fontFamily: F.display }}>{item.val}</strong>
              </div>
            ))}
          </div>
        </section>

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── SESSION QUALITY ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}><SessionQualityCard /></div>
 
        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── STAT CARDS — each with unique accent ─────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }} className="an-stats">
          <MetricCard icon="🎤" label="SESSIONS"   value={totalSessions}           sub={`${topicPerformance.length} topics covered`}                                                    color={C.violet}  accentColor={C.violet} />
          <MetricCard icon="📈" label="AVG SCORE"  value={`${averageScore}/100`}   sub={delta >= 0 ? `↑ ${delta} pts vs last` : `↓ ${Math.abs(delta)} pts vs last`}                   color={scoreColor(averageScore)} accentColor={scoreColor(averageScore)} />
          <MetricCard icon="🏆" label="BEST SCORE" value={`${highestScore}/100`}   sub="Your performance ceiling"                                                                       color={C.amber}   accentColor={C.amber} />
          <MetricCard icon="⏱"  label="AVG TIME/Q" value={`${avgTimePerQ ?? "—"}s`} sub={avgTimePerQ ? (avgTimePerQ < 30 ? "Fast paced" : avgTimePerQ > 55 ? "Methodical" : "Balanced") : "No data"} color={C.blue600} accentColor={C.blue500} />
        </div>

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── TIER READINESS ────────────────────────────────────────────── */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={{ ...S.eyebrow, color: C.violet }}>PACKAGE TIER READINESS</div>
          <h2 style={S.cardH2}>Where you stand in the placement food chain</h2>
          <p style={{ ...S.cardSub, marginBottom: 20 }}>IRS thresholds map directly to real Indian placement market data.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="an-tiers">
            {apiTiers.map(tier => {
              const meta = TIER_META[tier.label] ?? { color: C.violet, bg: C.violetTint, gradient: C.violetTint };
              const reached = tier.isUnlocked;
              const isCurrent = tier.label === currentTierLabel;
              const pct = Math.min(100, tier.minIRS === 0 ? 100 : (irs / tier.minIRS) * 100);
              return (
                <div key={tier.label} className={`an-tier-card${isCurrent ? " an-tier-card-active" : ""}`} style={{
                  padding: "18px 16px", borderRadius: 18,
                  border: `2px solid ${isCurrent ? meta.color : C.border}`,
                  background: isCurrent ? meta.gradient : C.cardAlt,
                  position: "relative",
                }}>
                  {isCurrent && <div style={{ position: "absolute", top: 9, right: 9, fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: meta.color, color: "#fff", fontFamily: F.mono, letterSpacing: "0.5px" }}>CURRENT</div>}
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: reached ? meta.color : C.muted, fontFamily: F.display, marginBottom: 4 }}>{tier.label}</div>
                  <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.45, marginBottom: 10 }}>{tier.desc}</div>
                  <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${mounted ? pct : 0}%`, background: reached ? meta.color : C.muted, transition: "width 1.1s cubic-bezier(.16,1,.3,1)" }} />
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 5 }}>
                    {tier.minIRS === 0 ? "✓ Always eligible" : reached ? `✓ Unlocked at IRS ${tier.minIRS}` : `Need ${tier.minIRS - irs} more IRS pts`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── DNA FINGERPRINT + STREAK CALENDAR ───────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">
          <div style={S.card} className="an-card">
            <div style={{ ...S.eyebrow, color: C.violet }}>PERFORMANCE DNA</div>
            <h2 style={S.cardH2}>Your unique score fingerprint</h2>
            <p style={{ ...S.cardSub, marginBottom: 14 }}>A generative waveform derived from your six dimensions — no two students have the same pattern.</p>
            <DNAFingerprint profile={dimensionProfile} />
            <div style={{ marginTop: 12, display: "flex", gap: 7, flexWrap: "wrap" }}>
              {dimensionProfile.map(d => {
                const col = C.dimColors[d.key] || scoreColor(d.score);
                return (
                  <span key={d.key} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: d.hasData ? `${col}18` : C.border, color: d.hasData ? col : C.faint }}>
                    {d.icon} {d.label}: {d.hasData ? d.score : "—"}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={S.card} className="an-card">
            <div style={{ ...S.eyebrow, color: C.violet }}>PRACTICE ACTIVITY</div>
            <h2 style={S.cardH2}>15-week session log</h2>
            <p style={{ ...S.cardSub, marginBottom: 16 }}>Darker violet = higher score. Hover for date and exact score.</p>
            <StreakCalendar scoreTrend={scoreTrend} />
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { label: "Total", val: totalSessions, color: C.violet },
                { label: "Strong (80+)", val: scoreTrend.filter(s => (s.score || 0) >= 80).length, color: C.green },
                { label: "Last delta", val: `${delta >= 0 ? "+" : ""}${delta}`, color: delta >= 0 ? C.green : C.orange },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "10px", background: C.violetTint, borderRadius: 10, border: `1px solid ${C.violet}15` }}>
                  <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 3 }}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── PERFORMANCE TRAJECTORY + TOPIC MOMENTUM ─────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">
          <div style={S.card} className="an-card">
            <div style={{ ...S.eyebrow, color: C.violet }}>SCORE TRAJECTORY</div>
            <h2 style={S.cardH2}>Your readiness evolution</h2>
            <p style={S.cardSub}>Every completed session reshapes your IRS. The dashed line is your average.</p>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={240} style={{ marginTop: 16 }}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.violet} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={C.violet} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="interview" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10, fontFamily: F.mono }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10, fontFamily: F.mono }} />
                  <Tooltip formatter={(v, name) => [`${v}/100`, name === "score" ? "Score" : "Avg"]}
                    contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: F.body, fontSize: 12 }} />
                  <ReferenceLine y={averageScore} stroke={C.borderMd} strokeDasharray="4 4"
                    label={{ value: `avg ${averageScore}`, position: "right", fontSize: 9, fill: C.muted, fontFamily: F.mono }} />
                  <Area type="monotone" dataKey="score"
                    stroke={C.violet} strokeWidth={2.5} fill="url(#scoreGrad)"
                    dot={{ r: 4.5, fill: C.violet, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 7, fill: C.violetLight }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ marginTop: 20, padding: "28px", textAlign: "center", background: C.violetTint, borderRadius: 14, color: C.sub, fontSize: 13 }}>
                Complete 2+ interviews to see your trajectory.
              </div>
            )}
          </div>

          <div style={S.card} className="an-card">
            <div style={{ ...S.eyebrow, color: C.violet }}>TOPIC MOMENTUM</div>
            <h2 style={S.cardH2}>Rising, stable, or falling?</h2>
            <p style={S.cardSub}>Trend tells more than a snapshot score.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {topicPerformance.slice(0, 7).map(t => {
                const momentum = getMomentum(scoreTrend, t.topic);
                const score = t.averageScore || 0;
                const col = C.dimColors[
                  dimensionProfile.find(d => (d.contributingTopics || []).some(ct => ct.toLowerCase() === t.topic.toLowerCase()))?.key
                ] || scoreColor(score);
                return (
                  <div key={t.topic} className="an-roi-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: C.cardAlt, border: `1px solid ${C.border}` }}>
                    <div style={{ width: 92, fontSize: 11.5, fontWeight: 700, color: C.text, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</div>
                    <div style={{ flex: 1, height: 7, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                      <div className="an-bar-fill" style={{ height: "100%", width: `${mounted ? score : 0}%`, background: col, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 800, color: col, width: 28, textAlign: "right", flexShrink: 0 }}>{score}</div>
                    <MomentumBadge momentum={momentum} />
                  </div>
                );
              })}
              {topicPerformance.length === 0 && <div style={{ color: C.muted, fontSize: 12, padding: "16px 0" }}>No topic data yet.</div>}
            </div>
          </div>
        </div>

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── SKILL VELOCITY ────────────────────────────────────────────── */}
        <SkillVelocityGraph scoreTrend={scoreTrend} />

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── TOPIC INTELLIGENCE GRID ───────────────────────────────────── */}
        <TopicIntelligenceGrid
          topicData={topicPerformance.map(t => ({
            topic:        t.topic,
            avgScore:     t.averageScore ?? t.avgScore ?? 0,
            sessionCount: t.sessionCount ?? t.count ?? 1,
            trend:        t.trend ?? 0,
            lastScore:    t.lastScore ?? t.averageScore ?? 0,
            sessions:     t.sessions ?? t.scoreHistory ?? [],
          }))}
          onDrill={(topic) => navigate(`/interview?topic=${encodeURIComponent(topic)}`)}
        />

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── BLIND SPOT ALERTS ────────────────────────────────────────── */}
        <BlindSpotAlertCard />

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── SIX DIMENSIONS GRID ──────────────────────────────────────── */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={{ ...S.eyebrow, color: C.violet }}>PREPARATION PROFILE</div>
          <h2 style={S.cardH2}>Your six interview dimensions</h2>
          <p style={{ ...S.cardSub, marginBottom: 18 }}>Each bar is weighted in the IRS formula. Hover a card to see which topics map here.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="an-dims">
            {dimensionProfile.map(dim => {
              const col = dim.hasData ? (C.dimColors[dim.key] || scoreColor(dim.score)) : C.faint;
              return (
                <div key={dim.key} title={dim.tip} className="an-dim-row" style={{
                  padding: "17px 16px", borderRadius: 17,
                  border: `1.5px solid ${dim.hasData ? `${col}40` : C.border}`,
                  background: dim.hasData ? `${col}08` : C.cardAlt,
                  borderTop: dim.hasData ? `3px solid ${col}` : `3px solid ${C.border}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 17 }}>{dim.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{dim.label}</span>
                    </div>
                    <span style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: dim.hasData ? col : C.faint }}>
                      {dim.hasData ? dim.score : "—"}
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                    <div className="an-bar-fill" style={{ height: "100%", width: `${mounted && dim.hasData ? dim.score : 0}%`, background: col, borderRadius: 999 }} />
                  </div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: dim.hasData ? col : C.faint }}>
                      {!dim.hasData ? "No data yet" : dim.score >= 80 ? "✓ Strong" : dim.score >= 60 ? "→ Developing" : "↑ Focus needed"}
                    </span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{Math.round((dim.weight ?? 0) * 100)}% weight</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── FULL AI PROFILE — War Room Edition ───────────────────────── */}
        <FullAIProfileSection
          dimensionProfile={dimensionProfile}
          scoreTrend={scoreTrend}
          archetype={archetype}
          totalSessions={totalSessions}
          irs={irs}
          topTier={currentTier}
          weakest={weakestDim}
          strongest={strongestDim}
        />

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── COLD START vs WARM UP ────────────────────────────────────── */}
        <ColdStartWarmUpCard />

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── SMART FOCUS + IRS CLIMB ───────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">
          {/* Smart Focus */}
          <div style={S.card} className="an-card">
            <div style={{ ...S.eyebrow, color: C.violet }}>SMART FOCUS RECOMMENDER</div>
            <h2 style={S.cardH2}>Where to put your next hour</h2>
            <p style={S.cardSub}>Sorted by ROI — specific action, mode, and estimated sessions to close the gap.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {topicROIRanking.slice(0, 3).map((t, i) => {
                const score = t.averageScore || 0;
                const mode = score < 40 ? "topic" : score < 60 ? "full" : "challenge";
                const modeLabel = { topic: "Topic Focus", full: "Full Session", challenge: "Challenge Mode" }[mode];
                const modeIcon = { topic: "📚", full: "🎯", challenge: "⚡" }[mode];
                const action = score < 40
                  ? `Start with ${t.topic} basics — cover definitions, then worked examples`
                  : score < 60
                  ? `Practice ${t.topic} with immediate answer review after each question`
                  : `Run a timed ${t.topic}-only challenge — aim to hold 75+ every question`;
                const sessionsEst = Math.ceil((100 - score) / 4);
                const sessionsLabel = sessionsEst <= 8 ? `~${sessionsEst} sessions` : "10+ sessions";
                const dimColor = t.dimColor || (i === 0 ? C.red : i === 1 ? C.amber : C.violet);
                return (
                  <div key={t.topic} className="an-roi-row" style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 15px", borderRadius: 14,
                    background: i === 0 ? C.redTint : i === 1 ? C.amberTint : C.violetTint,
                    border: `1px solid ${i === 0 ? "#FECACA" : i === 1 ? "#FDE68A" : `${C.violet}25`}`,
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: i === 0 ? C.red : i === 1 ? C.amber : C.violet, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, fontFamily: F.mono, marginTop: 1 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{t.topic} · {score}/100</div>
                        <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, whiteSpace: "nowrap", marginLeft: 8 }}>est. {sessionsLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{action}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>ROI {t.roi.toFixed(1)}</div>
                        <button onClick={() => navigate("/interview")} className="an-btn-blue"
                          style={{ border: "none", borderRadius: 8, background: i === 0 ? C.red : i === 1 ? C.amber : C.violet, color: "#fff", padding: "5px 11px", fontSize: 10.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: F.body }}>
                          {modeIcon} Start {modeLabel} →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* IRS Climb */}
          <div style={{ background: `linear-gradient(135deg, ${C.violetTint} 0%, ${C.blue50} 100%)`, border: `1px solid ${C.violet}25`, borderRadius: 20, padding: 22, boxShadow: `0 4px 20px rgba(26,110,255,0.08)`, display: "flex", flexDirection: "column" }}>
            <div style={{ ...S.eyebrow, color: C.violet }}>IRS PROGRESS</div>
            <h2 style={S.cardH2}>
              {nextTier ? <>{nextTier.minScore - irs} points to <span style={{ color: nextTier.color }}>{nextTier.label}</span></> : "You've reached the highest tracked tier."}
            </h2>
            <p style={{ ...S.cardSub, marginBottom: 16 }}>{nextTier ? (nextTier.advice ?? "") : "Maintain your streak to protect this position."}</p>
            {nextTier && nextTier.minScore > 0 && (
              <>
                <div style={{ position: "relative", height: 10, borderRadius: 999, background: C.borderMd, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${mounted ? Math.min(100, (irs / nextTier.minScore) * 100) : 0}%`, background: `linear-gradient(90deg, ${C.violet}, ${C.blue500})`, borderRadius: 999, transition: "width 1.3s cubic-bezier(.16,1,.3,1)" }} />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginBottom: 20 }}>{irs}/{nextTier.minScore} IRS ({Math.round((irs / nextTier.minScore) * 100)}% there)</div>
              </>
            )}
            <div style={{ marginTop: "auto" }}>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.7, marginBottom: 14 }}>
                Closing your <strong style={{ color: C.text }}>{weakestDim?.label}</strong> gap (currently {weakestDim?.score}/100) is the highest-leverage move toward <strong style={{ color: nextTier?.color || C.violet }}>{nextTier?.label || "peak"}</strong>.
              </div>
              <button style={{ ...S.btnPrimary, width: "100%", textAlign: "center" }} onClick={() => navigate("/interview")}>Keep climbing →</button>
            </div>
          </div>
        </div>

        </AnimatedSection>

        <AnimatedSection delay={0}>
        {/* ── COACH BANNER — violet war-room identity ───────────────────── */}
        <section style={{
          display: "flex", alignItems: "center", gap: 18, padding: "22px 26px",
          borderRadius: 20, marginBottom: 18,
          background: `linear-gradient(135deg, ${C.violetDeep} 0%, ${C.violetMid} 55%, ${C.blue700} 100%)`,
          boxShadow: "0 12px 40px rgba(0,68,196,0.35)",
        }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>⚔️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: "1.5px", color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>MOCKMATE WAR ROOM</div>
            <h2 style={{ margin: "0 0 6px", fontFamily: F.display, fontSize: 17, fontWeight: 800, color: "#fff" }}>
              Biggest unlock: <strong style={{ color: C.violetLight }}>{weakestDim?.label}</strong> at {weakestDim?.score}/100.
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.65 }}>
              Strongest: <strong style={{ color: "#fff" }}>{strongestDim?.label}</strong> at {strongestDim?.score}/100.
              {" "}A {weakestDim?.label} gap at IRS {irs} is the primary reason you haven't crossed{" "}
              <strong style={{ color: C.violetLight }}>{nextTier?.label || "the next tier"}</strong> yet.
            </p>
          </div>
          <button style={{ flexShrink: 0, border: "none", borderRadius: 12, padding: "11px 16px", background: "#fff", color: C.violetMid, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}
            onClick={() => navigate("/interview")}>Build This Skill →</button>
        </section>
        </AnimatedSection>

      </div>

      {/* ── DIMENSION DRILL PANEL ─────────────────────────────────────── */}
      {drillDim && (
        <>
          <div onClick={() => setDrillDim(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.35)", zIndex: 9998, backdropFilter: "blur(2px)" }} />
          <DimensionDrillPanel dim={drillDim} onClose={() => setDrillDim(null)} navigate={navigate} />
        </>
      )}
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(26,110,255,0.05) 0%, transparent 42%), radial-gradient(ellipse at 50% 100%, rgba(26,110,255,0.04) 0%, transparent 55%)`,
    padding: "36px 28px 80px",
    fontFamily: F.body,
  },
  container: { maxWidth: 1220, margin: "0 auto" },
  center: { minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },

  eyebrow: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "1.6px", color: C.violet, marginBottom: 6 },
  pageTitle: { margin: 0, fontFamily: F.display, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.8px", color: C.text },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 24, boxShadow: "0 2px 16px rgba(26,110,255,0.05)", marginBottom: 0 },
  cardH2:  { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.2px" },
  cardSub: { margin: "6px 0 0", color: C.sub, fontSize: 12, lineHeight: 1.65 },

  btnPrimary:   { border: "none", borderRadius: 13, background: `linear-gradient(135deg, ${C.violetMid}, ${C.violet})`, color: "#fff", padding: "13px 22px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: `0 6px 22px rgba(26,110,255,0.30)`, fontFamily: F.body, letterSpacing: "-0.1px" },
  btnSecondary: { width: "100%", padding: "11px 14px", borderRadius: 11, border: `1px solid ${C.violet}30`, background: C.violetTint, color: C.violet, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body },
  btnBlue:      { display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 12, background: `linear-gradient(135deg, ${C.violetMid}, ${C.violet})`, color: "#fff", padding: "12px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px rgba(26,110,255,0.3)`, fontFamily: F.body },

  emptyCard:  { maxWidth: 620, margin: "80px auto", padding: "56px 28px", textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, boxShadow: "0 8px 40px rgba(26,110,255,0.09)" },
  emptyTitle: { margin: "10px 0 0", fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text },
  emptyText:  { maxWidth: 480, margin: "10px auto 22px", color: C.sub, lineHeight: 1.7, fontSize: 13.5 },
};

export default Analytics;
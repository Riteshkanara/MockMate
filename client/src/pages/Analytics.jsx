import { useEffect, useMemo, useState, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { getAnalytics } from "../Services/interviewService";

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE ANALYTICS — READINESS INTELLIGENCE v4
// Blueprint blue system — exact tokens shared with Dashboard so both pages
// are visually the same product, not siblings from different families.
// Every number is computed by the same IRS formula as Dashboard.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Design tokens — EXACT mirror of Dashboard C ─────────────────────────────
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
  blue400:  "#4D8FFF",
  blue500:  "#1A6EFF",
  blue600:  "#0057E8",
  blue700:  "#0044C4",
  blue900:  "#001F6B",

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

  shadow:   "0 1px 12px rgba(26,110,255,0.07)",
  shadowMd: "0 6px 28px rgba(26,110,255,0.12)",
  shadowLg: "0 16px 56px rgba(0,31,107,0.18)",
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Dimension display metadata — icons, tips, weights for rendering only.
// Scores, hasData, contributingTopics come from the API (scoringModel.js
// with the real synonym resolver). This array is NEVER used to compute IRS.
const DIMENSION_META = [
  { key: "technical",      label: "Technical Depth", icon: "⚙",  weight: 0.28, tip: "Core CS fundamentals — the first thing technical screeners test." },
  { key: "problemSolving", label: "Problem Solving", icon: "🔍", weight: 0.22, tip: "How you break down unknowns — decisive in live coding rounds." },
  { key: "communication",  label: "Communication",   icon: "💬", weight: 0.18, tip: "Clarity of thought — interviewers notice it fast." },
  { key: "behavioral",     label: "Behavioral",      icon: "🤝", weight: 0.12, tip: "Situational judgment and self-awareness under HR scrutiny." },
  { key: "design",         label: "System Design",   icon: "🏗",  weight: 0.10, tip: "Matters at ₹12 LPA+ — often the differentiator between tiers." },
  { key: "fundamentals",   label: "CS Fundamentals", icon: "📚", weight: 0.10, tip: "Breadth of core knowledge — separates prepared from lucky." },
];

// ─── Tier display metadata — colors/bg only. Thresholds + readiness logic
// live in scoringModel.js (backend). Frontend reads computed values from API.
const TIER_META = {
  "₹3–6 LPA":   { color: "#7A8BAF", bg: C.blue50    },
  "₹6–12 LPA":  { color: C.amber,   bg: C.amberTint },
  "₹12–20 LPA": { color: C.blue500, bg: C.blue50    },
  "₹20 LPA+":   { color: C.cyan500, bg: C.cyanTint  },
};

// ─── Archetypes ───────────────────────────────────────────────────────────────
const ARCHETYPES = [
  { id: "inconsistentGenius", label: "Inconsistent Genius", icon: "🎲", desc: "High variance — brilliant when in flow, needs to build a floor.", fix: "Consistency drills: hold 65+ on every session before chasing 90+." },
  { id: "consistentClimber",  label: "Consistent Climber",  icon: "📈", desc: "Steady, reliable improvement — the archetype that wins campus placements.", fix: "Keep the streak; add harder topic rotations to keep growing." },
  { id: "speedRunner",        label: "Speed Runner",        icon: "⚡", desc: "Fast answers but sometimes sacrifices depth for pace.", fix: "Practise 'think aloud' — say your reasoning before your answer." },
  { id: "deepThinker",        label: "Deep Thinker",        icon: "🧠", desc: "Thorough and accurate — needs to improve time management.", fix: "Run timed drills: 2-minute cap per answer in quick-fire mode." },
  { id: "pressureCooker",     label: "Pressure Cooker",     icon: "🔥", desc: "Scores improve under timed, competitive conditions.", fix: "Channel this by joining live contest platforms weekly." },
];

// ─── Shared maths helpers (read-only — used only for archetype derivation
//     and chart annotations, NOT for IRS/tier computation) ──────────────────
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));

const ewma = (values, alpha = 0.35) => {
  if (!values.length) return 0;
  return values.reduce((acc, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * acc), values[0]);
};

const stdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const trendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, v) => a + v, 0) / n;
  const num   = values.reduce((a, v, i) => a + (i - xMean) * (v - yMean), 0);
  const den   = values.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
  return den ? num / den : 0;
};

const deriveArchetype = (scoreTrend, avgTimePerQ, avgScore) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1];
  const sd    = stdDev(scores);
  const slope = trendSlope(scores);
  if (sd > 18)   return ARCHETYPES[0];
  if (slope > 2) return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};

/** Topic ROI — uses DIMENSION_META weights (display only, consistent with API weights) */
const topicROI = (topic, dimensionProfile) => {
  // find which dimension this topic contributes to via the API's contributingTopics field
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

// ─── Animated ring — recoloured to blue system ───────────────────────────────
const AnimatedRing = ({ score, size = 160, strokeWidth = 14 }) => {
  const [displayed, setDisplayed] = useState(0);
  const r    = size / 2 - strokeWidth;
  const circ = 2 * Math.PI * r;
  const offset = circ - (displayed / 100) * circ;
  const color  = scoreColor(score);

  useEffect(() => {
    let start = null;
    const duration = 1400;
    const animate  = (ts) => {
      if (!start) start = ts;
      const p    = Math.min((ts - start) / duration, 1);
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
          <stop offset="0%"   stopColor={C.blue400}  stopOpacity="0.5" />
          <stop offset="100%" stopColor={C.cyan400} />
        </linearGradient>
        <filter id="ringGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#ringGrad)" strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.05s linear", filter: "url(#ringGlow)" }}
      />
      <g transform={`rotate(90, ${size/2}, ${size/2})`}>
        <text x={size/2} y={size/2 - 10} textAnchor="middle"
          fill={color} fontSize={34} fontWeight={900}
          fontFamily={F.display} dominantBaseline="middle"
        >{displayed}</text>
        <text x={size/2} y={size/2 + 18} textAnchor="middle"
          fill={C.muted} fontSize={9} fontWeight={700} letterSpacing="1.5"
          fontFamily={F.mono}
        >IRS SCORE</text>
      </g>
    </svg>
  );
};

// ─── Living Skill Aura — blue edition ────────────────────────────────────────
const LivingAura = ({ data: radarData, irs }) => {
  const [pulse, setPulse] = useState(0);
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

  const N = radarData.length;
  const cx = 200, cy = 200, maxR = 142;

  const pointsForScale = (scale) =>
    radarData.map((d, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const r = (d.score / 100) * maxR * scale;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });

  const toPath = (pts) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + "Z";

  const outerPts = pointsForScale(1);
  const midPts   = pointsForScale(0.70 + pulse * 0.022);
  const innerPts = pointsForScale(0.42 + pulse * 0.016);
  const corePts  = pointsForScale(0.22);

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
    <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
      <svg viewBox="0 0 400 400" width="100%" style={{ maxWidth: 420, overflow: "visible" }}>
        <defs>
          <radialGradient id="auraCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={C.blue500}  stopOpacity="0.5" />
            <stop offset="100%" stopColor={C.blue700}  stopOpacity="0.04" />
          </radialGradient>
          <radialGradient id="auraMid" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={C.blue400}  stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.cyan500}  stopOpacity="0.03" />
          </radialGradient>
          <radialGradient id="auraOuter" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={C.cyan400}  stopOpacity="0.12" />
            <stop offset="100%" stopColor={C.blue200}  stopOpacity="0.01" />
          </radialGradient>
          <filter id="auraGlow"  x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid rings */}
        {gridRings.map((s, i) => (
          <polygon key={i} points={gridPolygon(s)}
            fill="none" stroke={C.border}
            strokeWidth={i === gridRings.length - 1 ? 1.5 : 0.8}
            strokeOpacity={0.8}
          />
        ))}
        {/* Ring labels */}
        {gridRings.map((s, i) => {
          const angle = -Math.PI / 2;
          return (
            <text key={i}
              x={cx + maxR * s * Math.cos(angle) + 4}
              y={cy + maxR * s * Math.sin(angle)}
              fill={C.faint} fontSize={7} fontFamily={F.mono}
            >{s * 100}</text>
          );
        })}

        {/* Spokes */}
        {radarData.map((_, i) => {
          const angle = (2 * Math.PI * i) / N - Math.PI / 2;
          return (
            <line key={i}
              x1={cx} y1={cy}
              x2={cx + maxR * Math.cos(angle)}
              y2={cy + maxR * Math.sin(angle)}
              stroke={C.border} strokeWidth={0.8} strokeOpacity={0.7}
            />
          );
        })}

        {/* Aura layers */}
        <path d={toPath(outerPts)} fill="url(#auraOuter)" stroke={C.cyan400} strokeWidth={1} strokeOpacity={0.25 + pulse * 0.05} />
        <path d={toPath(midPts)}   fill="url(#auraMid)"   stroke={C.blue400} strokeWidth={1.5} strokeOpacity={0.4 + pulse * 0.1} filter="url(#softGlow)" />
        <path d={toPath(innerPts)} fill="url(#auraCore)"  stroke={C.blue500} strokeWidth={2} strokeOpacity={0.65 + pulse * 0.15} filter="url(#auraGlow)" />
        <path d={toPath(corePts)}  fill={C.blue500} fillOpacity={0.18} stroke={C.blue600} strokeWidth={1.5} />

        {/* Outer data line */}
        <path d={toPath(outerPts)} fill="none" stroke={`url(#ringGrad)`} strokeWidth={2.5} strokeOpacity={0.95} filter="url(#softGlow)" />

        {/* Data dots */}
        {outerPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4.5}
            fill={scoreColor(radarData[i]?.score || 0)}
            stroke="#fff" strokeWidth={1.5}
            filter="url(#softGlow)"
          />
        ))}

        {/* Labels */}
        {labelPts.map(({ x, y, label, score, icon }, i) => (
          <g key={i}>
            <text x={x} y={y - 8} textAnchor="middle" dominantBaseline="middle"
              fill={C.text} fontSize={10} fontWeight={800} fontFamily={F.body}
            >{icon} {label}</text>
            <text x={x} y={y + 8} textAnchor="middle" dominantBaseline="middle"
              fill={scoreColor(score)} fontSize={11} fontWeight={700} fontFamily={F.display}
            >{score}</text>
          </g>
        ))}

        {/* Centre badge */}
        <circle cx={cx} cy={cy} r={38}
          fill="white" fillOpacity={0.96}
          stroke={C.borderStr} strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 4px 16px rgba(26,110,255,0.20))` }}
        />
        <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
          fill={C.blue600} fontSize={22} fontWeight={900} fontFamily={F.display}
        >{irs}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
          fill={C.muted} fontSize={7} fontWeight={800} letterSpacing="1.4" fontFamily={F.mono}
        >IRS</text>
      </svg>
    </div>
  );
};

// ─── DNA Fingerprint — blue edition ──────────────────────────────────────────
const DNAFingerprint = ({ profile }) => {
  const seed = profile.reduce((acc, d) => acc + d.score, 0);

  const paths = profile.map((d, i) => {
    const freq  = 0.038 + (d.score / 100) * 0.07;
    const amp   = 16 + (d.score / 100) * 30;
    const yBase = 22 + i * 30;
    const color = scoreColor(d.score);
    const pts   = Array.from({ length: 80 }, (_, j) => {
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
            <path d={pts} fill="none" stroke={color} strokeWidth={1.8}
              strokeOpacity={0.7} filter="url(#dnaGlow)"
            />
            <text x={352} y={22 + i * 30} textAnchor="end"
              fill={C.muted} fontSize={8} fontWeight={600}
              fontFamily={F.body} dominantBaseline="middle"
            >{icon} {label} <tspan fill={color} fontWeight={800}>{s}</tspan></text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ─── Streak calendar — blue edition ──────────────────────────────────────────
const StreakCalendar = ({ scoreTrend }) => {
  const today = new Date();
  const WEEKS = 15;
  const DAYS  = WEEKS * 7;

  const sessionMap = useMemo(() => {
    const map = {};
    (scoreTrend || []).forEach(s => {
      // scoreTrend items have { date, score }
      const raw = s.date || s.createdAt;
      if (!raw) return;
      const d   = new Date(raw);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key] || (s.score || 0) > map[key]) map[key] = s.score || 0;
    });
    return map;
  }, [scoreTrend]);

  const cells = Array.from({ length: DAYS }, (_, i) => {
    const d   = new Date(today);
    d.setDate(today.getDate() - (DAYS - 1 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return { date: d, score: sessionMap[key] ?? 0, hasData: key in sessionMap };
  });

  const heatColor = (score, hasData) => {
    if (!hasData) return C.border;
    if (score >= 85) return C.blue700;
    if (score >= 70) return C.blue500;
    if (score >= 55) return C.blue400;
    if (score >= 40) return C.blue200;
    return C.blue100;
  };

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: WEEKS }, (_, w) => (
          <div key={w} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {cells.slice(w * 7, w * 7 + 7).map((cell, d) => (
              <div
                key={d}
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
        {[C.blue100, C.blue200, C.blue400, C.blue500, C.blue700].map((bg, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: bg, flexShrink: 0 }} />
        ))}
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>High</span>
      </div>
    </div>
  );
};

// ─── Confidence vs Accuracy ───────────────────────────────────────────────────
const ConfidenceChart = ({ topics, avgTimePerQ }) => {
  const data = (topics || []).map(t => {
    const timePerQ    = t.avgTimePerQ || avgTimePerQ || 40;
    const confidence  = Math.max(0, Math.min(100, 100 - (timePerQ / 90) * 100));
    const accuracy    = t.averageScore || 0;
    const divergence  = confidence - accuracy;
    return { topic: t.topic, confidence: Math.round(confidence), accuracy: Math.round(accuracy), divergence: Math.round(divergence) };
  });

  const getLabel = (d) => {
    if (d > 15) return { text: "Overconfident", color: C.orange, bg: C.orangeTint };
    if (d < -10) return { text: "Underrated", color: C.blue500, bg: C.blue50 };
    return { text: "Calibrated", color: C.green, bg: C.greenTint };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
      {data.map(d => {
        const lbl = getLabel(d.divergence);
        return (
          <div key={d.topic}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.topic}</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: lbl.bg, color: lbl.color }}>
                {d.divergence > 0 ? "⚠ " : d.divergence < -10 ? "🎯 " : "✓ "}{lbl.text}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 3 }}>SPEED (CONFIDENCE PROXY)</div>
                <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.confidence}%`, background: C.amber, borderRadius: 999 }} />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 2 }}>{d.confidence}</div>
              </div>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 3 }}>ACTUAL ACCURACY</div>
                <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.accuracy}%`, background: scoreColor(d.accuracy), borderRadius: 999 }} />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 2 }}>{d.accuracy}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Metric card ─────────────────────────────────────────────────────────────
const MetricCard = ({ icon, label, value, sub, color }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 13,
    padding: "18px 16px", background: C.card,
    border: `1px solid ${C.border}`, borderRadius: 18,
    boxShadow: C.shadow,
  }}>
    <div style={{
      width: 46, height: 46, borderRadius: 14, flexShrink: 0,
      background: C.blue50, border: `1px solid ${C.borderMd}`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
    }}>{icon}</div>
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: "0.4px", marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
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
    stable:  { icon: "→", color: C.blue500,bg: C.blue50,    label: "Stable" },
  }[momentum] || { icon: "→", color: C.muted, bg: C.border, label: "—" };

  return (
    <span style={{
      padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 800,
      color: cfg.color, background: cfg.bg, whiteSpace: "nowrap",
      fontFamily: F.mono,
    }}>{cfg.icon} {cfg.label}</span>
  );
};

// ─── IRS breakdown explanation tooltip chip ───────────────────────────────────
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

// ─── AI Readiness Board — blue dark panel ────────────────────────────────────
const AIReadinessBoard = ({ profile, irs, archetype, topTier, weakest, strongest, scoreTrend, totalSessions }) => {
  const [analysis,  setAnalysis]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  const slope  = trendSlope(scoreTrend.slice(-6).map(s => s.score || 0));
  const sd     = stdDev(scoreTrend.map(s => s.score || 0));

  const generateAnalysis = async () => {
    setLoading(true);
    setAnalysis("");
    setDone(false);
    try {
      const prompt = `You are MockMate's AI placement coach. Analyze this Indian CS/IT student's mock interview performance profile and give sharp, specific, actionable advice.

Verified stats:
- Interview Readiness Score (IRS): ${irs}/100  |  Package tier: ${topTier?.label}
- Archetype: ${archetype?.label} — ${archetype?.desc}
- Strongest dimension: ${strongest?.label} (${strongest?.score}/100)
- Weakest dimension:   ${weakest?.label} (${weakest?.score}/100)
- Total sessions: ${totalSessions}
- Score trend slope (last 6): ${slope.toFixed(2)} pts/session
- Score StdDev: ${sd.toFixed(1)} (${sd > 18 ? "HIGH variance" : sd > 10 ? "moderate variance" : "consistent"})
- Dimensions: ${profile.map(d => `${d.label}: ${d.score}`).join(" | ")}

Write exactly this structure (plain text, no markdown, no emojis):

VERDICT
One direct sentence on where they truly stand entering placement season.

CRITICAL GAPS
3 specific things to fix before interviews. Name topics and numbers.

STRENGTHS TO LEVERAGE
2 real advantages they have over peers. Be specific.

30-DAY BATTLE PLAN
4 concrete weekly targets to jump one tier. Start each with a number.

MINDSET ALERT
One honest observation about their learning pattern that most coaches won't say. Reference their archetype.

Under 300 words. Sharp, real, no padding.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const d    = await res.json();
      const text = d.content?.[0]?.text || "Unable to generate analysis. Try again.";
      setAnalysis(text);
      setDone(true);
    } catch {
      setAnalysis("Could not reach AI coach. Please check your connection and try again.");
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const sectionAccents = {
    "VERDICT":              C.cyan400,
    "CRITICAL GAPS":        C.red,
    "STRENGTHS TO LEVERAGE":C.green,
    "30-DAY BATTLE PLAN":   C.blue400,
    "MINDSET ALERT":        C.amber,
  };

  const parsedSections = done
    ? analysis.split(/\n(?=[A-Z][A-Z ]{3,}\n)/).filter(Boolean).map(s => {
        const lines   = s.trim().split("\n");
        const heading = lines[0].trim();
        const body    = lines.slice(1).join("\n").trim();
        return { heading, body, accent: sectionAccents[heading] || C.blue400 };
      })
    : [];

  return (
    <section style={{
      background: `linear-gradient(135deg, ${C.blue900} 0%, #001A50 45%, #002244 80%, #003355 100%)`,
      borderRadius: 24, padding: "28px 28px 24px",
      boxShadow: C.shadowLg, border: `1px solid rgba(26,110,255,0.25)`,
      marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "1.6px", color: C.cyan400, marginBottom: 7 }}>
            AI READINESS BOARD
          </div>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 21, fontWeight: 800, color: "#fff" }}>
            Your AI placement coach just analysed your data.
          </h2>
          <p style={{ margin: "7px 0 0", color: "rgba(255,255,255,0.52)", fontSize: 12.5, lineHeight: 1.65, maxWidth: 560 }}>
            Gaps, strengths, your 30-day battle plan — all derived from your real IRS components, not generic advice.
          </p>
        </div>
        <button
          onClick={generateAnalysis}
          disabled={loading}
          style={{
            border: "none", borderRadius: 12, flexShrink: 0,
            background: loading ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`,
            color: "#fff", padding: "12px 20px", fontSize: 13, fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : `0 4px 20px rgba(0,173,224,0.35)`,
            display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            fontFamily: F.body,
          }}
        >
          {loading ? (
            <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Analysing…</>
          ) : done ? "↺ Re-analyse" : "⚡ Analyse My Profile"}
        </button>
      </div>

      {!analysis && !loading && (
        <div style={{ padding: "40px 20px", textAlign: "center", border: `1.5px dashed rgba(26,110,255,0.3)`, borderRadius: 14 }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🎯</div>
          <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, margin: 0, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Click "Analyse My Profile" — the AI will study your IRS components, spot patterns in your variance, and give you a real 30-day battle plan.
          </p>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {[
            `Scanning IRS = ${irs}/100 across 6 dimensions…`,
            `Computing score variance (StdDev: ${sd.toFixed(1)})…`,
            `Mapping ${strongest?.label} strength vs ${weakest?.label} gap…`,
            "Drafting your 30-day battle plan…"
          ].map((msg, i) => (
            <div key={i} style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid rgba(26,110,255,0.15)`,
              color: "rgba(255,255,255,0.48)", fontSize: 12, fontFamily: F.mono,
            }}>{msg}</div>
          ))}
        </div>
      )}

      {done && parsedSections.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 4 }}>
          {parsedSections.map((s, i) => (
            <div key={i} style={{
              padding: "15px 16px", borderRadius: 14,
              background: "rgba(255,255,255,0.045)",
              border: `1px solid rgba(255,255,255,0.07)`,
              borderLeft: `3px solid ${s.accent}`,
            }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: "1.4px", color: s.accent, marginBottom: 9 }}>
                {s.heading}
              </div>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.82)", fontSize: 12.5, lineHeight: 1.72, whiteSpace: "pre-line" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {done && parsedSections.length === 0 && (
        <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 12.5, lineHeight: 1.72, marginTop: 8, whiteSpace: "pre-line" }}>
          {analysis}
        </p>
      )}
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYTICS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const Analytics = () => {
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await getAnalytics();
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
  const scoreTrend       = useMemo(() => data?.scoreTrend ?? [],       [data]);
  const averageScore     = data?.averageScore ?? 0;
  const totalSessions    = data?.totalSessions ?? 0;
  const avgTimePerQ      = data?.timePerformance?.averageTimePerQuestion ?? null;
  const highestScore     = data?.highestScore ?? data?.bestScore ?? Math.max(0, ...scoreTrend.map(s => s.score || 0));

  // ── IRS + tier — always read from backend (scoringModel.js).
  // The backend uses a real synonym resolver that handles 65+ Gemini topic
  // phrasings. The old frontend DIMENSIONS exact-match silently dropped ~20%
  // of real answered questions from dimension scores — that code is gone.
  const irs = data?.irs ?? 0;
  const currentTierLabel = data?.currentTier ?? "₹3–6 LPA";
  const currentTierMeta  = TIER_META[currentTierLabel] ?? TIER_META["₹3–6 LPA"];
  const currentTier      = { label: currentTierLabel, ...currentTierMeta };

  const apiTiers   = data?.tiers ?? [];
  const nextTierApi = apiTiers.find(t => !t.isUnlocked && t.label !== currentTierLabel) ?? null;
  const nextTier    = nextTierApi
    ? { label: nextTierApi.label, minScore: nextTierApi.minIRS, color: TIER_META[nextTierApi.label]?.color ?? C.blue500, advice: nextTierApi.advice, desc: nextTierApi.desc }
    : null;

  // ── Six-dimension profile — from backend (synonym-resolved).
  // Merge DIMENSION_META display fields onto API shape.
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

  // IRS sub-components for the breakdown panel — read straight from the
  // backend's computeIRSBreakdown() (server/utils/scoringModel.js), NOT
  // re-derived here. The old version re-implemented the V1 formula
  // client-side (different weights, no maturity gate, no rigor component),
  // which meant this panel could show numbers that didn't add up to the
  // headline IRS anymore once the backend model changed. Single source of
  // truth now lives on the server; this just renders it.
  const irsBreakdown  = data?.irsBreakdown ?? null;
  const irsComponents = useMemo(() => {
    if (!irsBreakdown) return {};
    const c = irsBreakdown.components;
    return {
      dimScore:    c.dimension.score,
      ewmaScore:   c.ewma.score,
      breadth:     c.breadth.score,
      consistency: c.consistency.score,
      rigor:       c.rigor.score,
    };
  }, [irsBreakdown]);

  // Maturity multiplier — how much the evidence volume (answered questions)
  // is currently suppressing the composite score. 1.0 = full trust, lower =
  // "the math says X, but you don't have enough logged history yet to fully
  // trust that number." Shown so the score doesn't feel arbitrary.
  const irsMaturity = irsBreakdown?.maturity ?? null;
  const irsRawComposite = irsBreakdown?.rawComposite ?? null;

  // Gated vs raw tier — currentTier (above) is already the evidence-gated
  // one from the backend. currentTierIsGated tells us the raw IRS math
  // actually points to a HIGHER tier than what's being shown, in which case
  // we say "on track for X, N more sessions to confirm it" instead of
  // silently downgrading with no explanation.
  const currentTierIsGated     = data?.currentTierIsGated ?? false;
  const currentTierRawLabel    = data?.currentTierRaw ?? currentTierLabel;
  const sessionsNeededForRaw   = data?.sessionsNeededForRawTier ?? 0;

  const unmappedTopics = data?.unmappedTopics ?? [];

  const strongestDim = useMemo(() => [...dimensionProfile].filter(d => d.hasData).sort((a, b) => b.score - a.score)[0], [dimensionProfile]);
  const weakestDim   = useMemo(() => [...dimensionProfile].filter(d => d.hasData).sort((a, b) => a.score - b.score)[0],  [dimensionProfile]);

  const archetype = useMemo(() => deriveArchetype(scoreTrend, avgTimePerQ, averageScore), [scoreTrend, avgTimePerQ, averageScore]);

  // Topic ranking by ROI — uses backend-resolved dimension profile so the
  // weight used for each topic matches the IRS formula, not the old exact-match lookup.
  const topicROIRanking = useMemo(() =>
    [...topicPerformance]
      .map(t => ({ ...t, roi: topicROI(t.topic, dimensionProfile) }))
      .sort((a, b) => b.roi - a.roi),
  [topicPerformance, dimensionProfile]);

  // Chart data
  const chartData = useMemo(() =>
    scoreTrend.map((item, i) => ({
      interview: `#${i + 1}`,
      score:     item.score || 0,
      avg:       averageScore,
    })),
  [scoreTrend, averageScore]);

  const latestScore  = chartData.at(-1)?.score ?? 0;
  const prevScore    = chartData.at(-2)?.score ?? latestScore;
  const delta        = latestScore - prevScore;

  const slope        = trendSlope(scoreTrend.map(s => s.score || 0));
  const sd           = stdDev(scoreTrend.map(s => s.score || 0));

  // ── States ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={S.spinner} />
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
        <button style={S.btnPrimary} onClick={() => window.location.reload()}>Try Again</button>
      </div>
    </div>
  );

  if (!data || totalSessions === 0) return (
    <div style={S.page}>
      <div style={S.emptyCard}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🧠</div>
        <div style={S.eyebrow}>READINESS INTELLIGENCE</div>
        <h1 style={S.emptyTitle}>Your interview fingerprint starts here.</h1>
        <p style={S.emptyText}>Complete your first mock interview and MockMate will compute your IRS, map your dimensions, and show you exactly which package tier you're ready for.</p>
        <button style={S.btnPrimary} onClick={() => navigate("/interview")}>Start First Interview →</button>
      </div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        *, *::before, *::after { box-sizing: border-box; }
        .an-page button:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .an-page * { animation: none !important; transition: none !important; } }
        @media (max-width: 960px)  { .an-two-col { grid-template-columns: 1fr !important; } .an-hero-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 760px)  { .an-stats { grid-template-columns: repeat(2,1fr) !important; } .an-tiers { grid-template-columns: repeat(2,1fr) !important; } .an-dims { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 480px)  { .an-page { padding: 16px 12px 60px !important; } .an-stats { grid-template-columns: 1fr !important; } .an-dims { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ ...S.container, opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(10px)", transition: "opacity 0.55s ease, transform 0.55s cubic-bezier(.16,1,.3,1)" }} className="an-page">

        {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <div style={S.eyebrow}>READINESS INTELLIGENCE</div>
            <h1 style={S.pageTitle}>Understand exactly how interview-ready you are.</h1>
            <p style={{ maxWidth: 640, margin: "10px 0 0", color: C.sub, fontSize: 13.5, lineHeight: 1.65, fontFamily: F.body }}>
              IRS = weighted dimension avg · EWMA trend · topic breadth · consistency.
              Every number here is from the same formula your Dashboard uses.
            </p>
          </div>
          <button style={S.btnPrimary} onClick={() => navigate("/interview")}>🎯 New Interview</button>
        </div>

        {/* ── HERO: LIVING AURA + IRS BREAKDOWN ───────────────────────── */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18, marginBottom: 18 }} className="an-hero-grid">

          {/* Living Skill Aura */}
          <div style={{ ...S.card, background: `linear-gradient(145deg, ${C.card} 0%, ${C.cardAlt} 100%)` }}>
            <div style={S.eyebrow}>LIVING SKILL AURA</div>
            <h2 style={{ ...S.cardH2, marginBottom: 4 }}>
              {irs >= 80 ? "Interview Ready" : irs >= 60 ? "Nearly Ready" : irs >= 40 ? "Building Readiness" : "Needs Focus"}
            </h2>
            <p style={{ ...S.cardSub, marginBottom: 16 }}>
              Each pulsing layer represents your real skill depth across six dimensions.
              Larger shape = stronger readiness. Empty rings = room to grow.
            </p>
            <LivingAura data={dimensionProfile} irs={irs} />
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* IRS ring + tier */}
            <div style={{ ...S.card, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={S.eyebrow}>INTERVIEW READINESS SCORE</div>
              <p style={{ margin: "4px 0 14px", color: C.sub, fontSize: 11, fontFamily: F.mono, letterSpacing: "0.3px" }}>
                4-component weighted composite
              </p>
              <AnimatedRing score={irs} size={150} strokeWidth={13} />
              <div style={{ marginTop: 12, width: "100%", padding: "10px 14px", borderRadius: 12, background: `${currentTier.color}15`, border: `1px solid ${currentTier.color}40`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: currentTier.color, fontFamily: F.display }}>{currentTier.label} eligible</div>
                  {nextTierApi?.desc && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>{nextTierApi.desc}</div>}
                </div>
              </div>
              {nextTier && (
                <div style={{ marginTop: 9, fontSize: 11, color: C.sub, fontFamily: F.mono }}>
                  {nextTier.minScore - irs} pts → <strong style={{ color: nextTier.color }}>{nextTier.label}</strong>
                </div>
              )}
            </div>

            {/* Archetype */}
            <div style={{ ...S.card, flex: 1 }}>
              <div style={S.eyebrow}>INTERVIEW ARCHETYPE</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, fontSize: 22, background: C.blue50, border: `1px solid ${C.borderMd}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {archetype.icon}
                </div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text }}>{archetype.label}</div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.55 }}>{archetype.desc}</div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.blue600, lineHeight: 1.55 }}>
                    Fix: {archetype.fix}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── IRS COMPONENT BREAKDOWN ──────────────────────────────────── */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={S.eyebrow}>IRS BREAKDOWN</div>
              <h2 style={S.cardH2}>How your {irs}/100 is computed</h2>
              <p style={S.cardSub}>Five statistical components, Bayesian-shrunk toward a neutral baseline until you've logged enough evidence — not a single average that can be gamed by drilling one topic or one lucky session.</p>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, lineHeight: 1.7, maxWidth: 340 }}>
              Weighted dim avg × 40%<br/>
              EWMA trend (shrunk) × 22%<br/>
              Topic breadth & depth × 13%<br/>
              Consistency (1 − CV) × 15%<br/>
              Difficulty-adjusted rigor × 10%
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 32px" }}>
            <IRSComponentBar label="Dimension-weighted avg" value={irsComponents.dimScore} weight={0.40} color={C.blue500} />
            <IRSComponentBar label="EWMA recent trend"      value={irsComponents.ewmaScore} weight={0.22} color={C.cyan500} />
            <IRSComponentBar label="Topic breadth & depth"  value={irsComponents.breadth} weight={0.13} color={C.amber} />
            <IRSComponentBar label="Consistency (1−CV)"     value={irsComponents.consistency} weight={0.15} color={C.green} />
            <IRSComponentBar label="Difficulty-adjusted rigor" value={irsComponents.rigor} weight={0.10} color={C.sub} />
          </div>

          {irsMaturity != null && irsMaturity < 0.97 && (
            <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: "#FFF7E8", border: `1px solid #F0D8A8`, fontSize: 12, color: "#8A6414", lineHeight: 1.6 }}>
              <strong>Evidence gate active:</strong> the raw weighted composite above is {irsRawComposite}/100, but with only {data?.totalAnsweredQuestions ?? 0} answered questions logged so far your trusted IRS is scaled to <strong>{Math.round(irsMaturity * 100)}%</strong> confidence — <strong>{irs}/100</strong>. Keep practicing; this multiplier climbs toward 100% as you log more sessions, and stops artificially inflating your score off a small sample.
            </div>
          )}

          {currentTierIsGated && (
            <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}`, fontSize: 12, color: C.blue700 ?? C.sub, lineHeight: 1.6 }}>
              <strong>On track for {currentTierRawLabel}:</strong> your IRS math already crosses that band, but we don't show it as confirmed until you've logged a few more sessions ({sessionsNeededForRaw} more needed) — small sample sizes can be misleading, and we'd rather under-promise here.
            </div>
          )}

          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}`, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div><span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>SCORE STD-DEV</span><br /><strong style={{ color: C.text, fontSize: 14, fontFamily: F.display }}>{sd.toFixed(1)}</strong></div>
            <div><span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>TREND SLOPE</span><br /><strong style={{ color: slope >= 0 ? C.green : C.orange, fontSize: 14, fontFamily: F.display }}>{slope >= 0 ? "+" : ""}{slope.toFixed(2)} pts/session</strong></div>
            <div><span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>TOPICS COVERED</span><br /><strong style={{ color: C.text, fontSize: 14, fontFamily: F.display }}>{topicPerformance.length}/8+</strong></div>
            <div><span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>SESSIONS</span><br /><strong style={{ color: C.text, fontSize: 14, fontFamily: F.display }}>{totalSessions}</strong></div>
            <div><span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>EVIDENCE CONFIDENCE</span><br /><strong style={{ color: C.text, fontSize: 14, fontFamily: F.display }}>{irsMaturity != null ? `${Math.round(irsMaturity * 100)}%` : "—"}</strong></div>
          </div>
        </section>

        {/* ── STAT CARDS ───────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }} className="an-stats">
          <MetricCard icon="🎤" label="SESSIONS"    value={totalSessions}    sub={`${topicPerformance.length} topics covered`}       color={C.blue600} />
          <MetricCard icon="📈" label="AVG SCORE"   value={`${averageScore}/100`} sub={delta >= 0 ? `↑ ${delta} pts vs last` : `↓ ${Math.abs(delta)} pts vs last`} color={scoreColor(averageScore)} />
          <MetricCard icon="🏆" label="BEST SCORE"  value={`${highestScore}/100`} sub="Your performance ceiling"                     color={C.amber} />
          <MetricCard icon="⏱" label="AVG TIME/Q"  value={`${avgTimePerQ ?? "—"}s`} sub={avgTimePerQ ? (avgTimePerQ < 30 ? "Fast paced" : avgTimePerQ > 55 ? "Methodical" : "Balanced") : "No data"} color={C.sub} />
        </div>

        {/* ── TIER READINESS ───────────────────────────────────────────── */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={S.eyebrow}>PACKAGE TIER READINESS</div>
          <h2 style={S.cardH2}>Where you stand in the placement food chain</h2>
          <p style={{ ...S.cardSub, marginBottom: 20 }}>IRS thresholds map directly to real Indian placement market data.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="an-tiers">
            {apiTiers.map((tier) => {
              const meta      = TIER_META[tier.label] ?? { color: C.blue500, bg: C.blue50 };
              const reached   = tier.isUnlocked;
              const isCurrent = tier.label === currentTierLabel;
              const pct       = Math.min(100, tier.minIRS === 0 ? 100 : (irs / tier.minIRS) * 100);
              return (
                <div key={tier.label} style={{
                  padding: "16px 15px", borderRadius: 16,
                  border: `2px solid ${isCurrent ? meta.color : C.border}`,
                  background: isCurrent ? `${meta.color}12` : C.cardAlt,
                  position: "relative", transition: "all 0.2s",
                }}>
                  {isCurrent && (
                    <div style={{ position: "absolute", top: 9, right: 9, fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: meta.color, color: "#fff", fontFamily: F.mono, letterSpacing: "0.5px" }}>CURRENT</div>
                  )}
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

        {/* ── DNA FINGERPRINT + STREAK CALENDAR ───────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">
          <div style={S.card}>
            <div style={S.eyebrow}>PERFORMANCE DNA</div>
            <h2 style={S.cardH2}>Your unique score fingerprint</h2>
            <p style={{ ...S.cardSub, marginBottom: 14 }}>
              A generative waveform derived from your six dimensions — no two students have the same pattern.
              Amplitude = score magnitude, frequency = dimension weight.
            </p>
            <DNAFingerprint profile={dimensionProfile} />
            <div style={{ marginTop: 12, display: "flex", gap: 7, flexWrap: "wrap" }}>
              {dimensionProfile.map(d => (
                <span key={d.key} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: d.hasData ? `${scoreColor(d.score)}18` : C.border, color: d.hasData ? scoreColor(d.score) : C.faint }}>
                  {d.icon} {d.label}: {d.hasData ? d.score : "—"}
                </span>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.eyebrow}>PRACTICE ACTIVITY</div>
            <h2 style={S.cardH2}>15-week session log</h2>
            <p style={{ ...S.cardSub, marginBottom: 16 }}>
              Darker blue = higher score. Hover for date and exact score.
            </p>
            <StreakCalendar scoreTrend={scoreTrend} />
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { label: "Total", val: totalSessions, color: C.blue600 },
                { label: "Strong (80+)", val: scoreTrend.filter(s => (s.score||0) >= 80).length, color: C.green },
                { label: "Last delta", val: `${delta >= 0 ? "+" : ""}${delta}`, color: delta >= 0 ? C.green : C.orange },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "10px", background: C.cardAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 3 }}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PERFORMANCE TRAJECTORY + TOPIC MOMENTUM ─────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">
          <div style={S.card}>
            <div style={S.eyebrow}>SCORE TRAJECTORY</div>
            <h2 style={S.cardH2}>Your readiness evolution</h2>
            <p style={S.cardSub}>Every completed session reshapes your IRS. The dashed line is your average.</p>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={240} style={{ marginTop: 16 }}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue500} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={C.blue500} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="interview" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10, fontFamily: F.mono }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10, fontFamily: F.mono }} />
                  <Tooltip
                    formatter={(v, name) => [`${v}/100`, name === "score" ? "Score" : "Avg"]}
                    contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: F.body, fontSize: 12 }}
                  />
                  <ReferenceLine y={averageScore} stroke={C.borderMd} strokeDasharray="4 4" label={{ value: `avg ${averageScore}`, position: "right", fontSize: 9, fill: C.muted, fontFamily: F.mono }} />
                  <Area type="monotone" dataKey="score"
                    stroke={C.blue500} strokeWidth={2.5} fill="url(#scoreGrad)"
                    dot={{ r: 4.5, fill: C.blue500, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 7, fill: C.cyan500 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ marginTop: 20, padding: "28px", textAlign: "center", background: C.blue50, borderRadius: 14, color: C.sub, fontSize: 13 }}>
                Complete 2+ interviews to see your trajectory.
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.eyebrow}>TOPIC MOMENTUM</div>
            <h2 style={S.cardH2}>Rising, stable, or falling?</h2>
            <p style={S.cardSub}>Trend tells more than a snapshot score.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {topicPerformance.slice(0, 7).map(t => {
                const momentum = getMomentum(scoreTrend, t.topic);
                const score    = t.averageScore || 0;
                return (
                  <div key={t.topic} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 92, fontSize: 11.5, fontWeight: 700, color: C.text, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.topic}
                    </div>
                    <div style={{ flex: 1, height: 8, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${mounted ? score : 0}%`, background: scoreColor(score), borderRadius: 999, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 800, color: scoreColor(score), width: 28, textAlign: "right", flexShrink: 0 }}>{score}</div>
                    <MomentumBadge momentum={momentum} />
                  </div>
                );
              })}
              {topicPerformance.length === 0 && <div style={{ color: C.muted, fontSize: 12, padding: "16px 0" }}>No topic data yet.</div>}
            </div>
          </div>
        </div>

        {/* ── CONFIDENCE vs ACCURACY + POINT-LOSS MAP ─────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">
          <div style={S.card}>
            <div style={S.eyebrow}>CONFIDENCE vs ACCURACY</div>
            <h2 style={S.cardH2}>Are you fast but wrong?</h2>
            <p style={S.cardSub}>
              Answer speed is a proxy for confidence. Where speed and accuracy diverge, you have a blind spot.
            </p>
            {topicPerformance.length > 0 ? (
              <ConfidenceChart topics={topicPerformance} avgTimePerQ={avgTimePerQ} />
            ) : (
              <div style={{ color: C.muted, fontSize: 12, padding: "20px 0" }}>Complete more interviews to map your confidence profile.</div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.eyebrow}>ROI POINT-LOSS MAP</div>
            <h2 style={S.cardH2}>Where you're leaking readiness points</h2>
            <p style={S.cardSub}>
              Ranked by ROI = dimension weight × gap. Fix #1 moves IRS more than any other change.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {topicROIRanking.slice(0, 5).map((t, i) => {
                const score = t.averageScore || 0;
                // Use contributingTopics from API profile — synonym-resolved, not exact-match
                const dim   = dimensionProfile.find(d =>
                  (d.contributingTopics ?? []).some(ct => ct.toLowerCase() === t.topic.toLowerCase())
                );
                return (
                  <div key={t.topic} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: i === 0 ? C.redTint : C.blue50, color: i === 0 ? C.red : C.blue600, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, fontFamily: F.mono }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <div>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{t.topic}</span>
                          {dim && <span style={{ marginLeft: 7, fontFamily: F.mono, fontSize: 9, color: C.muted }}>({dim.label})</span>}
                        </div>
                        <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 800, color: scoreColor(score) }}>{score}/100</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${score}%`, background: scoreColor(score), borderRadius: 999 }} />
                      </div>
                      <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 3 }}>
                        +{100 - score} pts headroom · ROI {t.roi.toFixed(1)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button style={{ ...S.btnSecondary, marginTop: 16 }} onClick={() => navigate("/interview")}>
              ⚡ Drill top ROI topic →
            </button>
          </div>
        </div>

        {/* ── SIX DIMENSIONS GRID ──────────────────────────────────────── */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={S.eyebrow}>PREPARATION PROFILE</div>
          <h2 style={S.cardH2}>Your six interview dimensions</h2>
          <p style={{ ...S.cardSub, marginBottom: 18 }}>
            Each bar is weighted in the IRS formula. Hover a card to see which topics map here.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="an-dims">
            {dimensionProfile.map(dim => {
              const col = dim.hasData ? scoreColor(dim.score) : C.faint;
              return (
                <div key={dim.key} title={dim.tip} style={{
                  padding: "16px 15px", borderRadius: 16,
                  border: `1.5px solid ${dim.hasData && dim.score >= 80 ? col + "55" : C.border}`,
                  background: dim.hasData && dim.score >= 80 ? `${col}0A` : C.cardAlt,
                  transition: "all 0.2s", cursor: "default",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 16, marginRight: 6 }}>{dim.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{dim.label}</span>
                    </div>
                    <span style={{ fontFamily: F.display, fontSize: 17, fontWeight: 900, color: dim.hasData ? col : C.faint }}>
                      {dim.hasData ? dim.score : "—"}
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${mounted && dim.hasData ? dim.score : 0}%`, background: col, borderRadius: 999, transition: "width 1.2s cubic-bezier(.16,1,.3,1)" }} />
                  </div>
                  <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: dim.hasData ? col : C.faint }}>
                      {!dim.hasData ? "No data yet" : dim.score >= 80 ? "✓ Strong" : dim.score >= 60 ? "→ Developing" : "↑ Focus needed"}
                    </span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>
                      {Math.round((dim.weight ?? 0) * 100)}% weight
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── AI READINESS BOARD ───────────────────────────────────────── */}
        <AIReadinessBoard
          profile={dimensionProfile}
          irs={irs}
          archetype={archetype}
          topTier={currentTier}
          weakest={weakestDim}
          strongest={strongestDim}
          scoreTrend={scoreTrend}
          totalSessions={totalSessions}
        />

        {/* ── SMART FOCUS + IRS CLIMB BANNER ───────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">

          {/* Smart Focus */}
          <div style={S.card}>
            <div style={S.eyebrow}>SMART FOCUS RECOMMENDER</div>
            <h2 style={S.cardH2}>Where to put your next hour</h2>
            <p style={S.cardSub}>Sorted by ROI — these fixes compound the fastest.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {topicROIRanking.slice(0, 3).map((t, i) => {
                const score  = t.averageScore || 0;
                const advice = score < 40 ? "Start from fundamentals — no shortcut here" : score < 60 ? "Drilling practice problems will move this fast" : "Run timed mock sessions on this topic only";
                return (
                  <div key={t.topic} style={{
                    display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 14px",
                    borderRadius: 12,
                    background: i === 0 ? C.redTint : i === 1 ? C.amberTint : C.blue50,
                    border: `1px solid ${i === 0 ? "#FECACA" : i === 1 ? "#FDE68A" : C.borderMd}`,
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: i === 0 ? C.red : i === 1 ? C.amber : C.blue500, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, fontFamily: F.mono, marginTop: 1 }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{t.topic} · {score}/100</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>{advice}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 4 }}>ROI score {t.roi.toFixed(1)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button style={{ ...S.btnSecondary, marginTop: 14 }} onClick={() => navigate("/interview")}>⚡ Start focused session →</button>
          </div>

          {/* Climb to next tier */}
          <div style={{
            background: `linear-gradient(135deg, ${C.blue50} 0%, ${C.cyanTint} 100%)`,
            border: `1px solid ${C.borderMd}`, borderRadius: 20, padding: 22,
            boxShadow: `0 4px 20px rgba(26,110,255,0.08)`,
            display: "flex", flexDirection: "column",
          }}>
            <div style={S.eyebrow}>IRS PROGRESS</div>
            <h2 style={S.cardH2}>
              {nextTier ? <>{nextTier.minScore - irs} points to <span style={{ color: nextTier.color }}>{nextTier.label}</span></> : "You've reached the highest tracked tier."}
            </h2>
            <p style={{ ...S.cardSub, marginBottom: 16 }}>{nextTier ? (nextTier.advice ?? "") : "Maintain your streak to protect this position."}</p>

            {nextTier && nextTier.minScore > 0 && (
              <>
                <div style={{ position: "relative", height: 10, borderRadius: 999, background: C.borderMd, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${mounted ? Math.min(100, (irs / nextTier.minScore) * 100) : 0}%`, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})`, borderRadius: 999, transition: "width 1.3s cubic-bezier(.16,1,.3,1)" }} />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginBottom: 20 }}>
                  {irs}/{nextTier.minScore} IRS ({Math.round((irs / nextTier.minScore) * 100)}% there)
                </div>
              </>
            )}

            <div style={{ marginTop: "auto" }}>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.7, marginBottom: 14 }}>
                Closing your <strong style={{ color: C.text }}>{weakestDim?.label}</strong> gap
                (currently {weakestDim?.score}/100) is the highest-leverage move to push IRS
                toward <strong style={{ color: nextTier?.color || C.green }}>{nextTier?.label || "peak"}</strong>.
              </div>
              <button style={{ ...S.btnBlue, width: "100%", justifyContent: "center" }} onClick={() => navigate("/interview")}>
                Keep climbing →
              </button>
            </div>
          </div>
        </div>

        {/* ── COACH BANNER ────────────────────────────────────────────── */}
        <section style={{
          display: "flex", alignItems: "center", gap: 18, padding: "22px 26px",
          borderRadius: 20, marginBottom: 18,
          background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 55%, ${C.cyan600} 100%)`,
          boxShadow: "0 12px 40px rgba(0,31,107,0.28)",
        }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🧠</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: "1.5px", color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>MOCKMATE READINESS COACH</div>
            <h2 style={{ margin: "0 0 6px", fontFamily: F.display, fontSize: 17, fontWeight: 800, color: "#fff" }}>
              Biggest unlock: <strong style={{ color: C.cyan400 }}>{weakestDim?.label}</strong> at {weakestDim?.score}/100.
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.65 }}>
              Strongest: <strong style={{ color: "#fff" }}>{strongestDim?.label}</strong> at {strongestDim?.score}/100.
              {" "}A {weakestDim?.label} gap at this IRS ({irs}) is the primary reason you haven't crossed{" "}
              <strong style={{ color: C.cyan400 }}>{nextTier?.label || "the next tier"}</strong> yet.
            </p>
          </div>
          <button style={{ flexShrink: 0, border: "none", borderRadius: 12, padding: "11px 16px", background: "#fff", color: C.blue700, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }} onClick={() => navigate("/interview")}>
            Build This Skill →
          </button>
        </section>

      </div>
    </div>
  );
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`,
    padding: "36px 28px 80px",
    fontFamily: F.body,
  },
  container: { maxWidth: 1220, margin: "0 auto" },
  center: { minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  spinner: { width: 44, height: 44, borderRadius: "50%", border: `4px solid ${C.blue50}`, borderTopColor: C.blue500, animation: "spin 0.75s linear infinite" },

  eyebrow: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "1.6px", color: C.blue500, marginBottom: 6 },
  pageTitle: { margin: 0, fontFamily: F.display, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.8px", color: C.text },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, boxShadow: C.shadow },
  cardH2:  { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text },
  cardSub: { margin: "6px 0 0", color: C.sub, fontSize: 12, lineHeight: 1.6 },

  btnPrimary: { border: "none", borderRadius: 12, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px rgba(26,110,255,0.28)`, fontFamily: F.body },
  btnSecondary: { width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.borderMd}`, background: C.blue50, color: C.blue600, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body },
  btnBlue: { display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 12, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "12px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px rgba(26,110,255,0.3)`, fontFamily: F.body },

  emptyCard: { maxWidth: 620, margin: "80px auto", padding: "56px 28px", textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, boxShadow: C.shadowMd },
  emptyTitle: { margin: "10px 0 0", fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text },
  emptyText: { maxWidth: 480, margin: "10px auto 22px", color: C.sub, lineHeight: 1.7, fontSize: 13.5 },
};

export default Analytics;
import PropTypes from 'prop-types';
import { useEffect, useMemo, useState, useRef} from "react";
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
import WarRoomSection from "../components/WarRoom";
import BookLoader from "../components/BookLoader";
import {
  getAIFreeform,
  getDashboardAnalytics,
  getLastSessionBreakdown,
  getBlindSpots,
  getSessionWarmup,
} from '../Services/interviewService';
import { C as CT, F } from '../styles/token';

// — Extracted sub-components
import LivingAura     from '../components/analytics/LivingAura';
import DNAFingerprint from '../components/analytics/DNAFingerprint';
import IRSBreakdown   from '../components/analytics/IRSBreakdown';
import StreakCalendar from '../components/analytics/StreakCalendar';
import TopicIntelligenceGrid from '../components/analytics/TopicIntelligenceGrid';

// — Analytics Palette
const C = {
  ...CT,
  violet:      CT.blue500,
  violetLight: CT.blue300,
  violetTint:  CT.blue50,
  violetMid:   CT.blue600,
  violetDeep:  CT.blue700,
  dimColors: {
    technical:      CT.blue500,
    problemSolving: CT.blue500,
    communication:  CT.green,
    behavioral:     CT.amber,
    design:         CT.cyan600,
    fundamentals:   CT.red,
  },
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
  { id: "service",     label: "Service (TCS / Infosys / Wipro)",            icon: "🏢", scores: { technical: 55, problemSolving: 50, communication: 65, behavioral: 60, design: 25, fundamentals: 55 } },
  { id: "product_mid", label: "Mid Product (Flipkart / Swiggy / PhonePe)",  icon: "🚀", scores: { technical: 72, problemSolving: 70, communication: 60, behavioral: 55, design: 55, fundamentals: 65 } },
  { id: "faang",       label: "FAANG-adjacent (Google / Amazon / Microsoft)",icon: "🏆", scores: { technical: 85, problemSolving: 88, communication: 65, behavioral: 62, design: 75, fundamentals: 78 } },
  { id: "startup",     label: "Early-Stage Startup",                         icon: "⚡", scores: { technical: 68, problemSolving: 65, communication: 72, behavioral: 65, design: 45, fundamentals: 58 } },
];

// — Math Helpers
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
  const num   = values.reduce((a, v, i) => a + (i - xMean) * (v - yMean), 0);
  const den   = values.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
  return den ? num / den : 0;
};
const deriveArchetype = (scoreTrend, avgTimePerQ) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1];
  const sd    = stdDev(scores);
  const slope = trendSlope(scores);
  if (sd > 18) return ARCHETYPES[0];
  if (slope > 2) return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};
const topicROI = (topic, dimensionProfile) => {
  const dim   = dimensionProfile.find(d =>
    (d.contributingTopics || []).some(topicName => topicName.toLowerCase() === topic.toLowerCase())
  );
  const w     = dim?.weight ?? 0.1;
  const score = dim ? (dimensionProfile.find(d => d.key === dim.key)?.score ?? 0) : 0;
  return w * (100 - score);
};
const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;
const lerp = (a, b, t) => a + (b - a) * t;

// — AnimatedRing
const AnimatedRing = ({ score, size = 160, strokeWidth = 14 }) => {
  const [displayed, setDisplayed] = useState(0);
  const r    = size / 2 - strokeWidth;
  const circ = 2 * Math.PI * r;
  const offset = circ - (displayed / 100) * circ;
  const color  = scoreColor(score);

  useEffect(() => {
    let start = null;
    let rafId;
    const duration = 1400;
    const animate  = (ts) => {
      if (!start) start = ts;
      const p    = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(lerp(0, score, ease)));
      if (p < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
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
AnimatedRing.propTypes = {
  score:       PropTypes.number.isRequired,
  size:        PropTypes.number,
  strokeWidth: PropTypes.number,
};



// — SessionOrderCard
const SessionOrderCard = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try { setData(await getSessionWarmup()); }
      catch { /* silently fail */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading || !data?.available) return null;

  const { positions, pattern } = data;
  const patternConfig = {
    warmup:     { label: "Warm-Up Performer",    icon: "🔥", color: C.orange,  desc: "You score higher in your 2nd+ session. Let your brain warm up before high-stakes practice." },
    coldstart:  { label: "Cold Start Performer", icon: "⚡", color: C.blue500, desc: "You score highest in your 1st session. Use mornings for the hardest topics." },
    consistent: { label: "Consistent Performer", icon: "⚖️", color: C.green,  desc: "Session order doesn't affect your performance. You're mentally well-calibrated." },
  };
  const cfg      = patternConfig[pattern] || patternConfig.consistent;
  const maxScore = Math.max(...positions.map(p => p.avgScore));

  return (
    <div style={{ ...S.card, marginBottom: 18 }}>
      <div style={{ ...S.eyebrow, color: C.violet }}>COLD START vs WARM UP</div>
      <h2 style={S.cardH2}>Does session order affect your score?</h2>
      <p style={{ ...S.cardSub, marginBottom: 14 }}>Based on your multi-session days.</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14,
        background: `${cfg.color}10`, border: `1.5px solid ${cfg.color}35`, marginBottom: 16 }}>
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
                <div style={{ height: "100%", width: `${p.avgScore}%`,
                  background: isMax ? cfg.color : C.blue200, borderRadius: 999, transition: "width 1s ease" }} />
              </div>
              <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800,
                color: isMax ? cfg.color : C.muted, width: 34, textAlign: "right", flexShrink: 0 }}>{p.avgScore}</div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, width: 48, flexShrink: 0 }}>
                {p.count} session{p.count !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// — SkillVelocityGraph
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
        date: s.date
          ? new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
          : `S${i + 1}`,
      };
      const ts = s.topicScores || {};
      Object.keys(VELOCITY_LABELS).forEach(key => { row[key] = ts[key] ?? null; });
      return row;
    });
  }, [scoreTrend]);

  const dimsWithData = useMemo(
    () => Object.keys(VELOCITY_LABELS).filter(key => chartData.filter(r => r[key] !== null).length >= 2),
    [chartData]
  );

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
          const color  = VELOCITY_COLORS[key];
          return (
            <button key={key} onClick={() => toggleDim(key)}
              className={`an-tab${active ? " an-tab-active" : ""}`}
              aria-pressed={active}
              aria-label={`${VELOCITY_LABELS[key]}, ${active ? "shown" : "hidden"}`}
              style={{ border: `1.5px solid ${active ? color : C.border}`, borderRadius: 999, padding: "5px 13px",
                background: active ? `${color}15` : C.cardAlt, color: active ? color : C.muted,
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F.body }}>
              {VELOCITY_LABELS[key]}
            </button>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
          <XAxis dataKey="date" axisLine={false} tickLine={false}
            tick={{ fill: C.muted, fontSize: 9, fontFamily: F.mono }} />
          <YAxis domain={[0, 100]} axisLine={false} tickLine={false}
            tick={{ fill: C.muted, fontSize: 9, fontFamily: F.mono }} />
          <Tooltip
            formatter={(v, name) => [v !== null ? `${v}/100` : "—", VELOCITY_LABELS[name] || name]}
            contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: F.body, fontSize: 11 }}
            labelStyle={{ color: C.sub, fontSize: 10 }} />
          {dimsWithData.filter(k => activeDims.has(k)).map(key => (
            <Line key={key} type="monotone" dataKey={key}
              stroke={VELOCITY_COLORS[key]} strokeWidth={2}
              dot={{ r: 3, fill: VELOCITY_COLORS[key], strokeWidth: 0 }}
              activeDot={{ r: 5 }} connectNulls={false}
              animationDuration={500} animationEasing="ease-out" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
SkillVelocityGraph.propTypes = {
  scoreTrend: PropTypes.arrayOf(PropTypes.shape({
    date:        PropTypes.string,
    topicScores: PropTypes.object,
  })),
};

// — BlindSpotAlertCard
const BlindSpotAlertCard = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try { setData(await getBlindSpots()); }
      catch { /* silently fail */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ ...S.card, borderLeft: `3px solid ${C.border}`, marginBottom: 18 }}>
      <div className="an-skel" style={{ width: 220, height: 10, marginBottom: 10 }} />
      <div className="an-skel" style={{ width: "70%", height: 16, marginBottom: 8 }} />
      <div className="an-skel" style={{ width: "50%", height: 12, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {[0, 1, 2].map(i => <div key={i} className="an-skel" style={{ height: 52 }} />)}
      </div>
    </div>
  );
  if (!data || !data.blindSpots?.length) return null;

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
            <div key={spot.topic} style={{ padding: "12px 14px", borderRadius: 12, background: cfg.bg,
              border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, fontFamily: F.mono, flexShrink: 0 }}>{i + 1}</div>
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

// — SessionQualityCard
const SessionQualityCard = () => {
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try { setBreakdown(await getLastSessionBreakdown()); }
      catch { setError(true); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div style={S.card} className="an-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ ...S.eyebrow, color: C.violet }}>LAST SESSION QUALITY</div>
          <div className="an-skel" style={{ width: "60%", height: 17, marginBottom: 8 }} />
          <div className="an-skel" style={{ width: "40%", height: 12 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="an-skel" style={{ width: 72, height: 52, borderRadius: 10 }} />)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="an-skel" style={{ height: 8 }} />)}
      </div>
    </div>
  );
  if (error || !breakdown) return null;

  const { questions = [], sessionScore, avgTimeTaken, skipRate, sessionMode, sessionDate, totalQuestions } = breakdown;
  const answered = questions.filter(q => !q.skipped);
  const fast     = answered.filter(q => q.timeTaken < 25).length;
  const slow     = answered.filter(q => q.timeTaken > 55).length;
  const perfect  = answered.filter(q => q.score >= 90).length;
  const struggle = answered.filter(q => q.score < 50).length;
  const timeLabel = avgTimeTaken < 25 ? "Fast paced ⚡" : avgTimeTaken > 55 ? "Methodical 🧠" : "Balanced ⚖️";
  const date      = sessionDate ? new Date(sessionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

  const summaryStats = [
    { label: "Avg time",        value: `${avgTimeTaken}s`, sub: timeLabel,                                                     color: C.blue600 },
    { label: "Skip rate",       value: `${skipRate}%`,     sub: skipRate > 30 ? "High — review skips" : "Good coverage",       color: skipRate > 30 ? C.orange : C.green },
    { label: "Perfect (90+)",   value: perfect,            sub: `of ${answered.length} answered`,                              color: C.green },
    { label: "Struggled (<50)", value: struggle,           sub: `of ${answered.length} answered`,                              color: struggle > 2 ? C.red : C.muted },
  ];

  return (
    <div style={S.card} className="an-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ ...S.eyebrow, color: C.violet }}>LAST SESSION QUALITY</div>
          <h2 style={S.cardH2}>Per-question breakdown · {date}</h2>
          <p style={{ ...S.cardSub, marginBottom: 12 }}>{totalQuestions} questions · {sessionMode} mode · session score {sessionScore}/100</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {summaryStats.map(({ label, value, sub, color }) => (
            <div key={label} className="an-milestone" style={{ padding: "9px 12px", borderRadius: 10,
              background: C.cardAlt, border: `1px solid ${C.border}`, textAlign: "center", minWidth: 72 }}>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, marginTop: 3 }}>{label.toUpperCase()}</div>
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
                <div style={{ height: "100%", width: q.skipped ? "100%" : `${q.score}%`,
                  background: q.skipped ? C.border : barColor, borderRadius: 999, opacity: q.skipped ? 0.4 : 1 }} />
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: barColor, width: 26, textAlign: "right", flexShrink: 0 }}>
                {q.skipped ? "skip" : q.score}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, width: 30, textAlign: "right", flexShrink: 0 }}>
                {q.skipped ? "" : `${q.timeTaken}s`}
              </div>
              <div style={{ fontSize: 9, color: C.muted, width: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
                {q.topic}
              </div>
            </div>
          );
        })}
      </div>

      {answered.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10,
          background: C.violetTint, border: `1px solid ${C.violet}20`, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: C.sub }}><strong style={{ color: C.blue600 }}>{fast}</strong> fast (&lt;25s)</div>
          <div style={{ fontSize: 11, color: C.sub }}><strong style={{ color: C.violet }}>{answered.length - fast - slow}</strong> normal</div>
          <div style={{ fontSize: 11, color: C.sub }}><strong style={{ color: C.amber }}>{slow}</strong> slow (&gt;55s)</div>
        </div>
      )}
    </div>
  );
};

// — DimensionDrillPanel
const DimensionDrillPanel = ({ dim, onClose, navigate }) => {
  if (!dim) return null;
  const topics = dim.contributingTopics || [];
  const score  = dim.score || 0;
  const col    = C.dimColors[dim.key] || scoreColor(score);

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(380px, 95vw)",
      background: C.card, borderLeft: `2px solid ${C.borderMd}`,
      boxShadow: C.shadowLg, zIndex: 9999, display: "flex", flexDirection: "column",
      animation: "slideInRight 0.25s cubic-bezier(.16,1,.3,1)", overflowY: "auto" }}>
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
        <button onClick={onClose} aria-label="Close panel"
          style={{ background: `${col}10`, border: `1px solid ${col}30`, borderRadius: 10,
            padding: "6px 12px", cursor: "pointer", fontSize: 13, color: C.sub, fontFamily: F.body, flexShrink: 0 }}>✕</button>
      </div>

      <div style={{ margin: "16px 20px", padding: "14px 16px", background: `${col}10`,
        border: `1.5px solid ${col}40`, borderRadius: 14, display: "flex", alignItems: "center", gap: 16 }}>
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
          {topics.length === 0
            ? <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>No topic data mapped yet.</div>
            : topics.map((topic, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 10, background: `${col}08`, border: `1px solid ${col}25` }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{topic}</div>
                <div style={{ fontSize: 10, color: col, fontFamily: F.mono }}>→ {dim.label}</div>
              </div>
            ))
          }
        </div>
      </div>

      {dim.answeredCount != null && (
        <div style={{ margin: "0 20px 16px", padding: "12px 14px", background: `${col}08`,
          border: `1px solid ${col}25`, borderRadius: 12, fontSize: 11.5, color: C.sub, lineHeight: 1.6 }}>
          <strong style={{ color: col }}>Evidence:</strong> {dim.answeredCount} answered questions in this dimension.
          {dim.isProvisional && <span style={{ color: C.amber }}> Score is provisional — keep practicing to stabilize.</span>}
        </div>
      )}

      <div style={{ padding: "0 20px 24px", marginTop: "auto" }}>
        <button style={{ ...S.btnPrimary, width: "100%", textAlign: "center", display: "block",
          background: `linear-gradient(135deg, ${col}, ${col}CC)` }}
          onClick={() => { onClose(); navigate("/interview"); }}>
          ⚡ Drill {dim.label} now →
        </button>
      </div>
    </div>
  );
};
DimensionDrillPanel.propTypes = {
  dim: PropTypes.shape({
    key:                PropTypes.string,
    label:              PropTypes.string,
    icon:               PropTypes.string,
    score:              PropTypes.number,
    weight:             PropTypes.number,
    tip:                PropTypes.string,
    contributingTopics: PropTypes.arrayOf(PropTypes.string),
    answeredCount:      PropTypes.number,
    isProvisional:      PropTypes.bool,
  }),
  onClose:  PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
};

// — MetricCard
const MetricCard = ({ icon, label, value, sub, color, accentColor }) => (
  <div className="an-stat-card" style={{ display: "flex", alignItems: "center", gap: 14,
    padding: "20px 18px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
    boxShadow: "0 2px 16px rgba(26,110,255,0.06)", borderTop: `3px solid ${accentColor || color}` }}>
    <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0,
      background: `${accentColor || color}15`, border: `1px solid ${accentColor || color}30`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, color: C.muted,
        letterSpacing: "0.9px", marginBottom: 5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, fontWeight: 500, color: C.sub, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  </div>
);
MetricCard.propTypes = {
  icon:        PropTypes.string.isRequired,
  label:       PropTypes.string.isRequired,
  value:       PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  sub:         PropTypes.string,
  color:       PropTypes.string.isRequired,
  accentColor: PropTypes.string,
};

// — MomentumBadge
const getMomentum = (scoreTrend, topic) => {
  if (!scoreTrend || scoreTrend.length < 3) return "stable";
  const relevant = scoreTrend
    .filter(s => (s.topics || []).some(t => t.toLowerCase() === topic.toLowerCase()))
    .slice(-4).map(s => s.score || 0);
  if (relevant.length < 2) return "stable";
  const delta = relevant[relevant.length - 1] - relevant[0];
  if (delta > 8)  return "rising";
  if (delta < -8) return "falling";
  return "stable";
};

const MomentumBadge = ({ momentum }) => {
  const cfg = {
    rising:  { icon: "↑", color: C.green,  bg: C.greenTint,  label: "Rising" },
    falling: { icon: "↓", color: C.red,    bg: C.redTint,    label: "Falling" },
    stable:  { icon: "→", color: C.violet, bg: C.violetTint, label: "Stable" },
  }[momentum] || { icon: "→", color: C.muted, bg: C.border, label: "—" };
  return (
    <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 800,
      color: cfg.color, background: cfg.bg, whiteSpace: "nowrap", fontFamily: F.mono }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};
MomentumBadge.propTypes = { momentum: PropTypes.string.isRequired };

// — AnimatedSection
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
    const timer = setTimeout(() => observer.observe(el), delay);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [delay]);

  return (
    <div ref={ref} style={{
      opacity:   visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(22px)",
      transition: `opacity 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  );
};
AnimatedSection.propTypes = {
  children: PropTypes.node.isRequired,
  delay:    PropTypes.number,
  style:    PropTypes.object,
};

// — Analytics (main page component)
const Analytics = () => {
  const navigate = useNavigate();
  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [mounted, setMounted]             = useState(false);
  const [drillDim, setDrillDim]           = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getDashboardAnalytics();
        setData(result);
      } catch {
        setError("Unable to load your performance data.");
      } finally {
        setLoading(false);
        requestAnimationFrame(() => setTimeout(() => setMounted(true), 50));
      }
    };
    load();
  }, []);

  const topicPerformance = useMemo(() => data?.topicPerformance ?? [], [data]);
  const scoreTrend       = useMemo(() => data?.scoreTrend ?? [], [data]);
  const averageScore     = data?.averageScore ?? 0;
  const totalSessions    = data?.totalSessions ?? 0;
  const avgTimePerQ      = data?.timePerformance?.averageTimePerQuestion ?? null;
  const highestScore     = data?.highestScore ?? data?.bestScore ?? Math.max(0, ...scoreTrend.map(s => s.score || 0));

  const irs          = data?.irs ?? 0;
  const tierLabel    = data?.currentTier ?? "₹3–6 LPA";
  const tierMeta     = TIER_META[tierLabel] ?? TIER_META["₹3–6 LPA"];
  const activeTier   = { label: tierLabel, ...tierMeta };

  const apiTiers     = data?.tiers ?? [];
  const nextTierApi  = apiTiers.find(t => !t.isUnlocked && t.label !== tierLabel) ?? null;
  const nextTier     = nextTierApi
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

  const irsMaturity             = irsBreakdown?.maturity ?? null;
  const irsRawComposite         = irsBreakdown?.rawComposite ?? null;
  const tierIsGated             = data?.currentTierIsGated ?? false;
  const tierRawLabel            = data?.currentTierRaw ?? tierLabel;
  const sessionsNeededForRaw    = data?.sessionsNeededForRawTier ?? 0;

  const strongestDim = useMemo(() => [...dimensionProfile].filter(d => d.hasData).sort((a, b) => b.score - a.score)[0], [dimensionProfile]);
  const weakestDim   = useMemo(() => [...dimensionProfile].filter(d => d.hasData).sort((a, b) => a.score - b.score)[0], [dimensionProfile]);
  const archetype    = useMemo(() => deriveArchetype(scoreTrend, avgTimePerQ), [scoreTrend, avgTimePerQ]);

  const topicROIRanking = useMemo(() =>
    [...topicPerformance].map(t => ({ ...t, roi: topicROI(t.topic, dimensionProfile) })).sort((a, b) => b.roi - a.roi),
    [topicPerformance, dimensionProfile]
  );

  const chartData = useMemo(() =>
    scoreTrend.map((item, i) => ({ interview: `#${i + 1}`, score: item.score || 0, avg: averageScore })),
    [scoreTrend, averageScore]
  );

  const latestScore = chartData.at(-1)?.score ?? 0;
  const prevScore   = chartData.at(-2)?.score ?? latestScore;
  const delta       = latestScore - prevScore;
  const slope       = trendSlope(scoreTrend.map(s => s.score || 0));
  const sd          = stdDev(scoreTrend.map(s => s.score || 0));

  const irsStatItems = [
    { label: "SCORE STD-DEV",       val: sd.toFixed(1),                                              color: C.text },
    { label: "TREND SLOPE",         val: `${slope >= 0 ? "+" : ""}${slope.toFixed(2)} pts/session`,  color: slope >= 0 ? C.green : C.orange },
    { label: "TOPICS COVERED",      val: `${topicPerformance.length}/8+`,                            color: C.text },
    { label: "SESSIONS",            val: totalSessions,                                              color: C.text },
    { label: "EVIDENCE CONFIDENCE", val: irsMaturity != null ? `${Math.round(irsMaturity * 100)}%` : "—", color: C.text },
  ];

  if (loading) return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#F0F4FF', gap: 16 }}>
      <BookLoader />
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: '1.2px' }}>
        COMPUTING YOUR IRS...
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
        <p style={{ fontSize: 11.5, color: C.amber, fontFamily: F.mono, marginBottom: 22 }}>
          ⚡ Takes less than 10 minutes — your peers already have a head start.
        </p>
        <button style={S.btnPrimary} className="an-btn-primary" onClick={() => navigate("/interview")}>Start First Interview →</button>
      </div>
    </div>
  );

  const statCards = [
    { icon: "🎤", label: "SESSIONS",    value: totalSessions,         sub: `${topicPerformance.length} topics covered`,                                         color: C.violet,              accentColor: C.violet },
    { icon: "📈", label: "AVG SCORE",   value: `${averageScore}/100`, sub: delta >= 0 ? `↑ ${delta} pts vs last` : `↓ ${Math.abs(delta)} pts vs last`,          color: scoreColor(averageScore), accentColor: scoreColor(averageScore) },
    { icon: "🏆", label: "BEST SCORE",  value: `${highestScore}/100`, sub: "Your performance ceiling",                                                          color: C.amber,               accentColor: C.amber },
    { icon: "⏱",  label: "AVG TIME/Q",  value: `${avgTimePerQ ?? "—"}s`, sub: avgTimePerQ ? (avgTimePerQ < 30 ? "Fast paced" : avgTimePerQ > 55 ? "Methodical" : "Balanced") : "No data", color: C.blue600, accentColor: C.blue500 },
  ];

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes livePulse   { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
        @keyframes anShimmer   { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        @keyframes anFadeIn    { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }

        .an-skel {
          background: linear-gradient(90deg, ${C.border} 25%, #EEF3FF 37%, ${C.border} 63%);
          background-size: 400px 100%;
          animation: anShimmer 1.4s ease infinite;
          border-radius: 8px;
        }
        .an-fade-in { animation: anFadeIn 0.5s cubic-bezier(.16,1,.3,1) both; }

        *, *::before, *::after { box-sizing: border-box; }
        ::selection { background: rgba(59,130,246,0.15); color: ${C.text}; }

        .an-page button:focus-visible, .an-page a:focus-visible {
          outline: 2px solid ${C.violet}; outline-offset: 3px; border-radius: 6px;
        }
        .an-page ::-webkit-scrollbar { width: 5px; height: 5px; }
        .an-page ::-webkit-scrollbar-track { background: transparent; }
        .an-page ::-webkit-scrollbar-thumb { background: ${C.borderMd}; border-radius: 4px; }

        .an-card { transition: box-shadow 0.22s ease, transform 0.22s cubic-bezier(.16,1,.3,1), border-color 0.22s ease !important; }
        .an-card:hover { box-shadow: 0 10px 36px rgba(26,110,255,0.1) !important; transform: translateY(-2px) !important; border-color: ${C.borderMd} !important; }

        .an-stat-card { transition: box-shadow 0.22s ease, transform 0.22s cubic-bezier(.16,1,.3,1), border-color 0.22s ease !important; position: relative; overflow: hidden; }
        .an-stat-card:hover { box-shadow: 0 8px 32px rgba(26,110,255,0.13) !important; transform: translateY(-3px) !important; }

        .an-milestone { transition: transform 0.18s cubic-bezier(.16,1,.3,1), box-shadow 0.18s ease !important; }
        .an-milestone:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(26,110,255,0.1) !important; }

        .an-tier-card { transition: box-shadow 0.2s ease, transform 0.2s cubic-bezier(.16,1,.3,1), border-color 0.2s ease !important; }
        .an-tier-card:hover { box-shadow: 0 6px 24px rgba(59,130,246,0.10) !important; transform: translateY(-2px) !important; }
        .an-tier-card-active:hover { box-shadow: 0 8px 28px rgba(26,110,255,0.22) !important; }

        .an-dim-row { transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease !important; cursor: default; }
        .an-dim-row:hover { background: ${C.violetTint} !important; border-color: ${C.borderMd} !important; transform: translateX(3px) !important; }

        .an-roi-row { transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease !important; }
        .an-roi-row:hover { background: ${C.violetTint} !important; border-color: ${C.borderMd} !important; box-shadow: 0 2px 12px rgba(26,110,255,0.07) !important; }

        .an-btn-primary { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
        .an-btn-primary:hover { box-shadow: 0 10px 28px rgba(59,130,246,0.35) !important; transform: translateY(-2px) !important; }

        .an-btn-secondary { transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease !important; }
        .an-btn-secondary:hover { background: ${C.violetTint} !important; border-color: ${C.violet}50 !important; transform: translateY(-1px) !important; }

        .an-btn-blue { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
        .an-btn-blue:hover { box-shadow: 0 8px 24px rgba(26,110,255,0.4) !important; transform: translateY(-2px) !important; }
        .an-btn-blue:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

        .an-tab { transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease !important; }
        .an-tab:hover:not(.an-tab-active) { color: ${C.violet} !important; background: ${C.violetTint} !important; }

        .an-bar-fill { transition: width 1.1s cubic-bezier(.16,1,.3,1) !important; }

        .an-irs-ring { transition: box-shadow 0.3s ease !important; }
        .an-irs-ring:hover { box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 16px 48px rgba(0,68,196,0.24) !important; }

        .an-ai-generate-btn { transition: box-shadow 0.2s ease, transform 0.2s cubic-bezier(.16,1,.3,1) !important; }
        .an-ai-generate-btn:hover:not(:disabled) { box-shadow: 0 10px 30px rgba(59,130,246,0.40) !important; transform: translateY(-2px) !important; }

        .recharts-tooltip-wrapper { transition: transform 0.12s ease !important; }

        @media (prefers-reduced-motion: reduce) {
          .an-page * { animation: none !important; transition-duration: 0.01ms !important; }
          .an-fade-in { opacity: 1 !important; transform: none !important; }
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
          .an-tiers { grid-template-columns: 1fr !important; }
          .an-dims  { grid-template-columns: 1fr !important; }
          .an-milestone-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={S.container} className="an-page">

        {/* PAGE HEADER */}
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

        {/* HERO: LIVING AURA + IRS RING */}
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
                    aria-pressed={active}
                    style={{ border: `1.5px solid ${active ? C.violet : C.border}`, borderRadius: 999, padding: "3px 10px",
                      background: active ? `${C.violet}15` : C.cardAlt, color: active ? C.violet : C.muted,
                      fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: F.body, transition: "all 0.15s" }}>
                    {cp.icon} {cp.label.split(" (")[0]}
                  </button>
                );
              })}
            </div>
            <LivingAura
              data={dimensionProfile}
              irs={irs}
              scoreTrend={scoreTrend}
              onDrillDimension={(dim) => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => setDrillDim(dim), 200);
              }}
              companyOverlay={selectedCompany}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="an-card an-irs-ring" style={{ ...S.card, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ ...S.eyebrow, color: C.violet }}>INTERVIEW READINESS SCORE</div>
              <p style={{ margin: "4px 0 14px", color: C.sub, fontSize: 11, fontFamily: F.mono, letterSpacing: "0.3px" }}>4-component weighted composite</p>
              <AnimatedRing score={irs} size={150} strokeWidth={13} />
              <div style={{ marginTop: 12, width: "100%", padding: "11px 14px", borderRadius: 13,
                background: `${activeTier.color}15`, border: `1px solid ${activeTier.color}40`,
                display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: activeTier.color, fontFamily: F.display }}>{activeTier.label} eligible</div>
                  {nextTierApi?.desc && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>{nextTierApi.desc}</div>}
                </div>
              </div>
              {nextTier && (
                <div style={{ marginTop: 9, fontSize: 11, color: C.sub, fontFamily: F.mono }}>
                  {nextTier.minScore - irs} pts → <strong style={{ color: nextTier.color }}>{nextTier.label}</strong>
                </div>
              )}
            </div>

            <div className="an-card" style={{ ...S.card, flex: 1, borderTop: `3px solid ${C.violet}` }}>
              <div style={{ ...S.eyebrow, color: C.violet }}>INTERVIEW ARCHETYPE</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, fontSize: 22,
                  background: C.violetTint, border: `1px solid ${C.violet}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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

        {/* IRS BREAKDOWN — extracted component */}
        <IRSBreakdown
          irs={irs}
          irsComponents={irsComponents}
          irsMaturity={irsMaturity}
          irsRawComposite={irsRawComposite}
          totalAnsweredQuestions={data?.totalAnsweredQuestions ?? 0}
          tierIsGated={tierIsGated}
          tierRawLabel={tierRawLabel}
          sessionsNeededForRaw={sessionsNeededForRaw}
          irsStatItems={irsStatItems}
        />

        {/* SESSION QUALITY */}
        <div style={{ marginBottom: 18 }}><SessionQualityCard /></div>

        {/* STAT CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }} className="an-stats">
          {statCards.map((card, i) => (
            <div key={card.label} className="an-fade-in" style={{ animationDelay: `${i * 70}ms` }}>
              <MetricCard {...card} />
            </div>
          ))}
        </div>

        {/* TIER READINESS */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={{ ...S.eyebrow, color: C.violet }}>PACKAGE TIER READINESS</div>
          <h2 style={S.cardH2}>Where you stand in the placement food chain</h2>
          <p style={{ ...S.cardSub, marginBottom: 20 }}>IRS thresholds map directly to real Indian placement market data.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="an-tiers">
            {apiTiers.map(tier => {
              const meta      = TIER_META[tier.label] ?? { color: C.violet, bg: C.violetTint, gradient: C.violetTint };
              const reached   = tier.isUnlocked;
              const isCurrent = tier.label === tierLabel;
              const pct       = Math.min(100, tier.minIRS === 0 ? 100 : (irs / tier.minIRS) * 100);
              return (
                <div key={tier.label} className={`an-tier-card${isCurrent ? " an-tier-card-active" : ""}`}
                  style={{ padding: "18px 16px", borderRadius: 18, position: "relative",
                    border: `2px solid ${isCurrent ? meta.color : C.border}`,
                    background: isCurrent ? meta.gradient : C.cardAlt }}>
                  {isCurrent && (
                    <div style={{ position: "absolute", top: 9, right: 9, fontSize: 9, fontWeight: 800,
                      padding: "2px 7px", borderRadius: 999, background: meta.color, color: "#fff",
                      fontFamily: F.mono, letterSpacing: "0.5px" }}>CURRENT</div>
                  )}
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: reached ? meta.color : C.muted, fontFamily: F.display, marginBottom: 4 }}>{tier.label}</div>
                  <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.45, marginBottom: 10 }}>{tier.desc}</div>
                  <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, background: reached ? meta.color : C.muted,
                      width: `${mounted ? pct : 0}%`, transition: "width 1.1s cubic-bezier(.16,1,.3,1)" }} />
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 5 }}>
                    {tier.minIRS === 0 ? "✓ Always eligible" : reached ? `✓ Unlocked at IRS ${tier.minIRS}` : `Need ${tier.minIRS - irs} more IRS pts`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* DNA FINGERPRINT + STREAK CALENDAR */}
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
                  <span key={d.key} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                    background: d.hasData ? `${col}18` : C.border, color: d.hasData ? col : C.faint }}>
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
            <div className="an-milestone-grid" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { label: "Total",        val: totalSessions,                                        color: C.violet, icon: "🎤", bg: C.violetTint },
                { label: "Strong (80+)", val: scoreTrend.filter(s => (s.score || 0) >= 80).length,  color: C.green,  icon: "🏅", bg: C.greenTint },
                { label: "Last delta",   val: `${delta >= 0 ? "+" : ""}${delta}`,                  color: delta >= 0 ? C.green : C.orange, icon: delta >= 0 ? "↑" : "↓", bg: delta >= 0 ? C.greenTint : C.orangeTint },
              ].map(({ label, val, color, icon, bg }) => (
                <div key={label} className="an-milestone" style={{ textAlign: "center", padding: "12px 10px",
                  background: bg, borderRadius: 12, border: `1.5px solid ${color}30`, borderTop: `2.5px solid ${color}` }}>
                  <div style={{ fontSize: 13, marginBottom: 3 }}>{icon}</div>
                  <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, marginTop: 4, letterSpacing: "0.4px" }}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PERFORMANCE TRAJECTORY + TOPIC MOMENTUM */}
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
                  <XAxis dataKey="interview" axisLine={false} tickLine={false}
                    tick={{ fill: C.muted, fontSize: 10, fontFamily: F.mono }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false}
                    tick={{ fill: C.muted, fontSize: 10, fontFamily: F.mono }} />
                  <Tooltip formatter={(v, name) => [`${v}/100`, name === "score" ? "Score" : "Avg"]}
                    contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: F.body, fontSize: 12 }} />
                  <ReferenceLine y={averageScore} stroke={C.borderMd} strokeDasharray="4 4"
                    label={{ value: `avg ${averageScore}`, position: "right", fontSize: 9, fill: C.muted, fontFamily: F.mono }} />
                  <Area type="monotone" dataKey="score" stroke={C.violet} strokeWidth={2.5} fill="url(#scoreGrad)"
                    dot={{ r: 4.5, fill: C.violet, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 7, fill: C.violetLight }}
                    animationDuration={600} animationEasing="ease-out" />
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
                const score    = t.averageScore || 0;
                const col      = C.dimColors[
                  dimensionProfile.find(d => (d.contributingTopics || []).some(topicName => topicName.toLowerCase() === t.topic.toLowerCase()))?.key
                ] || scoreColor(score);
                return (
                  <div key={t.topic} className="an-roi-row" style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 11, background: C.cardAlt, border: `1px solid ${C.border}` }}>
                    <div style={{ width: 92, fontSize: 11.5, fontWeight: 700, color: C.text, flexShrink: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</div>
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

        {/* SKILL VELOCITY */}
        <SkillVelocityGraph scoreTrend={scoreTrend} />

        {/* TOPIC INTELLIGENCE GRID */}
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

        {/* BLIND SPOT ALERTS */}
        <BlindSpotAlertCard />

        {/* SIX DIMENSIONS GRID */}
        <section style={{ ...S.card, marginBottom: 18 }}>
          <div style={{ ...S.eyebrow, color: C.violet }}>PREPARATION PROFILE</div>
          <h2 style={S.cardH2}>Your six interview dimensions</h2>
          <p style={{ ...S.cardSub, marginBottom: 18 }}>Each bar is weighted in the IRS formula. Hover a card to see which topics map here.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="an-dims">
            {dimensionProfile.map(dim => {
              const col = dim.hasData ? (C.dimColors[dim.key] || scoreColor(dim.score)) : C.faint;
              return (
                <div key={dim.key} title={dim.tip} className="an-dim-row" style={{ padding: "17px 16px", borderRadius: 17,
                  border: `1.5px solid ${dim.hasData ? `${col}40` : C.border}`,
                  background: dim.hasData ? `${col}08` : C.cardAlt,
                  borderTop: dim.hasData ? `3px solid ${col}` : `3px solid ${C.border}` }}>
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
                    <div className="an-bar-fill" style={{ height: "100%", background: col, borderRadius: 999,
                      width: `${mounted && dim.hasData ? dim.score : 0}%` }} />
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

        {/* AI WAR ROOM */}
        <WarRoomSection
          dimensionProfile={dimensionProfile}
          scoreTrend={scoreTrend}
          archetype={archetype}
          totalSessions={totalSessions}
          irs={irs}
          topTier={activeTier}
          weakest={weakestDim}
          strongest={strongestDim}
          getAIFreeform={getAIFreeform}
        />

        {/* COLD START vs WARM UP */}
        <SessionOrderCard />

        {/* SMART FOCUS + IRS CLIMB */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }} className="an-two-col">
          <div style={S.card} className="an-card">
            <div style={{ ...S.eyebrow, color: C.violet }}>SMART FOCUS RECOMMENDER</div>
            <h2 style={S.cardH2}>Where to put your next hour</h2>
            <p style={S.cardSub}>Sorted by ROI — specific action, mode, and estimated sessions to close the gap.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {topicROIRanking.slice(0, 3).map((t, i) => {
                const score      = t.averageScore || 0;
                                const mode       = score < 40 ? "topic" : score < 60 ? "full" : "challenge";
                const modeLabel  = { topic: "Topic Focus", full: "Full Session", challenge: "Challenge Mode" }[mode];
                const modeIcon   = { topic: "📚", full: "🎯", challenge: "⚡" }[mode];
                const action     = score < 40
                  ? `Start with ${t.topic} basics — cover definitions, then worked examples`
                  : score < 60
                  ? `Practice ${t.topic} with immediate answer review after each question`
                  : `Run a timed ${t.topic}-only challenge — aim to hold 75+ every question`;
                const sessionsEst   = Math.ceil((100 - score) / 4);
                const sessionsLabel = sessionsEst <= 8 ? `~${sessionsEst} sessions` : "10+ sessions";
                const rowColor  = i === 0 ? C.red : i === 1 ? C.amber : C.violet;
                const rowBg     = i === 0 ? C.redTint : i === 1 ? C.amberTint : C.violetTint;
                const rowBorder = i === 0 ? "#FECACA" : i === 1 ? "#FDE68A" : `${C.violet}25`;
                return (
                  <div key={t.topic} className="an-roi-row" style={{ display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "13px 15px", borderRadius: 14, background: rowBg, border: `1px solid ${rowBorder}` }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      background: rowColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 900, fontFamily: F.mono }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{t.topic} · {score}/100</div>
                        <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, whiteSpace: "nowrap", marginLeft: 8 }}>est. {sessionsLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{action}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>ROI {t.roi.toFixed(1)}</div>
                        <button onClick={() => navigate("/interview")} className="an-btn-blue"
                          style={{ border: "none", borderRadius: 8, background: rowColor, color: "#fff",
                            padding: "5px 11px", fontSize: 10.5, fontWeight: 800, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 4, fontFamily: F.body }}>
                          {modeIcon} Start {modeLabel} →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: `linear-gradient(135deg, ${C.violetTint} 0%, ${C.blue50} 100%)`,
            border: `1px solid ${C.violet}25`, borderRadius: 20, padding: 22,
            boxShadow: `0 4px 20px rgba(59,130,246,0.08)`, display: "flex", flexDirection: "column" }}>
            <div style={{ ...S.eyebrow, color: C.violet }}>IRS PROGRESS</div>
            <h2 style={S.cardH2}>
              {nextTier
                ? <>{nextTier.minScore - irs} points to <span style={{ color: nextTier.color }}>{nextTier.label}</span></>
                : "You've reached the highest tracked tier."}
            </h2>
            <p style={{ ...S.cardSub, marginBottom: 16 }}>{nextTier ? (nextTier.advice ?? "") : "Maintain your streak to protect this position."}</p>
            {nextTier && nextTier.minScore > 0 && (
              <>
                <div style={{ position: "relative", height: 10, borderRadius: 999, background: C.borderMd, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", borderRadius: 999,
                    width: `${mounted ? Math.min(100, (irs / nextTier.minScore) * 100) : 0}%`,
                    background: `linear-gradient(90deg, ${C.violet}, ${C.blue500})`,
                    transition: "width 1.3s cubic-bezier(.16,1,.3,1)" }} />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginBottom: 20 }}>
                  {irs}/{nextTier.minScore} IRS ({Math.round((irs / nextTier.minScore) * 100)}% there)
                </div>
              </>
            )}
            <div style={{ marginTop: "auto" }}>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.7, marginBottom: 14 }}>
                Closing your <strong style={{ color: C.text }}>{weakestDim?.label}</strong> gap (currently {weakestDim?.score}/100) is the highest-leverage move toward <strong style={{ color: nextTier?.color || C.violet }}>{nextTier?.label || "peak"}</strong>.
              </div>
              <button style={{ ...S.btnPrimary, width: "100%", textAlign: "center" }} onClick={() => navigate("/interview")}>
                Keep climbing →
              </button>
            </div>
          </div>
        </div>

        <AnimatedSection delay={0}>
          {/* COACH BANNER */}
          <section style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 26px",
            borderRadius: 20, marginBottom: 18,
            background: `linear-gradient(135deg, ${C.violetDeep} 0%, ${C.violetMid} 55%, ${C.blue700} 100%)`,
            boxShadow: "0 12px 40px rgba(0,68,196,0.35)" }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>⚔️</div>
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
            <button style={{ flexShrink: 0, border: "none", borderRadius: 12, padding: "11px 16px",
              background: "#fff", color: C.violetMid, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}
              onClick={() => navigate("/interview")}>Build This Skill →</button>
          </section>
        </AnimatedSection>

      </div>

      {/* DIMENSION DRILL PANEL */}
      {drillDim && (
        <>
          <div onClick={() => setDrillDim(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.35)", zIndex: 9998, backdropFilter: "blur(2px)" }} />
          <DimensionDrillPanel dim={drillDim} onClose={() => setDrillDim(null)} navigate={navigate} />
        </>
      )}
    </div>
  );
};

// — Styles
const S = {
  page: {
    minHeight: "calc(100vh - 84px)",
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(26,110,255,0.05) 0%, transparent 42%), radial-gradient(ellipse at 50% 100%, rgba(26,110,255,0.04) 0%, transparent 55%)`,
    padding: "36px 28px 80px",
    fontFamily: F.body,
  },
  container:  { maxWidth: 1220, margin: "0 auto" },
  eyebrow:    { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "1.6px", color: C.violet, marginBottom: 6 },
  pageTitle:  { margin: 0, fontFamily: F.display, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.8px", color: C.text },
  card:       { background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 24, boxShadow: "0 2px 16px rgba(26,110,255,0.05)", marginBottom: 0 },
  cardH2:     { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.2px" },
  cardSub:    { margin: "6px 0 0", color: C.sub, fontSize: 12, lineHeight: 1.65 },
  btnPrimary: { border: "none", borderRadius: 13, background: `linear-gradient(135deg, ${C.violetMid}, ${C.violet})`, color: "#fff", padding: "13px 22px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: `0 6px 22px rgba(26,110,255,0.30)`, fontFamily: F.body, letterSpacing: "-0.1px" },
  emptyCard:  { maxWidth: 620, margin: "80px auto", padding: "56px 28px", textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, boxShadow: "0 8px 40px rgba(26,110,255,0.09)" },
  emptyTitle: { margin: "10px 0 0", fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text },
  emptyText:  { maxWidth: 480, margin: "10px auto 22px", color: C.sub, lineHeight: 1.7, fontSize: 13.5 },
};

export default Analytics;
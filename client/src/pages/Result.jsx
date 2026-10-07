import { useState, useEffect, useMemo, useCallback, useRef, Component } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import { ResultHeroV2 }  from "./ResultHeroV2";
import ScoreCard          from "../components/ScoreCard";
import ScoreSummary       from "../components/result/ScoreSummary";
import FeedbackList       from "../components/result/FeedbackList";
import { ResultNav, BackToTop, Icon, RESULT_NAV_CSS } from "../components/result/ResultNav";
import { C, F }           from "../styles/token";
import { revealStyle, useGradeColorMoment } from "../utils/resultHelpers";
import usePlan from "../hooks/usePlan";
import useUpgrade from "../hooks/useUpgrade";
import ProUnlockBanner from "../components/pro/ProUnlockBanner";

// ─── helpers ──────────────────────────────────────────────────────────────────
const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const fmt = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

const scoreColor = (s) => {
  if (s >= 80) return C.green;
  if (s >= 60) return C.blue500;
  if (s >= 40) return C.amber;
  return C.red;
};

const GRADE = [
  { min: 90, g: "S", desc: "Elite form",     accent: C.violet  },
  { min: 80, g: "A", desc: "Strong",         accent: C.green   },
  { min: 70, g: "B", desc: "Solid form",     accent: C.blue500 },
  { min: 60, g: "C", desc: "Developing",     accent: C.amber   },
  { min:  0, g: "D", desc: "Needs practice", accent: C.red     },
];
const grade = (s) => GRADE.find(g => s >= g.min) || GRADE[GRADE.length - 1];

const parseFeedback = (question) => {
  if (!question) return null;
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  if (objective) {
    const correct = typeof question.userAnswerIndex === "number" && typeof question.correctAnswerIndex === "number"
      ? question.userAnswerIndex === question.correctAnswerIndex
      : question.feedback === "Correct answer." ? true : question.feedback === "Incorrect answer." ? false : null;
    return { score: typeof question.score === "number" ? question.score : correct ? 100 : 0, correct, good: "", missing: "", idealHint: "", tip: "", sampleAnswer: "", aiAvailable: true, fallback: false, isObjective: true };
  }
  if (!question.feedback) return null;
  try {
    const p = typeof question.feedback === "string" ? JSON.parse(question.feedback) : question.feedback;
    if (!p || typeof p !== "object") return null;
    return  {
  score: typeof question.score === "number" ? question.score : Number(question.score || 0),
  correct: question.correct ?? p.correct ?? null,
  good: p.good || "",
  missing: p.missing || "",
  idealHint: p.idealHint || "",
  tip: p.tip || "",
  sampleAnswer: p.sampleAnswer || "",
  aiAvailable: p.aiAvailable !== false,
  fallback: p.fallback === true,
  skippedPending: p.skippedPending === true,
  tier: p.tier || "full",
  locked: p.locked || null,
  isObjective: false,
};
  } catch { return null; }
};

const normalizeQ = (q, i) => {
  const aiFeedback = parseFeedback(q);
  const hasTopicField = typeof q?.topic === "string" && q.topic.trim().length > 0;
  return { ...q, index: i, text: q?.text || q?.question || `Question ${i + 1}`, topic: hasTopicField ? q.topic.trim() : "General", hasTopicField, questionType: q?.questionType || "open", userAnswer: q?.userAnswer || "", skipped: Boolean(q?.skipped), score: clamp(typeof q?.score === "number" ? q.score : Number(q?.score || 0)), aiFeedback };
};

// ─── shared styled primitives ──────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow, marginBottom: 12, ...style }}>{children}</div>
);
Card.propTypes = { children: PropTypes.node.isRequired, style: PropTypes.object };

const Eyebrow = ({ children }) => (
  <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".8px", color: C.blue500, textTransform: "lowercase", marginBottom: 5 }}>{children}</div>
);
Eyebrow.propTypes = { children: PropTypes.node.isRequired };

const CardH2 = ({ children }) => (
  <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-.3px", marginBottom: 4 }}>{children}</div>
);
CardH2.propTypes = { children: PropTypes.node.isRequired };

// ─── animated section (intersection-triggered) ────────────────────────────────
const AnimSec = ({ children, delay = 0, style = {}, id }) => {
  const [vis, setVis] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.06 });
    const t = setTimeout(() => obs.observe(el), delay);
    return () => { clearTimeout(t); obs.disconnect(); };
  }, [delay]);
  return (
    <div ref={ref} id={id} style={{ scrollMarginTop: "calc(var(--res-sticky-top, 84px) + 62px)", opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(18px)", transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .5s cubic-bezier(.16,1,.3,1) ${delay}ms`, ...style }}>
      {children}
    </div>
  );
};
AnimSec.propTypes = { children: PropTypes.node.isRequired, delay: PropTypes.number, style: PropTypes.object, id: PropTypes.string };

// ─── error boundary ───────────────────────────────────────────────────────────
class ErrBound extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error("[Result]", e); }
  render() {
    if (this.state.err) return (
      <div style={{ padding: "14px 18px", borderRadius: 12, marginBottom: 10, background: C.redTint, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", gap: 10 }}>
        <span>⚠️</span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>This section ran into a problem</div>
          <button onClick={() => this.setState({ err: false })} style={{ color: C.blue500, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}>Try again</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
ErrBound.propTypes = { children: PropTypes.node.isRequired };

// ─── stat rail — 4-up row matching artifact exactly ──────────────────────────
const MiniRing = ({ value, max, color }) => {
  const pct = max > 0 ? clamp((value / max) * 100) : 0;
  const R = 14, CIRC = 2 * Math.PI * R;
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" style={{ display: "block", flexShrink: 0 }}>
      <circle cx={20} cy={20} r={R} fill="none" stroke={`${color}18`} strokeWidth={5} />
      <circle cx={20} cy={20} r={R} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
        strokeLinecap="round" strokeOpacity=".8"
        transform="rotate(-90 20 20)"
        style={{ transition: "stroke-dasharray .9s cubic-bezier(.16,1,.3,1)" }}
      />
      <text x={20} y={20} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: F.display, fontSize: 11, fontWeight: 900, fill: color }}>{value}</text>
    </svg>
  );
};
MiniRing.propTypes = { value: PropTypes.number.isRequired, max: PropTypes.number.isRequired, color: PropTypes.string.isRequired };

const MiniSparkline = ({ points, color }) => {
  if (!points || points.length < 2) return null;
  const W = 90, H = 24, pad = 3;
  const mn = Math.min(...points), mx = Math.max(...points), rng = Math.max(mx - mn, 10);
  const xp = (i) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const yp = (v) => H - pad - ((v - mn) / rng) * (H - pad * 2);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${xp(i).toFixed(1)} ${yp(v).toFixed(1)}`).join(" ");
  const area = `${path} L ${xp(points.length - 1)} ${H - pad} L ${xp(0)} ${H - pad} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", marginTop: 5 }}>
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".22"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={area} fill="url(#sg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xp(points.length - 1)} cy={yp(points[points.length - 1])} r="2.5" fill={color} />
    </svg>
  );
};
MiniSparkline.propTypes = { points: PropTypes.array.isRequired, color: PropTypes.string.isRequired };

const RailBadge = ({ children, color, bg, border }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, fontFamily: F.mono, fontSize: 11, fontWeight: 800, color, background: bg, border: `1px solid ${border}`, marginTop: 5 }}>{children}</span>
);
RailBadge.propTypes = { children: PropTypes.node.isRequired, color: PropTypes.string.isRequired, bg: PropTypes.string.isRequired, border: PropTypes.string.isRequired };

const StatRail = ({ result, scoreHistory }) => {
  const { totalQuestions = 0, answeredQuestions = 0, skippedQuestions = 0, strongAnswers = 0, weakAnswers = 0, averageTime = 0, score = 0 } = result;
  const spark = useMemo(() => {
    const hist = Array.isArray(scoreHistory) ? scoreHistory : [];
    const nums = hist.map(h => clamp(typeof h === "number" ? h : Number(h?.score ?? h?.totalScore ?? 0)));
    const curr = clamp(score);
    return nums.length && nums[nums.length - 1] === curr ? nums : [...nums, curr];
  }, [scoreHistory, score]);
  const trendDelta = spark.length >= 2 ? spark[spark.length - 1] - spark[spark.length - 2] : null;
  const paceColor = averageTime <= 0 ? C.muted : averageTime < 60 ? C.blue500 : averageTime <= 180 ? C.green : averageTime <= 240 ? C.amber : C.red;
  const paceLabel = averageTime <= 0 ? "—" : averageTime < 60 ? "fast" : averageTime <= 180 ? "good pace ✓" : averageTime <= 240 ? "steady" : "slow";
  const pacePos = averageTime > 0 ? Math.max(0, Math.min(100, ((Math.min(averageTime, 300) - 30) / 270) * 100)) : 0;

  const cells = [
    // 1. answered
    <div key="ans">
      <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>answered</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <MiniRing value={answeredQuestions} max={totalQuestions || 1} color={C.blue500} />
        <div>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1 }}>{answeredQuestions}<span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, fontWeight: 400 }}>/{totalQuestions}</span></div>
          <div style={{ marginTop: 5, fontSize: 11, color: C.muted }}>answered</div>
          {skippedQuestions > 0 && <RailBadge color={C.amber} bg={C.amberTint} border={`${C.amber}25`}>{skippedQuestions} skipped</RailBadge>}
        </div>
      </div>
    </div>,
    // 2. performance
    <div key="perf">
      <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>performance</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <MiniRing value={strongAnswers} max={answeredQuestions || 1} color={C.green} />
        <div>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.green, lineHeight: 1 }}>{strongAnswers}</div>
          <div style={{ marginTop: 5, fontSize: 11, color: C.muted }}>scored 80+</div>
          {weakAnswers > 0 && <RailBadge color={C.red} bg={C.redTint} border={`${C.red}25`}>{weakAnswers} below 60</RailBadge>}
        </div>
      </div>
    </div>,
    // 3. pace
    <div key="pace">
      <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>avg pace</div>
      <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: paceColor, lineHeight: 1 }}>{averageTime > 0 ? fmt(averageTime) : "—"}</div>
      <div style={{ marginTop: 5, fontSize: 11, color: C.muted, marginBottom: 10 }}>per question</div>
      {averageTime > 0 && (
        <>
          <div style={{ position: "relative", height: 3, borderRadius: 999, background: C.border }}>
            <div style={{ position: "absolute", left: "10%", width: "42%", top: 0, bottom: 0, borderRadius: 3, background: `${C.green}22` }} />
            <div style={{ position: "absolute", left: `${pacePos}%`, top: -3, bottom: -3, width: 3, borderRadius: 999, background: paceColor, boxShadow: `0 0 6px ${paceColor}90`, transform: "translateX(-50%)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>fast</span>
            <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: paceColor }}>{paceLabel}</span>
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>slow</span>
          </div>
        </>
      )}
    </div>,
    // 4. score + sparkline
    <div key="score">
      <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>this session</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 5 }}>
        <div>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>{clamp(score)}</div>
          <div style={{ marginTop: 5, fontSize: 11, color: C.muted }}>score</div>
        </div>
        {trendDelta !== null && (
          <RailBadge color={trendDelta >= 0 ? C.green : C.red} bg={trendDelta >= 0 ? C.greenTint : C.redTint} border={`${trendDelta >= 0 ? C.green : C.red}25`}>
            {trendDelta >= 0 ? "+" : ""}{trendDelta.toFixed(0)}
          </RailBadge>
        )}
      </div>
      <MiniSparkline points={spark} color={scoreColor(score)} />
      {spark.length >= 2 && <div style={{ fontFamily: F.mono, fontSize: 11, color: C.faint, marginTop: 4 }}>last {spark.length} sessions</div>}
    </div>,
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", marginBottom: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }} className="sr-rail">
      {cells.map((cell, i) => (
        <div key={i} style={{ padding: "16px 18px", borderRight: i < cells.length - 1 ? `1px solid ${C.border}` : "none", transition: "background .15s ease" }} className="sr-cell">
          {cell}
        </div>
      ))}
      <style>{`
        .sr-cell:hover{background:${C.surfaceAlt}!important}
        @media(max-width:900px){.sr-rail{grid-template-columns:repeat(2,1fr)!important}.sr-cell:nth-child(2){border-right:none!important}.sr-cell:nth-child(3),.sr-cell:nth-child(4){border-top:1px solid ${C.border}}}
        @media(max-width:480px){.sr-rail{grid-template-columns:1fr!important}.sr-cell{border-right:none!important;border-bottom:1px solid ${C.border}}.sr-cell:last-child{border-bottom:none!important}}
      `}</style>
    </div>
  );
};
StatRail.propTypes = { result: PropTypes.object.isRequired, scoreHistory: PropTypes.array.isRequired };

// ─── next step banner ─────────────────────────────────────────────────────────
const NextStep = ({ text, weakestTopic, navigate, score }) => {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "14px 18px", marginBottom: 12, borderRadius: 12, background: `linear-gradient(135deg,${C.blue50} 0%,#F5F0FF 100%)`, border: `1px solid rgba(26,110,255,.2)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg,${C.blue500},${C.cyan500})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 6px 18px rgba(26,110,255,.28)`, flexShrink: 0 }}><Icon name="right" size={18} stroke={2.6} /></div>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, letterSpacing: "1.2px", color: C.blue600, marginBottom: 4 }}>what to do next</div>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: C.text, marginBottom: 4 }}>
            {weakestTopic ? <>Drill <span style={{ color: C.blue500 }}>{weakestTopic.topic}</span> next</> : (score >= 80 ? "Raise the difficulty" : "Start your next rep")}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub, maxWidth: 480, lineHeight: 1.55 }}>{text}</div>
        </div>
      </div>
      <button
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onClick={() => navigate("/interview")}
        style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.blue500},${C.blue600})`, color: "#fff", fontWeight: 800, fontSize: 12.5, fontFamily: F.body, cursor: "pointer", boxShadow: hov ? `0 6px 20px rgba(26,110,255,.46)` : `0 3px 14px rgba(26,110,255,.38)`, whiteSpace: "nowrap", transform: hov ? "translateY(-2px)" : "none", transition: "all .15s ease", flexShrink: 0 }}
      ><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{weakestTopic ? `Practice ${weakestTopic.topic}` : "Start interview"}<Icon name="right" size={15} stroke={2.6} style={{ transform: hov ? "translateX(3px)" : "none", transition: "transform .18s ease" }} /></span></button>
    </div>
  );
};
NextStep.propTypes = { text: PropTypes.string.isRequired, weakestTopic: PropTypes.object, navigate: PropTypes.func.isRequired, score: PropTypes.number.isRequired };

// ─── badge / streak bridge ────────────────────────────────────────────────────
const BadgeBridge = ({ streak, newBadges, navigate }) => {
  const [gone, setGone] = useState(false);
  const badges = Array.isArray(newBadges) ? newBadges.map(b => typeof b === "string" ? b : b?.label || "New badge") : [];
  if ((!streak?.current && !badges.length) || gone) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", marginBottom: 12, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      {streak?.current > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: C.violetTint, border: `1px solid ${C.violet}35`, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>◆</span>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 900, color: C.text }}>{streak.current} day streak</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>consistency compounds</div>
          </div>
        </div>
      )}
      {badges.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, flexWrap: "wrap" }}>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>earned</span>
          {badges.map((b, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: C.violetTint, border: `1px solid ${C.violet}45`, color: C.violet, fontFamily: F.mono, fontSize: 11, fontWeight: 700 }}>★ {b}</span>)}
        </div>
      )}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.violet}45`, background: C.violetTint, color: C.violet, fontFamily: F.body, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>View badges<Icon name="right" size={13} stroke={2.6} /></button>
        <button onClick={() => setGone(true)} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.faint, fontSize: 12, cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
};
BadgeBridge.propTypes = { streak: PropTypes.object, newBadges: PropTypes.array, navigate: PropTypes.func.isRequired };

// ─── tabbed analytics (overview tab from artifact) ────────────────────────────
const DNARow = ({ score, label, sub, visible, delay }) => {
  const col = score >= 80 ? C.green : score >= 60 ? C.blue500 : score >= 40 ? C.amber : C.red;
  const pct = score / 100;
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <div style={{ width: 80, textAlign: "right", paddingRight: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 900, lineHeight: 1, color: col }}>{score}</div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, marginTop: 1 }}>/100</div>
      </div>
      <div style={{ flex: 1, position: "relative", height: 26, borderRadius: 4, background: "rgba(26,110,255,.06)", border: "1px solid rgba(26,110,255,.12)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1.5, background: "rgba(26,110,255,.22)", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", right: "50%", top: 3, bottom: 3, borderRadius: "3px 0 0 3px", background: `linear-gradient(90deg,${col}22,${col}60)`, width: visible ? `${pct * 50}%` : "0%", transition: `width .9s cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
        <div style={{ position: "absolute", left: "50%", top: 3, bottom: 3, borderRadius: "0 3px 3px 0", background: `linear-gradient(90deg,${col}60,${col}22)`, width: visible ? `${pct * 50}%` : "0%", transition: `width .9s cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
      </div>
      <div style={{ width: 80, paddingLeft: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
};
DNARow.propTypes = { score: PropTypes.number.isRequired, label: PropTypes.string.isRequired, sub: PropTypes.string.isRequired, visible: PropTypes.bool.isRequired, delay: PropTypes.number.isRequired };

const TAB_DEFS = [
  { id: "overview",  icon: "◉", label: "Overview"  },
  { id: "pace",      icon: "⚡", label: "Pace"      },
  { id: "patterns",  icon: "◆", label: "Patterns"  },
  { id: "progress",  icon: "▲", label: "Progress"  },
];

const TabbedAnalytics = ({ questions, totalScore, scoreHistory }) => {
  const [tab,     setTab]     = useState("overview");
  const [vis,     setVis]     = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // compute DNA axes
  const dna = useMemo(() => {
    const evald   = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number");
    const answered = questions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped");
    const open    = evald.filter(q => !["mcq","aptitude"].includes(q.questionType));
    const depth   = open.length > 0 ? Math.round(open.reduce((s, q) => s + q.aiFeedback.score, 0) / open.length) : clamp(totalScore);
    const avgT    = answered.length ? answered.reduce((s, q) => s + Number(q.timeTaken || 0), 0) / answered.length : 0;
    const speed   = avgT > 0 ? clamp(Math.round(100 - ((avgT - 30) / 270) * 100)) : 50;
    let cons = 50;
    if (evald.length >= 2) { const scores = evald.map(q => q.aiFeedback.score); const mean = scores.reduce((s,v)=>s+v,0)/scores.length; cons = clamp(Math.round(100 - (Math.sqrt(scores.reduce((s,v)=>s+(v-mean)**2,0)/scores.length) / 35) * 100)); }
    const comp = questions.length ? clamp(Math.round((answered.length / questions.length) * 100)) : 0;
    return [
      { score: depth, label: "Depth",       sub: `${open.length} open-ended` },
      { score: speed, label: "Speed",        sub: avgT > 0 ? `~${fmt(Math.round(avgT))} avg` : "no time data" },
      { score: cons,  label: "Consistency",  sub: "score variance" },
      { score: comp,  label: "Completion",   sub: `${answered.length}/${questions.length} answered` },
    ];
  }, [questions, totalScore]);

  const dnaRead = useMemo(() => {
    if (dna.filter(a => a.score >= 72).length >= 3) return "Across-the-board strong session — high floor on every axis.";
    if (dna[0].score >= 72 && dna[1].score < 45) return "Deep thinker — answers had substance but pace was slower than optimal.";
    if (dna[1].score >= 72 && dna[0].score < 45) return "Fast but shallow — pace is there, depth needs to catch up.";
    if (dna[2].score < 45) return "High variance session — your best and worst answers were far apart. Consistency is the target.";
    if (dna[3].score < 60) return "Skips cost you here. A full pass at this depth level would raise the score.";
    return "Mixed fingerprint — open the question review to find the specific pattern.";
  }, [dna]);

  // score curve for progress tab
  const spark = useMemo(() => {
    const hist = Array.isArray(scoreHistory) ? scoreHistory : [];
    const pts  = hist.map(h => clamp(typeof h === "number" ? h : Number(h?.score ?? h?.totalScore ?? 0)));
    const curr = clamp(totalScore);
    return pts.length && pts[pts.length - 1] === curr ? pts : [...pts, curr];
  }, [scoreHistory, totalScore]);

  return (
    <div ref={ref} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12, boxShadow: C.shadow }}>
      {/* tab bar */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
        {TAB_DEFS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "12px 8px", border: "none", borderBottom: `2px solid ${tab === t.id ? C.blue500 : "transparent"}`, background: tab === t.id ? C.card : "transparent", color: tab === t.id ? C.blue500 : C.muted, cursor: "pointer", fontFamily: F.mono, fontSize: 11, fontWeight: tab === t.id ? 700 : 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all .15s ease" }}>
            <span style={{ fontSize: 11 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "18px 20px" }}>
        {/* OVERVIEW — DNA fingerprint */}
        {tab === "overview" && (
          <>
            <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: C.blue500, marginBottom: 3 }}>session fingerprint</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>4-axis read from how you answered — not just what you scored.</div>
            <div style={{ padding: "16px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
              {dna.map((a, i) => <DNARow key={a.label} score={a.score} label={a.label} sub={a.sub} visible={vis} delay={i * 120} />)}
            </div>
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 9, background: "rgba(26,110,255,.06)", border: "1px solid rgba(26,110,255,.18)", fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{dnaRead}</div>
          </>
        )}

        {/* PACE */}
        {tab === "pace" && (
          <>
            <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: C.blue500, marginBottom: 3 }}>pace vs score</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>How your response time correlated with answer quality.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && Number(q.timeTaken) > 0).map((q, i) => {
                const s = clamp(q.aiFeedback.score);
                const t = Number(q.timeTaken);
                const col = s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.red;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 9, background: C.card, border: `1px solid ${C.border}` }}>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: C.faint, flexShrink: 0 }}>Q{(q.index ?? i) + 1}</span>
                    <span style={{ fontSize: 11, color: C.sub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.topic}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(t)}</span>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: col, flexShrink: 0 }}>{s}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PATTERNS */}
        {tab === "patterns" && (
          <>
            <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: C.blue500, marginBottom: 3 }}>recurring gaps</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Topics or concepts that appeared in multiple weak answers.</div>
            {(() => {
              const weak = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && q.aiFeedback.score < 60);
              if (!weak.length) return <div style={{ fontSize: 11.5, color: C.muted, padding: "8px 0" }}>No weak answers this session — no patterns to surface.</div>;
              const topicMap = {};
              weak.forEach(q => { const t = q.topic || "General"; topicMap[t] = (topicMap[t] || 0) + 1; });
              return Object.entries(topicMap).sort((a, b) => b[1] - a[1]).map(([topic, count]) => (
                <div key={topic} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 9, background: C.card, border: `1px solid ${C.border}`, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{topic}</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{count} answer{count > 1 ? "s" : ""} below 60</div>
                  </div>
                  <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.amber }}>{count}</div>
                </div>
              ));
            })()}
          </>
        )}

        {/* PROGRESS */}
        {tab === "progress" && (
          <>
            <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: C.blue500, marginBottom: 3 }}>score curve</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Answer-by-answer progression this session.</div>
            {(() => {
              const pts = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number").map(q => q.aiFeedback.score);
              if (pts.length < 2) return <div style={{ fontSize: 11.5, color: C.muted }}>Need 2+ evaluated answers to draw the curve.</div>;
              const W = 540, H = 160, padX = 24, padY = 18;
              const xp = i => padX + (i / (pts.length - 1)) * (W - padX * 2);
              const yp = v => H - padY - (clamp(v) / 100) * (H - padY * 2);
              const path = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${xp(i).toFixed(1)} ${yp(v).toFixed(1)}`).join(" ");
              const area = `${path} L ${xp(pts.length - 1)} ${H - padY} L ${xp(0)} ${H - padY} Z`;
              const avg  = pts.reduce((s, v) => s + v, 0) / pts.length;
              const drift = pts[pts.length - 1] - pts[0];
              return (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: drift >= 0 ? C.greenTint : C.redTint, border: `1px solid ${drift >= 0 ? C.green : C.red}30` }}>
                      <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 900, color: drift >= 0 ? C.green : C.red }}>{drift >= 0 ? "+" : ""}{drift} pts</span>
                      <span style={{ fontFamily: F.mono, fontSize: 11, color: C.sub }}>drift</span>
                    </span>
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: 300 }}>
                    <defs><linearGradient id="ca" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue500} stopOpacity=".18"/><stop offset="100%" stopColor={C.blue500} stopOpacity="0"/></linearGradient></defs>
                    {[40, 60, 80].map(l => (<g key={l}><line x1={padX} x2={W - padX} y1={yp(l)} y2={yp(l)} stroke={C.border} strokeDasharray="4 5" /><text x={2} y={yp(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text></g>))}
                    <line x1={padX} x2={W - padX} y1={yp(avg)} y2={yp(avg)} stroke={C.muted} strokeWidth="1" strokeDasharray="2 4" opacity=".5" />
                    <path d={area} fill="url(#ca)" />
                    <path d={path} fill="none" stroke={C.blue500} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.map((v, i) => (<g key={i}><circle cx={xp(i)} cy={yp(v)} r="5" fill={scoreColor(v)} stroke="#fff" strokeWidth="2" /><text x={xp(i)} y={H - 4} textAnchor="middle" fontSize="7.5" fontFamily={F.mono} fill={C.muted}>Q{i + 1}</text></g>))}
                  </svg>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};
TabbedAnalytics.propTypes = { questions: PropTypes.array.isRequired, totalScore: PropTypes.number.isRequired, scoreHistory: PropTypes.array.isRequired };

// ─── Mission Report (promoted ScoreCard — always visible, no accordion) ────────
const MissionReport = ({ result, totalScore, normalizedQuestions }) => {
  const g = grade(totalScore);
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: `0 16px 56px rgba(0,31,107,.20)`, border: `1px solid rgba(26,110,255,.22)`, marginBottom: 12 }}>
      {/* navy header */}
      <div style={{ position: "relative", overflow: "hidden", padding: "20px 24px 18px", background: "linear-gradient(150deg,#060E20 0%,#0A1A38 50%,#0C2242 100%)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle,rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize: "20px 20px", opacity: .5, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -80, right: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,194,232,.22),transparent 68%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", color: "#00C8F0", textTransform: "uppercase", marginBottom: 4 }}>mission report · where you stand overall</div>
          <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 3 }}>
            {totalScore}/100 · <span style={{ color: g.accent }}>{g.g} — {g.desc}</span>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 12 }}>skill fingerprint · rank · archetype · tier progress · shareable card</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px", background: "rgba(5,150,105,.18)", color: "#79F2B2", border: "1px solid rgba(5,150,105,.3)" }}>{result.strongAnswers} strong</span>
            <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px", background: "rgba(220,38,38,.18)", color: "#fca5a5", border: "1px solid rgba(220,38,38,.3)" }}>{result.weakAnswers} to fix</span>
          </div>
        </div>
      </div>
      {/* ScoreCard body */}
      <div style={{ background: C.card, padding: "20px 24px" }}>
        <ScoreCard totalScore={totalScore} questions={normalizedQuestions} />
      </div>
    </div>
  );
};
MissionReport.propTypes = { result: PropTypes.object.isRequired, totalScore: PropTypes.number.isRequired, normalizedQuestions: PropTypes.array.isRequired };

// ─── hidden share card (for html-to-image) ────────────────────────────────────
const ShareCard = ({ result, cardRef }) => {
  const { score, totalQuestions, answeredQuestions, strongAnswers, weakAnswers, topTopic } = result;
  const s = clamp(score); const g = grade(s);
  return (
    <div ref={cardRef} style={{ position: "fixed", top: -9999, left: -9999, width: 520, fontFamily: F.body, borderRadius: 24, overflow: "hidden", background: "linear-gradient(135deg,#001F6B 0%,#0044C4 44%,#0057E8 72%,#00ADE0 100%)" }}>
      <div style={{ height: 4, background: `linear-gradient(90deg,${g.accent},${g.accent})` }} />
      <div style={{ padding: "28px 32px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", color: "rgba(255,255,255,.38)", textTransform: "uppercase" }}>MockMate · Session Result</div>
          <div style={{ fontFamily: F.mono, fontSize: 10, padding: "3px 9px", borderRadius: 6, background: `${g.accent}20`, color: g.accent, border: `1px solid ${g.accent}40`, fontWeight: 700 }}>{g.g} · {g.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
          <span style={{ fontFamily: F.display, fontSize: 80, fontWeight: 900, color: "#fff", letterSpacing: "-4px", lineHeight: 1 }}>{s}</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,.32)" }}>/100</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.5, marginBottom: 8 }}>{strongAnswers >= answeredQuestions * 0.75 ? "Consistent form across the board." : `${strongAnswers} strong · ${weakAnswers} to fix.`}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(0,0,0,.18)" }}>
        {[{ l: "answered", v: `${answeredQuestions}/${totalQuestions}` }, { l: "strong", v: strongAnswers }, { l: "to fix", v: weakAnswers }, { l: "top topic", v: topTopic || "—" }].map((s, i) => (
          <div key={i} style={{ padding: "12px 10px", borderRight: i < 3 ? "1px solid rgba(255,255,255,.08)" : "none", textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 7.5, color: "rgba(255,255,255,.38)", textTransform: "uppercase", marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 32px", background: "rgba(0,0,0,.32)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: g.accent }}>mockmate.app</div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,.3)" }}>AI interview coaching</div>
      </div>
    </div>
  );
};
ShareCard.propTypes = { result: PropTypes.object.isRequired, cardRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]).isRequired };

// ─── global keyframes ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "res-overview",  label: "Overview"  },
  { id: "res-topics",    label: "Topics"    },
  { id: "res-analytics", label: "Analytics" },
  { id: "res-answers",   label: "Answers"   },
  { id: "res-report",    label: "Report"    },
];

const GlobalStyles = () => (
  <style>{`
    @keyframes resFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes resLive{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.32;transform:scale(.7)}}
    *,*::before,*::after{box-sizing:border-box}
    body{background:${C.bg}}
    button:focus-visible{outline:2px solid ${C.blue500};outline-offset:3px;border-radius:6px}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition-duration:0.01ms!important}}
    ${RESULT_NAV_CSS}
  `}</style>
);

// ═══ MAIN PAGE ════════════════════════════════════════════════════════════════
const Result = () => {
  const location   = useLocation();
  const navigate   = useNavigate();
  const result     = location.state?.result || location.state;
  const idRef      = useRef(Math.random().toString(36).slice(2, 8).toUpperCase());
  const shareRef   = useRef(null);

  const [copied,      setCopied]      = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const { canUseFeature } = usePlan();
  const { openUpgrade }   = useUpgrade();
  const canDownload       = canUseFeature("scorecardDownload");

  useEffect(() => { if (!result) navigate("/"); }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  const normalizedQuestions = useMemo(() => questions.map((q, i) => normalizeQ(q, i)), [questions]);
  const answered  = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped"), [normalizedQuestions]);
  const skipped   = useMemo(() => normalizedQuestions.filter(q => q.skipped),  [normalizedQuestions]);
  const evaluated = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number"), [normalizedQuestions]);

  const strongAnswers = evaluated.filter(q => q.aiFeedback.score >= 80).length;
  const weakAnswers   = evaluated.filter(q => q.aiFeedback.score <  60).length;
  const averageTime   = answered.length ? Math.round(answered.reduce((s, q) => s + Number(q.timeTaken || 0), 0) / answered.length) : 0;

  const { topicAverages, topicStatus } = useMemo(() => {
    const map = {};
    let anyTagged = false;
    normalizedQuestions.forEach(q => {
      if (q.skipped || typeof q.aiFeedback?.score !== "number") return;
      if (q.hasTopicField) anyTagged = true;
      const t = q.topic || "General";
      if (!map[t]) map[t] = { total: 0, n: 0 };
      map[t].total += q.aiFeedback.score;
      map[t].n     += 1;
    });
    return {
      topicAverages: Object.entries(map).map(([topic, d]) => ({ topic, avg: Math.round(d.total / d.n) })),
      topicStatus:   evaluated.length === 0 ? "no-eval" : !anyTagged ? "no-topic-field" : "ok",
    };
  }, [normalizedQuestions, evaluated.length]);

  const weakestTopic = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];
  const topTopic     = [...topicAverages].sort((a, b) => b.avg - a.avg)[0]?.topic ?? null;

  const nextStepText = useMemo(() => {
    if (skipped.length > 0 && !weakAnswers) return `You skipped ${skipped.length} question${skipped.length > 1 ? "s" : ""} — a full pass would raise this score.`;
    if (weakestTopic && weakAnswers > 0) return `${weakAnswers} answer${weakAnswers > 1 ? "s" : ""} scored below 60, concentrated in ${weakestTopic.topic}. Start your next rep there.`;
    if (strongAnswers === evaluated.length && evaluated.length > 0) return "Every answer scored 80+. Raise the difficulty next time.";
    return "Review the answers below, then queue another session.";
  }, [skipped.length, weakAnswers, weakestTopic, strongAnswers, evaluated.length]);

  const handleCopy = useCallback(async () => {
    const lines = [
      `MockMate result: ${totalScore}/100 — ${grade(totalScore).desc}`,
      `${answered.length}/${normalizedQuestions.length} answered · ${strongAnswers} strong · ${weakAnswers} need work · ${skipped.length} skipped`,
      topTopic    ? `Strongest: ${topTopic} (${topicAverages.find(t => t.topic === topTopic)?.avg}/100)` : "",
      weakestTopic ? `Focus: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : "",
    ].filter(Boolean);
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* unavailable */ }
  }, [totalScore, answered.length, normalizedQuestions.length, strongAnswers, weakAnswers, skipped.length, topTopic, topicAverages, weakestTopic]);

  const handleDownload = useCallback(async () => {
    // Client-side feature, so this lock is a UX lock (the image is drawn in the browser).
    if (!canDownload) { openUpgrade("scorecardDownload"); return; }
    if (!shareRef.current || downloading) return;
    setDownloading(true);
    const id = toast.loading("Preparing your image…");
    try {
      const url  = await toPng(shareRef.current, { cacheBust: true, pixelRatio: 2.5 });
      const link = document.createElement("a");
      link.download = `mockmate-result-${Date.now()}.png`;
      link.href = url; link.click();
      toast.dismiss(id); toast.success("Image saved!");
    } catch (e) { toast.dismiss(id); console.error(e); toast.error("Could not create the image — try again."); }
    finally { setDownloading(false); }
  }, [downloading, canDownload, openUpgrade]);

  // How many insights the server is holding back on this session (0 for Pro).
  const lockedCount = useMemo(
    () => normalizedQuestions.reduce((n, q) => n + (q.aiFeedback?.tier === "basic" ? (q.aiFeedback.locked?.count || 0) : 0), 0),
    [normalizedQuestions]
  );

  const heroResult = {
    score: totalScore, sessionId,
    totalQuestions:    normalizedQuestions.length,
    answeredQuestions: answered.length,
    skippedQuestions:  skipped.length,
    strongAnswers, weakAnswers, averageTime,
    topTopic, weakestTopicName: weakestTopic?.topic ?? null,
    trendDelta:   result?.trendDelta   ?? null,
    scoreHistory: result?.scoreHistory ?? [],
  };

  if (!result) return null;

  // ── page layout ─────────────────────────────────────────────────────────────
  // 1. Strip
  // 2. Hero  (score ring, verdict, metric cards, actions)
  // 3. StatRail (4-up)
  // 4. BadgeBridge
  // 5. NextStep banner
  // 6. ScoreSummary (topic bars + IRS composition)
  // 7. TabbedAnalytics
  // 8. FeedbackList (per-question + analytics strip)
  // 9. MissionReport (ScoreCard, always visible, no accordion)
  // 10. Footer

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 24px 60px", fontFamily: F.body }} className="res-page">
      <GlobalStyles />
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* 1. strip */}
        <AnimSec>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", marginBottom: 14, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "resLive 2.4s ease-in-out infinite", display: "inline-block" }} />
              <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: ".4px", color: C.muted }}>mockmate · post-interview debrief</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {sessionId && <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>session {idRef.current}</span>}
              <span style={{ color: C.borderMd }}>·</span>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>{new Date(result?.completedAt || result?.createdAt || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase()}</span>
            </div>
          </div>
        </AnimSec>

        {/* sticky section nav */}
        <ResultNav
          items={NAV_ITEMS}
          onPractice={() => navigate("/interview")}
          practiceLabel={weakestTopic ? "Practice again" : "New interview"}
          practiceShort={weakestTopic ? "Again" : "New"}
        />

        {/* 2. hero */}
        <AnimSec delay={40} id="res-overview">
          <ErrBound>
            <ResultHeroV2 result={heroResult} navigate={navigate} onCopy={handleCopy} copied={copied} onDownloadImage={handleDownload} downloading={downloading} downloadLocked={!canDownload} />
          </ErrBound>
        </AnimSec>

        {!bannerHidden && (
          <AnimSec delay={60}>
            <ProUnlockBanner
              isTrial={result?.isTrial === true}
              mode={result?.mode}
              lockedCount={lockedCount}
              onDismiss={() => setBannerHidden(true)}
            />
          </AnimSec>
        )}

        {/* 3. stat rail */}
        <AnimSec delay={80}>
          <ErrBound>
            <StatRail result={heroResult} scoreHistory={result?.scoreHistory ?? []} />
          </ErrBound>
        </AnimSec>

        {/* hidden share card */}
        <ShareCard result={heroResult} cardRef={shareRef} />

        {/* 4. badges */}
        <AnimSec>
          <ErrBound>
            <BadgeBridge streak={streak} newBadges={newBadges} navigate={navigate} />
          </ErrBound>
        </AnimSec>

        {/* 5. next step */}
        <AnimSec>
          <ErrBound>
            <NextStep text={nextStepText} weakestTopic={weakestTopic} navigate={navigate} score={totalScore} />
          </ErrBound>
        </AnimSec>

        {/* 6. score summary */}
        <AnimSec id="res-topics">
          <ErrBound>
            <ScoreSummary topicAverages={topicAverages} topicStatus={topicStatus} averageTime={averageTime} totalScore={totalScore} />
          </ErrBound>
        </AnimSec>

        {/* 7. tabbed analytics */}
        <AnimSec id="res-analytics">
          <ErrBound>
            <TabbedAnalytics questions={normalizedQuestions} totalScore={totalScore} scoreHistory={result?.scoreHistory ?? []} />
          </ErrBound>
        </AnimSec>

        {/* 8. feedback list */}
        <AnimSec id="res-answers">
          <ErrBound>
            <FeedbackList questions={normalizedQuestions} sessionId={sessionId} />
          </ErrBound>
        </AnimSec>

        {/* 9. mission report */}
        <AnimSec id="res-report">
          <ErrBound>
            <MissionReport result={heroResult} totalScore={totalScore} normalizedQuestions={normalizedQuestions} />
          </ErrBound>
        </AnimSec>

        <BackToTop />

        {/* 10. footer */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, padding: "16px 4px 0", opacity: .35 }}>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>mockmate · result report</span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>scores normalized 0–100 · computed post-session</span>
        </div>
      </div>
    </div>
  );
};

export default Result;
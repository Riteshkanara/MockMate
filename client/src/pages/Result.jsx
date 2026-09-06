import { useState, useEffect, useMemo, useCallback, useRef, Component } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ScoreCard from "../components/ScoreCard";
import { retryQuestion } from "../Services/interviewService";
import { C, F } from "../styles/tokens";

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — RESULT PAGE v10
// Same design system throughout (Dashboard/Coach dark hero, dim-row/rail
// patterns, Inter/JetBrains Mono). v9 fixed hero data density, a silent
// topic-fallback bug, and redundant insight tiles. v10 adds three new
// performance-evaluation views, each chosen because the underlying data
// (timeTaken, questionType, per-question score) was already being collected
// but never surfaced in a way that changes what the user does next:
//
// 1. Consistency band on the score-progression chart — a shaded min/max
//    range plus a dashed average line, behind the existing line chart. Two
//    sessions can average the same score with very different spread; this
//    shows whether performance was steady or volatile without adding a new
//    section competing for attention.
//
// 2. Pace vs. score — a new scatter view plotting timeTaken against score
//    per question, split at the session's own median pace (not a fixed
//    threshold, since "fast" only means something relative to how this
//    person paced this particular session). Tells the user whether rushing
//    or overthinking is costing them points — something the score alone
//    can't say.
//
// 3. Answer type breakdown — objective (mcq/aptitude) accuracy vs
//    open-ended average, shown as a mirrored comparison rather than two
//    separate tiles. A gap here means a different fix than a topic gap:
//    weak objective accuracy is a knowledge problem, weak open-ended scoring
//    is a communication/structuring problem.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Local additions not in the shared token file ──────────────────────────
// Note: Dashboard.jsx/Coach.jsx reference `cardAlt` throughout their local
// styles, but it isn't actually defined in styles/tokens.js — that key
// resolves to undefined there too. We alias it here to the real token
// (surfaceAlt) rather than reproduce the gap; worth fixing at the source.
const X = {
  dark0: "#080F1E",
};
const cardAlt = C.surfaceAlt || C.card;

// ─── Pure helpers ───────────────────────────────────────────────────────────
const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const scoreColor = (s) => {
  const n = clamp(s);
  if (n >= 80) return C.green;
  if (n >= 60) return C.blue500;
  if (n >= 40) return C.amber;
  return C.red;
};
const scoreTint = (s) => {
  const n = clamp(s);
  if (n >= 80) return C.greenTint;
  if (n >= 60) return C.blue50;
  if (n >= 40) return C.amberTint;
  return C.redTint;
};

const getLabel = (s) =>
  s >= 90 ? "Elite" : s >= 80 ? "Strong" : s >= 70 ? "Solid" : s >= 60 ? "Developing" : "Needs Practice";

const getVerdict = (s) => {
  if (s >= 80) return { headline: "You are building reliable interview form.", body: "Fundamentals are landing well. The fastest gains now come from tightening weak spots, not adding new topics." };
  if (s >= 60) return { headline: "The foundation is there — sharpen the edges.", body: "Enough signal here to improve fast. Focus on the questions where depth or clarity dropped." };
  return { headline: "This session exposed useful gaps.", body: "Treat this as a diagnostic. Your weakest answers are the roadmap for the next rep." };
};

const formatTime = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

const toOneLine = (text, maxLen = 100) => {
  if (!text) return "";
  const s = (text.split(/(?<=[.!?])\s+/)[0] || text).trim();
  return s.length <= maxLen ? s : `${s.slice(0, maxLen - 1).trim()}…`;
};

const getTakeaway = (question) => {
  if (question.skipped) return { text: "Skipped — no answer submitted.", tone: "neutral" };
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  const fb = question.aiFeedback;
  if (objective) {
    if (fb?.correct === true) return { text: "Correct answer.", tone: "good" };
    if (fb?.correct === false) return { text: "Incorrect — see the explanation below.", tone: "bad" };
    return { text: "Answer recorded.", tone: "neutral" };
  }
  if (!fb || fb.aiAvailable === false) return { text: "AI evaluation unavailable for this answer.", tone: "neutral" };
  const score = clamp(fb.score);
  if (score >= 80 && fb.good) return { text: toOneLine(fb.good), tone: "good" };
  if (score < 60 && fb.missing) return { text: toOneLine(fb.missing), tone: "bad" };
  if (fb.tip) return { text: toOneLine(fb.tip), tone: "neutral" };
  if (fb.good) return { text: toOneLine(fb.good), tone: "neutral" };
  return { text: "Reviewed — open for the full breakdown.", tone: "neutral" };
};

const toneColor = (tone) => (tone === "good" ? C.green : tone === "bad" ? C.red : C.sub);

// ─── Feedback normalization (unchanged logic) ──────────────────────────────
const normalizeFeedback = (question) => {
  if (!question) return null;
  const raw = question.feedback;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      score: typeof question.score === "number" ? question.score : Number(question.score || 0),
      correct: question.correct ?? parsed.correct ?? null,
      good: parsed.good || "",
      missing: parsed.missing || "",
      idealHint: parsed.idealHint || "",
      tip: parsed.tip || "",
      sampleAnswer: parsed.sampleAnswer || "",
      aiAvailable: parsed.aiAvailable !== false,
      fallback: parsed.fallback === true,
    };
  } catch {
    return null;
  }
};

// `topic` is now tracked separately from "did the backend send one" so the
// UI can tell "General" (a real fallback topic) apart from "field missing
// entirely" further down, instead of treating both the same way.
const normalizeQuestion = (question, index) => {
  const aiFeedback = normalizeFeedback(question);
  const scoreValue = typeof question?.score === "number" ? question.score : Number(question?.score || 0);
  const hasTopicField = typeof question?.topic === "string" && question.topic.trim().length > 0;
  return {
    ...question,
    index,
    text: question?.text || question?.question || `Question ${index + 1}`,
    topic: hasTopicField ? question.topic.trim() : "General",
    hasTopicField,
    questionType: question?.questionType || "open",
    userAnswer: question?.userAnswer || "",
    skipped: Boolean(question?.skipped),
    score: clamp(scoreValue),
    aiFeedback,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY — same pattern as Dashboard/Coach
// ═══════════════════════════════════════════════════════════════════════════
class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("[Result section error]", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px 24px", borderRadius: 16, marginBottom: 18, background: C.redTint, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>This section ran into a problem</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
              The rest of the page is working fine.{" "}
              <button onClick={() => this.setState({ hasError: false })} style={{ color: C.blue500, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}>Try again</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED SECTION — same IntersectionObserver reveal as Dashboard/Coach
// ═══════════════════════════════════════════════════════════════════════════
const AnimatedSection = ({ children, delay = 0, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.08 }
    );
    const t = setTimeout(() => observer.observe(el), delay);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [delay]);

  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: `opacity 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms`, ...style }}>
      {children}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HERO — score block left, verdict + a compact stats line right. The stats
// line is new in v9: answered count, strong/weak split, and top topic, all
// pulled from numbers already computed in heroResult. No layout change to
// the two-column grid itself, so this doesn't disturb the dark panel design.
// ═══════════════════════════════════════════════════════════════════════════
const ResultHero = ({ result, navigate, onCopy, copied }) => {
  const score = result.score;
  const v = getVerdict(score);
  const trendDelta = result.trendDelta;
  const hasTrend = trendDelta != null && result.scoreHistory?.length >= 2;

  const statChips = [
    `${result.answeredQuestions}/${result.totalQuestions} answered`,
    result.strongAnswers > 0 ? `${result.strongAnswers} strong` : null,
    result.weakAnswers > 0 ? `${result.weakAnswers} need work` : null,
    result.topTopic ? `${result.topTopic} led the pack` : null,
  ].filter(Boolean);

  return (
    <section style={S.hero} className="res-hero">
      {/* Three diagonal lines layered at different speeds/widths/opacities */}
      <div style={S.heroNoise} />
      <div style={{ ...S.heroNoise, width: "10%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.045), transparent)", animation: "heroLineDrift 13s linear infinite", animationDelay: "3.2s" }} />
      <div style={{ ...S.heroNoise, width: "6%", background: "linear-gradient(90deg, transparent, rgba(0,220,255,0.08), transparent)", animation: "heroLineDrift2 17s linear infinite", animationDelay: "7s" }} />
      <div style={S.heroGrid} className="res-hero-grid">

        <div>
          <div style={S.heroLabel}>session score</div>
          <div style={S.heroNum} className="res-hero-num">
            {score}
            <span style={S.heroMax}>/100</span>
          </div>
          <div style={{ ...S.tierPill, background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)" }}>
            {getLabel(score)}
          </div>
          <div style={S.heroBar}>
            <div style={{ ...S.heroBarFill, width: `${score}%` }} />
          </div>
          {hasTrend && (
            <div style={S.heroTrendText}>
              {trendDelta >= 0 ? "+" : ""}{Number(trendDelta).toFixed(1)} pts vs last session
            </div>
          )}
        </div>

        <div>
          <div style={S.heroKicker}>Post-interview debrief</div>
          <h1 style={S.heroH1}>{v.headline}</h1>
          <p style={S.heroSub}>{v.body}</p>
          {statChips.length > 0 && (
            <div style={S.heroChipRow}>
              {statChips.map((c, i) => (
                <span key={i} style={S.heroChip}>{c}</span>
              ))}
            </div>
          )}
          <div style={S.heroActions}>
            <button style={S.btnPrimary} className="res-btn-primary" onClick={() => navigate("/interview")}>
              Start another interview
            </button>
            <button style={S.btnGhost} className="res-btn-ghost" onClick={() => navigate("/dashboard")}>
              Back to dashboard
            </button>
            <button style={S.btnGhost} className="res-btn-ghost" onClick={onCopy}>
              {copied ? "Copied" : "Copy summary"}
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};

// ─── Stat rail — one divided strip, matches Dashboard's RailStat exactly ───
const RailStat = ({ label, value, unit, sub, color }) => (
  <div style={S.railCell} className="res-rail-cell">
    <div style={S.railLabel}>{label}</div>
    <div style={S.railValRow}>
      <span style={{ ...S.railVal, color }}>{value}</span>
      {unit && <span style={S.railUnit}>{unit}</span>}
    </div>
    <div style={S.railSub}>{sub}</div>
  </div>
);

const StatRail = ({ result }) => (
  <section style={S.statRail} className="res-stat-rail">
    <RailStat label="Answered" value={`${result.answeredQuestions}/${result.totalQuestions}`} unit="" sub={result.skippedQuestions > 0 ? `${result.skippedQuestions} skipped` : "No skips"} color={C.text} />
    <RailStat label="Strong answers" value={result.strongAnswers} unit="" sub="Scored 80 or above" color={C.green} />
    <RailStat label="Needs work" value={result.weakAnswers} unit="" sub="Scored below 60" color={result.weakAnswers > 0 ? C.orange : C.muted} />
    <RailStat label="Avg time / question" value={formatTime(result.averageTime)} unit="" sub="Across answered questions" color={C.blue500} />
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════
// NEXT STEP BANNER — Dashboard's tierBanner pattern, light gradient
// ═══════════════════════════════════════════════════════════════════════════
const NextStepBanner = ({ nextStepText, weakestTopic, navigate }) => (
  <section style={S.tierBanner} className="res-banner">
    <div style={{ flex: 1 }}>
      <div style={S.eyebrow}>What to do next</div>
      <h2 style={S.bannerH2}>
        {weakestTopic ? <>Drill <span style={{ color: C.blue600 }}>{weakestTopic.topic}</span> next</> : "Queue another rep"}
      </h2>
      <p style={S.bannerSub}>{nextStepText}</p>
    </div>
    <button style={S.btnGradient} className="res-btn-gradient" onClick={() => navigate("/interview")}>
      Start another interview →
    </button>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════
// SCORE PROGRESSION — question-by-question line, styled with real tokens
// ═══════════════════════════════════════════════════════════════════════════
// Consistency is read off the same chart rather than given its own section:
// a shaded band from min to max (with the average as a dashed line) sits
// behind the existing progression line. Two sessions can average the same
// score with very different spread — a tight band means steady form, a wide
// one means the score depends heavily on which question you hit.
const ScoreProgression = ({ questions }) => {
  const points = questions
    .filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number")
    .map(q => q.aiFeedback.score);

  if (points.length < 2) {
    return (
      <div style={{ padding: 28, borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, textAlign: "center" }}>
        At least two evaluated questions are needed to show progression.
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const avg = points.reduce((s, v) => s + v, 0) / points.length;
  const variance = points.reduce((s, v) => s + (v - avg) ** 2, 0) / points.length;
  const stdDev = Math.round(Math.sqrt(variance));
  const spread = max - min;
  const consistencyRead = spread <= 15
    ? { label: "Steady", detail: "Your score barely moved question to question — even, predictable form.", color: C.green }
    : spread <= 35
    ? { label: "Some swing", detail: "A moderate spread between your best and weakest answers.", color: C.blue500 }
    : { label: "High swing", detail: "A big gap between your best and weakest answers — form varied a lot within the session.", color: C.amber };

  const W = 640, H = 180, padX = 26, padY = 20;
  const x = i => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = v => H - padY - (clamp(v) / 100) * (H - padY * 2);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(points.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;
  const bandTop = y(max), bandBottom = y(min);

  return (
    <div>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380, display: "block" }}>
          <defs>
            <linearGradient id="resAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue500} stopOpacity="0.16" />
              <stop offset="100%" stopColor={C.blue500} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 60, 80].map(l => (
            <g key={l}>
              <line x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} stroke={C.border} strokeDasharray="4 5" />
              <text x={2} y={y(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text>
            </g>
          ))}
          {spread > 0 && (
            <rect x={padX} y={bandTop} width={W - padX * 2} height={bandBottom - bandTop} fill={consistencyRead.color} opacity={0.07} />
          )}
          <line x1={padX} x2={W - padX} y1={y(avg)} y2={y(avg)} stroke={C.muted} strokeWidth="1" strokeDasharray="2 4" opacity={0.55} />
          <path d={area} fill="url(#resAreaGrad)" />
          <path d={path} fill="none" stroke={C.blue500} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((v, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r="5" fill={scoreColor(v)} stroke="#fff" strokeWidth="2" />
              <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>Q{i + 1}</text>
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        <span style={{ ...S.consistencyPill, color: consistencyRead.color, background: `${consistencyRead.color}14`, border: `1px solid ${consistencyRead.color}30` }}>
          {consistencyRead.label} · ±{stdDev} pts
        </span>
        <span style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>{consistencyRead.detail}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PACE VS SCORE — plots time taken against score per question. Score alone
// can't say whether someone is rushing or overthinking; this view can. The
// median time is used as the quadrant split rather than a fixed threshold,
// since "fast" and "slow" are relative to how this person paced this
// session, not an absolute number of seconds that's meaningful across
// question types or difficulty levels.
// ═══════════════════════════════════════════════════════════════════════════
const PaceVsScore = ({ questions }) => {
  const points = questions
    .filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && Number(q.timeTaken) > 0)
    .map(q => ({ time: Number(q.timeTaken), score: clamp(q.aiFeedback.score), index: q.index, topic: q.topic }));

  if (points.length < 3) {
    return (
      <div style={{ padding: 28, borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, textAlign: "center" }}>
        At least three timed, evaluated questions are needed to compare pace against score.
      </div>
    );
  }

  const times = points.map(p => p.time);
  const sortedTimes = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sortedTimes.length / 2);
  const medianTime = sortedTimes.length % 2 ? sortedTimes[mid] : (sortedTimes[mid - 1] + sortedTimes[mid]) / 2;

  const fast = points.filter(p => p.time <= medianTime);
  const slow = points.filter(p => p.time > medianTime);
  const avgOf = list => (list.length ? Math.round(list.reduce((s, p) => s + p.score, 0) / list.length) : null);
  const fastAvg = avgOf(fast);
  const slowAvg = avgOf(slow);

  let read = null;
  if (fastAvg != null && slowAvg != null) {
    const gap = fastAvg - slowAvg;
    if (gap >= 12) read = { text: `Your quicker answers scored ${gap} points higher on average — extra time isn't converting into better answers here.`, color: C.blue500 };
    else if (gap <= -12) read = { text: `Your slower, more considered answers scored ${Math.abs(gap)} points higher — depth is paying off, so don't rush.`, color: C.green };
    else read = { text: `Score held steady regardless of pace — timing isn't the lever to pull for this session.`, color: C.muted };
  }

  const W = 640, H = 220, padX = 34, padY = 24;
  const maxTime = Math.max(...times) * 1.08;
  const x = t => padX + (Math.min(t, maxTime) / maxTime) * (W - padX * 2);
  const y = s => H - padY - (clamp(s) / 100) * (H - padY * 2);
  const midX = x(medianTime);

  return (
    <div>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380, display: "block" }}>
          {[40, 60, 80].map(l => (
            <g key={l}>
              <line x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} stroke={C.border} strokeDasharray="4 5" />
              <text x={2} y={y(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text>
            </g>
          ))}
          <line x1={midX} x2={midX} y1={padY} y2={H - padY} stroke={C.borderMd} strokeDasharray="3 4" />
          <text x={midX} y={H - 6} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>median pace · {formatTime(medianTime)}</text>
          {points.map((p, i) => (
            <circle key={i} cx={x(p.time)} cy={y(p.score)} r="6" fill={scoreColor(p.score)} fillOpacity="0.85" stroke="#fff" strokeWidth="1.5">
              <title>{`Q${p.index + 1} · ${p.topic} · ${formatTime(p.time)} · ${p.score}/100`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <div style={{ padding: "12px 14px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: "0.4px", marginBottom: 6 }}>faster half · {fast.length} question{fast.length === 1 ? "" : "s"}</div>
          <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text }}>{fastAvg != null ? `${fastAvg}/100` : "—"}</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: "0.4px", marginBottom: 6 }}>slower half · {slow.length} question{slow.length === 1 ? "" : "s"}</div>
          <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text }}>{slowAvg != null ? `${slowAvg}/100` : "—"}</div>
        </div>
      </div>
      {read && (
        <div style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{read.text}</div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ANSWER TYPE BREAKDOWN — objective (mcq/aptitude) vs open-ended questions,
// each scored on its own terms. A gap here points to a different fix than
// a topic gap does: weak objective accuracy means a knowledge gap, weak
// open-ended scoring means a communication/structuring gap. Rendered as a
// mirrored bar pair rather than two separate stat tiles, since the point is
// the comparison between them, not either number alone.
// ═══════════════════════════════════════════════════════════════════════════
const AnswerTypeBreakdown = ({ questions }) => {
  const objective = questions.filter(q => !q.skipped && ["mcq", "aptitude"].includes(q.questionType) && q.aiFeedback?.correct != null);
  const openEnded = questions.filter(q => !q.skipped && !["mcq", "aptitude"].includes(q.questionType) && typeof q.aiFeedback?.score === "number");

  if (!objective.length && !openEnded.length) {
    return <p style={S.cardSub}>No evaluated questions yet — answer-type breakdown will appear once questions are scored.</p>;
  }

  const objectiveAccuracy = objective.length ? Math.round((objective.filter(q => q.aiFeedback.correct === true).length / objective.length) * 100) : null;
  const openEndedAvg = openEnded.length ? Math.round(openEnded.reduce((s, q) => s + q.aiFeedback.score, 0) / openEnded.length) : null;

  const rows = [
    objective.length ? { label: "Objective (MCQ / aptitude)", sub: `${objective.length} question${objective.length === 1 ? "" : "s"}`, value: objectiveAccuracy, unit: "% correct" } : null,
    openEnded.length ? { label: "Open-ended", sub: `${openEnded.length} question${openEnded.length === 1 ? "" : "s"}`, value: openEndedAvg, unit: "/100 avg" } : null,
  ].filter(Boolean);

  let read = null;
  if (objectiveAccuracy != null && openEndedAvg != null) {
    const gap = objectiveAccuracy - openEndedAvg;
    if (gap >= 15) read = "Knowledge checks out, but open-ended answers are giving up points — that's a structuring and clarity gap, not a knowledge gap.";
    else if (gap <= -15) read = "Open-ended answers are outscoring objective accuracy — worth revisiting the underlying facts, not just how you explain them.";
    else read = "Both formats are landing at a similar level — no single format is dragging this session down.";
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map(r => {
          const col = scoreColor(r.value);
          return (
            <div key={r.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{r.label}</div>
                  <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{r.sub}</div>
                </div>
                <span style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: col }}>{r.value}{r.unit}</span>
              </div>
              <div style={S.dimTrack}>
                <div style={{ ...S.dimFill, width: `${r.value}%`, background: col }} />
              </div>
            </div>
          );
        })}
      </div>
      {read && <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{read}</div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TOPIC BREAKDOWN — now takes an explicit status so "not evaluated yet" and
// "evaluated but no topic field from the backend" render different, honest
// copy instead of both falling through to the same generic message.
// ═══════════════════════════════════════════════════════════════════════════
const TopicBreakdown = ({ topicAverages, status, onTopicClick }) => {
  const sorted = [...topicAverages].sort((a, b) => b.avg - a.avg);

  if (!sorted.length) {
    if (status === "no-eval") {
      return <p style={S.cardSub}>No questions have been scored yet, so topic breakdown isn't available for this session.</p>;
    }
    if (status === "no-topic-field") {
      return <p style={S.cardSub}>Questions were scored, but none came back with a topic label — topic breakdown needs that field from the interview data.</p>;
    }
    return <p style={S.cardSub}>Topic-level scoring not available for this session.</p>;
  }

  return (
    <div style={S.dimList}>
      {sorted.map(t => {
        const col = scoreColor(t.avg);
        return (
          <button key={t.topic} style={S.dimRow} className="res-dim-row" onClick={() => onTopicClick?.(t.topic)}>
            <div style={S.dimMeta}>
              <div style={S.dimLeft}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={S.dimName}>{t.topic}</span>
              </div>
              <span style={{ ...S.dimScore, color: col }}>{t.avg}</span>
            </div>
            <div style={S.dimTrack}>
              <div style={{ ...S.dimFill, width: `${t.avg}%`, background: col }} />
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// READOUT CARD — quick-glance summary, matches Dashboard's card conventions
// ═══════════════════════════════════════════════════════════════════════════
const Insight = ({ label, value, text, color, background }) => (
  <div style={{ padding: 14, borderRadius: 12, background, border: `1px solid ${color}30` }}>
    <div style={S.insightLabel}>{label}</div>
    <div style={{ ...S.insightVal, color: C.text }}>{value}</div>
    <div style={S.insightText}>{text}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION REVIEW — filters + list, dim-row styled cards
// ═══════════════════════════════════════════════════════════════════════════
const FeedbackBlock = ({ label, value, color, background }) => (
  <div style={{ padding: 13, borderRadius: 12, background, border: `1px solid ${color}25` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color, letterSpacing: "0.5px", marginBottom: 6, textTransform: "lowercase" }}>{label}</div>
    <div style={{ fontSize: 11.5, lineHeight: 1.65, color: C.text }}>{value || "No additional readout."}</div>
  </div>
);

const Pill = ({ children, color = C.blue500, background = C.blue50 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 9px", background, color, fontFamily: F.mono, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.4px", border: `1px solid ${color}30` }}>
    {children}
  </span>
);

const QuestionCard = ({ question, open, onToggle, onRetry, retrying }) => {
  const idx = question._index;
  const feedback = question.aiFeedback;
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  const isEval = Boolean(feedback && feedback.aiAvailable !== false && (typeof feedback.score === "number" || objective));
  const score = isEval && !objective ? feedback.score : null;
  const takeaway = useMemo(() => getTakeaway(question), [question]);
  const hasTime = Number(question.timeTaken) > 0;
  const canRetry = !objective && !question.skipped && question.userAnswer?.trim() && question.id;

  const badgeColor = question.skipped ? C.muted
    : objective ? (feedback?.correct === true ? C.green : feedback?.correct === false ? C.red : C.muted)
    : (isEval ? scoreColor(score) : C.muted);
  const badgeBg = question.skipped ? cardAlt
    : objective ? (feedback?.correct === true ? C.greenTint : feedback?.correct === false ? C.redTint : cardAlt)
    : (isEval ? scoreTint(score) : cardAlt);

  return (
    <div style={{ border: `1px solid ${open ? C.borderMd : C.border}`, borderRadius: 14, background: open ? cardAlt : C.card, overflow: "hidden", transition: "border-color 0.2s ease, background 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <button type="button" onClick={() => onToggle(idx)} aria-expanded={open}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14, padding: "14px 8px 14px 16px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}>
          <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}25` }}>
            {question.skipped
              ? <span style={{ fontSize: 15, fontWeight: 700 }}>—</span>
              : objective
                ? <span style={{ fontSize: 19, fontWeight: 900 }}>{feedback?.correct === true ? "✓" : feedback?.correct === false ? "✕" : "?"}</span>
                : isEval
                  ? <><span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{score}</span><span style={{ fontFamily: F.mono, fontSize: 7, opacity: 0.7, marginTop: 1 }}>/100</span></>
                  : <span style={{ fontSize: 13, fontWeight: 700 }}>—</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.faint }}>Q{idx + 1}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: C.sub }}>{question.topic}</span>
              {!question.hasTopicField && (
                <span title="No topic field in interview data" style={{ fontSize: 9, color: C.faint }}>(untagged)</span>
              )}
              {hasTime && <><span style={{ color: C.border }}>·</span><span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>{formatTime(question.timeTaken)}</span></>}
              {question.skipped && <Pill color={C.amber} background={C.amberTint}>skipped</Pill>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{question.text}</div>
            {takeaway.text && (
              <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, color: toneColor(takeaway.tone), overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{takeaway.text}</div>
            )}
          </div>
        </button>
        <button type="button" onClick={() => onToggle(idx)} aria-expanded={open} aria-label={open ? `Collapse Q${idx + 1}` : `Expand Q${idx + 1}`}
          style={{ flexShrink: 0, width: 44, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.faint }}>
          <span style={{ display: "inline-block", fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>▾</span>
        </button>
      </div>

      {!question.skipped && (
        <div style={{ height: 2.5, background: C.border }}>
          <div style={{ width: objective ? (feedback?.correct !== null ? "100%" : "0%") : `${score || 0}%`, height: "100%", background: badgeColor, opacity: 0.4, transition: "width 0.7s ease" }} />
        </div>
      )}

      <div style={{ maxHeight: open ? 1400 : 0, opacity: open ? 1 : 0, overflow: "hidden", transition: "max-height 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s ease" }}>
        <div style={{ padding: "8px 18px 20px" }}>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: C.text, fontWeight: 700, marginBottom: 14 }}>{question.text}</div>

          {question.userAnswer && !question.skipped && question.userAnswer !== "Skipped" && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: C.surfaceAlt || cardAlt, border: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", marginBottom: 6 }}>your answer</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: C.sub, whiteSpace: "pre-wrap" }}>{question.userAnswer}</div>
            </div>
          )}

          {question.skipped && (
            <div style={{ padding: "11px 14px", borderRadius: 12, background: C.amberTint, border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 11.5, lineHeight: 1.55, marginBottom: 12 }}>
              You skipped this question. Use this as a pacing signal rather than a failure.
            </div>
          )}

          {objective && isEval && (
            <div style={{ padding: "11px 14px", border: `1px solid ${C.border}`, borderRadius: 12, background: cardAlt, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>result</span>
              <strong style={{ color: badgeColor, fontSize: 13 }}>{feedback?.correct ? "Correct" : "Incorrect"}</strong>
            </div>
          )}

          {!objective && isEval && feedback && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FeedbackBlock label="what worked" value={feedback.good} color={C.green} background={C.greenTint} />
              <FeedbackBlock label="what was missing" value={feedback.missing} color={C.red} background={C.redTint} />
              <FeedbackBlock label="key idea" value={feedback.idealHint} color={C.blue500} background={C.blue50} />
              <FeedbackBlock label="next move" value={feedback.tip} color={C.amber} background={C.amberTint} />
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: "1 / -1", padding: 13, borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", marginBottom: 6 }}>better answer pattern</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: C.text }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {canRetry && onRetry && (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => onRetry(question.id)} disabled={retrying}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.borderMd}`, background: retrying ? cardAlt : C.card, color: retrying ? C.muted : C.blue500, fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.3px", cursor: retrying ? "not-allowed" : "pointer" }}>
                {retrying ? "Re-evaluating…" : "Retry AI evaluation"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const QuestionReview = ({ questions, sessionId, reviewRef }) => {
  const [expanded, setExpanded] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState(null);
  const [overrides, setOverrides] = useState([]);

  const normalizedQuestions = useMemo(() => {
    return questions.map(q => {
      const override = overrides.find(o => o.id === q.id);
      return override ? { ...q, score: override.score, aiFeedback: override.aiFeedback } : q;
    });
  }, [questions, overrides]);

  const strongCount = normalizedQuestions.filter(q => !q.skipped && q.score >= 80).length;
  const weakCount = normalizedQuestions.filter(q => !q.skipped && q.score < 60).length;
  const skippedCount = normalizedQuestions.filter(q => q.skipped).length;

  const filters = [
    { key: "all", label: `All · ${normalizedQuestions.length}` },
    { key: "strong", label: `Strong · ${strongCount}` },
    { key: "weak", label: `Needs work · ${weakCount}` },
    { key: "skipped", label: `Skipped · ${skippedCount}` },
  ];

  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedQuestions
      .map((q, i) => ({ ...q, _index: i }))
      .filter(q => {
        if (activeFilter === "strong" && (q.skipped || q.score < 80)) return false;
        if (activeFilter === "weak" && (q.skipped || q.score >= 60)) return false;
        if (activeFilter === "skipped" && !q.skipped) return false;
        if (needle) {
          const hay = `${q.text} ${q.topic} ${q.userAnswer}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
  }, [normalizedQuestions, activeFilter, search]);

  const toggleExpand = useCallback(index => setExpanded(prev => ({ ...prev, [index]: !prev[index] })), []);

  const handleRetry = useCallback(async questionId => {
    if (!sessionId || !questionId || retryingId) return;
    setRetryingId(questionId);
    try {
      const data = await retryQuestion(sessionId, questionId);
      const parsedFeedback = normalizeFeedback({ feedback: data?.feedback, score: data?.score });
      setOverrides(prev => [...prev.filter(q => q.id !== questionId), { id: questionId, score: clamp(Number(data?.score) || 0), aiFeedback: parsedFeedback }]);
    } catch (err) { console.error("Retry failed:", err); }
    finally { setRetryingId(null); }
  }, [sessionId, retryingId]);

  return (
    <div style={S.card} ref={reviewRef}>
      <div style={S.eyebrow}>Question-by-question review</div>
      <h2 style={S.cardH2}>Full breakdown</h2>
      <p style={S.cardSub}>Score, time, and a quick takeaway for every question — open any card for feedback, sample answer, and retry.</p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "18px 0 14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{
              border: `1px solid ${activeFilter === f.key ? C.blue500 : C.border}`,
              background: activeFilter === f.key ? C.blue500 : C.card,
              color: activeFilter === f.key ? "#fff" : C.sub,
              borderRadius: 999, padding: "7px 13px", fontFamily: F.body, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
            }}>{f.label}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions or answers…"
          style={{ width: 240, maxWidth: "100%", border: `1px solid ${C.border}`, background: cardAlt, borderRadius: 10, padding: "9px 13px", fontFamily: F.body, fontSize: 12, color: C.text, outline: "none" }} />
      </div>

      {!filteredQuestions.length && (
        <div style={{ border: `1px dashed ${C.borderMd}`, borderRadius: 12, padding: 32, textAlign: "center", color: C.muted, fontSize: 12 }}>
          No questions match the current filter.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {filteredQuestions.map(q => (
          <QuestionCard key={q._index} question={q} open={Boolean(expanded[q._index])} onToggle={toggleExpand} onRetry={handleRetry} retrying={retryingId === q.id} />
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STREAK / BADGES — small card, Dashboard chip style
// ═══════════════════════════════════════════════════════════════════════════
const StreakBadgesCard = ({ streak, newBadges }) => {
  if (!streak && (!newBadges || !newBadges.length)) return null;
  return (
    <div style={{ ...S.card, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        {streak && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.amberTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>◆</div>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text }}>{streak.current || 0} day streak</div>
              <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: 9, color: C.muted }}>consistency compounds</div>
            </div>
          </div>
        )}
        {newBadges && newBadges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {newBadges.map((badge, i) => {
              const label = typeof badge === "string" ? badge : badge?.label || "New badge";
              return <Pill key={`${label}-${i}`} color={C.blue600} background={C.blue50}>★ {label}</Pill>;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESULT PAGE
// ═══════════════════════════════════════════════════════════════════════════
const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result;

  const [copied, setCopied] = useState(false);
  const topicRef = useRef(null);

  useEffect(() => {
    if (!result) navigate("/");
  }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  const normalizedQuestions = useMemo(() => questions.map((q, i) => normalizeQuestion(q, i)), [questions]);

  const evaluatedQuestions = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number"), [normalizedQuestions]);
  const answeredQuestions = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped"), [normalizedQuestions]);
  const skippedQuestions = useMemo(() => normalizedQuestions.filter(q => q.skipped), [normalizedQuestions]);
  const strongAnswers = evaluatedQuestions.filter(q => q.aiFeedback.score >= 80).length;
  const weakAnswers = evaluatedQuestions.filter(q => q.aiFeedback.score < 60).length;

  const averageTime = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0) / answeredQuestions.length)
    : 0;

  // topicStatus distinguishes "nothing evaluated yet" from "evaluated, but the
  // backend never sent a topic field" — these used to collapse into the same
  // "—" and "not available" copy, hiding a real data-shape bug.
  const { topicAverages, topicStatus } = useMemo(() => {
    const map = {};
    let anyTaggedEvaluated = false;
    normalizedQuestions.forEach(q => {
      if (q.skipped || typeof q.aiFeedback?.score !== "number") return;
      if (q.hasTopicField) anyTaggedEvaluated = true;
      const topic = q.topic || "General";
      if (!map[topic]) map[topic] = { total: 0, count: 0 };
      map[topic].total += q.aiFeedback.score;
      map[topic].count += 1;
    });
    const averages = Object.entries(map).map(([topic, d]) => ({ topic, avg: Math.round(d.total / d.count) }));
    let status = "ok";
    if (evaluatedQuestions.length === 0) status = "no-eval";
    else if (!anyTaggedEvaluated) status = "no-topic-field";
    return { topicAverages: averages, topicStatus: status };
  }, [normalizedQuestions, evaluatedQuestions.length]);

  const strongestTopic = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const weakestTopic = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

  const nextStepText = useMemo(() => {
    if (skippedQuestions.length > 0 && weakAnswers === 0)
      return `You skipped ${skippedQuestions.length} question${skippedQuestions.length > 1 ? "s" : ""} — a full pass at your current pace would likely raise this score.`;
    if (weakestTopic && weakAnswers > 0)
      return `${weakAnswers} answer${weakAnswers > 1 ? "s" : ""} scored below 60, concentrated in ${weakestTopic.topic}. Start your next rep there.`;
    if (strongAnswers === evaluatedQuestions.length && evaluatedQuestions.length > 0)
      return "Every evaluated answer scored 80+. Raise the difficulty next time to keep the signal useful.";
    return "Review the answers below, then queue another session to build on this one.";
  }, [skippedQuestions.length, weakAnswers, weakestTopic, strongAnswers, evaluatedQuestions.length]);

  const handleCopy = useCallback(async () => {
    const lines = [
      `MockMate result: ${totalScore}/100 — ${getLabel(totalScore)}`,
      `${answeredQuestions.length}/${normalizedQuestions.length} answered`,
      `${strongAnswers} strong · ${weakAnswers} need work · ${skippedQuestions.length} skipped`,
      strongestTopic ? `Strongest: ${strongestTopic.topic} (${strongestTopic.avg}/100)` : "",
      weakestTopic ? `Focus area: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : "",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }, [totalScore, answeredQuestions.length, normalizedQuestions.length, strongAnswers, weakAnswers, skippedQuestions.length, strongestTopic, weakestTopic]);

  const handleTopicClick = useCallback(() => {
    topicRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const heroResult = {
    score: totalScore,
    sessionId,
    totalQuestions: normalizedQuestions.length,
    answeredQuestions: answeredQuestions.length,
    skippedQuestions: skippedQuestions.length,
    strongAnswers,
    weakAnswers,
    averageTime,
    topTopic: strongestTopic?.topic ?? null,
    trendDelta: result?.trendDelta ?? null,
    scoreHistory: result?.scoreHistory ?? [],
  };

  if (!result) return null;

  return (
    <div style={S.page} className="res-page">
      <GlobalStyles />
      <div style={S.container}>

        {/* Status strip */}
        <AnimatedSection delay={0}>
          <div style={S.strip}>
            <div style={S.stripL}>
              <span style={S.liveDot} />
              <span style={S.mono}>mockmate · post-interview debrief</span>
            </div>
            <div style={S.stripR} className="res-strip-r">
              {sessionId && <span style={S.mono}>session {sessionId}</span>}
              <span style={{ color: C.borderMd }}>·</span>
              <span style={S.mono}>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase()}</span>
            </div>
          </div>
        </AnimatedSection>

        {/* Hero */}
        <AnimatedSection delay={60}>
          <SectionErrorBoundary>
            <ResultHero result={heroResult} navigate={navigate} onCopy={handleCopy} copied={copied} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Stat rail */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <StatRail result={heroResult} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Next step banner */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <NextStepBanner nextStepText={nextStepText} weakestTopic={weakestTopic} navigate={navigate} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Readout + Distribution */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <section style={S.twoCol} className="res-two-col">
              <div style={S.card}>
                <div style={S.eyebrow}>Session at a glance</div>
                <h2 style={S.cardH2}>Your readout</h2>
                <p style={S.cardSub}>The fastest summary of what this session says about your current form.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
                  <Insight
                    label="strongest topic"
                    value={strongestTopic?.topic || (topicStatus === "no-eval" ? "Pending" : "No data")}
                    text={strongestTopic ? `${strongestTopic.avg}/100 avg` : topicStatus === "no-eval" ? "Awaiting evaluation" : "No topic field returned"}
                    color={C.green}
                    background={C.greenTint}
                  />
                  <Insight
                    label="next focus"
                    value={weakestTopic?.topic || (topicStatus === "no-eval" ? "Pending" : "No data")}
                    text={weakestTopic ? `${weakestTopic.avg}/100 avg` : topicStatus === "no-eval" ? "Awaiting evaluation" : "No topic field returned"}
                    color={C.amber}
                    background={C.amberTint}
                  />
                  <Insight
                    label="pace"
                    value={formatTime(averageTime)}
                    text={answeredQuestions.length ? "Avg time per question" : "No answered questions yet"}
                    color={C.blue500}
                    background={C.blue50}
                  />
                </div>
              </div>

              <div style={S.card} ref={topicRef}>
                <div style={S.eyebrow}>Topic performance</div>
                <h2 style={S.cardH2}>Where to drill next</h2>
                <p style={S.cardSub}>Sorted strongest first — the bottom of this list is your highest-ROI move.</p>
                <div style={{ marginTop: 16 }}>
                  <TopicBreakdown topicAverages={topicAverages} status={topicStatus} onTopicClick={handleTopicClick} />
                </div>
              </div>
            </section>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Score progression */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <div style={S.card}>
              <div style={S.eyebrow}>Score progression</div>
              <h2 style={S.cardH2}>Answer-by-answer curve</h2>
              <p style={S.cardSub}>How your score moved from question to question, and how much it varied.</p>
              <div style={{ marginTop: 16 }}>
                <ScoreProgression questions={normalizedQuestions} />
              </div>
            </div>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Pace vs score + Answer type breakdown */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <section style={S.twoCol} className="res-two-col">
              <div style={S.card}>
                <div style={S.eyebrow}>Pace vs. score</div>
                <h2 style={S.cardH2}>Is speed helping or hurting?</h2>
                <p style={S.cardSub}>Each dot is one question — time taken against the score it earned.</p>
                <div style={{ marginTop: 16 }}>
                  <PaceVsScore questions={normalizedQuestions} />
                </div>
              </div>

              <div style={S.card}>
                <div style={S.eyebrow}>Answer type</div>
                <h2 style={S.cardH2}>Knowledge vs. communication</h2>
                <p style={S.cardSub}>Objective accuracy and open-ended scoring point to different fixes.</p>
                <div style={{ marginTop: 16 }}>
                  <AnswerTypeBreakdown questions={normalizedQuestions} />
                </div>
              </div>
            </section>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Streak / badges */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <StreakBadgesCard streak={streak} newBadges={newBadges} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Question-by-question review */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <QuestionReview questions={normalizedQuestions} sessionId={sessionId} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* ScoreCard (Mission Report component) */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <div style={S.card}>
              <div style={S.eyebrow}>Mission report</div>
              <ScoreCard totalScore={totalScore} questions={normalizedQuestions} />
            </div>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Footer */}
        <AnimatedSection delay={0}>
          <footer style={S.footerRow}>
            <span style={S.mono}>mockmate result page · v10</span>
            <span style={S.mono}>scores normalized 0–100 · computed post-session</span>
          </footer>
        </AnimatedSection>

      </div>
    </div>
  );
};

// ─── Global styles — same conventions as Dashboard/Coach ───────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes livePulse      { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes heroSweep      { 0% { transform:translateX(-30%); } 100% { transform:translateX(130%); } }
    @keyframes scaleIn        { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
    @keyframes heroLineDrift  { 0% { transform:translateX(-100%) skewX(-18deg); } 100% { transform:translateX(280%) skewX(-18deg); } }
    @keyframes heroLineDrift2 { 0% { transform:translateX(-100%) skewX(-18deg); } 100% { transform:translateX(280%) skewX(-18deg); } }

    *, *::before, *::after { box-sizing: border-box; }

    .res-page button:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 3px; border-radius: 6px; }

    .res-rail-cell { transition: background 0.18s ease !important; }
    .res-rail-cell:hover { background: ${cardAlt} !important; }

    .res-dim-row {
      width: 100%; text-align: left; border: none; cursor: pointer;
      transition: background 0.16s ease, border-color 0.16s ease !important;
    }
    .res-dim-row:hover { background: ${C.blue50} !important; }

    .res-btn-primary { transition: transform 0.15s cubic-bezier(.16,1,.3,1), box-shadow 0.15s ease !important; }
    .res-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 26px rgba(0,0,0,0.28) !important; }

    .res-btn-ghost { transition: background 0.15s ease, transform 0.15s ease !important; }
    .res-btn-ghost:hover { background: rgba(255,255,255,0.14) !important; transform: translateY(-1px) !important; }

    .res-btn-gradient { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .res-btn-gradient:hover { box-shadow: 0 10px 24px rgba(26,110,255,0.32) !important; transform: translateY(-2px) !important; }

    .res-hero-num { animation: scaleIn 0.6s cubic-bezier(.16,1,.3,1) both 0.1s; }

    @media (prefers-reduced-motion: reduce) {
      .res-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1020px) {
      .res-two-col { grid-template-columns: 1fr !important; }
      .res-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
      .res-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 760px) {
      .res-banner { flex-direction: column !important; align-items: flex-start !important; }
      .res-strip-r { display: none !important; }
    }
    @media (max-width: 480px) {
      .res-stat-rail { grid-template-columns: 1fr !important; }
      .res-page { padding: 14px 12px 60px !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — same tokens and structure as Dashboard.jsx
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(26,110,255,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,200,240,0.04) 0%, transparent 40%)`,
    padding: "24px 28px 80px",
    fontFamily: F.body,
  },
  container: { maxWidth: 1200, margin: "0 auto" },

  strip: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", marginBottom: 20, borderRadius: 11, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripL: { display: "flex", alignItems: "center", gap: 9 },
  stripR: { display: "flex", alignItems: "center", gap: 10 },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "livePulse 2.4s ease-in-out infinite" },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.3px", color: C.muted },

  hero: {
    position: "relative", overflow: "hidden",
    padding: "40px 36px", marginBottom: 20, borderRadius: 22,
    background: "linear-gradient(120deg, #0C1F4A 0%, #1246B5 38%, #1A6BF0 62%, #00BCD4 100%)",
    boxShadow: "0 28px 70px rgba(10,30,100,0.38)",
  },
  // heroNoise now renders three layered moving lines instead of the single sweep.
  // Each absolute div is a thin diagonal stripe; staggered delays give the
  // impression of parallel lines floating through the gradient at different speeds.
  heroNoise: { position: "absolute", top: "-20%", left: 0, width: "18%", height: "140%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)", animation: "heroLineDrift 9s linear infinite", borderRadius: 2 },
  heroGrid: { position: "relative", display: "grid", gridTemplateColumns: "260px 1fr", gap: 44, alignItems: "center" },

  heroLabel: { fontFamily: F.mono, fontSize: 10, fontWeight: 500, letterSpacing: "1px", color: "rgba(255,255,255,0.42)", marginBottom: 12 },
  heroNum: { fontFamily: F.display, fontSize: 76, fontWeight: 900, lineHeight: 0.95, color: "#fff", letterSpacing: "-3px" },
  heroMax: { fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.36)", letterSpacing: 0, fontFamily: F.body },
  tierPill: { display: "inline-flex", alignItems: "center", marginTop: 16, padding: "6px 13px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1px" },
  heroBar: { position: "relative", height: 4, marginTop: 18, borderRadius: 999, background: "rgba(255,255,255,0.1)" },
  heroBarFill: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #5B9EFF, #00E5FF)", transition: "width 1.3s cubic-bezier(.16,1,.3,1)" },
  heroTrendText: { marginTop: 10, fontFamily: F.mono, fontSize: 10.5, color: "rgba(255,255,255,0.5)", letterSpacing: "0.2px" },

  heroKicker: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: "1.8px", color: C.cyan400, textTransform: "uppercase" },
  heroH1: { margin: "14px 0 0", fontFamily: F.display, fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1.24, letterSpacing: "-0.7px", maxWidth: 560 },
  heroSub: { margin: "14px 0 0", fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,0.62)", maxWidth: 520, fontWeight: 400 },
  heroChipRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 },
  heroChip: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.2px", color: "rgba(255,255,255,0.78)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "5px 11px" },
  heroActions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 },

  statRail: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20, borderRadius: 18, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" },
  railCell: { padding: "20px 24px", borderRight: `1px solid ${C.border}` },
  railLabel: { fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.1px" },
  railValRow: { display: "flex", alignItems: "baseline", gap: 4, marginTop: 10 },
  railVal: { fontFamily: F.display, fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.8px" },
  railUnit: { fontFamily: F.mono, fontSize: 12, color: C.muted },
  railSub: { marginTop: 8, fontSize: 11, color: C.muted, lineHeight: 1.5 },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 26, boxShadow: C.shadow, marginBottom: 18 },
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", color: C.blue500, marginBottom: 7, textTransform: "lowercase" },
  cardH2: { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.3px" },
  cardSub: { margin: "7px 0 0", fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 480 },

  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 },

  insightLabel: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, letterSpacing: "0.5px", marginBottom: 8, color: C.sub, textTransform: "lowercase" },
  insightVal: { fontFamily: F.display, fontSize: 17, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  insightText: { marginTop: 4, fontSize: 11, color: C.sub, lineHeight: 1.4 },

  dimList: { display: "flex", flexDirection: "column", gap: 10 },
  dimRow: { padding: "13px 15px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` },
  dimMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  dimLeft: { display: "flex", alignItems: "center", gap: 10 },
  dimName: { fontSize: 12.5, fontWeight: 700, color: C.text },
  dimScore: { fontFamily: F.display, fontSize: 17, fontWeight: 800 },
  dimTrack: { height: 5, borderRadius: 999, background: C.border, overflow: "hidden" },
  dimFill: { height: "100%", borderRadius: 999, transition: "width 1s cubic-bezier(.16,1,.3,1)" },
  consistencyPill: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.2px", borderRadius: 999, padding: "5px 11px", whiteSpace: "nowrap" },

  tierBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "28px 32px", marginBottom: 18, borderRadius: 20, background: `linear-gradient(135deg, ${C.blue50} 0%, #E3FAFF 100%)`, border: `1px solid ${C.borderMd}`, boxShadow: C.shadow },
  bannerH2: { margin: "9px 0", fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" },
  bannerSub: { margin: 0, fontSize: 12.5, color: C.sub, maxWidth: 520, lineHeight: 1.6 },

  btnPrimary: { border: "none", borderRadius: 11, background: "#fff", color: C.text, padding: "11px 20px", fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" },
  btnGhost: { border: "1px solid rgba(255,255,255,0.18)", borderRadius: 11, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.82)", padding: "11px 20px", fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: "pointer" },
  btnGradient: { border: "none", borderRadius: 11, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "12px 22px", fontSize: 13, fontWeight: 800, fontFamily: F.body, cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 16px rgba(26,110,255,0.28)" },

  footerRow: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, padding: "20px 4px 0", opacity: 0.42 },
};

export default Result;
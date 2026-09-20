import { useState, useEffect, useMemo, useCallback, useRef, Component } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import { ResultHeroV2 } from "./ResultHeroV2";
import ScoreCard from "../components/ScoreCard";
import { C, F } from "../styles/token";
import { useSequentialReveal, revealStyle, useGradeColorMoment } from '../utils/resultHelpers';
import ScoreSummary  from "../components/result/ScoreSummary";
import FeedbackList  from "../components/result/FeedbackList";
import ResultActions from "../components/result/ResultActions";

// ─── Pure helpers ────────────────────────────────────────────────────────────

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const scoreColor = (s) => {
  const n = clamp(s);
  if (n >= 80) return C.green;
  if (n >= 60) return C.blue500;
  if (n >= 40) return C.amber;
  return C.red;
};

const GRADE_MAP = [
  { min: 90, grade: "S", glyph: "◆", desc: "Elite",          accent: C.violet, tint: C.violetTint, glow: C.violet },
  { min: 80, grade: "A", glyph: "▲", desc: "Strong",         accent: C.green,  tint: C.greenTint,  glow: C.green  },
  { min: 70, grade: "B", glyph: "●", desc: "Solid",          accent: C.blue500,tint: C.blue50,     glow: C.blue500},
  { min: 60, grade: "C", glyph: "■", desc: "Developing",     accent: C.amber,  tint: C.amberTint,  glow: C.amber  },
  { min:  0, grade: "D", glyph: "▼", desc: "Needs Practice", accent: C.red,    tint: C.redTint,    glow: C.red    },
];
const getGrade  = (s) => GRADE_MAP.find(g => s >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];
const getLabel  = (s) => getGrade(s).desc;

const getVerdict = (s) => {
  if (s >= 80) return { headline: "You are building reliable interview form.", body: "Fundamentals are landing well. The fastest gains now come from tightening weak spots, not adding new topics." };
  if (s >= 60) return { headline: "The foundation is there — sharpen the edges.", body: "Enough signal here to improve fast. Focus on the questions where depth or clarity dropped." };
  return { headline: "This session exposed useful gaps.", body: "Treat this as a diagnostic. Your weakest answers are the roadmap for the next rep." };
};

const formatTime = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};


const normalizeFeedback = (question) => {
  if (!question) return null;
  const raw = question.feedback;
  const isObjective = ["mcq", "aptitude"].includes(question.questionType);
  if (isObjective) {
    const correct = typeof question.userAnswerIndex === "number" && typeof question.correctAnswerIndex === "number"
      ? question.userAnswerIndex === question.correctAnswerIndex
      : raw === "Correct answer." ? true : raw === "Incorrect answer." ? false : null;
    return { score: typeof question.score === "number" ? question.score : correct ? 100 : 0, correct, good: "", missing: "", idealHint: "", tip: "", sampleAnswer: "", aiAvailable: true, fallback: false };
  }
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      score:        typeof question.score === "number" ? question.score : Number(question.score || 0),
      correct:      question.correct ?? parsed.correct ?? null,
      good:         parsed.good || "",
      missing:      parsed.missing || "",
      idealHint:    parsed.idealHint || "",
      tip:          parsed.tip || "",
      sampleAnswer: parsed.sampleAnswer || "",
      aiAvailable:  parsed.aiAvailable !== false,
      fallback:     parsed.fallback === true,
    };
  } catch { return null; }
};

const normalizeQuestion = (question, index) => {
  const aiFeedback = normalizeFeedback(question);
  const scoreValue = typeof question?.score === "number" ? question.score : Number(question?.score || 0);
  const hasTopicField = typeof question?.topic === "string" && question.topic.trim().length > 0;
  return {
    ...question,
    index,
    text:         question?.text || question?.question || `Question ${index + 1}`,
    topic:        hasTopicField ? question.topic.trim() : "General",
    hasTopicField,
    questionType: question?.questionType || "open",
    userAnswer:   question?.userAnswer || "",
    skipped:      Boolean(question?.skipped),
    score:        clamp(scoreValue),
    aiFeedback,
  };
};

const cardAlt = C.cardAlt;

// ─── Shared compact card style ───────────────────────────────────────────────

const CS = {
  card:    { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow, marginBottom: 12 },
  eyebrow: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.8px", color: C.blue500, marginBottom: 5, textTransform: "lowercase" },
  cardH2:  { margin: 0, fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.3px" },
  cardSub: { margin: "5px 0 0", fontSize: 11.5, lineHeight: 1.6, color: C.sub, maxWidth: 480 },
  emptyState: { padding: "16px 0", fontSize: 11.5, color: C.muted, textAlign: "center" },
};

export const GradeFlashOverlay = ({ score }) => {
  const { momentActive, grade } = useGradeColorMoment(score);
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: `radial-gradient(ellipse at 50% 40%, ${grade.glow}45 0%, transparent 68%)`, opacity: momentActive ? 1 : 0, transition: "opacity 1.1s cubic-bezier(.4,0,.2,1)", pointerEvents: "none", zIndex: 1 }} />
  );
};
GradeFlashOverlay.propTypes = { score: PropTypes.number.isRequired };

export const GradeBadgeDrop = ({ score, visible }) => {
  const grade = getGrade(clamp(score));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 8, ...revealStyle.dropIn(visible) }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 12, background: `${grade.accent}18`, border: `1.5px solid ${grade.accent}55`, boxShadow: `0 0 20px ${grade.glow}30` }}>
        <span style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: grade.accent, lineHeight: 1, textShadow: `0 0 12px ${grade.glow}80` }}>{grade.grade}</span>
        <div style={{ width: 1, height: 16, background: `${grade.accent}30` }} />
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: grade.accent, letterSpacing: "0.4px" }}>
          {grade.grade === "S" ? "Elite form" : grade.grade === "A" ? "Strong" : grade.grade === "B" ? "Solid" : grade.grade === "C" ? "Developing" : "Needs practice"}
        </span>
      </div>
    </div>
  );
};
GradeBadgeDrop.propTypes = { score: PropTypes.number.isRequired, visible: PropTypes.bool.isRequired };

export const MiniStatItem = ({ value, label, color, index, visible }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "0 18px", ...revealStyle.slideUp(visible, index) }}>
    <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, lineHeight: 1, color }}>{value}</span>
    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3px" }}>{label}</span>
  </div>
);
MiniStatItem.propTypes = { value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, label: PropTypes.string.isRequired, color: PropTypes.string.isRequired, index: PropTypes.number.isRequired, visible: PropTypes.bool.isRequired };

// ─── CrossSignalInsight ──────────────────────────────────────────────────────

const detectCrossSignal = (questions) => {
  const scored = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number").map(q => ({ index: typeof q.index === "number" ? q.index : 0, score: clamp(q.aiFeedback.score), time: Number(q.timeTaken || 0), topic: q.topic || "General", skipped: false })).sort((a, b) => a.index - b.index);
  const skipped = questions.filter(q => q.skipped);
  if (scored.length < 3) return null;
  const avg = scored.reduce((s, q) => s + q.score, 0) / scored.length;
  const timed = scored.filter(q => q.time > 0);

  if (timed.length >= 4) {
    const sortedByTime = [...timed].sort((a, b) => a.time - b.time);
    const fastHalf = sortedByTime.slice(0, Math.floor(timed.length / 2));
    const slowHalf = sortedByTime.slice(Math.floor(timed.length / 2));
    const fastAvg  = fastHalf.reduce((s, q) => s + q.score, 0) / fastHalf.length;
    const slowAvg  = slowHalf.reduce((s, q) => s + q.score, 0) / slowHalf.length;
    if (slowAvg - fastAvg >= 14) {
      const gap = Math.round(slowAvg - fastAvg);
      const rushQs = fastHalf.filter(q => q.score < 60);
      const topicCounts = {};
      rushQs.forEach(q => { topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1; });
      const topRushTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return { pattern: "RUSHING", priority: 1, sentence: topRushTopic ? `Your fastest answers on ${topRushTopic} scored ${gap} pts lower than your slower ones — you're rushing past the questions that need depth most.` : `Your fastest answers scored ${gap} pts lower than your slower ones. Speed is costing you here, not helping.`, accent: C.amber, icon: "⚡" };
    }
    const fastAvg2 = fastHalf.reduce((s, q) => s + q.score, 0) / fastHalf.length;
    const slowAvg2 = slowHalf.reduce((s, q) => s + q.score, 0) / slowHalf.length;
    if (fastAvg2 - slowAvg2 >= 14) {
      const gap = Math.round(fastAvg2 - slowAvg2);
      return { pattern: "DEPTH_SPEED_TRADEOFF", priority: 2, sentence: `Taking more time didn't help — your quicker answers scored ${gap} pts higher on average. Trust your first instinct more.`, accent: C.blue500, icon: "⏱" };
    }
  }

  const topicProgression = {};
  scored.forEach(q => { if (!topicProgression[q.topic]) topicProgression[q.topic] = []; topicProgression[q.topic].push(q); });
  for (const [topic, qs] of Object.entries(topicProgression)) {
    if (qs.length < 2) continue;
    const firstScore = qs[0].score, lastScore = qs[qs.length - 1].score;
    if (firstScore >= 70 && lastScore < 55) {
      const drop = Math.round(firstScore - lastScore);
      return { pattern: "TOPIC_COLLAPSE", priority: 3, sentence: `You opened ${topic} at ${firstScore} and dropped ${drop} pts by the end of it — initial knowledge is there, but depth ran out under follow-up.`, accent: C.amber, icon: "📉" };
    }
  }

  const mid = Math.floor(scored.length / 2);
  const firstHalf  = scored.slice(0, mid), secondHalf = scored.slice(mid);
  const firstAvg   = firstHalf.reduce((s, q) => s + q.score, 0) / firstHalf.length;
  const secondAvg  = secondHalf.reduce((s, q) => s + q.score, 0) / secondHalf.length;
  if (firstAvg - secondAvg >= 16) { const drop = Math.round(firstAvg - secondAvg); return { pattern: "FRONT_LOAD", priority: 4, sentence: `You started ${Math.round(firstAvg)} and finished ${Math.round(secondAvg)} — a ${drop}-pt drop across the session. Stamina or topic order, not ability.`, accent: C.amber, icon: "📊" }; }
  if (secondAvg - firstAvg >= 16) { const gain = Math.round(secondAvg - firstAvg); return { pattern: "BACK_LOAD", priority: 5, sentence: `You warmed up as the session went on — second half averaged ${gain} pts higher than the first. In a real interview, front-load your best.`, accent: C.green, icon: "📈" }; }

  if (scored.length >= 4) {
    const variance = scored.reduce((s, q) => s + (q.score - avg) ** 2, 0) / scored.length;
    const stdDev   = Math.sqrt(variance);
    const peak = Math.max(...scored.map(q => q.score)), floor = Math.min(...scored.map(q => q.score));
    if (stdDev >= 20 && avg >= 60) return { pattern: "CONSISTENCY_TRAP", priority: 6, sentence: `Your average looks fine at ${Math.round(avg)}, but you ranged from ${floor} to ${peak} — that's a ${peak - floor}-pt swing. Interviewers notice inconsistency more than the mean.`, accent: C.amber, icon: "〰" };
  }

  if (skipped.length >= 2) {
    const skipTopics = {};
    skipped.forEach(q => { const t = q.topic || "General"; skipTopics[t] = (skipTopics[t] || 0) + 1; });
    const [topSkipTopic, topSkipCount] = Object.entries(skipTopics).sort((a, b) => b[1] - a[1])[0] || [];
    if (topSkipTopic && topSkipCount >= 2) return { pattern: "SKIP_CLUSTER", priority: 7, sentence: `${topSkipCount} skips on ${topSkipTopic} — that's avoidance, not bad luck. That topic deserves a dedicated session before the next general rep.`, accent: C.red, icon: "⏭" };
  }

  let biggestJump = 0, jumpFrom = null, jumpTo = null;
  for (let i = 1; i < scored.length; i++) {
    const delta = scored[i].score - scored[i - 1].score;
    if (delta > biggestJump) { biggestJump = delta; jumpFrom = scored[i - 1]; jumpTo = scored[i]; }
  }
  if (biggestJump >= 25 && jumpFrom && jumpTo) return { pattern: "RECOVERY_STRENGTH", priority: 8, sentence: `After dropping to ${jumpFrom.score} on Q${jumpFrom.index + 1}, you came back ${biggestJump} pts on Q${jumpTo.index + 1}. That kind of reset under pressure is a real interview skill.`, accent: C.green, icon: "◆" };
  if (avg >= 80) return { pattern: "CLEAN_HIGH", priority: 9, sentence: `No weak patterns detected — consistent, strong, complete. The next step is harder questions, not more of the same difficulty.`, accent: C.green, icon: "◆" };
  return null;
};

export const CrossSignalInsight = ({ questions }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const signal = useMemo(() => detectCrossSignal(questions), [questions]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !signal) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [signal]);
  if (!signal) return null;
  return (
    <div ref={ref} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transition: "opacity 0.6s cubic-bezier(.16,1,.3,1), transform 0.6s cubic-bezier(.16,1,.3,1)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "4px 1fr" }}>
        <div style={{ background: signal.accent }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: `${signal.accent}09`, border: `1px solid ${signal.accent}25`, borderLeft: "none", borderRadius: "0 10px 10px 0" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${signal.accent}15`, border: `1px solid ${signal.accent}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{signal.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: signal.accent, letterSpacing: "0.8px", marginBottom: 4, opacity: 0.75 }}>{signal.pattern.replace(/_/g, " ").toLowerCase()} · session pattern</div>
            <p style={{ margin: 0, fontFamily: F.display, fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.45, letterSpacing: "-0.2px" }}>{signal.sentence}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
CrossSignalInsight.propTypes = { questions: PropTypes.array.isRequired };

// ─── CognitiveLoadHeatmap ────────────────────────────────────────────────────

const LOAD_TINTS = {
  green:  { bg: "rgba(34,197,94,0.08)",  fill: "rgba(34,197,94,0.72)"  },
  blue:   { bg: "rgba(59,130,246,0.08)", fill: "rgba(59,130,246,0.72)" },
  amber:  { bg: "rgba(245,158,11,0.09)", fill: "rgba(245,158,11,0.76)" },
  red:    { bg: "rgba(239,68,68,0.09)",  fill: "rgba(239,68,68,0.76)"  },
  muted:  { bg: "rgba(148,163,184,0.06)",fill: "rgba(148,163,184,0.4)" },
};
const loadTier = (score) => score >= 80 ? "green" : score >= 60 ? "blue" : score >= 40 ? "amber" : "red";
const isOverloaded = (timeTaken, medianTime, score) => timeTaken > medianTime && score < 60;
const isPeakLoad   = (timeTaken, maxTime, score)    => timeTaken >= maxTime * 0.85 && score < 60;

export const CognitiveLoadHeatmap = ({ questions }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);

    useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

      const cells = useMemo(() => questions.map((q, i) => {
    const score = clamp(typeof q.aiFeedback?.score === "number" ? q.aiFeedback.score : typeof q.score === "number" ? q.score : 0);
    const time = Math.max(0, Number(q.timeTaken || 0));
    const hasScore = !q.skipped && (typeof q.aiFeedback?.score === "number" || typeof q.score === "number");
    return { index: i, score, time, skipped: q.skipped, hasScore, topic: q.topic || "General", text: q.text || `Q${i + 1}` };
  }), [questions]);

  const timedCells = cells.filter(c => !c.skipped && c.time > 0);
  const times = timedCells.map(c => c.time);
  const sortedTimes = [...times].sort((a, b) => a - b);
  const midIdx = Math.floor(sortedTimes.length / 2);
  const medianTime = sortedTimes.length % 2 ? sortedTimes[midIdx] : ((sortedTimes[midIdx - 1] || 0) + (sortedTimes[midIdx] || 0)) / 2;
  const maxTime = Math.max(...times, 1);
  const minTime = Math.min(...times.filter(t => t > 0), 1);
  const normTime = (t) => { if (t <= 0) return 0; if (maxTime === minTime) return 0.6; return 0.18 + ((t - minTime) / (maxTime - minTime)) * 0.82; };

    const insight = useMemo(() => {
    const timedCount = cells.filter(c => !c.skipped && c.time > 0).length;
    const overloaded = cells.filter(c => !c.skipped && c.time > 0 && isOverloaded(c.time, medianTime, c.score));
    if (overloaded.length === 0 && timedCount === 0) return { text: "No timed answers recorded this session.", accent: C.muted };
    if (overloaded.length === 0) return { text: "No overload signals — you stayed composed across all questions.", accent: C.green };
    const topicMap = {};
    overloaded.forEach(c => { topicMap[c.topic] = (topicMap[c.topic] || 0) + 1; });
    const topTopic = Object.entries(topicMap).sort((a, b) => b[1] - a[1])[0];
    const qLabels = overloaded.map(c => `Q${c.index + 1}`).join(", ");
    if (overloaded.length === 1) { const c = overloaded[0]; return { text: `Q${c.index + 1} showed a load spike — ${formatTime(c.time)} and a score of ${c.score}.`, accent: C.amber }; }
    return { text: `${qLabels} triggered overload signals${topTopic ? ` — ${topTopic[0]} is the common thread` : ""}. That's the drill list.`, accent: C.amber };
  }, [cells, medianTime]);

  const hoveredCell = hoveredIdx !== null ? cells[hoveredIdx] : null;
  const overloadFlag = hoveredCell && !hoveredCell.skipped && hoveredCell.time > 0 ? isOverloaded(hoveredCell.time, medianTime, hoveredCell.score) : false;
  const peakFlag = hoveredCell && !hoveredCell.skipped && hoveredCell.time > 0 ? isPeakLoad(hoveredCell.time, maxTime, hoveredCell.score) : false;

  const CELL_W = 38, CELL_H = 60, CELL_GAP = 5, STRIP_PADDING = 16;

  const handleMouseMove = (e, idx) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredIdx(idx);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 11, color: C.sub, flex: 1 }}>
          <strong style={{ color: C.text }}>Height</strong> = time taken · <strong style={{ color: C.text }}>Color</strong> = score · Tall + red = overload
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {[{ label: "strong", color: C.green }, { label: "solid", color: C.blue500 }, { label: "shaky", color: C.amber }, { label: "gap", color: C.red }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: l.color, opacity: 0.75 }} />
              <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={containerRef} style={{ position: "relative", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: CELL_GAP, padding: `${STRIP_PADDING}px`, minWidth: cells.length * (CELL_W + CELL_GAP), alignItems: "flex-end", position: "relative" }}>
          {timedCells.length > 1 && (
            <div style={{ position: "absolute", left: STRIP_PADDING, right: STRIP_PADDING, bottom: STRIP_PADDING + CELL_H * (1 - normTime(medianTime)), height: 1, borderTop: `1px dashed ${C.borderMd}`, pointerEvents: "none", zIndex: 0 }}>
              <span style={{ position: "absolute", right: 0, top: -13, fontFamily: F.mono, fontSize: 8, color: C.faint, whiteSpace: "nowrap" }}>median · {formatTime(medianTime)}</span>
            </div>
          )}
          {cells.map((cell, i) => {
            const tier = cell.skipped ? "muted" : (cell.hasScore ? loadTier(cell.score) : "muted");
            const tint = LOAD_TINTS[tier];
            const fillH = cell.skipped ? 0 : cell.time > 0 ? normTime(cell.time) : (cell.hasScore ? 0.22 : 0);
            const isHov = hoveredIdx === i;
            const overload = !cell.skipped && cell.time > 0 && isOverloaded(cell.time, medianTime, cell.score);
            const peak = !cell.skipped && isPeakLoad(cell.time, maxTime, cell.score);
            const tierColor = tier === "green" ? C.green : tier === "blue" ? C.blue500 : tier === "amber" ? C.amber : tier === "red" ? C.red : C.muted;
            return (
              <div key={i} style={{ position: "relative", flexShrink: 0, zIndex: isHov ? 10 : 1 }} onMouseMove={(e) => handleMouseMove(e, i)} onMouseLeave={() => setHoveredIdx(null)}>
                {overload && <div style={{ position: "absolute", inset: -2, borderRadius: 9, border: `1.5px solid ${C.amber}60`, pointerEvents: "none", zIndex: 2 }} />}
                {peak && <div style={{ position: "absolute", inset: -3, borderRadius: 10, border: `2px solid ${C.red}70`, pointerEvents: "none", zIndex: 3 }} />}
                <div style={{ width: CELL_W, height: CELL_H, borderRadius: 7, background: cell.skipped ? "transparent" : tint.bg, border: cell.skipped ? `1.5px dashed ${C.borderMd}` : `1px solid ${isHov ? tierColor + "60" : "transparent"}`, position: "relative", overflow: "hidden", transition: "transform 0.14s ease", transform: isHov ? "scaleY(1.04) translateY(-2px)" : "none", cursor: "default" }}>
                  {!cell.skipped && fillH > 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${fillH * 100}%`, background: tint.fill, borderRadius: "0 0 6px 6px", transition: "height 0.9s cubic-bezier(.16,1,.3,1)" }} />}
                  {cell.hasScore && !cell.skipped && <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", fontFamily: F.display, fontSize: 10, fontWeight: 900, color: isHov ? "#fff" : tierColor, lineHeight: 1, zIndex: 2 }}>{cell.score}</div>}
                  {cell.skipped && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: F.mono, fontSize: 10, color: C.faint }}>—</span></div>}
                </div>
                <div style={{ textAlign: "center", fontFamily: F.mono, fontSize: 8, color: isHov ? tierColor : C.faint, marginTop: 4, fontWeight: isHov ? 700 : 400 }}>Q{i + 1}</div>
              </div>
            );
          })}
        </div>
        {hoveredCell && (
                      <div style={{ position: "absolute", top: Math.max(4, tooltipPos.y - 100), left: Math.min(tooltipPos.x - 70, containerWidth ? containerWidth - 180 : 0), zIndex: 20, background: C.card, border: `1px solid ${C.borderMd}`, borderRadius: 10, padding: "10px 12px", boxShadow: "0 6px 22px rgba(0,0,0,0.18)", pointerEvents: "none", minWidth: 155 }}>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginBottom: 6 }}>Q{hoveredCell.index + 1} · {hoveredCell.topic}</div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              {hoveredCell.hasScore && !hoveredCell.skipped && <div><div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: scoreColor(hoveredCell.score), lineHeight: 1 }}>{hoveredCell.score}</div><div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.muted, marginTop: 1 }}>/100</div></div>}
              {hoveredCell.time > 0 && !hoveredCell.skipped && <div><div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.blue500, lineHeight: 1 }}>{formatTime(hoveredCell.time)}</div><div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.muted, marginTop: 1 }}>time</div></div>}
              {hoveredCell.skipped && <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>skipped</div>}
            </div>
            {overloadFlag && !peakFlag && <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 4, padding: "4px 7px", borderRadius: 6, background: C.amberTint, border: `1px solid ${C.amber}35` }}><span style={{ fontSize: 9 }}>⚡</span><span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.amber, fontWeight: 700 }}>load spike</span></div>}
            {peakFlag && <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 4, padding: "4px 7px", borderRadius: 6, background: C.redTint, border: `1px solid ${C.red}35` }}><span style={{ fontSize: 9 }}>🔴</span><span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.red, fontWeight: 700 }}>peak overload</span></div>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 9, background: `${insight.accent}10`, border: `1px solid ${insight.accent}25`, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ width: 4, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: insight.accent, opacity: 0.6 }} />
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{insight.text}</p>
      </div>
    </div>
  );
};
CognitiveLoadHeatmap.propTypes = { questions: PropTypes.array.isRequired };

// ─── QuestionDifficultyCalibration ──────────────────────────────────────────

const QUADRANTS = [
  { id: "hard-pass", label: "Real strength",  sub: "Hard · got it right",  desc: "You spent the time and delivered.",           icon: "◆", color: C.green,  tint: C.greenTint,  pred: (isHard, isPassed) => isHard && isPassed },
  { id: "easy-pass", label: "Baseline",        sub: "Quick · got it right",  desc: "Comfortable territory — good floor.",          icon: "●", color: C.blue500,tint: C.blue50,     pred: (isHard, isPassed) => !isHard && isPassed },
  { id: "hard-fail", label: "Stretch zone",    sub: "Hard · missed",          desc: "Genuinely tough. Focused prep moves these.",   icon: "▲", color: C.amber,  tint: C.amberTint,  pred: (isHard, isPassed) => isHard && !isPassed },
  { id: "easy-fail", label: "Priority gap",    sub: "Quick · still missed",   desc: "Knowledge hole, not difficulty. Fix first.",   icon: "▼", color: C.red,    tint: C.redTint,    pred: (isHard, isPassed) => !isHard && !isPassed },
];

export const QuestionDifficultyCalibration = ({ questions }) => {
  const [selectedQ, setSelectedQ] = useState(null);
  const scoredTimed = useMemo(() => questions.filter(q => { if (q.skipped) return false; const hasScore = typeof q.aiFeedback?.score === "number" || typeof q.score === "number"; const hasTime = Number(q.timeTaken || 0) > 0; return hasScore && hasTime; }).map(q => ({ ...q, _score: clamp(typeof q.aiFeedback?.score === "number" ? q.aiFeedback.score : Number(q.score || 0)), _time: Number(q.timeTaken) })), [questions]);

  const sortedByTime = [...scoredTimed].sort((a, b) => a._time - b._time);
  const midIdx = Math.floor(sortedByTime.length / 2);
  const medianTime = scoredTimed.length >= 3
    ? (sortedByTime.length % 2 ? sortedByTime[midIdx]._time : (sortedByTime[midIdx - 1]._time + sortedByTime[midIdx]._time) / 2)
    : 0;
  const classified = scoredTimed.length >= 3
    ? scoredTimed.map(q => ({ ...q, isHard: q._time > medianTime, isPassed: q._score >= 60 }))
    : [];
  const quadrantData = QUADRANTS.map(qd => ({ ...qd, questions: classified.filter(q => qd.pred(q.isHard, q.isPassed)) }));
  const priorityGap  = quadrantData.find(q => q.id === "easy-fail");
  const realStrength = quadrantData.find(q => q.id === "hard-pass");

  const gapCount      = priorityGap?.questions.length || 0;
  const strengthCount = realStrength?.questions.length || 0;

  const insight = useMemo(() => {
    if (gapCount === 0 && strengthCount === 0) return { text: "Clean split — no easy misses, no hard wins.", accent: C.blue500 };
    if (gapCount === 0) return { text: `${strengthCount} hard question${strengthCount > 1 ? "s" : ""} answered correctly — genuine strengths, no easy misses.`, accent: C.green };
    if (strengthCount === 0) return { text: `${gapCount} quick miss${gapCount > 1 ? "es" : ""} — answered fast, still got wrong. Pure knowledge gaps.`, accent: C.red };
    return { text: `${gapCount} easy miss${gapCount > 1 ? "es" : ""} (fix first) · ${strengthCount} hard win${strengthCount > 1 ? "s" : ""} (genuine strength).`, accent: C.amber };
  }, [gapCount, strengthCount]);

  if (scoredTimed.length < 3) return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: C.sub }}>Need at least 3 timed, scored questions to calibrate. {scoredTimed.length > 0 ? `${scoredTimed.length} so far.` : "None yet."}</p>
    </div>
  );

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: C.sub }}>Difficulty inferred from your own pace — faster than your median = "easy for you".</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {quadrantData.map((qd) => {
          const isSelected = selectedQ === qd.id, isEmpty = qd.questions.length === 0;
          return (
            <button key={qd.id} onClick={() => setSelectedQ(isSelected ? null : qd.id)} disabled={isEmpty} style={{ border: `1.5px solid ${isSelected ? qd.color + "60" : qd.color + "22"}`, borderRadius: 12, padding: "14px 16px", background: isSelected ? qd.tint : C.card, cursor: isEmpty ? "default" : "pointer", textAlign: "left", transition: "all 0.18s ease", opacity: isEmpty ? 0.42 : 1 }} aria-expanded={isSelected}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: qd.color }}>{qd.icon}</span>
                <span style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: isEmpty ? C.muted : qd.color }}>{qd.questions.length}</span>
              </div>
              <div style={{ fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.text, marginBottom: 2 }}>{qd.label}</div>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: qd.color, marginBottom: 5 }}>{qd.sub}</div>
              <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.45 }}>{qd.desc}</div>
              {!isEmpty && <div style={{ marginTop: 8, fontFamily: F.mono, fontSize: 8.5, color: qd.color, opacity: 0.8 }}>{isSelected ? "▴ hide" : "▾ show"}</div>}
            </button>
          );
        })}
      </div>
      {selectedQ && (() => {
        const qd = quadrantData.find(q => q.id === selectedQ);
        if (!qd?.questions.length) return null;
        return (
          <div style={{ marginTop: 10, border: `1px solid ${qd.color}30`, borderRadius: 11, overflow: "hidden" }}>
            {qd.questions.map((q, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < qd.questions.length - 1 ? `1px solid ${C.border}` : "none", background: C.card }}>
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 9, background: `${qd.color}14`, border: `1px solid ${qd.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 900, color: qd.color }}>{q._score}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F.mono, fontSize: 8, color: C.faint }}>Q{(q.index ?? 0) + 1}</span>
                    <span style={{ color: C.border }}>·</span>
                    <span style={{ fontSize: 10, color: C.sub }}>{q.topic || "General"}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>· {formatTime(q._time)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.text || `Question ${(q.index ?? 0) + 1}`}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
      <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 9, background: `${insight.accent}10`, border: `1px solid ${insight.accent}25`, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 4, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: insight.accent, opacity: 0.6 }} />
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{insight.text}</p>
      </div>
    </div>
  );
};
QuestionDifficultyCalibration.propTypes = { questions: PropTypes.array.isRequired };

// ─── useCountUp ──────────────────────────────────────────────────────────────

const useCountUp = (target, duration = 900, delay = 0) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame;
    const start = performance.now();
    const tick = (now) => { const t = Math.min((now - start) / duration, 1); setValue(Math.round((1 - Math.pow(1 - t, 3)) * target)); if (t < 1) frame = requestAnimationFrame(tick); };
    const timeout = setTimeout(() => { frame = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [target, duration, delay]);
  return value;
};

// ─── SessionDNAFingerprint ───────────────────────────────────────────────────

const DNABand = ({ axis, delay }) => {
  const displayScore = useCountUp(axis.score, 800, delay);
  const col = axis.score >= 80 ? C.green : axis.score >= 60 ? C.blue500 : axis.score >= 40 ? C.amber : C.red;
  const BAND_MAX_HW = 120;
  const fillW = (axis.score / 100) * BAND_MAX_HW;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      <div style={{ width: 80, textAlign: "right", paddingRight: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 900, color: col, lineHeight: 1 }}>{displayScore}</div>
        <div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.muted, marginTop: 1 }}>/100</div>
      </div>
      <div style={{ flex: 1, position: "relative", height: 26 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: `${col}08`, border: `1px solid ${col}15` }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1.5, background: `${col}30`, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", right: "50%", top: 3, bottom: 3, width: fillW, borderRadius: "3px 0 0 3px", background: `linear-gradient(90deg, ${col}30, ${col}78)`, transition: `width 1s cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
        <div style={{ position: "absolute", left: "50%", top: 3, bottom: 3, width: fillW, borderRadius: "0 3px 3px 0", background: `linear-gradient(90deg, ${col}78, ${col}30)`, transition: `width 1s cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
      </div>
      <div style={{ width: 80, paddingLeft: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{axis.label}</div>
        <div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.muted, marginTop: 1, lineHeight: 1.3 }}>{axis.sublabel}</div>
      </div>
    </div>
  );
};
DNABand.propTypes = { axis: PropTypes.shape({ score: PropTypes.number, label: PropTypes.string, sublabel: PropTypes.string }).isRequired, delay: PropTypes.number.isRequired };


export const SessionDNAFingerprint = ({ questions, totalScore, result }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const axes = useMemo(() => {
    const evaluated = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number");
    const answered  = questions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped");
    const openEnded = evaluated.filter(q => !["mcq", "aptitude"].includes(q.questionType));
    const depth     = openEnded.length > 0 ? Math.round(openEnded.reduce((s, q) => s + q.aiFeedback.score, 0) / openEnded.length) : clamp(totalScore || 0);
    const avgTime   = answered.length > 0 ? answered.reduce((s, q) => s + Number(q.timeTaken || 0), 0) / answered.length : 0;
    const speed     = avgTime > 0 ? clamp(Math.round(100 - ((avgTime - 30) / 270) * 100)) : 50;
    let consistency = 50;
    if (evaluated.length >= 2) { const scores = evaluated.map(q => q.aiFeedback.score); const mean = scores.reduce((s, v) => s + v, 0) / scores.length; const stdDev = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length); consistency = clamp(Math.round(100 - (stdDev / 35) * 100)); }
    const completion = questions.length > 0 ? clamp(Math.round((answered.length / questions.length) * 100)) : 0;
    return [
      { key: "depth",       label: "Depth",       sublabel: openEnded.length > 0 ? `${openEnded.length} open-ended` : "overall score", score: depth },
      { key: "speed",       label: "Speed",        sublabel: avgTime > 0 ? `~${formatTime(Math.round(avgTime))} avg` : "no time data",  score: speed },
      { key: "consistency", label: "Consistency",  sublabel: evaluated.length >= 2 ? "score variance" : "< 2 scored",                   score: consistency },
      { key: "completion",  label: "Completion",   sublabel: `${answered.length}/${questions.length} answered`,                          score: completion },
    ];
     
  }, [questions, totalScore]);

  const fingerprintRead = useMemo(() => {
    const [depth, speed, consistency, completion] = axes;
    const highAxes = axes.filter(a => a.score >= 72).map(a => a.label.toLowerCase());
    const lowAxes  = axes.filter(a => a.score < 45).map(a => a.label.toLowerCase());
    if (lowAxes.length === 0 && highAxes.length >= 3) return "Across-the-board strong session — high floor on every axis.";
    if (depth.score >= 72 && speed.score < 45) return "Deep thinker — answers had substance but pace was slower than optimal.";
    if (speed.score >= 72 && depth.score < 45) return "Fast but shallow — pace is there, depth needs to catch up.";
    if (consistency.score < 45) return "High variance session — your best and worst answers were far apart.";
    if (consistency.score >= 80 && depth.score >= 60) return "Consistent and capable — this is replicable form, not a lucky session.";
    if (completion.score < 60) return "Skips cost you here. A full pass at this depth level would raise the score.";
    return "Mixed fingerprint — no single axis dominates. Open the question review to find the pattern.";
  }, [axes]);

  return (
    <div ref={ref}>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: C.sub }}>Four axes from how you answered — not just what you scored.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}>
        {axes.map((axis, i) => <DNABand key={axis.key} axis={axis} delay={visible ? i * 120 : 9999} />)}
      </div>
      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 9, background: `${C.blue500}08`, border: `1px solid ${C.blue500}20`, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 4, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: C.blue500, opacity: 0.5 }} />
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{fingerprintRead}</p>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {axes.map(a => { const col = a.score >= 80 ? C.green : a.score >= 60 ? C.blue500 : a.score >= 40 ? C.amber : C.red; return (<div key={a.key} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, background: C.card, border: `1px solid ${C.border}` }}><span style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, color: col }}>{a.score}</span><span style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>{a.label.toLowerCase()}</span></div>); })}
      </div>
    </div>
  );
};
SessionDNAFingerprint.propTypes = { questions: PropTypes.array.isRequired, totalScore: PropTypes.number.isRequired, result: PropTypes.object.isRequired };

// ─── Recovery / Pattern detector ────────────────────────────────────────────

const STOPWORDS = new Set(["the","a","an","and","or","but","of","to","in","on","for","with","is","are","was","were","be","been","being","this","that","these","those","it","its","as","at","by","from","not","no","did","does","do","your","you","answer","question","missing","lacked","lacking","lack","more","also","could","should","would","have","has","had","about","into","than","then","which","what","how","why","when","some","any","need","needs","needed","depth","detail","specific","specifics","example","examples","explain","explanation","provide","structure","context","clear","clarity","show","demonstrate","include","consider","important","relevant","response","point","points","better","strong","weak","good","great","well","just","make","sure","help","improve","work","focus","mention","discuss"]);
const extractKeywords = (text) => { if (!text) return []; return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOPWORDS.has(w)); };

const findRecovery = (questions) => {
  const pts = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number").map(q => ({ score: q.aiFeedback.score, index: q.index ?? 0, topic: q.topic || "General" })).sort((a, b) => a.index - b.index);
  let bestJump = 0, from = null, to = null;
  for (let i = 1; i < pts.length; i++) { const jump = pts[i].score - pts[i - 1].score; if (jump > bestJump) { bestJump = jump; from = pts[i - 1]; to = pts[i]; } }
  return (!from || !to || bestJump < 15) ? null : { from, to, jump: bestJump };
};

const findPattern = (questions) => {
  const weak = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && q.aiFeedback.score < 60 && q.aiFeedback.missing);
  if (weak.length < 2) return null;
  const counts = {};
  weak.forEach(q => { const seen = new Set(extractKeywords(q.aiFeedback.missing)); seen.forEach(word => { if (!counts[word]) counts[word] = { count: 0, questions: [] }; counts[word].count += 1; counts[word].questions.push(q); }); });
  const [topWord, topData] = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)[0] || [];
  if (topWord && topData?.count >= 2) return { type: "keyword", word: topWord, questions: topData.questions, totalWeak: weak.length };
  const topicCounts = {};
  weak.forEach(q => { if (!topicCounts[q.topic]) topicCounts[q.topic] = []; topicCounts[q.topic].push(q); });
  const [topTopic, topTopicQs] = Object.entries(topicCounts).sort((a, b) => b[1].length - a[1].length)[0] || [];
  if (topTopic && topTopicQs?.length >= 2) return { type: "topic", topic: topTopic, questions: topTopicQs, totalWeak: weak.length };
  return null;
};

export const RecoveryPatternDetector = ({ questions }) => {
  const pattern  = useMemo(() => findPattern(questions),  [questions]);
  const recovery = useMemo(() => findRecovery(questions), [questions]);
  if (!pattern && !recovery) return null;
  const both = pattern && recovery;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: both ? "1fr 1fr" : "1fr", gap: 10 }} className="res-recovery-grid">
        {pattern && (
          <div style={{ borderRadius: 12, padding: "14px 16px", background: `linear-gradient(135deg, ${C.amberTint} 0%, ${C.card} 70%)`, border: `1.5px solid ${C.amber}35`, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.amber}18`, border: `1px solid ${C.amber}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚡</div>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: C.amber, marginBottom: 2 }}>pattern alert</div>
                <div style={{ fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.text, lineHeight: 1.3 }}>{pattern.type === "keyword" ? `"${pattern.word}" in ${pattern.questions.length} weak answers` : `${pattern.topic} — ${pattern.questions.length} weak answers`}</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: C.sub }}>{pattern.type === "keyword" ? `The same gap showed up across ${pattern.questions.length} of your ${pattern.totalWeak} weak answers. That's a stronger signal than any single piece of feedback.` : `Your weakest answers concentrated in one topic.`}</p>
            <div style={{ padding: "8px 10px", borderRadius: 8, background: `${C.amber}10`, border: `1px solid ${C.amber}25`, fontSize: 10.5, color: C.sub, lineHeight: 1.5 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: C.amber, display: "block", marginBottom: 3 }}>so what →</span>
              {pattern.type === "keyword" ? `Drill "${pattern.word}" specifically across different question types.` : `Do a focused topic session on ${pattern.topic} before your next general rep.`}
            </div>
          </div>
        )}
        {recovery && (
          <div style={{ borderRadius: 12, padding: "14px 16px", background: `linear-gradient(135deg, ${C.greenTint} 0%, ${C.card} 70%)`, border: `1.5px solid ${C.green}35`, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.green}18`, border: `1px solid ${C.green}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>◆</div>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: C.green, marginBottom: 2 }}>recovery moment</div>
                <div style={{ fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.text, lineHeight: 1.3 }}>+{recovery.jump} pts — Q{recovery.from.index + 1} → Q{recovery.to.index + 1}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: scoreColor(recovery.from.score) }}>{recovery.from.score}</div><div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>Q{recovery.from.index + 1}</div></div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}><span style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, color: C.green }}>+{recovery.jump}</span><div style={{ width: 36, height: 2, background: `linear-gradient(90deg, ${scoreColor(recovery.from.score)}, ${C.green})`, borderRadius: 1 }} /><span style={{ fontSize: 10 }}>→</span></div>
              <div style={{ textAlign: "center" }}><div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: scoreColor(recovery.to.score) }}>{recovery.to.score}</div><div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>Q{recovery.to.index + 1}</div></div>
            </div>
            <div style={{ padding: "8px 10px", borderRadius: 8, background: `${C.green}10`, border: `1px solid ${C.green}25`, fontSize: 10.5, color: C.sub, lineHeight: 1.5 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: C.green, display: "block", marginBottom: 3 }}>so what →</span>
              {recovery.jump >= 30 ? `A ${recovery.jump}-pt swing in one question is significant composure recovery.` : `After a hard question, you came back ${recovery.jump} pts stronger. That's a real interview skill.`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
RecoveryPatternDetector.propTypes = { questions: PropTypes.array.isRequired };

// ─── MomentumArrow ───────────────────────────────────────────────────────────

const toRad = (deg) => (deg * Math.PI) / 180;
const linearRegression = (points) => { const n = points.length; if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 }; const sumX = points.reduce((s, p) => s + p.x, 0), sumY = points.reduce((s, p) => s + p.y, 0), sumXY = points.reduce((s, p) => s + p.x * p.y, 0), sumX2 = points.reduce((s, p) => s + p.x * p.x, 0); const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX); return { slope, intercept: (sumY - slope * sumX) / n }; };
const regressionStdErr = (points, slope, intercept) => { if (points.length < 3) return 8; const sse = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0); return Math.sqrt(sse / (points.length - 2)); };

export const MomentumArrow = ({ scoreHistory, currentScore }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (!el) return; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.1 }); observer.observe(el); return () => observer.disconnect(); }, []);

  const history = useMemo(() => {
    const raw = Array.isArray(scoreHistory) ? scoreHistory : [];
    const parsed = raw.map((item, i) => ({ score: clamp(typeof item === "number" ? item : Number(item?.score ?? item?.totalScore ?? 0)), label: item?.date ? new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : `S${i + 1}` }));
    const last = parsed[parsed.length - 1], clamped = clamp(currentScore || 0);
    if (!last || last.score !== clamped) parsed.push({ score: clamped, label: "today" });
    return parsed;
  }, [scoreHistory, currentScore]);

  const W = 580, H = 180, padX = 28, padY = 20, PROJ_COUNT = 2;
  const regressionPoints = history.map((h, i) => ({ x: i, y: h.score }));
  const { slope, intercept } = linearRegression(regressionPoints);
  const stdErr = regressionStdErr(regressionPoints, slope, intercept);
  const totalX = history.length - 1 + PROJ_COUNT;
  const xp = (xi) => padX + (xi / totalX) * (W - padX * 2);
  const yp = (score) => H - padY - (clamp(score) / 100) * (H - padY * 2);
  const actualPath = history.map((h, i) => `${i === 0 ? "M" : "L"} ${xp(i).toFixed(1)} ${yp(h.score).toFixed(1)}`).join(" ");
  const lastActualX = history.length - 1;
  const projPoints = [];
  for (let i = 0; i <= PROJ_COUNT; i++) projPoints.push({ xi: lastActualX + i, score: clamp(slope * (lastActualX + i) + intercept) });
  const projPath = projPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xp(p.xi).toFixed(1)} ${yp(p.score).toFixed(1)}`).join(" ");
  const coneWidth = Math.min(stdErr * 1.5, 20);
  const conePath = (() => { const topEdge = projPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xp(p.xi).toFixed(1)} ${yp(Math.min(p.score + coneWidth * (i + 1) * 0.6, 100)).toFixed(1)}`); const bottomEdge = [...projPoints].reverse().map((p, i) => `L ${xp(p.xi).toFixed(1)} ${yp(Math.max(p.score - coneWidth * (projPoints.length - 1 - i) * 0.6, 0)).toFixed(1)}`); return [...topEdge, ...bottomEdge, "Z"].join(" "); })();
  const latestScore = history[history.length - 1]?.score ?? 0;
  const prediction = useMemo(() => {
    if (history.length < 2) return null;
    const sessionsTo80 = slope > 0 && latestScore < 80 ? Math.ceil((80 - latestScore) / slope) : null;
    if (Math.abs(slope) < 0.5) return { text: `Score has been flat across ${history.length} sessions — the trajectory needs a change.`, action: "Change your question mix or increase difficulty.", color: C.amber, icon: "→" };
    if (slope > 0 && sessionsTo80 !== null) { if (latestScore >= 80) return { text: `You're past 80 and trending up. Next milestone: 90+.`, action: `At +${slope.toFixed(1)} pts/session, elite form is within reach.`, color: C.green, icon: "▲" }; return { text: `At +${slope.toFixed(1)} pts/session, you hit 80 in ~${sessionsTo80} session${sessionsTo80 === 1 ? "" : "s"}.`, action: "Keep the consistency.", color: C.green, icon: "▲" }; }
    if (slope < 0) return { text: `Score is dropping at ${Math.abs(slope).toFixed(1)} pts/session — worth addressing now.`, action: "Go back to weak topics before queuing general sessions.", color: C.red, icon: "▼" };
    return { text: `${slope > 0 ? "Upward" : "Downward"} trend of ${Math.abs(slope).toFixed(1)} pts/session.`, action: slope > 0 ? "You're building form. Stay consistent." : "Address the trend before it becomes a habit.", color: slope > 0 ? C.blue500 : C.amber, icon: slope > 0 ? "▲" : "▼" };
  }, [history, slope, latestScore]);
  const arcColor = slope >= 0.5 ? C.green : slope <= -0.5 ? C.red : C.amber;

  if (history.length < 2) return (
    <div ref={ref}>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: C.sub }}>After two or more sessions, a trajectory projection will appear here.</p>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, color: scoreColor(currentScore), lineHeight: 1 }}>{clamp(currentScore || 0)}</div>
        <div><div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 700, color: C.text }}>Session 1 baseline</div><div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>Every session from here is data toward your trajectory.</div></div>
      </div>
    </div>
  );

  return (
    <div ref={ref}>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: C.sub }}>{history.length} sessions plotted — dashed line is the projected trend with uncertainty cone.</p>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 340, display: "block", opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}>
          <defs>
            <linearGradient id="momAreaGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={arcColor} stopOpacity="0.12" /><stop offset="100%" stopColor={arcColor} stopOpacity="0" /></linearGradient>
            <linearGradient id="momConeGrad2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={arcColor} stopOpacity="0.08" /><stop offset="100%" stopColor={arcColor} stopOpacity="0.18" /></linearGradient>
          </defs>
          {[40, 60, 80].map(l => (<g key={l}><line x1={padX} x2={W - padX} y1={yp(l)} y2={yp(l)} stroke={C.border} strokeDasharray="4 5" /><text x={2} y={yp(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text></g>))}
          <line x1={xp(lastActualX)} x2={xp(lastActualX)} y1={padY} y2={H - padY} stroke={C.borderMd} strokeWidth="1" strokeDasharray="2 3" />
          <path d={conePath} fill="url(#momConeGrad2)" />
          <path d={`${actualPath} L ${xp(lastActualX)} ${H - padY} L ${xp(0)} ${H - padY} Z`} fill="url(#momAreaGrad2)" />
          <path d={actualPath} fill="none" stroke={arcColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={projPath} fill="none" stroke={arcColor} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" opacity="0.7" />
          {history.map((h, i) => (<g key={i}><circle cx={xp(i)} cy={yp(h.score)} r="5" fill={scoreColor(h.score)} stroke="#fff" strokeWidth="1.5" /><text x={xp(i)} y={H - 4} textAnchor="middle" fontSize="7.5" fontFamily={F.mono} fill={i === history.length - 1 ? arcColor : C.muted} fontWeight={i === history.length - 1 ? "700" : "400"}>{h.label}</text></g>))}
          {projPoints.slice(1).map((p, i) => (<g key={`proj-${i}`}><circle cx={xp(p.xi)} cy={yp(p.score)} r="4" fill="none" stroke={arcColor} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.65" /><text x={xp(p.xi)} y={yp(p.score) - 8} textAnchor="middle" fontSize="8" fontFamily={F.display} fill={arcColor} fontWeight="800" opacity="0.75">~{Math.round(clamp(p.score))}</text></g>))}
        </svg>
      </div>
      {prediction && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "auto 1fr", borderRadius: 11, overflow: "hidden", border: `1px solid ${prediction.color}30` }}>
          <div style={{ width: 4, background: prediction.color }} />
          <div style={{ padding: "11px 14px", background: `${prediction.color}08` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.5, marginBottom: 4 }}>{prediction.text}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, color: prediction.color, fontWeight: 700 }}>{prediction.action}</div>
          </div>
        </div>
      )}
    </div>
  );
};
MomentumArrow.propTypes = { scoreHistory: PropTypes.array.isRequired, currentScore: PropTypes.number.isRequired };

// ─── AnswerConfidenceArc ─────────────────────────────────────────────────────

const polarToXY = (cx, cy, r, angleDeg) => ({ x: cx + r * Math.cos(toRad(angleDeg)), y: cy + r * Math.sin(toRad(angleDeg)) });
const donutSegmentPath = (cx, cy, r_inner, r_outer, startAngle, endAngle) => {
  const s1 = polarToXY(cx, cy, r_outer, startAngle), e1 = polarToXY(cx, cy, r_outer, endAngle), s2 = polarToXY(cx, cy, r_inner, endAngle), e2 = polarToXY(cx, cy, r_inner, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
    return [`M ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`, `A ${r_outer} ${r_outer} 0 ${large} 1 ${e1.x.toFixed(2)} ${e1.y.toFixed(2)}`, `L ${s2.x.toFixed(2)} ${s2.y.toFixed(2)}`, `A ${r_inner} ${r_inner} 0 ${large} 0 ${e2.x.toFixed(2)} ${e2.y.toFixed(2)}`, "Z"].join(" ");
};

const ARC_START = 135, ARC_SWEEP = 270, SEG_GAP_DEG = 3, CX = 110, CY = 110, R_TRACK = 84, R_INNER = 56;
const TRACK_W = R_TRACK - R_INNER;
const fillRadius = (score) => R_INNER + Math.max(3, (clamp(score) / 100) * TRACK_W);

export const AnswerConfidenceArc = ({ questions }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltipXY,  setTooltipXY]  = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  const segments = useMemo(() => questions.map((q, i) => {
    const isObjective = ["mcq", "aptitude"].includes(q.questionType);
    const hasScore    = !q.skipped && typeof q.aiFeedback?.score === "number";
    const hasCorrect  = !q.skipped && isObjective && q.aiFeedback?.correct != null;
    const score = hasScore ? q.aiFeedback.score : hasCorrect ? (q.aiFeedback.correct ? 100 : 0) : null;
    return { index: i, text: q.text || `Question ${i + 1}`, topic: q.topic || "General", skipped: q.skipped, isObjective, hasScore: score !== null, score: score ?? 0, correct: q.aiFeedback?.correct ?? null, timeTaken: Number(q.timeTaken || 0) };
  }), [questions]);

  const n = segments.length;
  const totalGapDeg = SEG_GAP_DEG * n;
  const segDeg = (ARC_SWEEP - totalGapDeg) / n;
  const evaluated = segments.filter(s => s.hasScore && !s.skipped);
  const mcqSegs   = evaluated.filter(s => s.isObjective);
  const openSegs  = evaluated.filter(s => !s.isObjective);
  const mcqAcc    = mcqSegs.length ? Math.round((mcqSegs.filter(s => s.correct === true).length / mcqSegs.length) * 100) : null;
  const openAvg   = openSegs.length ? Math.round(openSegs.reduce((s, q) => s + q.score, 0) / openSegs.length) : null;
  const overallAvg = evaluated.length ? Math.round(evaluated.reduce((s, q) => s + q.score, 0) / evaluated.length) : 0;

  const insight = useMemo(() => {
    if (!evaluated.length) return { text: "No evaluated answers yet.", accent: C.muted };
    if (mcqAcc !== null && openAvg !== null) {
      const gap = mcqAcc - openAvg;
      if (gap >= 15) return { text: `MCQ accuracy (${mcqAcc}%) outpacing open-ended depth (${openAvg}/100) — communication, not knowledge, is the gap.`, accent: C.amber };
      if (gap <= -15) return { text: `Open-ended (${openAvg}/100) outscoring objective accuracy (${mcqAcc}%) — brush up on underlying facts.`, accent: C.blue500 };
      return { text: `Both formats balanced — MCQ at ${mcqAcc}% and open-ended at ${openAvg}/100.`, accent: C.green };
    }
    const strong = evaluated.filter(s => s.score >= 80).length, weak = evaluated.filter(s => s.score < 60).length;
    if (strong === evaluated.length) return { text: "Every arc segment filled near the top. Strong across the board.", accent: C.green };
    if (weak > evaluated.length / 2) return { text: `More than half the arc is in the shallow tier — ${weak} answers below 60.`, accent: C.red };
    return { text: `${strong} full arc${strong === 1 ? "" : "s"}, ${weak} shallow.`, accent: C.blue500 };
  }, [evaluated.length, mcqAcc, openAvg]);

  const hovSeg = hoveredIdx !== null ? segments[hoveredIdx] : null;
  const handleMouseMove = useCallback((e, idx) => { const rect = svgRef.current?.getBoundingClientRect(); if (!rect) return; setHoveredIdx(idx); setTooltipXY({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }, []);
  const SVG_SIZE = 220;

  if (n === 0) return <div style={CS.emptyState}>No questions to display.</div>;

  const tierRows = [
    { label: "80–100 · strong", color: C.green,   count: evaluated.filter(s => s.score >= 80).length },
    { label: "60–79 · solid",   color: C.blue500,  count: evaluated.filter(s => s.score >= 60 && s.score < 80).length },
    { label: "40–59 · shaky",   color: C.amber,    count: evaluated.filter(s => s.score >= 40 && s.score < 60).length },
    { label: "0–39 · gap",      color: C.red,      count: evaluated.filter(s => s.score < 40).length },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg ref={svgRef} width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} style={{ overflow: "visible", display: "block" }}>
            <circle cx={CX} cy={CY} r={R_TRACK + 12} fill="none" stroke={scoreColor(overallAvg)} strokeWidth="1" opacity="0.1" />
            {segments.map((seg, i) => {
              const startDeg = ARC_START + i * (segDeg + SEG_GAP_DEG), endDeg = startDeg + segDeg, isHov = hoveredIdx === i;
              const col = seg.skipped ? C.borderMd : (seg.hasScore ? scoreColor(seg.score) : C.borderMd);
              const rFill = seg.skipped ? R_INNER + 2 : (seg.hasScore ? fillRadius(seg.score) : R_INNER + 4);
              const trackPath = donutSegmentPath(CX, CY, R_INNER, R_TRACK, startDeg, endDeg);
              const fillPath  = rFill > R_INNER + 2 ? donutSegmentPath(CX, CY, R_INNER, rFill, startDeg, endDeg) : null;
              return (
                <g key={i} onMouseMove={(e) => handleMouseMove(e, i)} onMouseLeave={() => setHoveredIdx(null)} style={{ cursor: "default" }}>
                  <path d={trackPath} fill={isHov ? `${col}18` : `${col}09`} stroke={isHov ? `${col}50` : "transparent"} strokeWidth="0.5" />
                  {fillPath && <path d={fillPath} fill={col} opacity={isHov ? 0.95 : 0.75} style={{ filter: isHov ? `drop-shadow(0 0 5px ${col}80)` : "none" }} />}
                  {seg.skipped && <path d={trackPath} fill="none" stroke={C.borderMd} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />}
                </g>
              );
            })}
            <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: F.display, fontSize: 32, fontWeight: 900, fill: "#fff", letterSpacing: "-1px" }}>{overallAvg}</text>
            <text x={CX} y={CY + 8} textAnchor="middle" style={{ fontFamily: F.mono, fontSize: 8.5, fill: "rgba(255,255,255,0.35)" }}>session avg</text>
          </svg>
          {hovSeg && (
            <div style={{ position: "absolute", top: tooltipXY.y + 10, left: Math.min(tooltipXY.x - 60, SVG_SIZE - 140), zIndex: 20, background: C.card, border: `1px solid ${C.borderMd}`, borderRadius: 9, padding: "9px 11px", boxShadow: "0 6px 20px rgba(0,0,0,0.2)", pointerEvents: "none", minWidth: 130 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginBottom: 5 }}>Q{hovSeg.index + 1} · {hovSeg.isObjective ? "mcq" : "open"}</div>
              {hovSeg.skipped ? <div style={{ fontSize: 11, color: C.muted }}>Skipped</div> : hovSeg.isObjective ? <div style={{ fontSize: 16, color: hovSeg.correct ? C.green : C.red, fontWeight: 900 }}>{hovSeg.correct === true ? "✓" : "✕"}</div> : hovSeg.hasScore ? <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: scoreColor(hovSeg.score) }}>{hovSeg.score}<span style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>/100</span></div> : <div style={{ fontSize: 11, color: C.muted }}>—</div>}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tierRows.map(tier => (
              <div key={tier.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width={18} height={18} viewBox="0 0 20 20" style={{ flexShrink: 0 }}><circle cx={10} cy={10} r={8} fill="none" stroke={`${tier.color}18`} strokeWidth="5" /><circle cx={10} cy={10} r={8} fill="none" stroke={tier.color} strokeWidth="5" strokeDasharray={`${(tier.count / Math.max(n, 1)) * 50.27} 50.27`} strokeLinecap="round" transform="rotate(-90 10 10)" opacity="0.75" /></svg>
                <span style={{ fontFamily: F.mono, fontSize: 8.5, color: tier.count > 0 ? C.sub : C.faint, flex: 1 }}>{tier.label}</span>
                <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 800, color: tier.count > 0 ? tier.color : C.faint }}>{tier.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 9, background: `${insight.accent}10`, border: `1px solid ${insight.accent}25`, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 4, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: insight.accent, opacity: 0.6 }} />
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{insight.text}</p>
      </div>
    </div>
  );
};
AnswerConfidenceArc.propTypes = { questions: PropTypes.array.isRequired };

// ─── StatRailV2 ──────────────────────────────────────────────────────────────

const MiniSparkline = ({ points, color, width = 80, height = 24 }) => {
  if (!points || points.length < 2) return <div style={{ width, height, display: "flex", alignItems: "center" }}><div style={{ height: 1, width: "100%", background: `${color}30`, borderRadius: 1 }} /></div>;
  const min = Math.min(...points), max = Math.max(...points), range = Math.max(max - min, 10), pad = 3;
  const xp = (i) => pad + (i / (points.length - 1)) * (width - pad * 2), yp = (v) => height - pad - ((v - min) / range) * (height - pad * 2);
  const linePath = points.map((v, i) => `${i === 0 ? "M" : "L"} ${xp(i).toFixed(1)} ${yp(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xp(points.length - 1)} ${height - pad} L ${xp(0)} ${height - pad} Z`;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}><defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={areaPath} fill={`url(#${gradId})`} /><path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={xp(points.length - 1)} cy={yp(points[points.length - 1])} r="2.5" fill={color} /></svg>);
};

const MiniRing = ({ value, max, color, size = 40 }) => {
  const pct = max > 0 ? clamp((value / max) * 100) : 0, R = 14, circ = 2 * Math.PI * R, dash = (pct / 100) * circ;
  return (<svg width={size} height={size} viewBox="0 0 40 40" style={{ display: "block", flexShrink: 0 }}><circle cx={20} cy={20} r={R} fill="none" stroke={`${color}18`} strokeWidth="5" /><circle cx={20} cy={20} r={R} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" strokeOpacity="0.78" transform="rotate(-90 20 20)" style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.16,1,.3,1)" }} /><text x={20} y={20} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: F.display, fontSize: 10, fontWeight: 900, fill: color }}>{value}</text></svg>);
};

const MiniPaceBar = ({ seconds, width = 70, height = 12 }) => {
  const MIN_S = 30, MAX_S = 300, clamped = Math.max(MIN_S, Math.min(MAX_S, seconds || 0)), pct = ((clamped - MIN_S) / (MAX_S - MIN_S)) * 100, goodL = ((60 - MIN_S) / (MAX_S - MIN_S)) * 100, goodR = ((180 - MIN_S) / (MAX_S - MIN_S)) * 100;
  const color = seconds < 60 ? C.blue500 : seconds <= 180 ? C.green : seconds <= 240 ? C.amber : C.red;
  return (<div style={{ width, position: "relative", height }}><div style={{ position: "absolute", inset: 0, borderRadius: 999, background: C.border }} /><div style={{ position: "absolute", left: `${goodL}%`, width: `${goodR - goodL}%`, top: 0, bottom: 0, background: `${C.green}20`, borderRadius: 3 }} /><div style={{ position: "absolute", left: `${pct}%`, top: -2, bottom: -2, width: 3, background: color, borderRadius: 999, transform: "translateX(-50%)", boxShadow: `0 0 6px ${color}80`, transition: "left 0.8s cubic-bezier(.16,1,.3,1)" }} /></div>);
};

export const StatRailV2 = ({ result, scoreHistory }) => {
  const { totalQuestions = 0, answeredQuestions = 0, skippedQuestions = 0, strongAnswers = 0, weakAnswers = 0, averageTime = 0, score = 0 } = result;
  const sparkPoints = useMemo(() => { const hist = Array.isArray(scoreHistory) ? scoreHistory : []; const nums = hist.map(h => clamp(typeof h === "number" ? h : Number(h?.score ?? h?.totalScore ?? 0))); const curr = clamp(score); if (!nums.length) return [curr]; return nums[nums.length - 1] === curr ? nums : [...nums, curr]; }, [scoreHistory, score]);
  const trendDelta = sparkPoints.length >= 2 ? sparkPoints[sparkPoints.length - 1] - sparkPoints[sparkPoints.length - 2] : null;
  const paceColor  = averageTime < 60 ? C.blue500 : averageTime <= 180 ? C.green : averageTime <= 240 ? C.amber : C.red;
  const paceRead   = averageTime < 60 ? "Fast" : averageTime <= 180 ? "Good pace" : averageTime <= 240 ? "Steady" : "Slow";

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }} className="res-stat-rail">
      {[
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MiniRing value={answeredQuestions} max={totalQuestions} color={C.blue500} />
          <div>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: C.text, lineHeight: 1 }}>{answeredQuestions}<span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, fontWeight: 400 }}>/{totalQuestions}</span></div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>answered</div>
            {skippedQuestions > 0 && <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.amber, marginTop: 3, background: C.amberTint, borderRadius: 999, padding: "1px 6px", display: "inline-block" }}>{skippedQuestions} skipped</div>}
          </div>
        </div>,
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MiniRing value={strongAnswers} max={answeredQuestions || 1} color={C.green} />
          <div>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: C.green, lineHeight: 1 }}>{strongAnswers}</div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>scored 80+</div>
            {weakAnswers > 0 && <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.red, marginTop: 3, background: C.redTint, borderRadius: 999, padding: "1px 6px", display: "inline-block" }}>{weakAnswers} below 60</div>}
          </div>
        </div>,
        <div>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: paceColor, lineHeight: 1, marginBottom: 3 }}>{averageTime > 0 ? formatTime(averageTime) : "—"}</div>
          <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 8 }}>avg / question</div>
          {averageTime > 0 && (<><MiniPaceBar seconds={averageTime} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ fontFamily: F.mono, fontSize: 7.5, color: C.faint }}>fast</span><span style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: paceColor }}>{paceRead}</span><span style={{ fontFamily: F.mono, fontSize: 7.5, color: C.faint }}>slow</span></div></>)}
        </div>,
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 5 }}>
            <div><div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>{clamp(score)}</div><div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>this session</div></div>
            {trendDelta !== null && <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999, background: trendDelta >= 0 ? C.greenTint : C.redTint, border: `1px solid ${trendDelta >= 0 ? C.green : C.red}30` }}><span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: trendDelta >= 0 ? C.green : C.red }}>{trendDelta >= 0 ? "+" : ""}{trendDelta.toFixed(0)}</span></div>}
          </div>
          <MiniSparkline points={sparkPoints} color={scoreColor(score)} width={90} height={24} />
          {sparkPoints.length >= 2 && <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, marginTop: 4 }}>last {sparkPoints.length} sessions</div>}
        </div>
      ].map((child, i, arr) => (
        <div key={i} style={{ padding: "16px 18px", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }} className="res-rail-cell">
          {child}
        </div>
      ))}
    </section>
  );
};
StatRailV2.propTypes = { result: PropTypes.object.isRequired, scoreHistory: PropTypes.array.isRequired };

// ─── BadgeSessionBridge ──────────────────────────────────────────────────────

export const BadgeSessionBridge = ({ streak, newBadges, navigate }) => {
  const [dismissed, setDismissed] = useState(false);
  const badges = useMemo(() => { if (!Array.isArray(newBadges) || !newBadges.length) return []; return newBadges.map(b => (typeof b === "string" ? b : b?.label || "New badge")); }, [newBadges]);
  const hasStreak = streak?.current > 0, hasBadges = badges.length > 0;
  if ((!hasStreak && !hasBadges) || dismissed) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", marginBottom: 12, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      {hasStreak && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: C.violetTint, border: `1px solid ${C.violet}35`, flexShrink: 0 }}><span style={{ fontSize: 16 }}>◆</span><div><div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 900, color: C.text }}>{streak.current} day streak</div><div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>consistency compounds</div></div></div>}
      {hasBadges && <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, flexWrap: "wrap" }}><span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>earned</span>{badges.map((label, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: C.violetTint, border: `1px solid ${C.violet}45`, color: C.violet, fontFamily: F.mono, fontSize: 9, fontWeight: 700 }}>★ {label}</span>)}</div>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.violet}45`, background: C.violetTint, color: C.violet, fontFamily: F.body, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View badges →</button>
        <button onClick={() => setDismissed(true)} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.faint, fontSize: 12, cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
};
BadgeSessionBridge.propTypes = { streak: PropTypes.shape({ current: PropTypes.number }), newBadges: PropTypes.array, navigate: PropTypes.func.isRequired };

// ─── ScoreCard Drawer ─────────────────────────────────────────────────────────

const ScoreCardDrawer = ({ result, totalScore, normalizedQuestions}) => {
  const [open, setOpen] = useState(false);
  const grade = getGrade(totalScore);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderRadius: open ? "14px 14px 0 0" : 14, border: `1px solid ${open ? grade.accent + "55" : C.border}`, borderBottom: open ? "none" : `1px solid ${open ? grade.accent + "55" : C.border}`, background: open ? `${grade.accent}10` : C.card, cursor: "pointer", transition: "all 0.2s ease", boxShadow: C.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${grade.accent}18`, border: `1.5px solid ${grade.accent}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: grade.accent }}>{grade.grade}</span>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1 }}>Mission Report · {totalScore}/100</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 3 }}>{grade.desc} · tap to {open ? "collapse" : "view full breakdown + download"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ label: `${result.strongAnswers} strong`, color: C.green, bg: C.greenTint }, { label: `${result.weakAnswers} fix`, color: C.red, bg: C.redTint }].map(p => (
              <span key={p.label} style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: p.color, background: p.bg, border: `1px solid ${p.color}30`, borderRadius: 999, padding: "2px 8px" }}>{p.label}</span>
            ))}
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>▾</span>
        </div>
      </button>
      <div style={{ maxHeight: open ? 1200 : 0, opacity: open ? 1 : 0, overflow: "hidden", transition: "max-height 0.4s cubic-bezier(.16,1,.3,1), opacity 0.25s ease", border: open ? `1px solid ${grade.accent}40` : "none", borderTop: "none", borderRadius: "0 0 14px 14px", background: C.card }}>
        <div style={{ padding: "18px 20px" }}>
          <ScoreCard totalScore={totalScore} questions={normalizedQuestions} />
        </div>
      </div>
    </div>
  );
};
ScoreCardDrawer.propTypes = { result: PropTypes.object.isRequired, totalScore: PropTypes.number.isRequired, normalizedQuestions: PropTypes.array.isRequired };

// ─── ShareCard ────────────────────────────────────────────────────────────────

const ShareCard = ({ result, cardRef }) => {
  const { score, totalQuestions, answeredQuestions, strongAnswers, weakAnswers, topTopic, weakestTopicName } = result;
  const v = getVerdict(score), grade = getGrade(score);
  const stats = [{ label: "answered", value: `${answeredQuestions}/${totalQuestions}` }, { label: "strong", value: strongAnswers }, { label: "to fix", value: weakAnswers }, { label: "top topic", value: topTopic || "—" }];
  return (
    <div ref={cardRef} style={{ position: "fixed", top: -9999, left: -9999, width: 520, fontFamily: F.body, borderRadius: 24, overflow: "hidden", background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 44%, ${C.blue600} 72%, ${C.cyan600} 100%)` }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${grade.accent}, ${grade.glow})` }} />
      <div style={{ padding: "28px 32px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", color: "rgba(255,255,255,0.38)", textTransform: "uppercase" }}>MockMate · Session Result</div>
          <div style={{ fontFamily: F.mono, fontSize: 9, padding: "3px 9px", borderRadius: 6, background: `${grade.accent}20`, color: grade.accent, border: `1px solid ${grade.accent}40`, fontWeight: 700 }}>{grade.grade} · {grade.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
          <span style={{ fontFamily: F.display, fontSize: 80, fontWeight: 900, color: "#fff", letterSpacing: "-4px", lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.32)" }}>/100</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.5, marginBottom: 8, maxWidth: 400 }}>{v.headline}</div>
        {weakestTopicName && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 4 }}><span style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.4)" }}>working on</span><span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.amber }}>{weakestTopicName}</span></div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(0,0,0,0.18)" }}>
        {stats.map((s, i) => <div key={i} style={{ padding: "12px 10px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", textAlign: "center" }}><div style={{ fontFamily: F.mono, fontSize: 7.5, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div><div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.value}</div></div>)}
      </div>
      <div style={{ padding: "12px 32px", background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: grade.accent }}>mockmate.app</div>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.3)" }}>AI interview coaching</div>
      </div>
    </div>
  );
};
ShareCard.propTypes = { result: PropTypes.object.isRequired, cardRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]).isRequired };

// ─── Tabbed analytics ─────────────────────────────────────────────────────────

const TAB_DEFS = [
  { id: "overview",  label: "Overview",  icon: "◉" },
  { id: "pace",      label: "Pace",      icon: "⚡" },
  { id: "patterns",  label: "Patterns",  icon: "◆" },
  { id: "progress",  label: "Progress",  icon: "▲" },
];

const TabbedAnalytics = ({ questions, totalScore, result, scoreHistory }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const tabContent = {
    overview: (
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <SectionBlock title="Behavioral fingerprint" sub="4-axis fingerprint from how you answered">
          <SessionDNAFingerprint questions={questions} totalScore={totalScore} result={result} />
        </SectionBlock>
        <SectionDivider />
        <SectionBlock title="Answer confidence ring" sub="Every question as an arc — fill depth = score">
          <AnswerConfidenceArc questions={questions} />
        </SectionBlock>
      </div>
    ),
    pace: (
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <SectionBlock title="Cognitive load heatmap" sub="Bar height = time · Color = score · Tall + red = overload">
          <CognitiveLoadHeatmap questions={questions} />
        </SectionBlock>
        <SectionDivider />
        <SectionBlock title="Pace vs. score" sub="Is speed helping or hurting?">
          <PaceVsScoreLabeled questions={questions} />
        </SectionBlock>
        <SectionDivider />
        <SectionBlock title="Difficulty calibration" sub="Easy miss vs. hard earn">
          <QuestionDifficultyCalibration questions={questions} />
        </SectionBlock>
      </div>
    ),
    patterns: (
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <SectionBlock title="Cross-session signal" sub="What the data says about how you answered">
          <CrossSignalInsight questions={questions} />
          <p style={{ margin: "8px 0 0", fontSize: 11, color: C.muted }}>Pattern detected from your speed, topic, and score distribution this session.</p>
        </SectionBlock>
        <SectionDivider />
        <SectionBlock title="Recovery & pattern detection" sub="Bounce-backs and recurring gaps">
          <RecoveryPatternDetector questions={questions} />
        </SectionBlock>
      </div>
    ),
    progress: (
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <SectionBlock title="Score curve" sub="Answer-by-answer progression this session">
          <ScoreProgressionCompact questions={questions} />
        </SectionBlock>
        <SectionDivider />
        <SectionBlock title="Momentum trajectory" sub="Where the trend puts you in future sessions">
          <MomentumArrow scoreHistory={scoreHistory} currentScore={totalScore} />
        </SectionBlock>
      </div>
    ),
  };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12, boxShadow: C.shadow }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: cardAlt }}>
        {TAB_DEFS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "12px 8px", border: "none", borderBottom: active ? `2px solid ${C.blue500}` : "2px solid transparent", background: active ? C.card : "transparent", color: active ? C.blue500 : C.muted, cursor: "pointer", fontFamily: F.mono, fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: "0.3px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.15s ease" }}>
              <span style={{ fontSize: 10 }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>
      <div style={{ padding: "18px 20px" }}>{tabContent[activeTab]}</div>
    </div>
  );
};
TabbedAnalytics.propTypes = { questions: PropTypes.array.isRequired, totalScore: PropTypes.number.isRequired, result: PropTypes.object.isRequired, scoreHistory: PropTypes.array.isRequired };

const SectionBlock = ({ title, sub, children }) => (
  <div style={{ paddingBottom: 16 }}>
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.7px", color: C.blue500, marginBottom: 3 }}>{title.toLowerCase()}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
    {children}
  </div>
);
SectionBlock.propTypes = { title: PropTypes.string.isRequired, sub: PropTypes.string, children: PropTypes.node.isRequired };

const SectionDivider = () => <div style={{ height: 1, background: C.border, margin: "4px 0 16px" }} />;

// ─── ScoreProgressionCompact ──────────────────────────────────────────────────

const ScoreProgressionCompact = ({ questions }) => {
  const points = questions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number").map(q => q.aiFeedback.score);
  if (points.length < 2) return <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Need 2+ evaluated questions to plot the curve.</p>;
  const avg = points.reduce((s, v) => s + v, 0) / points.length;
  const stdDev = Math.round(Math.sqrt(points.reduce((s, v) => s + (v - avg) ** 2, 0) / points.length));
  const spread = Math.max(...points) - Math.min(...points);
  const consistencyRead = spread <= 15 ? { label: "Steady", color: C.green } : spread <= 35 ? { label: "Some swing", color: C.blue500 } : { label: "High swing", color: C.amber };
  const W = 560, H = 160, padX = 24, padY = 18;
  const x = i => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = v => H - padY - (clamp(v) / 100) * (H - padY * 2);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(points.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;
  const drift = points[points.length - 1] - points[0];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: drift >= 0 ? C.greenTint : C.redTint, border: `1px solid ${drift >= 0 ? C.green : C.red}30` }}>
          <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 900, color: drift >= 0 ? C.green : C.red }}>{drift >= 0 ? "+" : ""}{drift} pts</span>
          <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.sub }}>drift</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: cardAlt, border: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 800, color: consistencyRead.color }}>{consistencyRead.label}</span>
          <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>±{stdDev} pts</span>
        </div>
      </div>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 320, display: "block" }}>
          <defs><linearGradient id="resAreaGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue500} stopOpacity="0.18" /><stop offset="100%" stopColor={C.blue500} stopOpacity="0" /></linearGradient></defs>
          {[40, 60, 80].map(l => (<g key={l}><line x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} stroke={C.border} strokeDasharray="4 5" /><text x={2} y={y(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text></g>))}
          <line x1={padX} x2={W - padX} y1={y(avg)} y2={y(avg)} stroke={C.muted} strokeWidth="1" strokeDasharray="2 4" opacity={0.55} />
          <path d={area} fill="url(#resAreaGrad2)" />
          <path d={path} fill="none" stroke={C.blue500} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((v, i) => (<g key={i}><circle cx={x(i)} cy={y(v)} r="5" fill={scoreColor(v)} stroke="#fff" strokeWidth="2" /><text x={x(i)} y={H - 4} textAnchor="middle" fontSize="7.5" fontFamily={F.mono} fill={C.muted}>Q{i + 1}</text></g>))}
        </svg>
      </div>
    </div>
  );
};
ScoreProgressionCompact.propTypes = { questions: PropTypes.array.isRequired };

// ─── PaceVsScoreLabeled ───────────────────────────────────────────────────────

const PaceVsScoreLabeled = ({ questions }) => {
  const points = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && Number(q.timeTaken) > 0).map(q => ({ time: Number(q.timeTaken), score: clamp(q.aiFeedback.score), index: q.index, topic: q.topic }));
  if (points.length < 3) return (
    <div>
      {points.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {points.map(p => (<div key={p.index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 11px", borderRadius: 9, background: C.card, border: `1px solid ${C.border}` }}><span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Q{p.index + 1} · {p.topic}</span><span style={{ display: "flex", gap: 10 }}><span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{formatTime(p.time)}</span><span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 800, color: scoreColor(p.score) }}>{p.score}</span></span></div>))}
          <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>Need 3+ timed answers for the chart. {points.length} so far.</p>
        </div>
      ) : <p style={{ margin: 0, fontSize: 11, color: C.muted }}>No timed, evaluated questions yet.</p>}
    </div>
  );
  const times = points.map(p => p.time);
  const sortedTimes = [...times].sort((a, b) => a - b), midIdx2 = Math.floor(sortedTimes.length / 2);
  const medianTime = sortedTimes.length % 2 ? sortedTimes[midIdx2] : (sortedTimes[midIdx2 - 1] + sortedTimes[midIdx2]) / 2;
  const fast = points.filter(p => p.time <= medianTime), slow = points.filter(p => p.time > medianTime);
  const avgOf = list => list.length ? Math.round(list.reduce((s, p) => s + p.score, 0) / list.length) : null;
  const fastAvg = avgOf(fast), slowAvg = avgOf(slow);
  let read = null;
  if (fastAvg != null && slowAvg != null) {
    const gap = fastAvg - slowAvg;
    if (gap >= 12)       read = { text: `Quicker answers scored ${gap} pts higher — extra time isn't converting.`,    color: C.blue500 };
    else if (gap <= -12) read = { text: `Slower answers scored ${Math.abs(gap)} pts higher — depth pays off.`,        color: C.green  };
    else                 read = { text: "Score held steady regardless of pace.",                                       color: C.muted  };
  }
  const W = 540, H = 200, padX = 30, padY = 20;
  const maxTime = Math.max(...times) * 1.08, xp = t => padX + (Math.min(t, maxTime) / maxTime) * (W - padX * 2), yp = s => H - padY - (clamp(s) / 100) * (H - padY * 2);
  const midX = xp(medianTime), midY = yp(60);
  return (
    <div>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 320, display: "block" }}>
          {[40, 60, 80].map(l => (<g key={l}><line x1={padX} x2={W - padX} y1={yp(l)} y2={yp(l)} stroke={C.border} strokeDasharray="4 5" /><text x={2} y={yp(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text></g>))}
          <line x1={midX} x2={midX} y1={padY} y2={H - padY} stroke={C.borderMd} strokeDasharray="3 4" />
          <line x1={padX} x2={W - padX} y1={midY} y2={midY} stroke={C.borderMd} strokeDasharray="3 4" />
          <text x={midX + 4} y={padY + 10} fontSize="7.5" fontFamily={F.mono} fill={C.faint}>median · {formatTime(medianTime)}</text>
          {points.map((p, i) => (<circle key={i} cx={xp(p.time)} cy={yp(p.score)} r="6" fill={scoreColor(p.score)} fillOpacity="0.88" stroke="#fff" strokeWidth="1.5"><title>{`Q${p.index + 1} · ${formatTime(p.time)} · ${p.score}/100`}</title></circle>))}
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        {[{ label: `faster half · ${fast.length}q`, value: fastAvg, bg: C.blue50, border: C.blue500 }, { label: `slower half · ${slow.length}q`, value: slowAvg, bg: C.greenTint, border: C.green }].map((cell, i) => (
          <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: cell.bg, border: `1px solid ${cell.border}30` }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 600, color: C.muted, marginBottom: 4 }}>{cell.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>{cell.value != null ? `${cell.value}/100` : "—"}</div>
          </div>
        ))}
      </div>
      {read && <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: C.sub }}>{read.text}</div>}
    </div>
  );
};
PaceVsScoreLabeled.propTypes = { questions: PropTypes.array.isRequired };

// ─── Error boundary + AnimatedSection ────────────────────────────────────────

class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("[Result section error]", err); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: "14px 18px", borderRadius: 12, marginBottom: 10, background: C.redTint, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>This section ran into a problem</div>
          <button onClick={() => this.setState({ hasError: false })} style={{ color: C.blue500, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}>Try again</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

const AnimatedSection = ({ children, delay = 0, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.06 });
    const t = setTimeout(() => observer.observe(el), delay);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [delay]);
  return (<div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: `opacity 0.5s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.5s cubic-bezier(.16,1,.3,1) ${delay}ms`, ...style }}>{children}</div>);
};
AnimatedSection.propTypes = { children: PropTypes.node.isRequired, delay: PropTypes.number, style: PropTypes.object };

// ─── ScoreArc + CaptionBlock + ResultHero ─────────────────────────────────────

const ScoreArc = ({ score }) => {
  const [displayed, setDisplayed]     = useState(0);
  const [arcProgress, setArcProgress] = useState(0);
  const grade = getGrade(score);
  useEffect(() => {
    let frame;
    const start = performance.now(), duration = 1100;
    const tick = (now) => { const t = Math.min((now - start) / duration, 1), eased = 1 - Math.pow(1 - t, 3); setDisplayed(Math.round(eased * score)); setArcProgress(eased * score); if (t < 1) frame = requestAnimationFrame(tick); };
    const delay = setTimeout(() => { frame = requestAnimationFrame(tick); }, 180);
    return () => { clearTimeout(delay); cancelAnimationFrame(frame); };
  }, [score]);
  const R = 88, CX = 110, CY = 114, startAngle = 150, sweep = 240;
  const arcPath = (pct) => { const minPct = Math.max(pct, 4), angle = startAngle + (sweep * minPct) / 100, sx = CX + R * Math.cos(toRad(startAngle)), sy = CY + R * Math.sin(toRad(startAngle)), ex = CX + R * Math.cos(toRad(angle)), ey = CY + R * Math.sin(toRad(angle)), large = (sweep * minPct) / 100 > 180 ? 1 : 0; if (pct >= 99.9) { const mx = CX + R * Math.cos(toRad(startAngle + sweep / 2)), my = CY + R * Math.sin(toRad(startAngle + sweep / 2)); return `M ${sx} ${sy} A ${R} ${R} 0 0 1 ${mx} ${my} A ${R} ${R} 0 0 1 ${ex} ${ey}`; } return `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`; };
  const trackPath = arcPath(100), fillPath = arcPath(arcProgress);
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={220} height={210} viewBox="0 0 220 210" style={{ overflow: "visible" }}>
        <circle cx={CX} cy={CY} r={R + 16} fill="none" stroke={grade.accent} strokeWidth="1.5" opacity="0.14" />
        <circle cx={CX} cy={CY} r={R + 28} fill="none" stroke={grade.accent} strokeWidth="1"   opacity="0.06" />
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" strokeLinecap="round" />
        {fillPath && <path d={fillPath} fill="none" stroke={grade.accent} strokeWidth="11" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${grade.glow}88)` }} />}
        {[0, 25, 50, 75, 100].map(pct => { const angle = toRad(startAngle + (sweep * pct) / 100), inner = R - 7, outer = R + 7; return <line key={pct} x1={CX + inner * Math.cos(angle)} y1={CY + inner * Math.sin(angle)} x2={CX + outer * Math.cos(angle)} y2={CY + outer * Math.sin(angle)} stroke="rgba(255,255,255,0.2)" strokeWidth={pct === 0 || pct === 100 ? "2.5" : "1.5"} />; })}
        <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: F.display, fontSize: 52, fontWeight: 900, fill: "#fff", letterSpacing: "-2px" }}>{displayed}</text>
        <text x={CX} y={CY + 24} textAnchor="middle" style={{ fontFamily: F.mono, fontSize: 10.5, fill: "rgba(255,255,255,0.38)", letterSpacing: "0.5px" }}>/ 100</text>
      </svg>
    </div>
  );
};

const CaptionBlock = ({ captions, accentColor }) => {
  const [idx, setIdx] = useState(0), [visible, setVisible] = useState(true);
  useEffect(() => { const interval = setInterval(() => { setVisible(false); setTimeout(() => { setIdx(i => (i + 1) % captions.length); setVisible(true); }, 300); }, 3400); return () => clearInterval(interval); }, [captions.length]);
  const item = captions[idx];
  return (
    <div style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "16px 18px", minHeight: 100, transition: "opacity 0.3s ease, transform 0.3s ease", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(6px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${accentColor}22`, border: `1px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{item.icon}</div>
        <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: accentColor, letterSpacing: "0.8px" }}>{item.tag}</span>
        <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
          {captions.map((_, i) => <div key={i} style={{ width: i === idx ? 14 : 5, height: 4, borderRadius: 999, background: i === idx ? accentColor : "rgba(255,255,255,0.25)", transition: "all 0.3s ease" }} />)}
        </div>
      </div>
      <div style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 700, color: "#fff", lineHeight: 1.38, marginBottom: 4 }}>{item.headline}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{item.body}</div>
    </div>
  );
};

const ResultHero = ({ result, navigate, onCopy, copied }) => {
  const score = result.score, v = getVerdict(score), trendDelta = result.trendDelta, hasTrend = trendDelta != null && result.scoreHistory?.length >= 2, grade = getGrade(score), reveal = useSequentialReveal();
  const captions = [
    { icon: "📊", tag: "Session insight", headline: score >= 80 ? "Strong fundamentals across the board." : score >= 60 ? "Foundation is there — edges need work." : "Clear gaps identified. Use them as a roadmap.", body: score >= 80 ? "Your answers show consistency and depth. Now isolate weak spots." : score >= 60 ? "You're in range. A few targeted reps will push you to the next tier." : "Every weak answer is a specific, fixable thing. Start there." },
    { icon: "🎯", tag: "Next move", headline: result.weakAnswers > 0 ? `${result.weakAnswers} answer${result.weakAnswers > 1 ? "s" : ""} below 60 — drill those topics.` : "All answers cleared 60. Raise difficulty next.", body: result.weakAnswers > 0 ? "Open the question review below." : "You're past the basics. Add harder questions to keep the signal useful." },
    { icon: "⚡", tag: "Pace check", headline: `${formatTime(result.averageTime)} per question on average.`, body: result.averageTime < 90 ? "Quick responses — verify depth, not just speed." : result.averageTime > 180 ? "Taking your time. Check if slower answers scored higher." : "Pace is in a healthy range." },
    { icon: "📈", tag: "Trend", headline: hasTrend ? `${trendDelta >= 0 ? "+" : ""}${Number(trendDelta).toFixed(1)} pts vs last session.` : `${result.answeredQuestions}/${result.totalQuestions} answered.`, body: hasTrend && trendDelta >= 0 ? "You're moving in the right direction." : hasTrend ? "Score dipped — check topic mix or answer depth." : `${result.strongAnswers > 0 ? `${result.strongAnswers} strong answers scored 80+.` : "First rep is always a diagnostic. Use it well."}` },
  ];
  return (
    <section style={S.hero} className="res-hero">
      <GradeFlashOverlay score={score} />
      <div style={S.heroScan} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      <div style={{ position: "absolute", right: -60, bottom: -80, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${grade.glow}20 0%, transparent 68%)`, pointerEvents: "none" }} />
      <div style={S.heroGrid} className="res-hero-grid">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <div style={revealStyle.fadeUp(reveal.arc)}><ScoreArc score={score} /></div>
          <GradeBadgeDrop score={score} visible={reveal.grade} />
          {hasTrend && (<div style={{ ...S.trendChip, ...revealStyle.fade(reveal.grade, 80) }}><span style={{ color: trendDelta >= 0 ? C.green : C.amber, fontWeight: 800 }}>{trendDelta >= 0 ? "▲" : "▼"}</span><span style={{ color: "rgba(255,255,255,0.62)", fontSize: 10.5 }}>{Math.abs(Number(trendDelta)).toFixed(1)} pts vs last session</span></div>)}
        </div>
        <div>
          <div style={revealStyle.fadeUp(reveal.arc, 60)}>
            <div style={S.heroKicker}>Post-interview debrief</div>
            <h1 style={S.heroH1} className="res-hero-h1">{v.headline}</h1>
            <p style={S.heroSub} className="res-hero-sub">{v.body}</p>
          </div>
          <div style={{ ...S.miniStats, ...revealStyle.fade(reveal.stats) }}>
            <MiniStatItem value={result.strongAnswers} label="strong" color={C.green} index={0} visible={reveal.stats} />
            <div style={S.miniDivider} />
            <MiniStatItem value={result.weakAnswers} label="to fix" color={result.weakAnswers > 0 ? C.amber : "rgba(255,255,255,0.45)"} index={1} visible={reveal.stats} />
            <div style={S.miniDivider} />
            <MiniStatItem value={formatTime(result.averageTime)} label="avg / q" color={C.cyan400} index={2} visible={reveal.stats} />
            <div style={S.miniDivider} />
            <MiniStatItem value={`${result.answeredQuestions}/${result.totalQuestions}`} label="answered" color="rgba(255,255,255,0.7)" index={3} visible={reveal.stats} />
          </div>
          <div style={{ marginTop: 14, maxWidth: 380, ...revealStyle.fade(reveal.caption) }}>
            <CaptionBlock captions={captions} accentColor={grade.accent} />
          </div>
          <div style={{ ...S.heroActions, ...revealStyle.fade(reveal.actions) }} className="res-hero-actions">
            <button style={S.btnPrimary} className="res-btn-primary" onClick={() => navigate("/interview")}>Start another interview</button>
            <button style={S.btnGhost}   className="res-btn-ghost"   onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button style={S.btnGhost}   className="res-btn-ghost"   onClick={onCopy}>{copied ? "Copied ✓" : "Copy summary"}</button>
          </div>
        </div>
      </div>
    </section>
  );
};
ResultHero.propTypes = { result: PropTypes.object.isRequired, navigate: PropTypes.func.isRequired, onCopy: PropTypes.func.isRequired, copied: PropTypes.bool.isRequired };

// ─── Global styles ────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @keyframes livePulse  { 0%,100%{opacity:1}50%{opacity:0.28} }
    @keyframes mmHeroScan { 0%{transform:translateX(-100%)}100%{transform:translateX(650%)} }
    @keyframes scaleIn    { from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)} }
    @keyframes badgeGlow  { 0%,100%{box-shadow:0 0 0 rgba(139,92,246,0)}50%{box-shadow:0 0 10px rgba(139,92,246,0.35)} }
    @keyframes insightBarPulse{0%{opacity:0;transform:scaleY(0);transform-origin:top}40%{opacity:1;transform:scaleY(1)}70%{opacity:1}100%{opacity:0.7}}
    *,*::before,*::after{box-sizing:border-box}
    .res-page button:focus-visible{outline:2px solid ${C.blue500};outline-offset:3px;border-radius:6px}
    .res-rail-cell:hover{background:${cardAlt}!important}
    .res-btn-primary{transition:transform 0.15s cubic-bezier(.16,1,.3,1),box-shadow 0.15s ease!important}
    .res-btn-primary:hover{transform:translateY(-2px)!important;box-shadow:0 10px 26px rgba(0,0,0,0.28)!important}
    .res-btn-ghost{transition:background 0.15s ease,transform 0.15s ease!important}
    .res-btn-ghost:hover{background:rgba(255,255,255,0.14)!important;transform:translateY(-1px)!important}
    @media(prefers-reduced-motion:reduce){.res-page *{animation:none!important;transition-duration:0.01ms!important}}
    @media(max-width:1020px){.res-hero-grid{grid-template-columns:1fr!important;gap:24px!important}.res-stat-rail{grid-template-columns:repeat(2,1fr)!important}}
    @media(max-width:760px){.res-banner{flex-direction:column!important;align-items:flex-start!important}.res-hero{padding:24px 18px!important}.res-recovery-grid{grid-template-columns:1fr!important}}
    @media(max-width:480px){.res-stat-rail{grid-template-columns:1fr!important}.res-page{padding:12px 10px 60px!important}.res-hero{padding:20px 14px!important;border-radius:14px!important}.res-hero-actions button{flex:1 1 auto!important;min-width:0!important}}
  `}</style>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:      { minHeight: "100vh", background: C.bg, backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(26,110,255,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,200,240,0.04) 0%, transparent 40%)`, padding: "20px 24px 60px", fontFamily: F.body },
  container: { maxWidth: 1080, margin: "0 auto" },
  strip:     { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", marginBottom: 14, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripL:    { display: "flex", alignItems: "center", gap: 8 },
  liveDot:   { width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "livePulse 2.4s ease-in-out infinite" },
  mono:      { fontFamily: F.mono, fontSize: 10, letterSpacing: "0.3px", color: C.muted },
  hero:      { position: "relative", overflow: "hidden", padding: "36px 32px", marginBottom: 14, borderRadius: 20, background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 44%, ${C.blue600} 72%, ${C.cyan600} 100%)`, boxShadow: "0 24px 60px rgba(10,30,100,0.36)" },
  heroScan:  { position: "absolute", top: 0, left: 0, width: "18%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)", animation: "mmHeroScan 10s linear infinite", pointerEvents: "none" },
  heroGrid:  { position: "relative", display: "grid", gridTemplateColumns: "240px 1fr", gap: 40, alignItems: "center" },
  trendChip: { display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: F.mono, fontSize: 10, marginTop: 7 },
  heroKicker:{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, letterSpacing: "1.8px", color: C.cyan400, textTransform: "uppercase", opacity: 0.9 },
  heroH1:    { margin: "12px 0 0", fontFamily: F.display, fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.8px", maxWidth: 520 },
  heroSub:   { margin: "12px 0 0", fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.62)", maxWidth: 490, fontWeight: 400 },
  miniStats: { display: "flex", alignItems: "center", gap: 0, marginTop: 18, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(8px)", width: "fit-content" },
  miniDivider:{ width: 1, height: 28, background: "rgba(255,255,255,0.12)", flexShrink: 0 },
  heroActions:{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 },
  btnPrimary: { border: "none", borderRadius: 10, background: "#fff", color: C.blue900, padding: "10px 18px", fontSize: 12.5, fontWeight: 700, fontFamily: F.body, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.22)" },
  btnGhost:   { border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.82)", padding: "10px 18px", fontSize: 12.5, fontWeight: 700, fontFamily: F.body, cursor: "pointer" },
};

// ─── Result (main) ────────────────────────────────────────────────────────────

const Result = () => {
  const sessionIdRef = useRef(null);
if (sessionIdRef.current === null) {
  sessionIdRef.current = Math.random().toString(36).slice(2, 8).toUpperCase();
}

  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result || location.state;

  const [copied,setCopied]      = useState(false);
  const [downloading, setDownloading] = useState(false);
  const shareCardRef = useRef(null);

  useEffect(() => { if (!result) navigate("/"); }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  const normalizedQuestions = useMemo(() => questions.map((q, i) => normalizeQuestion(q, i)), [questions]);
  const evaluated  = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number"), [normalizedQuestions]);
  const answered   = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped"), [normalizedQuestions]);
  const skipped    = useMemo(() => normalizedQuestions.filter(q => q.skipped), [normalizedQuestions]);

  const strongAnswers = evaluated.filter(q => q.aiFeedback.score >= 80).length;
  const weakAnswers   = evaluated.filter(q => q.aiFeedback.score < 60).length;
  const averageTime   = answered.length ? Math.round(answered.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0) / answered.length) : 0;

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
    if (evaluated.length === 0) status = "no-eval";
    else if (!anyTaggedEvaluated) status = "no-topic-field";
    return { topicAverages: averages, topicStatus: status };
  }, [normalizedQuestions, evaluated.length]);

  const weakestTopic = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

  const nextStepText = useMemo(() => {
    if (skipped.length > 0 && weakAnswers === 0) return `You skipped ${skipped.length} question${skipped.length > 1 ? "s" : ""} — a full pass at your current pace would likely raise this score.`;
    if (weakestTopic && weakAnswers > 0) return `${weakAnswers} answer${weakAnswers > 1 ? "s" : ""} scored below 60, concentrated in ${weakestTopic.topic}. Start your next rep there.`;
    if (strongAnswers === evaluated.length && evaluated.length > 0) return "Every evaluated answer scored 80+. Raise the difficulty next time to keep the signal useful.";
    return "Review the answers below, then queue another session to build on this one.";
  }, [skipped.length, weakAnswers, weakestTopic, strongAnswers, evaluated.length]);

  const handleCopy = useCallback(async () => {
    const strongestTopic = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
    const lines = [`MockMate result: ${totalScore}/100 — ${getLabel(totalScore)}`, `${answered.length}/${normalizedQuestions.length} answered`, `${strongAnswers} strong · ${weakAnswers} need work · ${skipped.length} skipped`, strongestTopic ? `Strongest: ${strongestTopic.topic} (${strongestTopic.avg}/100)` : "", weakestTopic ? `Focus area: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : ""].filter(Boolean);
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard unavailable */ }
  }, [totalScore, answered.length, normalizedQuestions.length, strongAnswers, weakAnswers, skipped.length, topicAverages, weakestTopic]);

  const handleDownload = useCallback(async () => {
    if (!shareCardRef.current || downloading) return;
    setDownloading(true);
    const toastId = toast.loading("Preparing your image…");
    try {
      const url = await toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2.5, width: shareCardRef.current.offsetWidth, height: shareCardRef.current.offsetHeight });
      const link = document.createElement("a");
      link.download = `mockmate-result-${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.dismiss(toastId);
      toast.success("Image saved!");
    } catch (err) {
      toast.dismiss(toastId);
      console.error("Result image export failed:", err);
      toast.error("Could not create the image — try again.");
    } finally { setDownloading(false); }
  }, [downloading]);

  const heroResult = {
    score:             totalScore,
    sessionId,
    totalQuestions:    normalizedQuestions.length,
    answeredQuestions: answered.length,
    skippedQuestions:  skipped.length,
    strongAnswers,
    weakAnswers,
    averageTime,
    topTopic:          [...topicAverages].sort((a, b) => b.avg - a.avg)[0]?.topic ?? null,
    weakestTopicName:  weakestTopic?.topic ?? null,
    trendDelta:        result?.trendDelta   ?? null,
    scoreHistory:      result?.scoreHistory ?? [],
  };

  if (!result) return null;

  return (
    <div style={S.page} className="res-page">
      <GlobalStyles />
      <div style={S.container}>

        <AnimatedSection delay={0}>
          <div style={S.strip}>
            <div style={S.stripL}>
              <span style={S.liveDot} />
              <span style={S.mono}>mockmate · post-interview debrief</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {sessionId && <span style={S.mono}>session {sessionIdRef.current}</span>}
              <span style={{ color: C.borderMd }}>·</span>
              <span style={S.mono}>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase()}</span>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={40}>
          <SectionErrorBoundary>
            <ResultHeroV2 result={heroResult} navigate={navigate} onCopy={handleCopy} copied={copied} onDownloadImage={handleDownload} downloading={downloading} />
          </SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={80}>
          <SectionErrorBoundary>
            <ScoreCardDrawer result={heroResult} totalScore={totalScore} normalizedQuestions={normalizedQuestions}  />
          </SectionErrorBoundary>
        </AnimatedSection>

        <ShareCard result={heroResult} cardRef={shareCardRef} />

        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <StatRailV2 result={heroResult} scoreHistory={result?.scoreHistory ?? []} />
          </SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <BadgeSessionBridge streak={streak} newBadges={newBadges} navigate={navigate} />
            {/* ── EXTRACTED: ResultActions replaces NextStepBanner ── */}
            <ResultActions nextStepText={nextStepText} weakestTopic={weakestTopic} navigate={navigate} score={totalScore} />
          </SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            {/* ── EXTRACTED: ScoreSummary replaces SummaryStrip ── */}
            <ScoreSummary topicAverages={topicAverages} topicStatus={topicStatus} averageTime={averageTime} totalScore={totalScore} />
          </SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <TabbedAnalytics questions={normalizedQuestions} totalScore={totalScore} result={result} scoreHistory={result?.scoreHistory ?? []} />
          </SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            {/* ── EXTRACTED: FeedbackList replaces QuestionReview ── */}
            <FeedbackList questions={normalizedQuestions} sessionId={sessionId} />
          </SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={0}>
          <footer style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, padding: "16px 4px 0", opacity: 0.38 }}>
            <span style={S.mono}>mockmate result page · v14</span>
            <span style={S.mono}>scores normalized 0–100 · computed post-session</span>
          </footer>
        </AnimatedSection>

      </div>
    </div>
  );
};

export default Result;


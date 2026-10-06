import { useState, useMemo, useCallback, useRef, useEffect, useId } from "react";
import PropTypes from "prop-types";
import { retryQuestion } from '../../Services/interviewService';
import { usePendingAnswers } from '../../hooks/usePendingAnswers';
import usePlan from '../../hooks/usePlan';
import useUpgrade from '../../hooks/useUpgrade';
import LockedInsights from '../pro/LockedInsights';
import ProBadge from '../pro/ProBadge';
import { C, F } from "../../styles/token";
import { Icon, scrollToId } from "./ResultNav";



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

const formatTime = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

// AI feedback often arrives as "1. First point. 2. Second point." - split that
// into clean items (no numbering) so previews and lists never show a bare "1.".
const splitPoints = (text = "") => {
  if (!text) return [];
  const byNum = text.split(/(?<!\d)\d+[.)]\s+/).map((x) => x.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  const bySentence = text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  return bySentence.length > 1 ? bySentence : [text.trim()];
};

const toOneLine = (text, maxLen = 100) => {
  if (!text) return "";
  const s = (splitPoints(text)[0] || text).trim();
  return s.length <= maxLen ? s : `${s.slice(0, maxLen - 1).trim()}…`;
};

const normalizeFeedback = (question) => {
  if (!question) return null;
  const raw = question.feedback;
  const isObjective = ["mcq", "aptitude"].includes(question.questionType);
  if (isObjective) {
    const correct =
      typeof question.userAnswerIndex === "number" && typeof question.correctAnswerIndex === "number"
        ? question.userAnswerIndex === question.correctAnswerIndex
        : raw === "Correct answer." ? true : raw === "Incorrect answer." ? false : null;
    return {
      score: typeof question.score === "number" ? question.score : correct ? 100 : 0,
      correct, good: "", missing: "", idealHint: "", tip: "", sampleAnswer: "",
      aiAvailable: true, fallback: false,
    };
  }
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      score:        typeof question.score === "number" ? question.score : Number(question.score || 0),
      correct:      question.correct ?? parsed.correct ?? null,
      good:         parsed.good        || "",
      missing:      parsed.missing     || "",
      idealHint:    parsed.idealHint   || "",
      tip:          parsed.tip         || "",
      sampleAnswer: parsed.sampleAnswer|| "",
      aiAvailable:  parsed.aiAvailable !== false,
      fallback:     parsed.fallback    === true,
      skippedPending: parsed.skippedPending === true,
      tier:         parsed.tier || "full",
      locked:       parsed.locked || null,
      teasers:      parsed.teasers || null,
    };
  } catch { return null; }
};

const getTakeaway = (question) => {
  if (question.skipped && question._pending)
    return { text: "Skipped — model answer is being generated…", tone: "neutral" };
  if (question.skipped && question.aiFeedback?.fallback)
    return { text: "Skipped — generic guidance only (AI was unavailable).", tone: "neutral" };
  if (question.skipped) return { text: "Skipped — no answer submitted.", tone: "neutral" };
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  const fb = question.aiFeedback;
  if (objective) {
    if (fb?.correct === true)  return { text: "Correct answer.", tone: "good" };
    if (fb?.correct === false) return { text: "Incorrect — see the explanation below.", tone: "bad" };
    return { text: "Answer recorded.", tone: "neutral" };
  }
  if (!fb || fb.aiAvailable === false) return { text: "AI evaluation unavailable for this answer.", tone: "neutral" };
  const score = clamp(fb.score);
  if (score >= 80 && fb.good)    return { text: toOneLine(fb.good),    tone: "good" };
  if (score < 60  && fb.missing) return { text: toOneLine(fb.missing), tone: "bad" };
  if (fb.tip)  return { text: toOneLine(fb.tip),  tone: "neutral" };
  if (fb.good) return { text: toOneLine(fb.good), tone: "neutral" };
  return { text: "Reviewed — open for the full breakdown.", tone: "neutral" };
};

const toneColor = (tone) => (tone === "good" ? C.green : tone === "bad" ? C.red : C.sub);

const cardAlt = C.cardAlt;

// ─── CrossSignalInsight (private copy — also lives in Result.jsx for TabbedAnalytics)
// TODO: extract to src/components/Result/CrossSignalInsight.jsx and import in both places

const detectCrossSignal = (questions) => {
  const scored = questions
    .filter(q => !q.skipped && typeof q.aiFeedback?.score === "number")
    .map(q => ({
      index: typeof q.index === "number" ? q.index : 0,
      score: clamp(q.aiFeedback.score),
      time:  Number(q.timeTaken || 0),
      topic: q.topic || "General",
      skipped: false,
    }))
    .sort((a, b) => a.index - b.index);
  const skipped = questions.filter(q => q.skipped);
  if (scored.length < 3) return null;
  const avg   = scored.reduce((s, q) => s + q.score, 0) / scored.length;
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
      return {
        pattern: "RUSHING", priority: 1,
        sentence: topRushTopic
          ? `Your fastest answers on ${topRushTopic} scored ${gap} pts lower than your slower ones — you're rushing past the questions that need depth most.`
          : `Your fastest answers scored ${gap} pts lower than your slower ones. Speed is costing you here, not helping.`,
        accent: C.amber, icon: "⚡",
      };
    }
    const fastAvg2 = fastHalf.reduce((s, q) => s + q.score, 0) / fastHalf.length;
    const slowAvg2 = slowHalf.reduce((s, q) => s + q.score, 0) / slowHalf.length;
    if (fastAvg2 - slowAvg2 >= 14) {
      const gap = Math.round(fastAvg2 - slowAvg2);
      return {
        pattern: "DEPTH_SPEED_TRADEOFF", priority: 2,
        sentence: `Taking more time didn't help — your quicker answers scored ${gap} pts higher on average. Trust your first instinct more.`,
        accent: C.blue500, icon: "⏱",
      };
    }
  }

  const topicProgression = {};
  scored.forEach(q => {
    if (!topicProgression[q.topic]) topicProgression[q.topic] = [];
    topicProgression[q.topic].push(q);
  });
  for (const [topic, qs] of Object.entries(topicProgression)) {
    if (qs.length < 2) continue;
    const firstScore = qs[0].score, lastScore = qs[qs.length - 1].score;
    if (firstScore >= 70 && lastScore < 55) {
      const drop = Math.round(firstScore - lastScore);
      return {
        pattern: "TOPIC_COLLAPSE", priority: 3,
        sentence: `You opened ${topic} at ${firstScore} and dropped ${drop} pts by the end of it — initial knowledge is there, but depth ran out under follow-up.`,
        accent: C.amber, icon: "📉",
      };
    }
  }

  const mid        = Math.floor(scored.length / 2);
  const firstHalf  = scored.slice(0, mid), secondHalf = scored.slice(mid);
  const firstAvg   = firstHalf.reduce((s, q)  => s + q.score, 0) / firstHalf.length;
  const secondAvg  = secondHalf.reduce((s, q) => s + q.score, 0) / secondHalf.length;
  if (firstAvg - secondAvg >= 16) {
    const drop = Math.round(firstAvg - secondAvg);
    return { pattern: "FRONT_LOAD", priority: 4, sentence: `You started ${Math.round(firstAvg)} and finished ${Math.round(secondAvg)} — a ${drop}-pt drop across the session. Stamina or topic order, not ability.`, accent: C.amber, icon: "📊" };
  }
  if (secondAvg - firstAvg >= 16) {
    const gain = Math.round(secondAvg - firstAvg);
    return { pattern: "BACK_LOAD", priority: 5, sentence: `You warmed up as the session went on — second half averaged ${gain} pts higher than the first. In a real interview, front-load your best.`, accent: C.green, icon: "📈" };
  }

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

const CrossSignalInsight = ({ questions }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const signal = useMemo(() => detectCrossSignal(questions), [questions]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !signal) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [signal]);
  if (!signal) return null;
  return (
    <div
      ref={ref}
      style={{
        marginBottom: 12, borderRadius: 12, overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.6s cubic-bezier(.16,1,.3,1), transform 0.6s cubic-bezier(.16,1,.3,1)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "4px 1fr" }}>
        <div style={{ background: signal.accent }} />
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
            background: `${signal.accent}09`, border: `1px solid ${signal.accent}25`,
            borderLeft: "none", borderRadius: "0 10px 10px 0",
          }}
        >
          <div
            style={{
              width: 30, height: 30, borderRadius: 8, background: `${signal.accent}15`,
              border: `1px solid ${signal.accent}35`, display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
            }}
          >
            {signal.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: F.mono, fontSize: 10, fontWeight: 700,
                color: signal.accent, letterSpacing: "0.8px", marginBottom: 4, opacity: 0.75,
              }}
            >
              {signal.pattern.replace(/_/g, " ").toLowerCase()} · session pattern
            </div>
            <p style={{ margin: 0, fontFamily: F.display, fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.45, letterSpacing: "-0.2px" }}>
              {signal.sentence}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
CrossSignalInsight.propTypes = { questions: PropTypes.array.isRequired };

// ─── FeedbackBlock ────────────────────────────────────────────────────────────

const FeedbackBlock = ({ label, value, color, background }) => (
  <div style={{ padding: 11, borderRadius: 10, background, border: `1px solid ${color}25` }}>
    <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color, letterSpacing: "0.5px", marginBottom: 5 }}>
      {label}
    </div>
    {(() => {
      const pts = splitPoints(value);
      if (pts.length <= 1) return <div style={{ fontSize: 12, lineHeight: 1.65, color: C.text }}>{value || "No additional readout."}</div>;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pts.map((pt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 8 }} />
              <span style={{ fontSize: 12, lineHeight: 1.6, color: C.text, flex: 1 }}>{pt}</span>
            </div>
          ))}
        </div>
      );
    })()}
  </div>
);
FeedbackBlock.propTypes = {
  label:      PropTypes.string.isRequired,
  value:      PropTypes.string,
  color:      PropTypes.string.isRequired,
  background: PropTypes.string.isRequired,
};

// ─── Pill ─────────────────────────────────────────────────────────────────────

const Pill = ({ children, color = C.blue500, background = C.blue50 }) => (
  <span
    style={{
      display: "inline-flex", alignItems: "center", borderRadius: 999,
      padding: "3px 9px", background, color,
      fontFamily: F.mono, fontSize: 10, fontWeight: 700, border: `1px solid ${color}30`,
    }}
  >
    {children}
  </span>
);
Pill.propTypes = {
  children:   PropTypes.node.isRequired,
  color:      PropTypes.string,
  background: PropTypes.string,
};

// ─── usePulse ─────────────────────────────────────────────────────────────────
// FeedbackList has no <style> tag for @keyframes, so we toggle a boolean on an
// interval instead. The interval only exists while `active` is true and is
// always cleared, so idle cards cost nothing.

const usePulse = (active) => {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setOn((v) => !v), 700);
    return () => clearInterval(id);
  }, [active]);
  return active ? on : true;
};

// ─── PendingBanner ────────────────────────────────────────────────────────────

const PendingBanner = ({ count, onDismiss }) => (
  <div
    role="status"
    aria-live="polite"
    style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      marginBottom: 12, borderRadius: 10,
      background: C.blue50, border: `1px solid ${C.blue500}30`,
    }}
  >
    <span style={{ fontSize: 13 }} aria-hidden="true">⏳</span>
    <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.5, color: C.text }}>
      Model answers generating for {count} skipped question{count === 1 ? "" : "s"} — cards update automatically.
    </span>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss notice"
      style={{
        flexShrink: 0, border: "none", background: "transparent", cursor: "pointer",
        color: C.muted, fontSize: 14, lineHeight: 1, padding: "2px 6px",
      }}
    >
      ✕
    </button>
  </div>
);
PendingBanner.propTypes = {
  count:     PropTypes.number.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

// ─── QuestionCard ─────────────────────────────────────────────────────────────

const QuestionCard = ({ question, open, onToggle, onRetry, retrying, onStep, hasPrev, hasNext, total }) => {
  const idx       = question._index;
  const panelId   = `res-q-panel-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const feedback  = question.aiFeedback;
  const pending   = Boolean(question._pending);
  const timedOut  = Boolean(question._timedOut);
  const pulse     = usePulse(pending);
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  const isEval    = Boolean(
    feedback && feedback.aiAvailable !== false &&
    (typeof feedback.score === "number" || objective)
  );
  const score     = isEval && !objective ? feedback.score : null;
  const takeaway  = useMemo(() => getTakeaway(question), [question]);
  const hasTime   = Number(question.timeTaken) > 0;
  const canRetry  = !objective && !question.skipped && question.userAnswer?.trim() && question.id;
  const { canUseFeature } = usePlan();
  const { openUpgrade }   = useUpgrade();
  const basic             = feedback?.tier === "basic";
  // Re-evaluating is Pro — except when OUR evaluator failed, which must stay free to fix.
  const evalFailed        = feedback?.aiAvailable === false || feedback?.fallback === true;
  const retryAllowed      = canUseFeature("retryQuestion") || evalFailed;

  const badgeColor = question.skipped
    ? C.muted
    : objective
      ? (feedback?.correct === true ? C.green : feedback?.correct === false ? C.red : C.muted)
      : (isEval ? scoreColor(score) : C.muted);

  const badgeBg = question.skipped
    ? cardAlt
    : objective
      ? (feedback?.correct === true ? C.greenTint : feedback?.correct === false ? C.redTint : cardAlt)
      : (isEval ? scoreTint(score) : cardAlt);

  return (
    <div
      id={`res-q-${idx}`}
      style={{
        scrollMarginTop: "calc(var(--res-sticky-top, 84px) + 62px)",
        border: `1px solid ${pending ? C.amber : open ? C.borderMd : C.border}`,
        borderRadius: 12, background: open ? cardAlt : C.card,
        overflow: "hidden", transition: "border-color 0.2s ease, opacity 0.3s ease",
        opacity: pending ? (pulse ? 1 : 0.72) : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <button
          type="button"
          onClick={() => onToggle(idx)}
          aria-expanded={open}
          aria-controls={panelId}
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center",
            gap: 12, padding: "12px 8px 12px 14px",
            border: "none", background: "transparent", cursor: "pointer",
            textAlign: "left", font: "inherit", color: "inherit",
          }}
        >
          <div
            style={{
              flexShrink: 0, width: 42, height: 42, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column",
              background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}25`,
            }}
          >
            {question.skipped ? (
              <span style={{ fontSize: 14, fontWeight: 700 }}>—</span>
            ) : objective ? (
              <span style={{ fontSize: 17, fontWeight: 900 }}>
                {feedback?.correct === true ? "✓" : feedback?.correct === false ? "✕" : "?"}
              </span>
            ) : isEval ? (
              <>
                <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{score}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, opacity: 0.7 }}>/100</span>
              </>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700 }}>—</span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.faint }}>Q{idx + 1}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.sub }}>{question.topic}</span>
              {hasTime && (
                <>
                  <span style={{ color: C.border }}>·</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{formatTime(question.timeTaken)}</span>
                </>
              )}
              {question.skipped && <Pill color={C.amber} background={C.amberTint}>skipped</Pill>}
              {pending && <Pill color={C.amber} background={C.amberTint}>⏳ generating</Pill>}
            </div>
            <div
              style={{
                fontSize: 12.5, lineHeight: 1.4, color: C.text, fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
              }}
            >
              {question.text}
            </div>
            {takeaway.text && (
              <div
                style={{
                  marginTop: 3, fontSize: 11, lineHeight: 1.4, color: toneColor(takeaway.tone),
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                }}
              >
                {takeaway.text}
              </div>
            )}
          </div>
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8, marginRight: 4,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: open ? C.blue50 : "transparent", color: open ? C.blue600 : C.faint,
              border: `1px solid ${open ? C.blue100 : "transparent"}`,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .28s cubic-bezier(.16,1,.3,1), background .15s ease, color .15s ease",
            }}
          >
            <Icon name="chevron" size={15} stroke={2.6} />
          </span>
        </button>
      </div>

      {!question.skipped && (
        <div style={{ height: 2, background: C.border }}>
          <div
            style={{
              width: objective ? (feedback?.correct !== null ? "100%" : "0%") : `${score || 0}%`,
              height: "100%", background: badgeColor, opacity: 0.4,
              transition: "width 0.7s ease",
            }}
          />
        </div>
      )}

      <div
        id={panelId}
        style={{
          display: "grid", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0,
          transition: "grid-template-rows 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s ease",
        }}
      >
       <div style={{ overflow: "hidden", minHeight: 0 }} inert={!open} aria-hidden={!open}>
        <div style={{ padding: "8px 16px 18px" }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text, fontWeight: 700, marginBottom: 12 }}>
            {question.text}
          </div>

          {question.userAnswer && !question.skipped && question.userAnswer !== "Skipped" && (
            <div
              style={{
                padding: "10px 12px", borderRadius: 10,
                background: C.surfaceAlt || cardAlt, border: `1px solid ${C.border}`,
                marginBottom: 10,
              }}
            >
              <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", marginBottom: 5 }}>
                your answer
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.65, color: C.sub, whiteSpace: "pre-wrap" }}>
                {question.userAnswer}
              </div>
            </div>
          )}

          {question.skipped && (
            <div
              style={{
                padding: "10px 12px", borderRadius: 10,
                background: C.amberTint, border: `1px solid ${C.amber}40`,
                color: C.amber, fontSize: 11, lineHeight: 1.5, marginBottom: 10,
              }}
            >
              You skipped this question. Use this as a pacing signal.
            </div>
          )}

          {question.skipped && pending && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "12px 14px", borderRadius: 10,
                background: C.amberTint, border: `1px dashed ${C.amber}`,
                color: C.amber, fontSize: 11.5, fontWeight: 600, lineHeight: 1.5,
                opacity: pulse ? 1 : 0.6, transition: "opacity 0.5s ease",
              }}
            >
              ⏳ Model answer generating… this card updates automatically.
            </div>
          )}

          {question.skipped && !pending && timedOut && (
            <div
              style={{
                padding: "10px 12px", borderRadius: 10,
                background: cardAlt, border: `1px dashed ${C.borderMd}`,
                color: C.sub, fontSize: 11, lineHeight: 1.5,
              }}
            >
              The model answer took too long to generate. Reload this page in a
              minute to check again.
            </div>
          )}

          {question.skipped && !pending && !timedOut && feedback && feedback.aiAvailable === false && (
            <div
              style={{
                padding: "8px 12px", borderRadius: 10, marginBottom: 10,
                background: cardAlt, border: `1px solid ${C.border}`,
                color: C.muted, fontSize: 10.5, lineHeight: 1.5,
              }}
            >
              AI was unavailable, so this is generic guidance rather than a model answer written for this question.
            </div>
          )}

          {question.skipped && !pending && !timedOut && feedback && (feedback.idealHint || feedback.tip || feedback.sampleAnswer) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
              {feedback.idealHint && (
                <FeedbackBlock label="key idea"        value={feedback.idealHint} color={C.blue500} background={C.blue50} />
              )}
              {feedback.tip && (
                <FeedbackBlock label="common mistake"  value={feedback.tip}       color={C.amber}   background={C.amberTint} />
              )}
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: "1 / -1", padding: 11, borderRadius: 10, background: cardAlt, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 5 }}>
                    model answer
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap" }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {question.skipped && !pending && !timedOut && basic && feedback?.locked?.modelAnswer && (
            <LockedInsights locked={{ modelAnswer: true }} variant="preview" teasers={feedback?.teasers} />
          )}

          {objective && isEval && (
            <div
              style={{
                padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10,
                background: cardAlt, display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 10, marginBottom: 10,
              }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>result</span>
              <strong style={{ color: badgeColor, fontSize: 13 }}>{feedback?.correct ? "Correct" : "Incorrect"}</strong>
            </div>
          )}

          {!objective && !question.skipped && isEval && feedback && basic && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                <FeedbackBlock label="what worked"      value={feedback.good}    color={C.green} background={C.greenTint} />
                <FeedbackBlock label="what was missing" value={feedback.missing} color={C.red}   background={C.redTint}   />
              </div>
              <LockedInsights locked={feedback.locked} usedVoice={false} variant="preview" teasers={feedback.teasers} />
            </>
          )}

          {!objective && !question.skipped && isEval && feedback && !basic && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
              <FeedbackBlock label="what worked"      value={feedback.good}        color={C.green}   background={C.greenTint} />
              <FeedbackBlock label="what was missing" value={feedback.missing}     color={C.red}     background={C.redTint}   />
              <FeedbackBlock label="key idea"         value={feedback.idealHint}   color={C.blue500} background={C.blue50}    />
              <FeedbackBlock label="next move"        value={feedback.tip}         color={C.amber}   background={C.amberTint} />
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: "1 / -1", padding: 11, borderRadius: 10, background: cardAlt, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 5 }}>
                    better answer pattern
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.65, color: C.text }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {canRetry && onRetry && !retryAllowed && (
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => openUpgrade("retryQuestion")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "7px 12px 7px 14px", borderRadius: 9, border: `1px solid ${C.borderMd}`,
                  background: C.card, color: C.sub, fontFamily: F.mono, fontSize: 10, fontWeight: 600, cursor: "pointer",
                }}
              >
                Re-evaluate this answer <ProBadge variant="pro" />
              </button>
            </div>
          )}

          {canRetry && onRetry && retryAllowed && (
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => onRetry(question.id)}
                disabled={retrying}
                style={{
                  padding: "7px 14px", borderRadius: 9, border: `1px solid ${C.borderMd}`,
                  background: retrying ? cardAlt : C.card,
                  color: retrying ? C.muted : C.blue500,
                  fontFamily: F.mono, fontSize: 10, fontWeight: 600,
                  cursor: retrying ? "not-allowed" : "pointer",
                }}
              >
                {retrying ? "Re-evaluating…" : "Retry AI evaluation"}
              </button>
            </div>
          )}

          {onStep && total > 1 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <button
                type="button" className="res-step" onClick={() => onStep(idx, -1)} disabled={!hasPrev}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "7px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: hasPrev ? C.sub : C.faint, fontFamily: F.body, fontSize: 12, fontWeight: 700, cursor: hasPrev ? "pointer" : "not-allowed", opacity: hasPrev ? 1 : 0.5 }}
              >
                <Icon name="left" size={14} />Previous
              </button>
              <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>{question._pos + 1} of {total}</span>
              <button
                type="button" className="res-step" onClick={() => onStep(idx, 1)} disabled={!hasNext}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "7px 12px", borderRadius: 10, border: "none", background: hasNext ? `linear-gradient(135deg, ${C.blue700}, ${C.blue500})` : C.cardAlt, color: hasNext ? "#fff" : C.faint, fontFamily: F.body, fontSize: 12, fontWeight: 800, cursor: hasNext ? "pointer" : "not-allowed", opacity: hasNext ? 1 : 0.5 }}
              >
                Next question<Icon name="right" size={14} stroke={2.6} />
              </button>
            </div>
          )}
        </div>
       </div>
      </div>
    </div>
  );
};
QuestionCard.propTypes = {
  question: PropTypes.object.isRequired,
  open:     PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onRetry:  PropTypes.func,
  retrying: PropTypes.bool,
  onStep:   PropTypes.func,
  hasPrev:  PropTypes.bool,
  hasNext:  PropTypes.bool,
  total:    PropTypes.number,
};

// ─── PropTypes ────────────────────────────────────────────────────────────────

const propTypes = {
  questions: PropTypes.array.isRequired,
  sessionId: PropTypes.string,
};

// ─── Component ────────────────────────────────────────────────────────────────

const FeedbackList = ({ questions, sessionId }) => {
  const { openUpgrade } = useUpgrade();
  const [expanded,     setExpanded]     = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const [retryingId,   setRetryingId]   = useState(null);
  const [overrides,    setOverrides]    = useState([]);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [sortBy,       setSortBy]       = useState("order");

  // Skipped open-ended questions are answered in the background on the server.
  // The Result page hands us a snapshot taken before that finished, so we poll
  // for the real answers and layer them on top.
  const { pendingIds, resolvedOverrides, timedOut } = usePendingAnswers(sessionId, questions);

  // Precedence, lowest to highest:
  //   1. base `questions` prop
  //   2. resolvedOverrides  (background skip-answer landed)
  //   3. overrides          (user pressed "Retry AI evaluation")
  // A manual retry is the user's most recent explicit action, so it wins.
  const normalizedQuestions = useMemo(() => {
    // Older sessions can lack an `id`. `undefined` would match `undefined` as a
    // Map key and bleed one question's override onto every other id-less one,
    // so a missing id must never match anything.
    const retryById = new Map(overrides.filter(o => o.id).map(o => [o.id, o]));
    return questions.map(q => {
      const hasId    = Boolean(q.id);
      const retried  = hasId ? retryById.get(q.id)         : undefined;
      const resolved = hasId ? resolvedOverrides.get(q.id) : undefined;
      const isPending = hasId && pendingIds.has(q.id);
      const base = resolved
        ? { ...q, score: resolved.score, aiFeedback: resolved.aiFeedback }
        : q;
      const withRetry = retried
        ? { ...base, score: retried.score, aiFeedback: retried.aiFeedback }
        : base;
      return {
        ...withRetry,
        _pending:  isPending,
        _timedOut: timedOut && !resolved && !isPending && q.aiFeedback?.skippedPending === true,
      };
    });
  }, [questions, overrides, resolvedOverrides, pendingIds, timedOut]);

  const strongCount  = normalizedQuestions.filter(q => !q.skipped && q.score >= 80).length;
  const weakCount    = normalizedQuestions.filter(q => !q.skipped && q.score < 60).length;
  const skippedCount = normalizedQuestions.filter(q => q.skipped).length;

  const filters = [
    { key: "all",     label: `All · ${normalizedQuestions.length}` },
    { key: "strong",  label: `Strong · ${strongCount}` },
    { key: "weak",    label: `Needs work · ${weakCount}` },
    { key: "skipped", label: `Skipped · ${skippedCount}` },
  ];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedQuestions
      .map((q, i) => ({ ...q, _index: i }))
      .filter(q => {
        if (activeFilter === "strong"  && (q.skipped || q.score < 80))  return false;
        if (activeFilter === "weak"    && (q.skipped || q.score >= 60)) return false;
        if (activeFilter === "skipped" && !q.skipped)                   return false;
        if (needle) {
          const hay = `${q.text} ${q.topic} ${q.userAnswer}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy !== "weakest") return a._index - b._index;
        const av = a.skipped ? -1 : (typeof a.score === "number" ? a.score : 101);
        const bv = b.skipped ? -1 : (typeof b.score === "number" ? b.score : 101);
        return av - bv || a._index - b._index;
      })
      .map((q, pos) => ({ ...q, _pos: pos }));
  }, [normalizedQuestions, activeFilter, search, sortBy]);

  const toggleExpand = useCallback(
    (index) => setExpanded((prev) => ({ ...prev, [index]: !prev[index] })),
    []
  );

  const allOpen = filtered.length > 0 && filtered.every((q) => expanded[q._index]);
  const toggleAll = useCallback(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      filtered.forEach((q) => { next[q._index] = !allOpen; });
      return next;
    });
  }, [filtered, allOpen]);

  // Previous / Next inside an open card: close this one, open the neighbour,
  // and scroll it under the sticky bar so the reader never loses their place.
  const stepFrom = useCallback((index, dir) => {
    const pos = filtered.findIndex((q) => q._index === index);
    const target = filtered[pos + dir];
    if (!target) return;
    setExpanded((prev) => ({ ...prev, [index]: false, [target._index]: true }));
    requestAnimationFrame(() => setTimeout(() => scrollToId(`res-q-${target._index}`, 8), 60));
  }, [filtered]);

  const clearFilters = useCallback(() => { setActiveFilter("all"); setSearch(""); }, []);

  const handleRetry = useCallback(async (questionId) => {
    if (!sessionId || !questionId || retryingId) return;
    setRetryingId(questionId);
    try {
      const data   = await retryQuestion(sessionId, questionId);
      const parsed = normalizeFeedback({ feedback: data?.feedback, score: data?.score });
      setOverrides(prev => [
        ...prev.filter(q => q.id !== questionId),
        { id: questionId, score: clamp(Number(data?.score) || 0), aiFeedback: parsed },
      ]);
    } catch (err) {
      // Server says Pro-only (e.g. plan expired since this page loaded): explain, don't fail silently.
      if (err?.response?.status === 403 && err?.response?.data?.error === "plan_required") {
        openUpgrade("retryQuestion");
      } else {
        console.error("Retry failed:", err);
      }
    } finally {
      setRetryingId(null);
    }
  }, [sessionId, retryingId, openUpgrade]);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow }}>
      <style>{`.res-step:hover:not(:disabled){transform:translateY(-1px)}.res-step{transition:transform .12s ease}.res-tool:hover{background:${C.blue50}!important;border-color:${C.blue200}!important}`}</style>
      <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", color: C.blue500, marginBottom: 4 }}>
        question-by-question review
      </div>
      <div style={{ margin: 0, fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
        Full breakdown
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 11.5, color: C.sub }}>
        Open any card for feedback, sample answer, and retry.
      </p>

      {pendingIds.size > 0 && !bannerHidden && (
        <PendingBanner count={pendingIds.size} onDismiss={() => setBannerHidden(true)} />
      )}

      <CrossSignalInsight questions={normalizedQuestions} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={activeFilter === f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                border: `1px solid ${activeFilter === f.key ? C.blue500 : C.border}`,
                background: activeFilter === f.key ? C.blue500 : C.card,
                color: activeFilter === f.key ? "#fff" : C.sub,
                borderRadius: 999, padding: "5px 11px",
                fontFamily: F.body, fontSize: 10.5, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s ease",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          aria-label="Search questions"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            width: 200, maxWidth: "100%", border: `1px solid ${C.border}`,
            background: cardAlt, borderRadius: 9, padding: "7px 11px",
            fontFamily: F.body, fontSize: 11.5, color: C.text, outline: "none",
          }}
        />
      </div>

      {filtered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div role="group" aria-label="Sort questions" style={{ display: "inline-flex", padding: 3, borderRadius: 10, background: C.cardAlt, border: `1px solid ${C.border}` }}>
            {[{ k: "order", l: "Interview order" }, { k: "weakest", l: "Weakest first" }].map((o) => (
              <button
                key={o.k} type="button" aria-pressed={sortBy === o.k} onClick={() => setSortBy(o.k)}
                style={{ border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 11px", minHeight: 30, fontFamily: F.body, fontSize: 11.5, fontWeight: 700, background: sortBy === o.k ? C.card : "transparent", color: sortBy === o.k ? C.blue600 : C.muted, boxShadow: sortBy === o.k ? "0 1px 4px rgba(0,31,107,.12)" : "none" }}
              >
                {o.l}
              </button>
            ))}
          </div>
          <button
            type="button" className="res-tool" onClick={toggleAll}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "6px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.blue600, fontFamily: F.mono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            <Icon name="chevron" size={13} stroke={2.6} style={{ transform: allOpen ? "rotate(180deg)" : "none", transition: "transform .25s ease" }} />
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}

      {!filtered.length && (
        <div style={{ border: `1px dashed ${C.borderMd}`, borderRadius: 10, padding: 24, textAlign: "center", color: C.muted, fontSize: 11.5 }}>
          <div>No questions match the current filter.</div>
          <button type="button" className="res-tool" onClick={clearFilters} style={{ marginTop: 10, padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.blue600, fontFamily: F.mono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Clear filters</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {filtered.map((q, pos) => (
          <QuestionCard
            key={q._index}
            question={q}
            open={Boolean(expanded[q._index])}
            onToggle={toggleExpand}
            onRetry={handleRetry}
            retrying={retryingId === q.id}
            onStep={stepFrom}
            hasPrev={pos > 0}
            hasNext={pos < filtered.length - 1}
            total={filtered.length}
          />
        ))}
      </div>
    </div>
  );
};

FeedbackList.propTypes = propTypes;


export default FeedbackList;
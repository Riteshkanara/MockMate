import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { retryQuestion } from '../../Services/interviewService';
import { C, F } from "../../styles/token";
import { FeedbackCard } from '../interview/FeedbackPanel';



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

const toOneLine = (text, maxLen = 100) => {
  if (!text) return "";
  const s = (text.split(/(?<=[.!?])\s+/)[0] || text).trim();
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
    };
  } catch { return null; }
};

const getTakeaway = (question) => {
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
                fontFamily: F.mono, fontSize: 8, fontWeight: 700,
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
    <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color, letterSpacing: "0.5px", marginBottom: 5 }}>
      {label}
    </div>
    <div style={{ fontSize: 11.5, lineHeight: 1.65, color: C.text }}>{value || "No additional readout."}</div>
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
      fontFamily: F.mono, fontSize: 9, fontWeight: 700, border: `1px solid ${color}30`,
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

// ─── QuestionCard ─────────────────────────────────────────────────────────────

const QuestionCard = ({ question, open, onToggle, onRetry, retrying }) => {
  const idx       = question._index;
  const feedback  = question.aiFeedback;
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  const isEval    = Boolean(
    feedback && feedback.aiAvailable !== false &&
    (typeof feedback.score === "number" || objective)
  );
  const score     = isEval && !objective ? feedback.score : null;
  const takeaway  = useMemo(() => getTakeaway(question), [question]);
  const hasTime   = Number(question.timeTaken) > 0;
  const canRetry  = !objective && !question.skipped && question.userAnswer?.trim() && question.id;

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
      style={{
        border: `1px solid ${open ? C.borderMd : C.border}`,
        borderRadius: 12, background: open ? cardAlt : C.card,
        overflow: "hidden", transition: "border-color 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <button
          type="button"
          onClick={() => onToggle(idx)}
          aria-expanded={open}
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
                <span style={{ fontFamily: F.mono, fontSize: 7, opacity: 0.7 }}>/100</span>
              </>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700 }}>—</span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: C.faint }}>Q{idx + 1}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.sub }}>{question.topic}</span>
              {hasTime && (
                <>
                  <span style={{ color: C.border }}>·</span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{formatTime(question.timeTaken)}</span>
                </>
              )}
              {question.skipped && <Pill color={C.amber} background={C.amberTint}>skipped</Pill>}
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
        </button>
        <button
          type="button"
          onClick={() => onToggle(idx)}
          aria-label={open ? `Collapse Q${idx + 1}` : `Expand Q${idx + 1}`}
          style={{
            flexShrink: 0, width: 40, border: "none", background: "transparent",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", color: C.faint,
          }}
        >
          <span
            style={{
              display: "inline-block", fontSize: 11,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
          >
            ▾
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
        style={{
          maxHeight: open ? 1400 : 0, opacity: open ? 1 : 0, overflow: "hidden",
          transition: "max-height 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s ease",
        }}
      >
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
              <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", marginBottom: 5 }}>
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

          {objective && isEval && (
            <div
              style={{
                padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10,
                background: cardAlt, display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 10, marginBottom: 10,
              }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>result</span>
              <strong style={{ color: badgeColor, fontSize: 13 }}>{feedback?.correct ? "Correct" : "Incorrect"}</strong>
            </div>
          )}

          {!objective && isEval && feedback && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FeedbackBlock label="what worked"      value={feedback.good}        color={C.green}   background={C.greenTint} />
              <FeedbackBlock label="what was missing" value={feedback.missing}     color={C.red}     background={C.redTint}   />
              <FeedbackBlock label="key idea"         value={feedback.idealHint}   color={C.blue500} background={C.blue50}    />
              <FeedbackBlock label="next move"        value={feedback.tip}         color={C.amber}   background={C.amberTint} />
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: "1 / -1", padding: 11, borderRadius: 10, background: cardAlt, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 600, color: C.muted, marginBottom: 5 }}>
                    better answer pattern
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.65, color: C.text }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {canRetry && onRetry && (
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
};

// ─── PropTypes ────────────────────────────────────────────────────────────────

const propTypes = {
  questions: PropTypes.array.isRequired,
  sessionId: PropTypes.string,
};

// ─── Component ────────────────────────────────────────────────────────────────

const FeedbackList = ({ questions, sessionId }) => {
  const [expanded,     setExpanded]     = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const [retryingId,   setRetryingId]   = useState(null);
  const [overrides,    setOverrides]    = useState([]);

  const normalizedQuestions = useMemo(
    () => questions.map(q => {
      const override = overrides.find(o => o.id === q.id);
      return override ? { ...q, score: override.score, aiFeedback: override.aiFeedback } : q;
    }),
    [questions, overrides]
  );

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
      });
  }, [normalizedQuestions, activeFilter, search]);

  const toggleExpand = useCallback(
    (index) => setExpanded((prev) => ({ ...prev, [index]: !prev[index] })),
    []
  );

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
      console.error("Retry failed:", err);
    } finally {
      setRetryingId(null);
    }
  }, [sessionId, retryingId]);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow }}>
      <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.8px", color: C.blue500, marginBottom: 4 }}>
        question-by-question review
      </div>
      <div style={{ margin: 0, fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
        Full breakdown
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 11.5, color: C.sub }}>
        Open any card for feedback, sample answer, and retry.
      </p>

      <CrossSignalInsight questions={questions} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <button
              key={f.key}
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            width: 200, maxWidth: "100%", border: `1px solid ${C.border}`,
            background: cardAlt, borderRadius: 9, padding: "7px 11px",
            fontFamily: F.body, fontSize: 11.5, color: C.text, outline: "none",
          }}
        />
      </div>

      {!filtered.length && (
        <div style={{ border: `1px dashed ${C.borderMd}`, borderRadius: 10, padding: 24, textAlign: "center", color: C.muted, fontSize: 11.5 }}>
          No questions match the current filter.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {filtered.map((q) => (
          <QuestionCard
            key={q._index}
            question={q}
            open={Boolean(expanded[q._index])}
            onToggle={toggleExpand}
            onRetry={handleRetry}
            retrying={retryingId === q.id}
          />
        ))}
      </div>
    </div>
  );
};

FeedbackList.propTypes = propTypes;


export default FeedbackList;
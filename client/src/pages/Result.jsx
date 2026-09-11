import { useState, useEffect, useMemo, useCallback, useRef, Component } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import { ResultHeroV2 } from "./ResultHeroV2";
import ScoreCard from "../components/ScoreCard";
import { retryQuestion } from "../Services/interviewService";
import { C, F } from "../styles/token";

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
const scoreTint = (s) => {
  const n = clamp(s);
  if (n >= 80) return C.greenTint;
  if (n >= 60) return C.blue50;
  if (n >= 40) return C.amberTint;
  return C.redTint;
};

const GRADE_MAP = [
  { min: 90, grade: "S", glyph: "◆", desc: "Elite",          accent: C.violet, tint: C.violetTint, glow: C.violet },
  { min: 80, grade: "A", glyph: "▲", desc: "Strong",         accent: C.green,  tint: C.greenTint,  glow: C.green  },
  { min: 70, grade: "B", glyph: "●", desc: "Solid",          accent: C.blue500,tint: C.blue50,     glow: C.blue500},
  { min: 60, grade: "C", glyph: "■", desc: "Developing",     accent: C.amber,  tint: C.amberTint,  glow: C.amber  },
  { min:  0, grade: "D", glyph: "▼", desc: "Needs Practice", accent: C.red,    tint: C.redTint,    glow: C.red    },
];
const getGrade = (s) => GRADE_MAP.find(g => s >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];
const getLabel = (s) => getGrade(s).desc;

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

const normalizeFeedback = (question) => {
  if (!question) return null;
  const raw = question.feedback;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      score:       typeof question.score === "number" ? question.score : Number(question.score || 0),
      correct:     question.correct ?? parsed.correct ?? null,
      good:        parsed.good || "",
      missing:     parsed.missing || "",
      idealHint:   parsed.idealHint || "",
      tip:         parsed.tip || "",
      sampleAnswer:parsed.sampleAnswer || "",
      aiAvailable: parsed.aiAvailable !== false,
      fallback:    parsed.fallback === true,
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

// ═══════════════════════════════════════════════════════════════════════════
// 1. useSequentialReveal
//
// Returns an object of boolean flags, each becoming true at a different
// time offset. Attach to opacity/transform in the hero.
//
// Usage:
//   const reveal = useSequentialReveal();
//   // reveal.arc      — true at 80ms  (ScoreArc appears)
//   // reveal.grade    — true at 500ms (grade badge drops in)
//   // reveal.stats    — true at 720ms (mini-stats slide up)
//   // reveal.caption  — true at 920ms (caption block fades)
//   // reveal.actions  — true at 1080ms (action buttons appear)
//
// Wrap each hero sub-element with the corresponding flag's style.
// ═══════════════════════════════════════════════════════════════════════════

export const useSequentialReveal = () => {
  const [flags, setFlags] = useState({
    arc:     false,
    grade:   false,
    stats:   false,
    caption: false,
    actions: false,
  });

  useEffect(() => {
    const timers = [
      setTimeout(() => setFlags(f => ({ ...f, arc:     true })),  80),
      setTimeout(() => setFlags(f => ({ ...f, grade:   true })),  500),
      setTimeout(() => setFlags(f => ({ ...f, stats:   true })),  720),
      setTimeout(() => setFlags(f => ({ ...f, caption: true })),  920),
      setTimeout(() => setFlags(f => ({ ...f, actions: true })), 1080),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return flags;
};

// ─── Reveal style helpers ────────────────────────────────────────────────────
// Use these to build the inline style objects for each hero element.

export const revealStyle = {
  // Fade + rise (for most elements)
  fadeUp: (visible, delay = 0) => ({
    opacity:   visible ? 1 : 0,
    transform: visible ? "translateY(0)"  : "translateY(18px)",
    transition: `opacity 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms,
                 transform 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms`,
  }),

  // Drop in from above (for grade badge)
  dropIn: (visible) => ({
    opacity:   visible ? 1 : 0,
    transform: visible ? "translateY(0) scale(1)" : "translateY(-14px) scale(0.88)",
    transition: "opacity 0.42s cubic-bezier(.16,1,.3,1), transform 0.42s cubic-bezier(.16,1,.3,1)",
  }),

  // Slide up with stagger (for mini-stats, one per item)
  slideUp: (visible, index = 0) => ({
    opacity:   visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: `opacity 0.38s ease ${index * 60}ms,
                 transform 0.38s cubic-bezier(.16,1,.3,1) ${index * 60}ms`,
  }),

  // Simple fade (for caption block, actions)
  fade: (visible, delay = 0) => ({
    opacity:   visible ? 1 : 0,
    transition: `opacity 0.5s ease ${delay}ms`,
  }),
};


// ═══════════════════════════════════════════════════════════════════════════
// 2. useGradeColorMoment
//
// Returns { momentActive, grade } where momentActive is true for 1.4s
// after mount then becomes false. Use momentActive to apply a grade-tinted
// overlay on the hero that fades out after the pulse.
//
// Usage in ResultHero:
//   const { momentActive, grade } = useGradeColorMoment(score);
//
//   // In the hero's style:
//   background: momentActive
//     ? `linear-gradient(135deg, ${grade.glow}55 0%, ${C.blue900} 60%)`
//     : `linear-gradient(135deg, ${C.blue900} 0%, ...)`
// ═══════════════════════════════════════════════════════════════════════════

export const useGradeColorMoment = (score) => {
  const [momentActive, setMomentActive] = useState(true);
  const grade = getGrade(clamp(score));

  useEffect(() => {
    // Pulse on for 1400ms then settle to normal hero gradient
    const t = setTimeout(() => setMomentActive(false), 1400);
    return () => clearTimeout(t);
  }, []);

  return { momentActive, grade };
};

// ─── GradeFlashOverlay ───────────────────────────────────────────────────────
// Drop this as the FIRST child inside the hero section's outer div.
// It's an absolutely positioned overlay that pulses grade color then fades.
// Completely non-interactive (pointerEvents: none).
//
// Usage:
//   <section style={S.hero}>
//     <GradeFlashOverlay score={score} />   ← ADD THIS
//     <div style={S.heroScan} />
//     ...rest of hero
//   </section>

export const GradeFlashOverlay = ({ score }) => {
  const { momentActive, grade } = useGradeColorMoment(score);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        background: `radial-gradient(ellipse at 50% 40%, ${grade.glow}45 0%, transparent 68%)`,
        opacity: momentActive ? 1 : 0,
        transition: "opacity 1.1s cubic-bezier(.4,0,.2,1)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
};

// ─── GradeBadgeDrop ──────────────────────────────────────────────────────────
// The grade badge itself, now as its own component with a drop-in entrance.
// Replaces the inline grade badge inside ScoreArc.
// Pass `visible` from reveal.grade.
//
// Usage inside the hero left column (below ScoreArc SVG):
//   <GradeBadgeDrop score={score} visible={reveal.grade} />

export const GradeBadgeDrop = ({ score, visible }) => {
  const grade = getGrade(clamp(score));

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      ...revealStyle.dropIn(visible),
    }}>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 16px",
        borderRadius: 12,
        background: `${grade.accent}18`,
        border: `1.5px solid ${grade.accent}55`,
        boxShadow: `0 0 20px ${grade.glow}30`,
      }}>
        <span style={{
          fontFamily: F.display,
          fontSize: 18,
          fontWeight: 900,
          color: grade.accent,
          lineHeight: 1,
          textShadow: `0 0 12px ${grade.glow}80`,
        }}>
          {grade.grade}
        </span>
        <div style={{ width: 1, height: 16, background: `${grade.accent}30` }} />
        <span style={{
          fontFamily: F.mono,
          fontSize: 10,
          fontWeight: 700,
          color: grade.accent,
          letterSpacing: "0.4px",
        }}>
          {grade.grade === "S" ? "Elite form" :
           grade.grade === "A" ? "Strong" :
           grade.grade === "B" ? "Solid" :
           grade.grade === "C" ? "Developing" : "Needs practice"}
        </span>
      </div>
    </div>
  );
};

// ─── MiniStatItem ────────────────────────────────────────────────────────────
// Individual mini-stat with staggered slide-up reveal.
// Replace the existing miniStat divs in ResultHero with this.
//
// Usage (wrap each existing miniStat):
//   <MiniStatItem value={result.strongAnswers} label="strong"
//     color={C.green} index={0} visible={reveal.stats} />

export const MiniStatItem = ({ value, label, color, index, visible }) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    padding: "0 18px",
    ...revealStyle.slideUp(visible, index),
  }}>
    <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, lineHeight: 1, color }}>
      {value}
    </span>
    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3px" }}>
      {label}
    </span>
  </div>
);


// ═══════════════════════════════════════════════════════════════════════════
// 3. CrossSignalInsight
//
// The "how did it know that?" moment.
//
// Analyzes 8 cross-axis behavioral patterns from session data and surfaces
// the single most specific diagnostic sentence. This goes at the top of
// the question review section — one sentence, no header, just the insight.
//
// The 8 patterns it detects (in priority order):
//
//   1. RUSHING — fastest answers scored lowest (time inversely correlated with score)
//   2. DEPTH_SPEED_TRADEOFF — slowest answers scored highest (time helps)
//   3. TOPIC_COLLAPSE — 2+ weak answers in same topic that was strong earlier
//   4. FRONT_LOAD — first half significantly stronger than second half
//   5. BACK_LOAD — second half significantly stronger (warmed up)
//   6. CONSISTENCY_TRAP — high avg score but high stdDev (inconsistent, not weak)
//   7. SKIP_CLUSTER — skips concentrated in a topic (avoidance signal)
//   8. RECOVERY_STRENGTH — bounced back 25+ pts after a drop (resilience signal)
//
// Each pattern produces a specific sentence — not generic, not templated.
// The sentence names the actual topic, actual question numbers, actual delta.
// ═══════════════════════════════════════════════════════════════════════════

const detectCrossSignal = (questions) => {
  const scored = questions
    .filter(q => !q.skipped && typeof q.aiFeedback?.score === "number")
    .map(q => ({
      index:  typeof q.index === "number" ? q.index : 0,
      score:  clamp(q.aiFeedback.score),
      time:   Number(q.timeTaken || 0),
      topic:  q.topic || "General",
      skipped: false,
    }))
    .sort((a, b) => a.index - b.index);

  const skipped = questions.filter(q => q.skipped);

  if (scored.length < 3) return null;

  const avg = scored.reduce((s, q) => s + q.score, 0) / scored.length;
  const timed = scored.filter(q => q.time > 0);

  // ── 1. RUSHING — fast + wrong ─────────────────────────────────────────
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
        pattern: "RUSHING",
        priority: 1,
        sentence: topRushTopic
          ? `Your fastest answers on ${topRushTopic} scored ${gap} pts lower than your slower ones — you're rushing past the questions that need depth most.`
          : `Your fastest answers scored ${gap} pts lower than your slower ones. Speed is costing you here, not helping.`,
        accent: C.amber,
        icon: "⚡",
      };
    }
  }

  // ── 2. DEPTH_SPEED_TRADEOFF — slow + right ────────────────────────────
  if (timed.length >= 4) {
    const sortedByTime = [...timed].sort((a, b) => a.time - b.time);
    const fastHalf = sortedByTime.slice(0, Math.floor(timed.length / 2));
    const slowHalf = sortedByTime.slice(Math.floor(timed.length / 2));
    const fastAvg  = fastHalf.reduce((s, q) => s + q.score, 0) / fastHalf.length;
    const slowAvg  = slowHalf.reduce((s, q) => s + q.score, 0) / slowHalf.length;

    if (fastAvg - slowAvg >= 14) {
      const gap = Math.round(fastAvg - slowAvg);
      return {
        pattern: "DEPTH_SPEED_TRADEOFF",
        priority: 2,
        sentence: `Taking more time didn't help — your quicker answers scored ${gap} pts higher on average. Trust your first instinct more.`,
        accent: C.blue500,
        icon: "⏱",
      };
    }
  }

  // ── 3. TOPIC_COLLAPSE ─────────────────────────────────────────────────
  // A topic that started strong (first question in it ≥70) but ended weak
  // (subsequent questions in same topic <55)
  const topicProgression = {};
  scored.forEach(q => {
    if (!topicProgression[q.topic]) topicProgression[q.topic] = [];
    topicProgression[q.topic].push(q);
  });

  for (const [topic, qs] of Object.entries(topicProgression)) {
    if (qs.length < 2) continue;
    const firstScore = qs[0].score;
    const lastScore  = qs[qs.length - 1].score;
    if (firstScore >= 70 && lastScore < 55) {
      const drop = Math.round(firstScore - lastScore);
      return {
        pattern: "TOPIC_COLLAPSE",
        priority: 3,
        sentence: `You opened ${topic} at ${firstScore} and dropped ${drop} pts by the end of it — initial knowledge is there, but depth ran out under follow-up.`,
        accent: C.amber,
        icon: "📉",
      };
    }
  }

  // ── 4. FRONT_LOAD — first half >> second half ─────────────────────────
  const mid = Math.floor(scored.length / 2);
  const firstHalf  = scored.slice(0, mid);
  const secondHalf = scored.slice(mid);
  const firstAvg   = firstHalf.reduce((s, q) => s + q.score, 0) / firstHalf.length;
  const secondAvg  = secondHalf.reduce((s, q) => s + q.score, 0) / secondHalf.length;

  if (firstAvg - secondAvg >= 16) {
    const drop = Math.round(firstAvg - secondAvg);
    return {
      pattern: "FRONT_LOAD",
      priority: 4,
      sentence: `You started ${Math.round(firstAvg)} and finished ${Math.round(secondAvg)} — a ${drop}-pt drop across the session. Stamina or topic order, not ability.`,
      accent: C.amber,
      icon: "📊",
    };
  }

  // ── 5. BACK_LOAD — second half >> first half (warmed up) ──────────────
  if (secondAvg - firstAvg >= 16) {
    const gain = Math.round(secondAvg - firstAvg);
    return {
      pattern: "BACK_LOAD",
      priority: 5,
      sentence: `You warmed up as the session went on — second half averaged ${gain} pts higher than the first. In a real interview, front-load your best.`,
      accent: C.green,
      icon: "📈",
    };
  }

  // ── 6. CONSISTENCY_TRAP — decent avg but high swing ───────────────────
  if (scored.length >= 4) {
    const variance = scored.reduce((s, q) => s + (q.score - avg) ** 2, 0) / scored.length;
    const stdDev   = Math.sqrt(variance);
    const peak     = Math.max(...scored.map(q => q.score));
    const floor    = Math.min(...scored.map(q => q.score));

    if (stdDev >= 20 && avg >= 60) {
      return {
        pattern: "CONSISTENCY_TRAP",
        priority: 6,
        sentence: `Your average looks fine at ${Math.round(avg)}, but you ranged from ${floor} to ${peak} — that's a ${peak - floor}-pt swing. Interviewers notice inconsistency more than the mean.`,
        accent: C.amber,
        icon: "〰",
      };
    }
  }

  // ── 7. SKIP_CLUSTER — skips concentrated in a topic ───────────────────
  if (skipped.length >= 2) {
    const skipTopics = {};
    skipped.forEach(q => {
      const t = q.topic || "General";
      skipTopics[t] = (skipTopics[t] || 0) + 1;
    });
    const [topSkipTopic, topSkipCount] = Object.entries(skipTopics)
      .sort((a, b) => b[1] - a[1])[0] || [];

    if (topSkipTopic && topSkipCount >= 2) {
      return {
        pattern: "SKIP_CLUSTER",
        priority: 7,
        sentence: `${topSkipCount} skips on ${topSkipTopic} — that's avoidance, not bad luck. That topic deserves a dedicated session before the next general rep.`,
        accent: C.red,
        icon: "⏭",
      };
    }
  }

  // ── 8. RECOVERY_STRENGTH — biggest bounce-back ────────────────────────
  let biggestJump = 0, jumpFrom = null, jumpTo = null;
  for (let i = 1; i < scored.length; i++) {
    const delta = scored[i].score - scored[i - 1].score;
    if (delta > biggestJump) {
      biggestJump = delta;
      jumpFrom = scored[i - 1];
      jumpTo   = scored[i];
    }
  }

  if (biggestJump >= 25 && jumpFrom && jumpTo) {
    return {
      pattern: "RECOVERY_STRENGTH",
      priority: 8,
      sentence: `After dropping to ${jumpFrom.score} on Q${jumpFrom.index + 1}, you came back ${biggestJump} pts on Q${jumpTo.index + 1}. That kind of reset under pressure is a real interview skill.`,
      accent: C.green,
      icon: "◆",
    };
  }

  // ── Fallback — no strong pattern ──────────────────────────────────────
  if (avg >= 80) {
    return {
      pattern: "CLEAN_HIGH",
      priority: 9,
      sentence: `No weak patterns detected — consistent, strong, complete. The next step is harder questions, not more of the same difficulty.`,
      accent: C.green,
      icon: "◆",
    };
  }

  return null;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const CrossSignalInsight = ({ questions }) => {
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
        marginBottom: 16,
        borderRadius: 16,
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.6s cubic-bezier(.16,1,.3,1), transform 0.6s cubic-bezier(.16,1,.3,1)",
      }}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "5px 1fr",
      }}>
        {/* Accent bar — pulses once */}
        <div style={{
          background: signal.accent,
          animation: "insightBarPulse 1.8s cubic-bezier(.4,0,.2,1) 0.4s both",
        }} />

        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "16px 20px",
          background: `${signal.accent}09`,
          borderTop: `1px solid ${signal.accent}25`,
          borderRight: `1px solid ${signal.accent}25`,
          borderBottom: `1px solid ${signal.accent}25`,
          borderRadius: "0 14px 14px 0",
        }}>
          {/* Icon */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${signal.accent}15`,
            border: `1px solid ${signal.accent}35`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
            marginTop: 1,
          }}>
            {signal.icon}
          </div>

          <div style={{ flex: 1 }}>
            {/* Pattern tag */}
            <div style={{
              fontFamily: F.mono,
              fontSize: 8.5,
              fontWeight: 700,
              color: signal.accent,
              letterSpacing: "0.8px",
              marginBottom: 6,
              opacity: 0.75,
            }}>
              {signal.pattern.replace(/_/g, " ").toLowerCase()} · session pattern
            </div>

            {/* The sentence */}
            <p style={{
              margin: 0,
              fontFamily: F.display,
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.5,
              letterSpacing: "-0.2px",
            }}>
              {signal.sentence}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL CSS (add to GlobalStyles in Result.jsx)
// ═══════════════════════════════════════════════════════════════════════════
//
// @keyframes insightBarPulse {
//   0%   { opacity: 0; transform: scaleY(0); transform-origin: top; }
//   40%  { opacity: 1; transform: scaleY(1); }
//   70%  { opacity: 1; }
//   100% { opacity: 0.7; }
// }
//
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────
const LOAD_TINTS = {
  green:  { bg: "rgba(34,197,94,0.08)",  fill: "rgba(34,197,94,0.72)"  },
  blue:   { bg: "rgba(59,130,246,0.08)", fill: "rgba(59,130,246,0.72)" },
  amber:  { bg: "rgba(245,158,11,0.09)", fill: "rgba(245,158,11,0.76)" },
  red:    { bg: "rgba(239,68,68,0.09)",  fill: "rgba(239,68,68,0.76)"  },
  muted:  { bg: "rgba(148,163,184,0.06)",fill: "rgba(148,163,184,0.4)" },
};

const loadTier = (score) => {
  if (score >= 80) return "green";
  if (score >= 60) return "blue";
  if (score >= 40) return "amber";
  return "red";
};

// Overload = bottom-right quadrant: time above median AND score below 60
const isOverloaded = (timeTaken, medianTime, score) =>
  timeTaken > medianTime && score < 60;

// Peak load = top-right quadrant: most time AND low score (worst cell)
const isPeakLoad = (timeTaken, maxTime, score) =>
  timeTaken >= maxTime * 0.85 && score < 60;

export const CognitiveLoadHeatmap = ({ questions }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Build display data
  const cells = useMemo(() => {
    return questions.map((q, i) => {
      const score = clamp(
        typeof q.aiFeedback?.score === "number"
          ? q.aiFeedback.score
          : typeof q.score === "number" ? q.score : 0
      );
      const time = Math.max(0, Number(q.timeTaken || 0));
      const hasScore = !q.skipped && (typeof q.aiFeedback?.score === "number" || typeof q.score === "number");
      return { index: i, score, time, skipped: q.skipped, hasScore, topic: q.topic || "General", text: q.text || `Q${i + 1}` };
    });
  }, [questions]);

  const timedCells = cells.filter(c => !c.skipped && c.time > 0);
  const times = timedCells.map(c => c.time);
  const sortedTimes = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sortedTimes.length / 2);
  const medianTime = sortedTimes.length % 2
    ? sortedTimes[mid]
    : ((sortedTimes[mid - 1] || 0) + (sortedTimes[mid] || 0)) / 2;
  const maxTime = Math.max(...times, 1);
  const minTime = Math.min(...times.filter(t => t > 0), 1);

  // Normalize time to [0.18, 1] so even short answers have a visible bar
  const normTime = (t) => {
    if (t <= 0) return 0;
    if (maxTime === minTime) return 0.6;
    return 0.18 + ((t - minTime) / (maxTime - minTime)) * 0.82;
  };

  // Auto-generated insight
  const insight = useMemo(() => {
    const overloaded = cells.filter(c => !c.skipped && c.time > 0 && isOverloaded(c.time, medianTime, c.score));
    if (overloaded.length === 0 && timedCells.length === 0)
      return { text: "No timed answers recorded this session — pace data will appear in future sessions.", accent: C.muted };
    if (overloaded.length === 0)
      return { text: "No overload signals — you stayed composed across all questions. Keep the consistency.", accent: C.green };

    const topicMap = {};
    overloaded.forEach(c => { topicMap[c.topic] = (topicMap[c.topic] || 0) + 1; });
    const topTopic = Object.entries(topicMap).sort((a, b) => b[1] - a[1])[0];
    const qLabels = overloaded.map(c => `Q${c.index + 1}`).join(", ");

    if (overloaded.length === 1) {
      const c = overloaded[0];
      return { text: `Q${c.index + 1} showed a load spike — ${formatTime(c.time)} and a score of ${c.score}. One-off or a pattern to watch.`, accent: C.amber };
    }
    return {
      text: `${qLabels} triggered overload signals${topTopic ? ` — ${topTopic[0]} is the common thread` : ""}. These took longest and scored lowest. That's the drill list.`,
      accent: C.amber,
    };
  }, [cells, medianTime, timedCells.length]);

  // Tooltip for hovered cell
  const hoveredCell = hoveredIdx !== null ? cells[hoveredIdx] : null;
  const overloadFlag = hoveredCell && !hoveredCell.skipped && hoveredCell.time > 0
    ? isOverloaded(hoveredCell.time, medianTime, hoveredCell.score)
    : false;
  const peakFlag = hoveredCell && !hoveredCell.skipped && hoveredCell.time > 0
    ? isPeakLoad(hoveredCell.time, maxTime, hoveredCell.score)
    : false;

  const CELL_W = 44;
  const CELL_H = 72;
  const CELL_GAP = 6;
  const STRIP_PADDING = 20;

  const handleMouseMove = (e, idx) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredIdx(idx);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <section style={phaseS.card} className="res-card">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <div style={phaseS.eyebrow}>Cognitive load heatmap</div>
          <h2 style={phaseS.cardH2}>Where you got stuck</h2>
          <p style={phaseS.cardSub}>
            Each column is one question. <strong style={{ color: C.text, fontWeight: 700 }}>Height</strong> = time taken.
            <strong style={{ color: C.text, fontWeight: 700 }}> Color</strong> = score.
            Tall + red = cognitive overload.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {[
            { label: "strong", color: C.green },
            { label: "solid",  color: C.blue500 },
            { label: "shaky",  color: C.amber },
            { label: "gap",    color: C.red },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, opacity: 0.75 }} />
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Strip */}
      <div ref={containerRef} style={{ position: "relative", overflowX: "auto", paddingBottom: 8 }}>
        <div style={{
          display: "flex",
          gap: CELL_GAP,
          padding: `${STRIP_PADDING}px ${STRIP_PADDING}px`,
          minWidth: cells.length * (CELL_W + CELL_GAP),
          alignItems: "flex-end",
          position: "relative",
        }}>

          {/* Median time reference line — horizontal dashed across the strip */}
          {timedCells.length > 1 && (
            <div style={{
              position: "absolute",
              left: STRIP_PADDING,
              right: STRIP_PADDING,
              bottom: STRIP_PADDING + CELL_H * (1 - normTime(medianTime)),
              height: 1,
              borderTop: `1px dashed ${C.borderMd}`,
              pointerEvents: "none",
              zIndex: 0,
            }}>
              <span style={{
                position: "absolute",
                right: 0,
                top: -14,
                fontFamily: F.mono,
                fontSize: 8.5,
                color: C.faint,
                whiteSpace: "nowrap",
              }}>
                median · {formatTime(medianTime)}
              </span>
            </div>
          )}

          {cells.map((cell, i) => {
            const tier = cell.skipped ? "muted" : (cell.hasScore ? loadTier(cell.score) : "muted");
            const tint = LOAD_TINTS[tier];
            const fillH = cell.skipped ? 0 : cell.time > 0 ? normTime(cell.time) : (cell.hasScore ? 0.22 : 0);
            const isHovered = hoveredIdx === i;
            const overload = !cell.skipped && cell.time > 0 && isOverloaded(cell.time, medianTime, cell.score);
            const peak = !cell.skipped && isPeakLoad(cell.time, maxTime, cell.score);
            const tierColor = tier === "green" ? C.green : tier === "blue" ? C.blue500 : tier === "amber" ? C.amber : tier === "red" ? C.red : C.muted;

            return (
              <div
                key={i}
                style={{ position: "relative", flexShrink: 0, zIndex: isHovered ? 10 : 1 }}
                onMouseMove={(e) => handleMouseMove(e, i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Overload glow ring */}
                {overload && (
                  <div style={{
                    position: "absolute",
                    inset: -3,
                    borderRadius: 11,
                    border: `1.5px solid ${C.amber}60`,
                    boxShadow: `0 0 12px ${C.amber}30`,
                    pointerEvents: "none",
                    zIndex: 2,
                  }} />
                )}
                {peak && (
                  <div style={{
                    position: "absolute",
                    inset: -4,
                    borderRadius: 12,
                    border: `2px solid ${C.red}70`,
                    boxShadow: `0 0 18px ${C.red}28`,
                    pointerEvents: "none",
                    zIndex: 3,
                  }} />
                )}

                {/* Cell body */}
                <div style={{
                  width: CELL_W,
                  height: CELL_H,
                  borderRadius: 9,
                  background: cell.skipped
                    ? "transparent"
                    : tint.bg,
                  border: cell.skipped
                    ? `1.5px dashed ${C.borderMd}`
                    : `1px solid ${isHovered ? tierColor + "60" : "transparent"}`,
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.14s ease, border-color 0.14s ease",
                  transform: isHovered ? "scaleY(1.04) translateY(-2px)" : "none",
                  cursor: "default",
                }}>
                  {/* Time bar (fills from bottom) */}
                  {!cell.skipped && fillH > 0 && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${fillH * 100}%`,
                      background: tint.fill,
                      borderRadius: "0 0 8px 8px",
                      transition: "height 0.9s cubic-bezier(.16,1,.3,1)",
                    }} />
                  )}

                  {/* Score chip at top of cell */}
                  {cell.hasScore && !cell.skipped && (
                    <div style={{
                      position: "absolute",
                      top: 5,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontFamily: F.display,
                      fontSize: 11,
                      fontWeight: 900,
                      color: isHovered ? "#fff" : tierColor,
                      lineHeight: 1,
                      zIndex: 2,
                      textShadow: isHovered ? `0 0 6px ${tierColor}` : "none",
                      transition: "color 0.14s ease",
                    }}>
                      {cell.score}
                    </div>
                  )}

                  {/* Skipped marker */}
                  {cell.skipped && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: F.mono, fontSize: 10, color: C.faint }}>—</span>
                    </div>
                  )}

                  {/* Overload ⚡ icon */}
                  {overload && !peak && (
                    <div style={{
                      position: "absolute", bottom: 4, right: 4,
                      fontSize: 8, zIndex: 4, opacity: 0.8,
                    }}>⚡</div>
                  )}
                  {peak && (
                    <div style={{
                      position: "absolute", bottom: 4, right: 4,
                      fontSize: 8, zIndex: 4,
                    }}>🔴</div>
                  )}
                </div>

                {/* Q-number label below */}
                <div style={{
                  textAlign: "center",
                  fontFamily: F.mono,
                  fontSize: 8.5,
                  color: isHovered ? tierColor : C.faint,
                  marginTop: 5,
                  transition: "color 0.14s ease",
                  fontWeight: isHovered ? 700 : 400,
                }}>
                  Q{i + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {hoveredCell && (
          <div style={{
            position: "absolute",
            top: Math.max(4, tooltipPos.y - 120),
            left: Math.min(tooltipPos.x - 80, containerRef.current ? containerRef.current.offsetWidth - 200 : 0),
            zIndex: 20,
            background: C.card,
            border: `1px solid ${C.borderMd}`,
            borderRadius: 12,
            padding: "12px 14px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            pointerEvents: "none",
            minWidth: 170,
            animation: "scaleIn 0.15s cubic-bezier(.16,1,.3,1)",
          }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 7 }}>
              Q{hoveredCell.index + 1} · {hoveredCell.topic}
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
              {hoveredCell.hasScore && !hoveredCell.skipped && (
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: scoreColor(hoveredCell.score), lineHeight: 1 }}>{hoveredCell.score}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>/ 100</div>
                </div>
              )}
              {hoveredCell.time > 0 && !hoveredCell.skipped && (
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.blue500, lineHeight: 1 }}>{formatTime(hoveredCell.time)}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>time taken</div>
                </div>
              )}
              {hoveredCell.skipped && (
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>skipped</div>
              )}
            </div>
            {overloadFlag && !peakFlag && (
              <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", borderRadius: 7, background: C.amberTint, border: `1px solid ${C.amber}35` }}>
                <span style={{ fontSize: 10 }}>⚡</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.amber, fontWeight: 700 }}>load spike</span>
              </div>
            )}
            {peakFlag && (
              <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", borderRadius: 7, background: C.redTint, border: `1px solid ${C.red}35` }}>
                <span style={{ fontSize: 10 }}>🔴</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.red, fontWeight: 700 }}>peak overload</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend — time axis */}
      {timedCells.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingLeft: STRIP_PADDING }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ width: 6, height: 14, borderRadius: 2, background: C.borderMd }} />
            <div style={{ width: 6, height: 6, borderRadius: 2, background: C.border }} />
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.faint, lineHeight: 1.4 }}>
            bar height = time taken · {formatTime(minTime)} → {formatTime(maxTime)}
          </span>
        </div>
      )}

      {/* Insight strip */}
      <div style={{
        marginTop: 18,
        padding: "12px 16px",
        borderRadius: 11,
        background: `${insight.accent}10`,
        border: `1px solid ${insight.accent}25`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <div style={{ width: 5, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: insight.accent, opacity: 0.6, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.sub }}>{insight.text}</p>
      </div>
    </section>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// 2. QUESTION DIFFICULTY CALIBRATION
//
// What it shows:
//   A 2×2 grid of quadrants based on inferred difficulty × result:
//
//     HARD (took > median time)  +  PASS (score ≥ 60)  → "Real strength"
//     HARD                       +  FAIL (score < 60)  → "Stretch zone"
//     EASY (took ≤ median time)  +  PASS               → "Baseline"
//     EASY                       +  FAIL               → "Priority gap ⚠️"
//
//   Difficulty is inferred from time relative to the session median.
//   This is NOT a self-report — it's derived from behavior.
//
// Why it's unique:
//   Most result pages show score per question. Nobody shows "was this
//   question actually hard for you?" Most platforms treat all questions as
//   equal-weight. This surfaces the most important distinction:
//
//   EASY + FAIL = your highest-priority gap.
//   The user *should* have gotten that. They didn't because of a knowledge
//   hole, not because the question was hard. That's more fixable and more
//   urgent than HARD + FAIL.
//
//   HARD + PASS = genuine strength. The user earned that under pressure.
//   That's a signal they should hear.
//
// Design:
//   - 4 quadrant tiles in a 2×2 grid
//   - Each tile: large question count, quadrant label, color-coded
//   - A scrollable list of questions in the selected quadrant on click
//   - A single auto-generated insight at the bottom
// ═══════════════════════════════════════════════════════════════════════════

const QUADRANTS = [
  {
    id: "hard-pass",
    label: "Real strength",
    sub: "Hard for you · got it right",
    desc: "You spent the time and delivered. These are your interview anchors.",
    icon: "◆",
    color: C.green,
    tint: C.greenTint,
    // isHard=true, isPassed=true
    pred: (isHard, isPassed) => isHard && isPassed,
  },
  {
    id: "easy-pass",
    label: "Baseline",
    sub: "Quick · got it right",
    desc: "Comfortable territory. Good floor, but don't over-index here.",
    icon: "●",
    color: C.blue500,
    tint: C.blue50,
    pred: (isHard, isPassed) => !isHard && isPassed,
  },
  {
    id: "hard-fail",
    label: "Stretch zone",
    sub: "Hard for you · missed",
    desc: "These are genuinely tough. Focused prep will move them over time.",
    icon: "▲",
    color: C.amber,
    tint: C.amberTint,
    pred: (isHard, isPassed) => isHard && !isPassed,
  },
  {
    id: "easy-fail",
    label: "Priority gap",
    sub: "Quick · still missed",
    desc: "Fastest answers that scored lowest — knowledge hole, not difficulty. Fix these first.",
    icon: "▼",
    color: C.red,
    tint: C.redTint,
    pred: (isHard, isPassed) => !isHard && !isPassed,
  },
];

export const QuestionDifficultyCalibration = ({ questions }) => {
  const [selectedQ, setSelectedQ] = useState(null);

  // Only include questions with both time and score data
  const scoredTimed = useMemo(() => {
    return questions.filter(q => {
      if (q.skipped) return false;
      const hasScore = typeof q.aiFeedback?.score === "number" || typeof q.score === "number";
      const hasTime = Number(q.timeTaken || 0) > 0;
      return hasScore && hasTime;
    }).map(q => ({
      ...q,
      _score: clamp(typeof q.aiFeedback?.score === "number" ? q.aiFeedback.score : Number(q.score || 0)),
      _time: Number(q.timeTaken),
    }));
  }, [questions]);

  if (scoredTimed.length < 3) {
    return (
      <section style={phaseS.card}>
        <div style={phaseS.eyebrow}>Difficulty calibration</div>
        <h2 style={phaseS.cardH2}>Easy miss vs. hard earn</h2>
        <p style={phaseS.cardSub}>
          Need at least 3 timed, scored questions to calibrate. {scoredTimed.length > 0 ? `${scoredTimed.length} so far.` : "No qualifying questions yet."}
        </p>
      </section>
    );
  }

  const sortedByTime = [...scoredTimed].sort((a, b) => a._time - b._time);
  const mid = Math.floor(sortedByTime.length / 2);
  const medianTime = sortedByTime.length % 2
    ? sortedByTime[mid]._time
    : (sortedByTime[mid - 1]._time + sortedByTime[mid]._time) / 2;

  const classified = scoredTimed.map(q => ({
    ...q,
    isHard: q._time > medianTime,
    isPassed: q._score >= 60,
  }));

  const quadrantData = QUADRANTS.map(qd => ({
    ...qd,
    questions: classified.filter(q => qd.pred(q.isHard, q.isPassed)),
  }));

  // Auto-generated insight
  const priorityGap = quadrantData.find(q => q.id === "easy-fail");
  const realStrength = quadrantData.find(q => q.id === "hard-pass");

  const insight = useMemo(() => {
    const gapCount = priorityGap?.questions.length || 0;
    const strengthCount = realStrength?.questions.length || 0;

    if (gapCount === 0 && strengthCount === 0)
      return { text: "Clean split — no easy misses, no hard wins. The session was consistent across difficulty.", accent: C.blue500 };
    if (gapCount === 0 && strengthCount > 0)
      return {
        text: `${strengthCount} hard question${strengthCount > 1 ? "s" : ""} answered correctly — those are genuine strengths, not lucky guesses. No easy questions missed.`,
        accent: C.green,
      };
    if (gapCount > 0 && strengthCount === 0)
      return {
        text: `${gapCount} quick miss${gapCount > 1 ? "es" : ""} — questions you answered fast but still got wrong. Those are pure knowledge gaps, not time or difficulty issues. Highest ROI drill target.`,
        accent: C.red,
      };

    return {
      text: `${gapCount} easy miss${gapCount > 1 ? "es" : ""} (fix first) · ${strengthCount} hard win${strengthCount > 1 ? "s" : ""} (genuine strength). The gap between these two is the real picture of where you stand.`,
      accent: C.amber,
    };
  }, [priorityGap, realStrength]);

  return (
    <section style={phaseS.card}>
      <div style={phaseS.eyebrow}>Difficulty calibration</div>
      <h2 style={phaseS.cardH2}>Easy miss vs. hard earn</h2>
      <p style={phaseS.cardSub}>
        Difficulty is inferred from your own pace — questions you answered faster than your session median are treated as "easy for you." This reveals whether your gaps are knowledge holes or genuine stretch.
      </p>

      {/* 2×2 grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginTop: 22,
      }}>
        {quadrantData.map((qd) => {
          const isSelected = selectedQ === qd.id;
          const isEmpty = qd.questions.length === 0;

          return (
            <button
              key={qd.id}
              onClick={() => setSelectedQ(isSelected ? null : qd.id)}
              disabled={isEmpty}
              style={{
                border: `1.5px solid ${isSelected ? qd.color + "60" : qd.color + "22"}`,
                borderRadius: 16,
                padding: "18px 20px",
                background: isSelected ? qd.tint : C.card,
                cursor: isEmpty ? "default" : "pointer",
                textAlign: "left",
                transition: "border-color 0.18s ease, background 0.18s ease, transform 0.15s cubic-bezier(.16,1,.3,1)",
                transform: isSelected ? "translateY(-1px)" : "none",
                boxShadow: isSelected ? `0 6px 20px ${qd.color}18` : "none",
                opacity: isEmpty ? 0.42 : 1,
                position: "relative",
                overflow: "hidden",
              }}
              aria-expanded={isSelected}
              aria-label={`${qd.label}: ${qd.questions.length} questions`}
            >
              {/* Background number watermark */}
              <div style={{
                position: "absolute",
                right: -4,
                bottom: -10,
                fontFamily: F.display,
                fontSize: 80,
                fontWeight: 900,
                color: qd.color,
                opacity: 0.05,
                lineHeight: 1,
                pointerEvents: "none",
                userSelect: "none",
              }}>
                {qd.questions.length}
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: `${qd.color}18`,
                  border: `1px solid ${qd.color}35`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  color: qd.color,
                  flexShrink: 0,
                }}>
                  {qd.icon}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: F.display, fontSize: 32, fontWeight: 900, color: isEmpty ? C.muted : qd.color, lineHeight: 1 }}>
                    {qd.questions.length}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 1 }}>
                    {qd.questions.length === 1 ? "question" : "questions"}
                  </div>
                </div>
              </div>

              <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                {qd.label}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, color: qd.color, marginBottom: 7, letterSpacing: "0.2px" }}>
                {qd.sub}
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.55, maxWidth: 220 }}>
                {qd.desc}
              </div>

              {!isEmpty && (
                <div style={{
                  marginTop: 12,
                  fontFamily: F.mono,
                  fontSize: 9,
                  color: qd.color,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: 0.8,
                }}>
                  {isSelected ? "▴ hide questions" : "▾ show questions"}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded question list */}
      {selectedQ && (() => {
        const qd = quadrantData.find(q => q.id === selectedQ);
        if (!qd || !qd.questions.length) return null;

        return (
          <div style={{
            marginTop: 14,
            border: `1px solid ${qd.color}30`,
            borderRadius: 14,
            overflow: "hidden",
            animation: "scaleIn 0.2s cubic-bezier(.16,1,.3,1)",
          }}>
            <div style={{
              padding: "10px 16px",
              background: `${qd.color}10`,
              borderBottom: `1px solid ${qd.color}20`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ fontSize: 11, color: qd.color }}>{qd.icon}</span>
              <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: qd.color }}>
                {qd.label} — {qd.questions.length} question{qd.questions.length > 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {qd.questions.map((q, i) => {
                const questionIndex = questions.indexOf(questions.find(orig => orig === q || (orig.id && orig.id === q.id))) ?? i;
                const displayIndex = typeof q.index === "number" ? q.index : questionIndex;

                return (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                    borderBottom: i < qd.questions.length - 1 ? `1px solid ${C.border}` : "none",
                    background: C.card,
                  }}>
                    {/* Score badge */}
                    <div style={{
                      flexShrink: 0,
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `${qd.color}14`,
                      border: `1px solid ${qd.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                    }}>
                      <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 900, color: qd.color, lineHeight: 1 }}>{q._score}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 7, color: C.muted }}>/ 100</span>
                    </div>

                    {/* Text + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.faint }}>Q{displayIndex + 1}</span>
                        <span style={{ color: C.border }}>·</span>
                        <span style={{ fontSize: 10.5, color: C.sub }}>{q.topic || "General"}</span>
                        <span style={{ color: C.border }}>·</span>
                        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>{formatTime(q._time)}</span>
                        {q.isHard && (
                          <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.amber, background: C.amberTint, border: `1px solid ${C.amber}30`, borderRadius: 999, padding: "2px 6px" }}>
                            hard for you
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {q.text || `Question ${displayIndex + 1}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Median time note */}
      <div style={{
        marginTop: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 10,
        background: C.card,
        border: `1px solid ${C.border}`,
      }}>
        <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>calibration baseline</span>
        <span style={{ color: C.borderMd }}>·</span>
        <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.sub }}>
          questions answered in &lt; {formatTime(medianTime)} (your session median) are treated as "easy for you"
        </span>
      </div>

      {/* Insight strip */}
      <div style={{
        marginTop: 12,
        padding: "12px 16px",
        borderRadius: 11,
        background: `${insight.accent}10`,
        border: `1px solid ${insight.accent}25`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <div style={{ width: 5, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: insight.accent, opacity: 0.6, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.sub }}>{insight.text}</p>
      </div>
    </section>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// Animated count-up hook
const useCountUp = (target, duration = 900, delay = 0) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timeout = setTimeout(() => { frame = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [target, duration, delay]);
  return value;
};

// Single animated DNA band
const DNABand = ({ axis, delay }) => {
  const displayScore = useCountUp(axis.score, 800, delay);

  const col = axis.score >= 80 ? C.green
    : axis.score >= 60 ? C.blue500
    : axis.score >= 40 ? C.amber
    : C.red;

  // The band's max half-width in px (each side of the spine)
  const BAND_MAX_HW = 140;
  const fillW = (axis.score / 100) * BAND_MAX_HW;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {/* Left side label + score */}
      <div style={{ width: 96, textAlign: "right", paddingRight: 14, flexShrink: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: col, lineHeight: 1 }}>
          {displayScore}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 2 }}>/ 100</div>
      </div>

      {/* Gel track — full width */}
      <div style={{ flex: 1, position: "relative", height: 32 }}>
        {/* Track background */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: 4,
          background: `${col}08`,
          border: `1px solid ${col}15`,
        }} />

        {/* Center spine */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1.5,
          background: `${col}30`,
          transform: "translateX(-50%)",
        }} />

        {/* Left fill (mirrored) */}
        <div style={{
          position: "absolute",
          right: "50%",
          top: 4,
          bottom: 4,
          width: fillW,
          borderRadius: "3px 0 0 3px",
          background: `linear-gradient(90deg, ${col}30, ${col}78)`,
          transition: `width 1s cubic-bezier(.16,1,.3,1) ${delay}ms`,
          boxShadow: `inset -1px 0 0 ${col}40`,
        }} />

        {/* Right fill */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: 4,
          bottom: 4,
          width: fillW,
          borderRadius: "0 3px 3px 0",
          background: `linear-gradient(90deg, ${col}78, ${col}30)`,
          transition: `width 1s cubic-bezier(.16,1,.3,1) ${delay}ms`,
          boxShadow: `inset 1px 0 0 ${col}40`,
        }} />

        {/* Tick marks at 25/50/75 */}
        {[25, 50, 75].map(pct => (
          <div key={pct} style={{
            position: "absolute",
            left: `${pct}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: `rgba(255,255,255,0.07)`,
            pointerEvents: "none",
          }} />
        ))}
      </div>

      {/* Right side label */}
      <div style={{ width: 96, paddingLeft: 14, flexShrink: 0 }}>
        <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
          {axis.label}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>
          {axis.sublabel}
        </div>
      </div>
    </div>
  );
};

export const SessionDNAFingerprint = ({ questions, totalScore, result }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const axes = useMemo(() => {
    const evaluated = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number");
    const answered = questions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped");
    const openEnded = evaluated.filter(q => !["mcq", "aptitude"].includes(q.questionType));

    // DEPTH — avg open-ended score, fall back to overall score
    const depth = openEnded.length > 0
      ? Math.round(openEnded.reduce((s, q) => s + q.aiFeedback.score, 0) / openEnded.length)
      : clamp(totalScore || 0);

    // SPEED — invert avg time. Reference: 30s = perfect (100), 300s+ = 0.
    //   speed = clamp(100 - ((avgTime - 30) / 270) * 100)
    const avgTime = answered.length > 0
      ? answered.reduce((s, q) => s + Number(q.timeTaken || 0), 0) / answered.length
      : 0;
    const speed = avgTime > 0
      ? clamp(Math.round(100 - ((avgTime - 30) / 270) * 100))
      : 50; // no time data → neutral

    // CONSISTENCY — 100 − normalized stdDev
    let consistency = 50;
    if (evaluated.length >= 2) {
      const scores = evaluated.map(q => q.aiFeedback.score);
      const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
      const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      // stdDev of 0 = 100, stdDev of 35+ = 0
      consistency = clamp(Math.round(100 - (stdDev / 35) * 100));
    }

    // COMPLETION — answered / total × 100
    const completion = questions.length > 0
      ? clamp(Math.round((answered.length / questions.length) * 100))
      : 0;

    return [
      {
        key: "depth",
        label: "Depth",
        sublabel: openEnded.length > 0 ? `${openEnded.length} open-ended` : "overall score",
        score: depth,
      },
      {
        key: "speed",
        label: "Speed",
        sublabel: avgTime > 0 ? `~${formatTime(Math.round(avgTime))} avg` : "no time data",
        score: speed,
      },
      {
        key: "consistency",
        label: "Consistency",
        sublabel: evaluated.length >= 2 ? "score variance" : "< 2 scored",
        score: consistency,
      },
      {
        key: "completion",
        label: "Completion",
        sublabel: `${answered.length} / ${questions.length} answered`,
        score: completion,
      },
    ];
  }, [questions, totalScore]);

  // Generate a 1-line "fingerprint read" from the axis profile
  const fingerprintRead = useMemo(() => {
    const [depth, speed, consistency, completion] = axes;
    const highAxes = axes.filter(a => a.score >= 72).map(a => a.label.toLowerCase());
    const lowAxes = axes.filter(a => a.score < 45).map(a => a.label.toLowerCase());

    if (lowAxes.length === 0 && highAxes.length >= 3)
      return "Across-the-board strong session — high floor on every axis.";
    if (depth.score >= 72 && speed.score < 45)
      return "Deep thinker this session — answers had substance but pace was slower than optimal.";
    if (speed.score >= 72 && depth.score < 45)
      return "Fast but shallow — pace is there, depth needs to catch up.";
    if (consistency.score < 45)
      return "High variance session — your best and worst answers were far apart. Pinpoint the gap.";
    if (consistency.score >= 80 && depth.score >= 60)
      return "Consistent and capable — this is a replicable form, not a lucky session.";
    if (completion.score < 60)
      return "Skips cost you here. A full pass at this depth level would meaningfully raise the score.";
    return "Mixed fingerprint — no single axis dominates. Open the question review to find the pattern.";
  }, [axes]);

  return (
    <section style={phaseS.card} ref={ref}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={phaseS.eyebrow}>Session DNA</div>
          <h2 style={phaseS.cardH2}>Your behavioral fingerprint</h2>
          <p style={phaseS.cardSub}>
            Four axes distilled from how you answered — not just what you scored.
            The pattern across all four is more useful than any single number.
          </p>
        </div>
        {/* Mini legend */}
        <div style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: C.card,
          border: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginBottom: 7 }}>reading the bands</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 32, height: 6, borderRadius: 2, background: `linear-gradient(90deg, ${C.green}30, ${C.green}78)` }} />
              <span style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>wider = stronger</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 16, height: 6, borderRadius: 2, background: `linear-gradient(90deg, ${C.red}30, ${C.red}78)` }} />
              <span style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>narrower = needs work</span>
            </div>
          </div>
        </div>
      </div>

      {/* DNA gel lanes */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "20px 16px",
        borderRadius: 14,
        background: C.card,
        border: `1px solid ${C.border}`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}>
        {axes.map((axis, i) => (
          <DNABand key={axis.key} axis={axis} delay={visible ? i * 120 : 9999} />
        ))}
      </div>

      {/* Fingerprint read */}
      <div style={{
        marginTop: 14,
        padding: "13px 16px",
        borderRadius: 11,
        background: `${C.blue500}08`,
        border: `1px solid ${C.blue500}20`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <div style={{ width: 5, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: C.blue500, opacity: 0.5, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.sub }}>{fingerprintRead}</p>
      </div>

      {/* Axis scores in a compact chip row — quick scan */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {axes.map(a => {
          const col = a.score >= 80 ? C.green : a.score >= 60 ? C.blue500 : a.score >= 40 ? C.amber : C.red;
          return (
            <div key={a.key} style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 999,
              background: C.card,
              border: `1px solid ${C.border}`,
            }}>
              <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 800, color: col }}>{a.score}</span>
              <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{a.label.toLowerCase()}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// 2. RECOVERY PATTERN DETECTOR
//
// Replaces the existing RepeatedMistake component with something that
// shows BOTH signals in a side-by-side layout:
//
//   LEFT PANEL  — "Pattern alert": the repeated failure keyword/topic
//                 (same logic as RepeatedMistake, kept intact)
//   RIGHT PANEL — "Recovery moment": the biggest score jump in the session
//                 (e.g., "After Q3 dropped to 42, you bounced to 78 on Q4")
//
// If there's no recovery and no pattern: returns null (same behavior).
// If there's a pattern but no recovery: shows only the pattern panel.
// If there's a recovery but no pattern: shows only the recovery panel.
// If both: shows them side by side in a matched 2-col layout.
//
// Design:
//   - Amber/red gradient tile for the pattern alert
//   - Green/violet gradient tile for the recovery signal
//   - The two tiles are visually matched in height (CSS grid auto-rows)
//   - Each tile has a "so what?" line that makes the signal actionable
// ═══════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","is","are",
  "was","were","be","been","being","this","that","these","those","it","its",
  "as","at","by","from","not","no","did","does","do","your","you","answer",
  "question","missing","lacked","lacking","lack","more","also","could","should",
  "would","have","has","had","about","into","than","then","which","what",
  "how","why","when","some","any","need","needs","needed",
  "depth","detail","specific","specifics","example","examples","explain",
  "explanation","provide","structure","context","clear","clarity","show",
  "demonstrate","include","consider","important","relevant","response",
  "point","points","better","strong","weak","good","great","well","just",
  "make","sure","help","improve","work","focus","mention","discuss",
]);

const extractKeywords = (text) => {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
};

// Detect the strongest recovery jump in scored questions
const findRecovery = (questions) => {
  const pts = questions
    .filter(q => !q.skipped && typeof q.aiFeedback?.score === "number")
    .map(q => ({ score: q.aiFeedback.score, index: q.index ?? 0, topic: q.topic || "General" }))
    .sort((a, b) => a.index - b.index);

  let bestJump = 0, from = null, to = null;
  for (let i = 1; i < pts.length; i++) {
    const jump = pts[i].score - pts[i - 1].score;
    if (jump > bestJump) { bestJump = jump; from = pts[i - 1]; to = pts[i]; }
  }

  if (!from || !to || bestJump < 15) return null;
  return { from, to, jump: bestJump };
};

// Detect the worst repeated mistake (keyword or topic fallback)
const findPattern = (questions) => {
  const weak = questions.filter(q =>
    !q.skipped &&
    typeof q.aiFeedback?.score === "number" &&
    q.aiFeedback.score < 60 &&
    q.aiFeedback.missing
  );

  if (weak.length < 2) return null;

  const counts = {};
  weak.forEach(q => {
    const seen = new Set(extractKeywords(q.aiFeedback.missing));
    seen.forEach(word => {
      if (!counts[word]) counts[word] = { count: 0, questions: [] };
      counts[word].count += 1;
      counts[word].questions.push(q);
    });
  });

  const [topWord, topData] = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)[0] || [];

  if (topWord && topData?.count >= 2) {
    return { type: "keyword", word: topWord, questions: topData.questions, totalWeak: weak.length };
  }

  // Topic fallback
  const topicCounts = {};
  weak.forEach(q => {
    if (!topicCounts[q.topic]) topicCounts[q.topic] = [];
    topicCounts[q.topic].push(q);
  });
  const [topTopic, topTopicQs] = Object.entries(topicCounts).sort((a, b) => b[1].length - a[1].length)[0] || [];
  if (topTopic && topTopicQs?.length >= 2) {
    return { type: "topic", topic: topTopic, questions: topTopicQs, totalWeak: weak.length };
  }

  return null;
};

const PatternPanel = ({ pattern }) => {
  const label = pattern.type === "keyword"
    ? `"${pattern.word}" — in ${pattern.questions.length} weak answers`
    : `${pattern.topic} — ${pattern.questions.length} weak answers in one topic`;

  const desc = pattern.type === "keyword"
    ? `The same gap showed up across ${pattern.questions.length} of your ${pattern.totalWeak} weak answers. That convergence is a stronger signal than any single piece of feedback.`
    : `Your weakest answers concentrated in a single topic. A topic-cluster like this is more meaningful than scattered individual misses.`;

  const soWhat = pattern.type === "keyword"
    ? `Drill for "${pattern.word}" specifically — it's showing up because it's missing from your answer structure, not just from one question.`
    : `Do a focused topic session on ${pattern.topic} before your next general rep. One topic pulling down three questions costs more than it looks.`;

  return (
    <div style={{
      borderRadius: 16,
      padding: "20px 22px",
      background: `linear-gradient(135deg, ${C.amberTint} 0%, ${C.card} 70%)`,
      border: `1.5px solid ${C.amber}35`,
      display: "flex",
      flexDirection: "column",
      gap: 14,
      height: "100%",
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${C.amber}18`, border: `1px solid ${C.amber}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>⚡</div>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.amber, letterSpacing: "0.5px", marginBottom: 4 }}>
            pattern alert
          </div>
          <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>
            {label}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: C.sub }}>{desc}</p>

      {/* Question chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {pattern.questions.map((q, i) => (
          <span key={i} style={{
            fontFamily: F.mono, fontSize: 10, fontWeight: 600,
            color: C.amber, background: C.card,
            border: `1px solid ${C.amber}40`, borderRadius: 999,
            padding: "4px 10px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 900 }}>
              {q.aiFeedback?.score ?? "—"}
            </span>
            Q{(q.index ?? 0) + 1} · {q.topic}
          </span>
        ))}
      </div>

      {/* So what */}
      <div style={{
        marginTop: "auto",
        padding: "10px 13px",
        borderRadius: 10,
        background: `${C.amber}10`,
        border: `1px solid ${C.amber}25`,
        fontSize: 11.5,
        lineHeight: 1.6,
        color: C.sub,
      }}>
        <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.amber, display: "block", marginBottom: 4 }}>
          so what →
        </span>
        {soWhat}
      </div>
    </div>
  );
};

const RecoveryPanel = ({ recovery }) => {
  const { from, to, jump } = recovery;

  const soWhat = jump >= 30
    ? `A ${jump}-point swing in one question is a significant composure recovery — you reset fast. That's a skill, not luck.`
    : `After a hard question, you came back ${jump} pts stronger. Knowing you can recover like this should affect how you pace yourself in real interviews.`;

  return (
    <div style={{
      borderRadius: 16,
      padding: "20px 22px",
      background: `linear-gradient(135deg, ${C.greenTint} 0%, ${C.card} 70%)`,
      border: `1.5px solid ${C.green}35`,
      display: "flex",
      flexDirection: "column",
      gap: 14,
      height: "100%",
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${C.green}18`, border: `1px solid ${C.green}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>◆</div>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.green, letterSpacing: "0.5px", marginBottom: 4 }}>
            recovery moment
          </div>
          <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>
            +{jump} pts — Q{from.index + 1} → Q{to.index + 1}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: C.sub }}>
        Your strongest bounce-back of the session. After scoring <strong style={{ color: C.text }}>{from.score}</strong> on Q{from.index + 1} ({from.topic}), you came back with <strong style={{ color: C.text }}>{to.score}</strong> on Q{to.index + 1} ({to.topic}).
      </p>

      {/* Visual jump arrow */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "14px 0",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: F.display, fontSize: 36, fontWeight: 900,
            color: scoreColor(from.score), lineHeight: 1,
          }}>{from.score}</div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 3 }}>Q{from.index + 1}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{
            fontFamily: F.display, fontSize: 13, fontWeight: 800,
            color: C.green, lineHeight: 1,
          }}>+{jump}</div>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, ${scoreColor(from.score)}, ${C.green})`, borderRadius: 1 }} />
          <div style={{ fontSize: 10 }}>→</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: F.display, fontSize: 36, fontWeight: 900,
            color: scoreColor(to.score), lineHeight: 1,
          }}>{to.score}</div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 3 }}>Q{to.index + 1}</div>
        </div>
      </div>

      {/* So what */}
      <div style={{
        marginTop: "auto",
        padding: "10px 13px",
        borderRadius: 10,
        background: `${C.green}10`,
        border: `1px solid ${C.green}25`,
        fontSize: 11.5,
        lineHeight: 1.6,
        color: C.sub,
      }}>
        <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.green, display: "block", marginBottom: 4 }}>
          so what →
        </span>
        {soWhat}
      </div>
    </div>
  );
};

export const RecoveryPatternDetector = ({ questions }) => {
  const pattern = useMemo(() => findPattern(questions), [questions]);
  const recovery = useMemo(() => findRecovery(questions), [questions]);

  if (!pattern && !recovery) return null;

  const both = pattern && recovery;
  const onlyPattern = pattern && !recovery;
  const onlyRecovery = recovery && !pattern;

  return (
    <section style={{ marginBottom: 18 }}>
      {/* Section header — only shown when both panels are present */}
      {both && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
          padding: "0 2px",
        }}>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: "0.5px" }}>
            patterns detected
          </div>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>
            what to keep · what to fix
          </div>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: both ? "1fr 1fr" : "1fr",
        gap: 14,
        alignItems: "start",
      }} className="res-recovery-grid">
        {pattern && <PatternPanel pattern={pattern} />}
        {recovery && <RecoveryPanel recovery={recovery} />}
      </div>
    </section>
  );
};


// ─── MomentumArrow helpers ───────────────────────────────────────────────────
const linearRegression = (points) => {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const regressionStdErr = (points, slope, intercept) => {
  if (points.length < 3) return 8;
  const residuals = points.map(p => p.y - (slope * p.x + intercept));
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  return Math.sqrt(sse / (points.length - 2));
};

// ═══════════════════════════════════════════════════════════════════════════
export const MomentumArrow = ({ scoreHistory, currentScore }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build the historical data array.
  // scoreHistory is expected as [{score, date}] or [number].
  // currentScore is always appended as the last point.
  const history = useMemo(() => {
    const raw = Array.isArray(scoreHistory) ? scoreHistory : [];
    const parsed = raw.map((item, i) => ({
      score: clamp(typeof item === "number" ? item : Number(item?.score ?? item?.totalScore ?? 0)),
      label: item?.date ? new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : `S${i + 1}`,
    }));

    // Append current session if not already included
    const last = parsed[parsed.length - 1];
    const clamped = clamp(currentScore || 0);
    if (!last || last.score !== clamped) {
      parsed.push({ score: clamped, label: "today" });
    }

    return parsed;
  }, [scoreHistory, currentScore]);

  // Chart dimensions
  const W = 640, H = 210, padX = 30, padY = 22;
  const PROJ_COUNT = 2; // how many sessions to project forward

  // Regression over actual points
  const regressionPoints = history.map((h, i) => ({ x: i, y: h.score }));
  const { slope, intercept } = linearRegression(regressionPoints);
  const stdErr = regressionStdErr(regressionPoints, slope, intercept);

  // Total x-domain = history.length - 1 actual + PROJ_COUNT projected
  const totalX = history.length - 1 + PROJ_COUNT;

  const xp = (xi) => padX + (xi / totalX) * (W - padX * 2);
  const yp = (score) => H - padY - (clamp(score) / 100) * (H - padY * 2);

  // Actual line path
  const actualPath = history.map((h, i) =>
    `${i === 0 ? "M" : "L"} ${xp(i).toFixed(1)} ${yp(h.score).toFixed(1)}`
  ).join(" ");

  // Projected path (dashed) — from last actual to PROJ_COUNT forward
  const lastActualX = history.length - 1;
  const projPoints = [];
  for (let i = 0; i <= PROJ_COUNT; i++) {
    const xi = lastActualX + i;
    const projScore = clamp(slope * xi + intercept);
    projPoints.push({ xi, score: projScore });
  }
  const projPath = projPoints.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${xp(p.xi).toFixed(1)} ${yp(p.score).toFixed(1)}`
  ).join(" ");

  // Uncertainty cone (polygon: upper edge → lower edge reversed)
  const coneWidth = Math.min(stdErr * 1.5, 20); // cap at 20 pts
  const conePath = (() => {
    const topEdge = projPoints.map((p, i) =>
      `${i === 0 ? "M" : "L"} ${xp(p.xi).toFixed(1)} ${yp(Math.min(p.score + coneWidth * (i + 1) * 0.6, 100)).toFixed(1)}`
    );
    const bottomEdge = [...projPoints].reverse().map((p, i) =>
      `L ${xp(p.xi).toFixed(1)} ${yp(Math.max(p.score - coneWidth * (projPoints.length - 1 - i) * 0.6, 0)).toFixed(1)}`
    );
    return [...topEdge, ...bottomEdge, "Z"].join(" ");
  })();

  // Prediction text
  const currentTrend = slope; // pts per session
  const latestScore = history[history.length - 1]?.score ?? 0;

  const prediction = useMemo(() => {
    if (history.length < 2) return null;

    const targetScore = 80;
    const sessionsTo80 = slope > 0 && latestScore < targetScore
      ? Math.ceil((targetScore - latestScore) / slope)
      : null;

    const sessionsToFloor = slope < 0 && latestScore > 40
      ? Math.ceil((latestScore - 40) / Math.abs(slope))
      : null;

    if (Math.abs(slope) < 0.5) {
      return {
        text: `Score has been flat across ${history.length} sessions — the trajectory needs a change, not more of the same prep.`,
        action: "Change your question mix or increase difficulty.",
        color: C.amber,
        icon: "→",
      };
    }
    if (slope > 0 && sessionsTo80 !== null) {
      if (latestScore >= 80) {
        return {
          text: `You're already past 80 and trending up. The next milestone is elite form above 90.`,
          action: `At +${slope.toFixed(1)} pts/session, 90 is within reach in ${Math.ceil((90 - latestScore) / slope)} sessions.`,
          color: C.green,
          icon: "▲",
        };
      }
      return {
        text: `At +${slope.toFixed(1)} pts/session, you hit 80 in roughly ${sessionsTo80} more session${sessionsTo80 === 1 ? "" : "s"}.`,
        action: "Keep the consistency — don't change what's working.",
        color: C.green,
        icon: "▲",
      };
    }
    if (slope < 0 && sessionsToFloor !== null) {
      return {
        text: `Score is dropping at ${Math.abs(slope).toFixed(1)} pts/session. The pattern is worth addressing now, not after a few more dips.`,
        action: "Go back to weak topics before queuing general sessions.",
        color: C.red,
        icon: "▼",
      };
    }
    return {
      text: `${slope > 0 ? "Upward" : "Downward"} trend of ${Math.abs(slope).toFixed(1)} pts/session detected across ${history.length} sessions.`,
      action: slope > 0 ? "You're building form. Stay consistent." : "Address the trend before it becomes a habit.",
      color: slope > 0 ? C.blue500 : C.amber,
      icon: slope > 0 ? "▲" : "▼",
    };
  }, [history, slope, latestScore]);

  // The arc color — based on current score and slope direction
  const arcColor = slope >= 0.5 ? C.green : slope <= -0.5 ? C.red : C.amber;

  // Minimal state if fewer than 2 sessions
  const hasEnoughHistory = history.length >= 2;

  if (!hasEnoughHistory) {
    return (
      <section style={phaseS.card} ref={ref}>
        <div style={phaseS.eyebrow}>momentum</div>
        <h2 style={phaseS.cardH2}>Where you're heading</h2>
        <p style={phaseS.cardSub}>
          This is your first recorded session. After two or more sessions, a trajectory projection will appear here — showing where the current trend line puts you in 2–3 sessions.
        </p>
        <div style={{
          marginTop: 18,
          padding: "16px 18px",
          borderRadius: 12,
          background: C.card,
          border: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}>
          <div style={{ fontFamily: F.display, fontSize: 44, fontWeight: 900, color: scoreColor(currentScore), lineHeight: 1 }}>
            {clamp(currentScore || 0)}
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: C.text }}>Session 1 baseline</div>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
              This score is your floor. Every session from here is data toward your trajectory.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={phaseS.card} ref={ref}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={phaseS.eyebrow}>momentum</div>
          <h2 style={phaseS.cardH2}>Where you're heading</h2>
          <p style={phaseS.cardSub}>
            {history.length} sessions plotted. The dashed projection shows where the current trend puts you next — with an uncertainty cone.
          </p>
        </div>

        {/* Trend chip */}
        {prediction && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            borderRadius: 999,
            background: `${prediction.color}12`,
            border: `1px solid ${prediction.color}35`,
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: prediction.color }}>{prediction.icon}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: prediction.color, fontWeight: 700 }}>
              {slope >= 0.5 ? "+" : ""}{slope.toFixed(1)} pts/session
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{
            minWidth: 380,
            display: "block",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <defs>
            <linearGradient id="momAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={arcColor} stopOpacity="0.12" />
              <stop offset="100%" stopColor={arcColor} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="momConeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={arcColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={arcColor} stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {/* Reference lines */}
          {[40, 60, 80].map(l => (
            <g key={l}>
              <line x1={padX} x2={W - padX} y1={yp(l)} y2={yp(l)} stroke={C.border} strokeDasharray="4 5" />
              <text x={2} y={yp(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text>
            </g>
          ))}

          {/* Divider between actual and projected */}
          <line
            x1={xp(lastActualX)} x2={xp(lastActualX)}
            y1={padY} y2={H - padY}
            stroke={C.borderMd} strokeWidth="1" strokeDasharray="2 3"
          />
          <text
            x={xp(lastActualX) + 5}
            y={padY + 10}
            fontSize="7.5" fontFamily={F.mono} fill={C.faint}
          >
            now
          </text>
          <text
            x={xp(lastActualX + 0.5)}
            y={padY + 20}
            fontSize="7.5" fontFamily={F.mono} fill={C.faint}
          >
            projected →
          </text>

          {/* Uncertainty cone */}
          <path d={conePath} fill="url(#momConeGrad)" />

          {/* Actual area fill */}
          <path
            d={`${actualPath} L ${xp(lastActualX)} ${H - padY} L ${xp(0)} ${H - padY} Z`}
            fill="url(#momAreaGrad)"
          />

          {/* Actual line */}
          <path
            d={actualPath}
            fill="none"
            stroke={arcColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Projected dashed line */}
          <path
            d={projPath}
            fill="none"
            stroke={arcColor}
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Actual session dots */}
          {history.map((h, i) => (
            <g key={i}>
              <circle
                cx={xp(i)} cy={yp(h.score)}
                r="5.5"
                fill={scoreColor(h.score)}
                stroke="#fff"
                strokeWidth="1.5"
              />
              <text
                x={xp(i)} y={H - 5}
                textAnchor="middle"
                fontSize="7.5" fontFamily={F.mono} fill={i === history.length - 1 ? arcColor : C.muted}
                fontWeight={i === history.length - 1 ? "700" : "400"}
              >
                {h.label}
              </text>
            </g>
          ))}

          {/* Projected endpoint dot (hollow) */}
          {projPoints.slice(1).map((p, i) => (
            <g key={`proj-${i}`}>
              <circle
                cx={xp(p.xi)} cy={yp(p.score)}
                r="4.5"
                fill="none"
                stroke={arcColor}
                strokeWidth="1.5"
                strokeDasharray="3 2"
                opacity="0.65"
              />
              <text
                x={xp(p.xi)} y={yp(p.score) - 9}
                textAnchor="middle"
                fontSize="8.5" fontFamily={F.display} fill={arcColor}
                fontWeight="800" opacity="0.75"
              >
                ~{Math.round(clamp(p.score))}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Prediction card */}
      {prediction && (
        <div style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 0,
          borderRadius: 13,
          overflow: "hidden",
          border: `1px solid ${prediction.color}30`,
        }}>
          {/* Color accent bar */}
          <div style={{
            width: 5,
            background: `linear-gradient(180deg, ${prediction.color}, ${prediction.color}55)`,
          }} />
          <div style={{ padding: "14px 16px", background: `${prediction.color}08` }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.55, marginBottom: 6 }}>
              {prediction.text}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: prediction.color, fontWeight: 700 }}>
              {prediction.action}
            </div>
          </div>
        </div>
      )}

      {/* Uncertainty note */}
      <div style={{ marginTop: 10, fontSize: 10.5, color: C.faint, lineHeight: 1.5, paddingLeft: 2 }}>
        Projection assumes the current {slope >= 0 ? "upward" : "downward"} trend continues.
        Shaded cone = ±{Math.round(coneWidth)} pt uncertainty, widening per session.
      </div>
    </section>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
const toRad = (deg) => (deg * Math.PI) / 180;

const polarToXY = (cx, cy, r, angleDeg) => ({
  x: cx + r * Math.cos(toRad(angleDeg)),
  y: cy + r * Math.sin(toRad(angleDeg)),
});

// Build an SVG arc path for a donut segment.
// startAngle/endAngle in degrees, r_inner/r_outer in px.
const donutSegmentPath = (cx, cy, r_inner, r_outer, startAngle, endAngle) => {
  const s1 = polarToXY(cx, cy, r_outer, startAngle);
  const e1 = polarToXY(cx, cy, r_outer, endAngle);
  const s2 = polarToXY(cx, cy, r_inner, endAngle);
  const e2 = polarToXY(cx, cy, r_inner, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`,
    `A ${r_outer} ${r_outer} 0 ${large} 1 ${e1.x.toFixed(2)} ${e1.y.toFixed(2)}`,
    `L ${s2.x.toFixed(2)} ${s2.y.toFixed(2)}`,
    `A ${r_inner} ${r_inner} 0 ${large} 0 ${e2.x.toFixed(2)} ${e2.y.toFixed(2)}`,
    "Z",
  ].join(" ");
};

// ─── Segment config ──────────────────────────────────────────────────────────
const ARC_START   = 135;  // degrees — bottom-left (matches ScoreArc)
const ARC_SWEEP   = 270;  // total degrees
const SEG_GAP_DEG = 3;    // gap between segments in degrees
const CX          = 130;
const CY          = 130;
const R_TRACK     = 96;   // outer radius of the track (background)
const R_INNER     = 64;   // inner radius (donut hole)
const TRACK_W     = R_TRACK - R_INNER; // = 32px track width

// Fill: the filled arc thickness scales with score percentage.
// score 100 → fills the full TRACK_W. score 0 → fills 0.
// We add a minimum 3px so even a 1/100 is visible.
const fillRadius = (score) =>
  R_INNER + Math.max(3, (clamp(score) / 100) * TRACK_W);

// ─── Main component ──────────────────────────────────────────────────────────
export const AnswerConfidenceArc = ({ questions }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltipXY, setTooltipXY] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // Build segment data
  const segments = useMemo(() => {
    return questions.map((q, i) => {
      const isObjective = ["mcq", "aptitude"].includes(q.questionType);
      const hasScore = !q.skipped && typeof q.aiFeedback?.score === "number";
      const hasCorrect = !q.skipped && isObjective && q.aiFeedback?.correct != null;
      const score = hasScore
        ? q.aiFeedback.score
        : hasCorrect
          ? (q.aiFeedback.correct ? 100 : 0)
          : null;

      return {
        index: i,
        text: q.text || `Question ${i + 1}`,
        topic: q.topic || "General",
        skipped: q.skipped,
        isObjective,
        hasScore: score !== null,
        score: score ?? 0,
        correct: q.aiFeedback?.correct ?? null,
        timeTaken: Number(q.timeTaken || 0),
      };
    });
  }, [questions]);

  const n = segments.length;
  if (n === 0) {
    return (
      <div style={phaseS.emptyState}>
        No questions to display.
      </div>
    );
  }

  // Total gap degrees consumed by gaps
  const totalGapDeg = SEG_GAP_DEG * n;
  const availableDeg = ARC_SWEEP - totalGapDeg;
  const segDeg = availableDeg / n; // degrees per segment (equal weight)

  // Center stats
  const evaluated = segments.filter(s => s.hasScore && !s.skipped);
  const mcqSegs   = evaluated.filter(s => s.isObjective);
  const openSegs  = evaluated.filter(s => !s.isObjective);
  const mcqAcc    = mcqSegs.length
    ? Math.round((mcqSegs.filter(s => s.correct === true).length / mcqSegs.length) * 100)
    : null;
  const openAvg   = openSegs.length
    ? Math.round(openSegs.reduce((s, q) => s + q.score, 0) / openSegs.length)
    : null;
  const overallAvg = evaluated.length
    ? Math.round(evaluated.reduce((s, q) => s + q.score, 0) / evaluated.length)
    : 0;

  // Insight line
  const insight = useMemo(() => {
    if (!evaluated.length)
      return { text: "No evaluated answers yet.", accent: C.muted };

    const strong = evaluated.filter(s => s.score >= 80).length;
    const weak   = evaluated.filter(s => s.score < 60).length;

    if (mcqAcc !== null && openAvg !== null) {
      const gap = mcqAcc - openAvg;
      if (gap >= 15) return { text: `MCQ accuracy (${mcqAcc}%) is outpacing open-ended depth (${openAvg}/100) — communication, not knowledge, is the gap.`, accent: C.amber };
      if (gap <= -15) return { text: `Open-ended answers (${openAvg}/100) are outscoring objective accuracy (${mcqAcc}%) — brush up on the underlying facts.`, accent: C.blue500 };
      return { text: `Both formats are balanced — MCQ at ${mcqAcc}% and open-ended at ${openAvg}/100. No single format is costing you.`, accent: C.green };
    }

    if (strong === evaluated.length)
      return { text: "Every arc segment filled near the top. Strong across the board.", accent: C.green };
    if (weak > evaluated.length / 2)
      return { text: `More than half the arc is in the shallow tier — ${weak} answers below 60. Open the question review.`, accent: C.red };
    return { text: `${strong} full arc${strong === 1 ? "" : "s"}, ${weak} shallow. The shape of your session is right there in the ring.`, accent: C.blue500 };
  }, [evaluated, mcqAcc, openAvg]);

  // Hovered segment
  const hovSeg = hoveredIdx !== null ? segments[hoveredIdx] : null;

  const handleMouseMove = useCallback((e, idx) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredIdx(idx);
    setTooltipXY({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const SVG_SIZE = 260;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 28, flexWrap: "wrap" }}>

        {/* ── Arc SVG ── */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg
            ref={svgRef}
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            style={{ overflow: "visible", display: "block" }}
          >
            {/* Outer glow ring */}
            <circle cx={CX} cy={CY} r={R_TRACK + 14} fill="none"
              stroke={scoreColor(overallAvg)} strokeWidth="1.5" opacity="0.12" />

            {/* Segments */}
            {segments.map((seg, i) => {
              const startDeg = ARC_START + i * (segDeg + SEG_GAP_DEG);
              const endDeg   = startDeg + segDeg;
              const isHov    = hoveredIdx === i;
              const col      = seg.skipped ? C.borderMd : (seg.hasScore ? scoreColor(seg.score) : C.borderMd);
              const rFill    = seg.skipped ? R_INNER + 2 : (seg.hasScore ? fillRadius(seg.score) : R_INNER + 4);

              // Track (background) path
              const trackPath = donutSegmentPath(CX, CY, R_INNER, R_TRACK, startDeg, endDeg);
              // Fill path (score-depth)
              const fillPath  = rFill > R_INNER + 2
                ? donutSegmentPath(CX, CY, R_INNER, rFill, startDeg, endDeg)
                : null;

              return (
                <g
                  key={i}
                  onMouseMove={(e) => handleMouseMove(e, i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: "default" }}
                >
                  {/* Track */}
                  <path
                    d={trackPath}
                    fill={isHov ? `${col}18` : `${col}09`}
                    stroke={isHov ? `${col}50` : "transparent"}
                    strokeWidth="0.5"
                    style={{ transition: "fill 0.15s ease" }}
                  />

                  {/* Fill */}
                  {fillPath && (
                    <path
                      d={fillPath}
                      fill={col}
                      opacity={isHov ? 0.95 : (seg.skipped ? 0.2 : 0.75)}
                      style={{
                        transition: "opacity 0.15s ease",
                        filter: isHov ? `drop-shadow(0 0 6px ${col}80)` : "none",
                      }}
                    />
                  )}

                  {/* Skipped dashed outline */}
                  {seg.skipped && (
                    <path
                      d={trackPath}
                      fill="none"
                      stroke={C.borderMd}
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      opacity="0.6"
                    />
                  )}

                  {/* MCQ correct tick — tiny dot at outer edge */}
                  {seg.isObjective && seg.correct === true && !seg.skipped && (() => {
                    const midAngle = startDeg + segDeg / 2;
                    const pt = polarToXY(CX, CY, R_TRACK + 5, midAngle);
                    return (
                      <circle cx={pt.x} cy={pt.y} r="2.5"
                        fill={C.green} opacity="0.9" />
                    );
                  })()}
                  {seg.isObjective && seg.correct === false && !seg.skipped && (() => {
                    const midAngle = startDeg + segDeg / 2;
                    const pt = polarToXY(CX, CY, R_TRACK + 5, midAngle);
                    return (
                      <circle cx={pt.x} cy={pt.y} r="2.5"
                        fill={C.red} opacity="0.8" />
                    );
                  })()}
                </g>
              );
            })}

            {/* Center content */}
            {/* Overall score */}
            <text x={CX} y={CY - 14}
              textAnchor="middle" dominantBaseline="middle"
              style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, fill: "#fff", letterSpacing: "-1.5px" }}>
              {overallAvg}
            </text>
            <text x={CX} y={CY + 10}
              textAnchor="middle"
              style={{ fontFamily: F.mono, fontSize: 9, fill: "rgba(255,255,255,0.35)" }}>
              session avg
            </text>

            {/* MCQ / open-ended split */}
            {(mcqAcc !== null || openAvg !== null) && (
              <g>
                <line x1={CX - 22} x2={CX + 22} y1={CY + 24} y2={CY + 24}
                  stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                {mcqAcc !== null && openAvg !== null ? (
                  <>
                    <text x={CX - 12} y={CY + 37}
                      textAnchor="middle"
                      style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, fill: scoreColor(mcqAcc) }}>
                      {mcqAcc}%
                    </text>
                    <text x={CX - 12} y={CY + 47}
                      textAnchor="middle"
                      style={{ fontFamily: F.mono, fontSize: 7, fill: "rgba(255,255,255,0.3)" }}>
                      mcq
                    </text>
                    <line x1={CX} x2={CX} y1={CY + 30} y2={CY + 50}
                      stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <text x={CX + 12} y={CY + 37}
                      textAnchor="middle"
                      style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, fill: scoreColor(openAvg) }}>
                      {openAvg}
                    </text>
                    <text x={CX + 12} y={CY + 47}
                      textAnchor="middle"
                      style={{ fontFamily: F.mono, fontSize: 7, fill: "rgba(255,255,255,0.3)" }}>
                      open
                    </text>
                  </>
                ) : mcqAcc !== null ? (
                  <>
                    <text x={CX} y={CY + 37}
                      textAnchor="middle"
                      style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, fill: scoreColor(mcqAcc) }}>
                      {mcqAcc}%
                    </text>
                    <text x={CX} y={CY + 47}
                      textAnchor="middle"
                      style={{ fontFamily: F.mono, fontSize: 7, fill: "rgba(255,255,255,0.3)" }}>
                      mcq accuracy
                    </text>
                  </>
                ) : (
                  <>
                    <text x={CX} y={CY + 37}
                      textAnchor="middle"
                      style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, fill: scoreColor(openAvg) }}>
                      {openAvg}/100
                    </text>
                    <text x={CX} y={CY + 47}
                      textAnchor="middle"
                      style={{ fontFamily: F.mono, fontSize: 7, fill: "rgba(255,255,255,0.3)" }}>
                      open-ended
                    </text>
                  </>
                )}
              </g>
            )}
          </svg>

          {/* SVG tooltip — absolutely positioned relative to the svg container */}
          {hovSeg && (
            <div style={{
              position: "absolute",
              top: tooltipXY.y + 12,
              left: Math.min(tooltipXY.x - 70, SVG_SIZE - 155),
              zIndex: 20,
              background: C.card,
              border: `1px solid ${C.borderMd}`,
              borderRadius: 11,
              padding: "10px 13px",
              boxShadow: "0 6px 22px rgba(0,0,0,0.2)",
              pointerEvents: "none",
              minWidth: 148,
              animation: "scaleIn 0.14s cubic-bezier(.16,1,.3,1)",
            }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginBottom: 6 }}>
                Q{hovSeg.index + 1} · {hovSeg.isObjective ? "mcq" : "open"} · {hovSeg.topic}
              </div>
              {hovSeg.skipped ? (
                <div style={{ fontSize: 11, color: C.muted }}>Skipped</div>
              ) : hovSeg.isObjective ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, color: hovSeg.correct ? C.green : C.red, fontWeight: 900 }}>
                    {hovSeg.correct === true ? "✓" : hovSeg.correct === false ? "✕" : "?"}
                  </span>
                  <span style={{ fontSize: 11, color: C.sub }}>
                    {hovSeg.correct === true ? "Correct" : hovSeg.correct === false ? "Incorrect" : "No result"}
                  </span>
                </div>
              ) : hovSeg.hasScore ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: scoreColor(hovSeg.score), lineHeight: 1 }}>
                    {hovSeg.score}
                  </span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>/ 100</span>
                  {hovSeg.timeTaken > 0 && (
                    <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginLeft: 4 }}>
                      · {formatTime(hovSeg.timeTaken)}
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: C.muted }}>Not evaluated</div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: legend + breakdown ── */}
        <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>

          {/* Type breakdown */}
          {(mcqSegs.length > 0 || openSegs.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mcqSegs.length > 0 && (
                <TypeRow
                  label="Objective"
                  sub={`${mcqSegs.length} MCQ / aptitude`}
                  value={mcqAcc}
                  unit="% correct"
                  color={scoreColor(mcqAcc ?? 0)}
                  tint={scoreTint(mcqAcc ?? 0)}
                  icon="◉"
                />
              )}
              {openSegs.length > 0 && (
                <TypeRow
                  label="Open-ended"
                  sub={`${openSegs.length} question${openSegs.length > 1 ? "s" : ""}`}
                  value={openAvg}
                  unit="/ 100"
                  color={scoreColor(openAvg ?? 0)}
                  tint={scoreTint(openAvg ?? 0)}
                  icon="◎"
                />
              )}
            </div>
          )}

          {/* Score tier legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginBottom: 2 }}>
              arc fill depth = score
            </div>
            {[
              { label: "80–100 · strong",    color: C.green,  count: evaluated.filter(s => s.score >= 80).length },
              { label: "60–79 · solid",      color: C.blue500,count: evaluated.filter(s => s.score >= 60 && s.score < 80).length },
              { label: "40–59 · shaky",      color: C.amber,  count: evaluated.filter(s => s.score >= 40 && s.score < 60).length },
              { label: "0–39 · gap",         color: C.red,    count: evaluated.filter(s => s.score < 40).length },
            ].map(tier => (
              <div key={tier.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                {/* Mini donut swatch */}
                <svg width={20} height={20} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
                  <circle cx={10} cy={10} r={8} fill="none" stroke={`${tier.color}18`} strokeWidth="5" />
                  <circle cx={10} cy={10} r={8} fill="none" stroke={tier.color} strokeWidth="5"
                    strokeDasharray={`${(tier.count / Math.max(n, 1)) * 50.27} 50.27`}
                    strokeLinecap="round"
                    transform="rotate(-90 10 10)"
                    opacity="0.75"
                  />
                </svg>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: tier.count > 0 ? C.sub : C.faint, flex: 1 }}>
                  {tier.label}
                </span>
                <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: tier.count > 0 ? tier.color : C.faint }}>
                  {tier.count}
                </span>
              </div>
            ))}
          </div>

          {/* MCQ indicator note */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 9, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red }} />
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>
              dots outside arc = MCQ correct / incorrect
            </span>
          </div>
        </div>
      </div>

      {/* Insight strip */}
      <div style={{
        marginTop: 20,
        padding: "12px 16px",
        borderRadius: 11,
        background: `${insight.accent}10`,
        border: `1px solid ${insight.accent}25`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <div style={{ width: 5, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: insight.accent, opacity: 0.6, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.sub }}>{insight.text}</p>
      </div>
    </div>
  );
};

// ─── TypeRow sub-component ───────────────────────────────────────────────────
const TypeRow = ({ label, sub, value, unit, color, tint, icon }) => (
  <div style={{ padding: "11px 14px", borderRadius: 12, background: tint, border: `1px solid ${color}28` }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 12, color }}>{icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{label}</div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{sub}</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color }}>{value ?? "—"}</span>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{unit}</span>
      </div>
    </div>
    <div style={{ height: 5, borderRadius: 999, background: `${color}18`, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${clamp(value ?? 0)}%`,
        background: color,
        borderRadius: 999,
        transition: "width 1s cubic-bezier(.16,1,.3,1)",
        opacity: 0.75,
      }} />
    </div>
  </div>
);

const MiniSparkline = ({ points, color, width = 80, height = 28 }) => {
  if (!points || points.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center" }}>
        <div style={{ height: 1, width: "100%", background: `${color}30`, borderRadius: 1 }} />
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 10); // prevent flat line at max
  const pad = 3;

  const xp = (i) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const yp = (v) => height - pad - ((v - min) / range) * (height - pad * 2);

  const linePath = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xp(i).toFixed(1)} ${yp(v).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${xp(points.length - 1)} ${height - pad} L ${xp(0)} ${height - pad} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath}
        fill={`url(#spark-grad-${color.replace(/[^a-z0-9]/gi, "")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle
        cx={xp(points.length - 1)}
        cy={yp(points[points.length - 1])}
        r="2.5" fill={color} stroke="none" />
    </svg>
  );
};

// ─── Mini radial ring ────────────────────────────────────────────────────────
// Used in the "Answered" and "Strong" tiles.
const MiniRing = ({ value, max, color, size = 44 }) => {
  const pct = max > 0 ? clamp((value / max) * 100) : 0;
  const R = 16;
  const circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;

  return (
    <svg width={size} height={size} viewBox="0 0 44 44"
      style={{ display: "block", flexShrink: 0 }}>
      <circle cx={22} cy={22} r={R} fill="none"
        stroke={`${color}18`} strokeWidth="5" />
      <circle cx={22} cy={22} r={R} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        strokeOpacity="0.78"
        transform="rotate(-90 22 22)"
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.16,1,.3,1)" }}
      />
      <text x={22} y={22} textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: F.display, fontSize: 11, fontWeight: 900, fill: color }}>
        {value}
      </text>
    </svg>
  );
};

// ─── Mini pace bar ───────────────────────────────────────────────────────────
// Used in the "Avg time" tile — shows a horizontal bar where position
// represents pace relative to the 60s–240s "good range" window.
const MiniPaceBar = ({ seconds, width = 80, height = 14 }) => {
  const MIN_S = 30, MAX_S = 300;
  const clampedS = Math.max(MIN_S, Math.min(MAX_S, seconds || 0));
  const pct = ((clampedS - MIN_S) / (MAX_S - MIN_S)) * 100;

  // "good zone" = 60–180s → maps to 14%–51% of bar
  const goodL = ((60 - MIN_S) / (MAX_S - MIN_S)) * 100;
  const goodR = ((180 - MIN_S) / (MAX_S - MIN_S)) * 100;

  const paceColor = seconds < 60 ? C.blue500
    : seconds <= 180 ? C.green
    : seconds <= 240 ? C.amber
    : C.red;

  return (
    <div style={{ width, position: "relative", height }}>
      {/* Track */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: 999, background: C.border,
      }} />
      {/* Good zone highlight */}
      <div style={{
        position: "absolute",
        left: `${goodL}%`, width: `${goodR - goodL}%`,
        top: 0, bottom: 0,
        background: `${C.green}20`,
        borderRadius: 4,
      }} />
      {/* Cursor */}
      <div style={{
        position: "absolute",
        left: `${pct}%`,
        top: -2, bottom: -2, width: 3,
        background: paceColor,
        borderRadius: 999,
        transform: "translateX(-50%)",
        boxShadow: `0 0 6px ${paceColor}80`,
        transition: "left 0.8s cubic-bezier(.16,1,.3,1)",
      }} />
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// 1. STAT RAIL V2
// ═══════════════════════════════════════════════════════════════════════════

export const StatRailV2 = ({ result, scoreHistory }) => {
  const {
    totalQuestions = 0,
    answeredQuestions = 0,
    skippedQuestions = 0,
    strongAnswers = 0,
    weakAnswers = 0,
    averageTime = 0,
    score = 0,
  } = result;

  // Build sparkline from scoreHistory + current score
  const sparkPoints = useMemo(() => {
    const hist = Array.isArray(scoreHistory) ? scoreHistory : [];
    const nums = hist.map(h => clamp(typeof h === "number" ? h : Number(h?.score ?? h?.totalScore ?? 0)));
    const curr = clamp(score);
    if (!nums.length) return [curr];
    const last = nums[nums.length - 1];
    if (last === curr) return nums;
    return [...nums, curr];
  }, [scoreHistory, score]);

  const trendDelta = sparkPoints.length >= 2
    ? sparkPoints[sparkPoints.length - 1] - sparkPoints[sparkPoints.length - 2]
    : null;

  const paceColor = averageTime < 60 ? C.blue500
    : averageTime <= 180 ? C.green
    : averageTime <= 240 ? C.amber
    : C.red;

  const paceRead = averageTime < 60 ? "Fast"
    : averageTime <= 180 ? "Good pace"
    : averageTime <= 240 ? "Steady"
    : "Slow";

  return (
    <section style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      marginBottom: 20,
      borderRadius: 18,
      background: C.card,
      border: `1px solid ${C.border}`,
      boxShadow: C.shadow,
      overflow: "hidden",
    }} className="res-stat-rail">

      {/* ── Tile 1: Completion ring ── */}
      <StatTile borderRight>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MiniRing value={answeredQuestions} max={totalQuestions} color={C.blue500} />
          <div>
            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1 }}>
              {answeredQuestions}
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, fontWeight: 400 }}>/{totalQuestions}</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>answered</div>
            {skippedQuestions > 0 && (
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.amber, marginTop: 4, background: C.amberTint, borderRadius: 999, padding: "2px 7px", display: "inline-block" }}>
                {skippedQuestions} skipped
              </div>
            )}
          </div>
        </div>
      </StatTile>

      {/* ── Tile 2: Strong answers ring ── */}
      <StatTile borderRight>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MiniRing value={strongAnswers} max={answeredQuestions || 1} color={C.green} />
          <div>
            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.green, lineHeight: 1 }}>
              {strongAnswers}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>scored 80+</div>
            {weakAnswers > 0 && (
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.red, marginTop: 4, background: C.redTint, borderRadius: 999, padding: "2px 7px", display: "inline-block" }}>
                {weakAnswers} below 60
              </div>
            )}
          </div>
        </div>
      </StatTile>

      {/* ── Tile 3: Pace bar ── */}
      <StatTile borderRight>
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: paceColor, lineHeight: 1, marginBottom: 4 }}>
          {averageTime > 0 ? formatTime(averageTime) : "—"}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>avg / question</div>
        {averageTime > 0 && (
          <>
            <MiniPaceBar seconds={averageTime} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8, color: C.faint }}>fast</span>
              <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: paceColor }}>{paceRead}</span>
              <span style={{ fontFamily: F.mono, fontSize: 8, color: C.faint }}>slow</span>
            </div>
          </>
        )}
      </StatTile>

      {/* ── Tile 4: Score sparkline ── */}
      <StatTile>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>
              {clamp(score)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>this session</div>
          </div>
          {trendDelta !== null && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 999,
              background: trendDelta >= 0 ? C.greenTint : C.redTint,
              border: `1px solid ${trendDelta >= 0 ? C.green : C.red}30`,
            }}>
              <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, color: trendDelta >= 0 ? C.green : C.red }}>
                {trendDelta >= 0 ? "+" : ""}{trendDelta.toFixed(0)}
              </span>
            </div>
          )}
        </div>
        <MiniSparkline
          points={sparkPoints}
          color={scoreColor(score)}
          width={100}
          height={30}
        />
        {sparkPoints.length >= 2 && (
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.faint, marginTop: 5 }}>
            last {sparkPoints.length} sessions
          </div>
        )}
      </StatTile>

    </section>
  );
};

// ─── Tile wrapper ────────────────────────────────────────────────────────────
const StatTile = ({ children, borderRight }) => (
  <div style={{
    padding: "20px 22px",
    borderRight: borderRight ? `1px solid ${C.border}` : "none",
    transition: "background 0.18s ease",
  }} className="res-rail-cell">
    {children}
  </div>
);


// ═══════════════════════════════════════════════════════════════════════════
// 2. BADGE SESSION BRIDGE
//
// Replaces StreakBadgesCard entirely.
// "What you just earned this session" — compact, glowing, links to Dashboard.
//
// Props:
//   streak     — {current: number} (same as before)
//   newBadges  — string[] | {label: string}[] (same as before)
//   navigate   — from useNavigate()
// ═══════════════════════════════════════════════════════════════════════════

export const BadgeSessionBridge = ({ streak, newBadges, navigate }) => {
  const [dismissed, setDismissed] = useState(false);

  const badges = useMemo(() => {
    if (!Array.isArray(newBadges) || !newBadges.length) return [];
    return newBadges.map(b => (typeof b === "string" ? b : b?.label || "New badge"));
  }, [newBadges]);

  const hasStreak = streak?.current > 0;
  const hasBadges = badges.length > 0;

  if ((!hasStreak && !hasBadges) || dismissed) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      padding: "16px 22px",
      marginBottom: 18,
      borderRadius: 16,
      background: C.card,
      border: `1px solid ${C.border}`,
      boxShadow: C.shadow,
      flexWrap: "wrap",
    }}>

      {/* Streak */}
      {hasStreak && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderRadius: 12,
          background: C.violetTint,
          border: `1px solid ${C.violet}35`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>◆</span>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: C.text, lineHeight: 1 }}>
              {streak.current} day streak
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 2 }}>
              consistency compounds
            </div>
          </div>
        </div>
      )}

      {/* New badges earned this session */}
      {hasBadges && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" }}>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, whiteSpace: "nowrap" }}>
            earned this session
          </span>
          {badges.map((label, i) => (
            <BadgeChip key={`${label}-${i}`} label={label} />
          ))}
        </div>
      )}

      {/* Spacer + CTA */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${C.violet}45`,
            background: C.violetTint,
            color: C.violet,
            fontFamily: F.body,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "transform 0.14s ease, box-shadow 0.14s ease",
          }}
          className="res-btn-badge-cta"
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = `0 4px 14px ${C.violet}25`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          View all badges →
        </button>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            width: 28, height: 28,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.faint,
            fontSize: 13,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// ─── Badge chip with glow pulse ──────────────────────────────────────────────
const BadgeChip = ({ label }) => (
  <span style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 11px",
    borderRadius: 999,
    background: C.violetTint,
    border: `1px solid ${C.violet}45`,
    color: C.violet,
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
    letterSpacing: "0.3px",
    animation: "badgeGlow 2.2s ease-in-out infinite",
  }}>
    <span style={{ fontSize: 10 }}>★</span>
    {label}
  </span>
);


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL CSS ADDITIONS (add to GlobalStyles in Result.jsx)
// ═══════════════════════════════════════════════════════════════════════════
//
// @keyframes badgeGlow {
//   0%, 100% { box-shadow: 0 0 0 rgba(139,92,246,0); }
//   50%       { box-shadow: 0 0 10px rgba(139,92,246,0.35); }
// }
//
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ORIGINAL Result.jsx COMPONENTS (unchanged)
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

// ─── ScoreArc (grade badge removed — GradeBadgeDrop handles it now) ─────────
const ScoreArc = ({ score }) => {
  const [displayed, setDisplayed] = useState(0);
  const [arcProgress, setArcProgress] = useState(0);
  const grade = getGrade(score);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 1100;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * score));
      setArcProgress(eased * score);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const delay = setTimeout(() => { frame = requestAnimationFrame(tick); }, 180);
    return () => { clearTimeout(delay); cancelAnimationFrame(frame); };
  }, [score]);

  const R = 88, CX = 110, CY = 114;
  const startAngle = 150;
  const sweep = 240;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const arcPath = (pct) => {
    const minPct = Math.max(pct, 4);
    const angle = startAngle + (sweep * minPct) / 100;
    const sx = CX + R * Math.cos(toRad(startAngle));
    const sy = CY + R * Math.sin(toRad(startAngle));
    const ex = CX + R * Math.cos(toRad(angle));
    const ey = CY + R * Math.sin(toRad(angle));
    const large = (sweep * minPct) / 100 > 180 ? 1 : 0;
    if (pct >= 99.9) {
      const mx = CX + R * Math.cos(toRad(startAngle + sweep / 2));
      const my = CY + R * Math.sin(toRad(startAngle + sweep / 2));
      return `M ${sx} ${sy} A ${R} ${R} 0 0 1 ${mx} ${my} A ${R} ${R} 0 0 1 ${ex} ${ey}`;
    }
    return `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`;
  };

  const trackPath = arcPath(100);
  const fillPath  = arcPath(arcProgress);

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={220} height={210} viewBox="0 0 220 210" style={{ overflow: "visible" }}>
        <circle cx={CX} cy={CY} r={R + 16} fill="none" stroke={grade.accent} strokeWidth="1.5" opacity="0.14" />
        <circle cx={CX} cy={CY} r={R + 28} fill="none" stroke={grade.accent} strokeWidth="1"   opacity="0.06" />
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke={grade.accent} strokeWidth="11" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 10px ${grade.glow}88)` }} />
        )}
        {[0, 25, 50, 75, 100].map(pct => {
          const angle = toRad(startAngle + (sweep * pct) / 100);
          const inner = R - 7, outer = R + 7;
          return (
            <line key={pct}
              x1={CX + inner * Math.cos(angle)} y1={CY + inner * Math.sin(angle)}
              x2={CX + outer * Math.cos(angle)} y2={CY + outer * Math.sin(angle)}
              stroke="rgba(255,255,255,0.2)" strokeWidth={pct === 0 || pct === 100 ? "2.5" : "1.5"} />
          );
        })}
        <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: F.display, fontSize: 52, fontWeight: 900, fill: "#fff", letterSpacing: "-2px" }}>
          {displayed}
        </text>
        <text x={CX} y={CY + 24} textAnchor="middle"
          style={{ fontFamily: F.mono, fontSize: 10.5, fill: "rgba(255,255,255,0.38)", letterSpacing: "0.5px" }}>
          / 100
        </text>
        {/* Grade badge removed — rendered by GradeBadgeDrop outside SVG */}
      </svg>
    </div>
  );
};

const CaptionBlock = ({ captions, accentColor }) => {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % captions.length); setVisible(true); }, 300);
    }, 3400);
    return () => clearInterval(interval);
  }, [captions.length]);
  const item = captions[idx];
  return (
    <div style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16, padding: "18px 20px", minHeight: 108, transition: "opacity 0.3s ease, transform 0.3s ease", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(6px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${accentColor}22`, border: `1px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{item.icon}</div>
        <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: "0.8px", textTransform: "uppercase" }}>{item.tag}</span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {captions.map((_, i) => (
            <div key={i} style={{ width: i === idx ? 16 : 5, height: 5, borderRadius: 999, background: i === idx ? accentColor : "rgba(255,255,255,0.25)", transition: "all 0.3s ease" }} />
          ))}
        </div>
      </div>
      <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.4, marginBottom: 5 }}>{item.headline}</div>
      <div style={{ fontFamily: F.body, fontSize: 11.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.55 }}>{item.body}</div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// RESULT HERO — Phase 6 sequential reveal + grade flash wired in
// ═══════════════════════════════════════════════════════════════════════════
const ResultHero = ({ result, navigate, onCopy, copied, onDownloadImage, downloading }) => {
  const score = result.score;
  const v = getVerdict(score);
  const trendDelta = result.trendDelta;
  const hasTrend = trendDelta != null && result.scoreHistory?.length >= 2;
  const grade = getGrade(score);

  // Phase 6 — sequential reveal
  const reveal = useSequentialReveal();

  const captions = [
    { icon: "📊", tag: "Session insight", headline: score >= 80 ? "Strong fundamentals across the board." : score >= 60 ? "Foundation is there — edges need work." : "Clear gaps identified. Use them as a roadmap.", body: score >= 80 ? "Your answers show consistency and depth. Now isolate weak spots." : score >= 60 ? "You're in range. A few targeted reps will push you to the next tier." : "Every weak answer is a specific, fixable thing. Start there." },
    { icon: "🎯", tag: "Next move", headline: result.weakAnswers > 0 ? `${result.weakAnswers} answer${result.weakAnswers > 1 ? "s" : ""} below 60 — drill those topics.` : "All answers cleared 60. Raise difficulty next.", body: result.weakAnswers > 0 ? "Open the question review below. The feedback on those answers is your training plan." : "You're past the basics. Add harder questions to keep the signal useful." },
    { icon: "⚡", tag: "Pace check", headline: `${formatTime(result.averageTime)} per question on average.`, body: result.averageTime < 90 ? "Quick responses — verify you're giving depth, not just speed." : result.averageTime > 180 ? "Taking your time. Check if slower answers scored proportionally higher." : "Pace is in a healthy range. Focus on quality over speed." },
    { icon: "📈", tag: "Trend", headline: hasTrend ? `${trendDelta >= 0 ? "+" : ""}${Number(trendDelta).toFixed(1)} pts vs last session.` : `${result.answeredQuestions}/${result.totalQuestions} questions answered.`, body: hasTrend && trendDelta >= 0 ? "You're moving in the right direction. Keep the streak." : hasTrend ? "Score dipped — check if it was topic mix or answer depth." : result.strongAnswers > 0 ? `${result.strongAnswers} strong answer${result.strongAnswers > 1 ? "s" : ""} scored 80+.` : "First rep is always a diagnostic. Use it well." },
  ];

  return (
    <section style={S.hero} className="res-hero">
      {/* Phase 6 — grade color flash on mount */}
      <GradeFlashOverlay score={score} />

      <div style={S.heroScan} />
      <div style={{ ...S.heroScan, width: "10%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.045), transparent)", animation: "mmHeroScan 13s linear infinite", animationDelay: "3.2s" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      <div style={{ position: "absolute", right: -60, bottom: -80, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${grade.glow}20 0%, transparent 68%)`, pointerEvents: "none" }} />

      <div style={S.heroGrid} className="res-hero-grid">

        {/* LEFT: Arc + grade badge drop + trend */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {/* Phase 6 — arc fades up first */}
          <div style={revealStyle.fadeUp(reveal.arc)}>
            <ScoreArc score={score} />
          </div>
          {/* Phase 6 — grade badge drops in after arc */}
          <GradeBadgeDrop score={score} visible={reveal.grade} />
          {hasTrend && (
            <div style={{ ...S.trendChip, ...revealStyle.fade(reveal.grade, 80) }}>
              <span style={{ color: trendDelta >= 0 ? C.green : C.amber, fontWeight: 800 }}>{trendDelta >= 0 ? "▲" : "▼"}</span>
              <span style={{ color: "rgba(255,255,255,0.62)", fontSize: 10.5 }}>{Math.abs(Number(trendDelta)).toFixed(1)} pts vs last session</span>
            </div>
          )}
        </div>

        {/* RIGHT: Verdict + stats + caption + actions */}
        <div>
          {/* Kicker + headline reveal with arc */}
          <div style={revealStyle.fadeUp(reveal.arc, 60)}>
            <div style={S.heroKicker}>Post-interview debrief</div>
            <h1 style={S.heroH1} className="res-hero-h1">{v.headline}</h1>
            <p style={S.heroSub} className="res-hero-sub">{v.body}</p>
          </div>

          {/* Phase 6 — mini-stats slide up L→R with stagger */}
          <div style={{ ...S.miniStats, ...revealStyle.fade(reveal.stats) }}>
            <MiniStatItem value={result.strongAnswers} label="strong" color={C.green} index={0} visible={reveal.stats} />
            <div style={S.miniDivider} />
            <MiniStatItem value={result.weakAnswers} label="to fix" color={result.weakAnswers > 0 ? C.amber : "rgba(255,255,255,0.45)"} index={1} visible={reveal.stats} />
            <div style={S.miniDivider} />
            <MiniStatItem value={formatTime(result.averageTime)} label="avg / q" color={C.cyan400} index={2} visible={reveal.stats} />
            <div style={S.miniDivider} />
            <MiniStatItem value={`${result.answeredQuestions}/${result.totalQuestions}`} label="answered" color="rgba(255,255,255,0.7)" index={3} visible={reveal.stats} />
          </div>

          {/* Caption block fades in last */}
          <div style={{ marginTop: 16, maxWidth: 380, ...revealStyle.fade(reveal.caption) }}>
            <CaptionBlock captions={captions} accentColor={grade.accent} />
          </div>

          {/* Actions fade in after caption */}
          <div style={{ ...S.heroActions, ...revealStyle.fade(reveal.actions) }} className="res-hero-actions">
            <button style={S.btnPrimary} className="res-btn-primary" onClick={() => navigate("/interview")}>Start another interview</button>
            <button style={S.btnGhost}   className="res-btn-ghost"   onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button style={S.btnGhost}   className="res-btn-ghost"   onClick={onCopy}>{copied ? "Copied ✓" : "Copy summary"}</button>
            <button style={S.btnGhost}   className="res-btn-ghost"   onClick={onDownloadImage} disabled={downloading}>{downloading ? "Preparing…" : "Download image"}</button>
          </div>
        </div>
      </div>
    </section>
  );
};


// ─── ShareCard (unchanged) ───────────────────────────────────────────────────
const ShareCard = ({ result, cardRef }) => {
  const { score, totalQuestions, answeredQuestions, strongAnswers, weakAnswers, topTopic, weakestTopicName } = result;
  const v = getVerdict(score);
  const grade = getGrade(score);
  return (
    <div ref={cardRef} style={{ position: "fixed", top: -9999, left: -9999, width: 520, fontFamily: F.body, borderRadius: 24, overflow: "hidden", background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 44%, ${C.blue600} 72%, ${C.cyan600} 100%)` }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${grade.accent}, ${grade.glow})` }} />
      <div style={{ padding: "32px 36px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", color: "rgba(255,255,255,0.38)", textTransform: "uppercase" }}>MockMate · Session Result</div>
          <div style={{ fontFamily: F.mono, fontSize: 9, padding: "4px 10px", borderRadius: 6, background: `${grade.accent}20`, color: grade.accent, border: `1px solid ${grade.accent}40`, fontWeight: 700 }}>{grade.grade} · {grade.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
          <span style={{ fontFamily: F.display, fontSize: 88, fontWeight: 900, color: "#fff", letterSpacing: "-4px", lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.32)" }}>/100</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.5, marginBottom: 8, maxWidth: 400 }}>{v.headline}</div>
        {weakestTopicName && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 4 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>working on</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.amber }}>{weakestTopicName}</span>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(0,0,0,0.18)" }}>
        {[{ label: "answered", value: `${answeredQuestions}/${totalQuestions}` }, { label: "strong", value: strongAnswers }, { label: "to fix", value: weakAnswers }, { label: "top topic", value: topTopic || "—" }].map((s, i) => (
          <div key={i} style={{ padding: "14px 12px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.38)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 36px", background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: grade.accent, letterSpacing: "0.5px" }}>mockmate.app</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>AI interview coaching</div>
      </div>
    </div>
  );
};

// ─── NextStepBanner (unchanged) ──────────────────────────────────────────────
const NextStepBanner = ({ nextStepText, weakestTopic, navigate, score = 0 }) => {
  const grade = getGrade(score);
  return (
    <section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "26px 30px", marginBottom: 18, borderRadius: 20, background: `linear-gradient(135deg, ${grade.tint} 0%, ${C.blue50} 100%)`, border: `1px solid ${grade.accent}30`, boxShadow: C.shadow }} className="res-banner">
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", color: grade.accent, marginBottom: 7 }}>what to do next</div>
        <h2 style={{ margin: "0 0 8px", fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>
          {weakestTopic ? <>Drill <span style={{ color: grade.accent }}>{weakestTopic.topic}</span> next</> : "Queue another rep"}
        </h2>
        <p style={{ margin: 0, fontSize: 12.5, color: C.sub, maxWidth: 520, lineHeight: 1.6 }}>{nextStepText}</p>
      </div>
      <button onClick={() => navigate("/interview")} style={{ border: "none", borderRadius: 11, flexShrink: 0, background: `linear-gradient(135deg, ${grade.glow}, ${grade.accent})`, color: "#fff", padding: "12px 22px", fontSize: 13, fontWeight: 800, fontFamily: F.body, cursor: "pointer", boxShadow: `0 4px 18px ${grade.accent}55`, textShadow: "0 1px 2px rgba(0,0,0,0.18)" }} className="res-btn-gradient">
        Start another interview →
      </button>
    </section>
  );
};


// ─── ScoreProgressionHeader (unchanged) ─────────────────────────────────────
const ScoreProgressionHeader = ({ questions }) => {
  const pts = questions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number").map(q => ({ score: q.aiFeedback.score, index: q.index, topic: q.topic }));
  if (pts.length < 2) return null;
  const drift = pts[pts.length - 1].score - pts[0].score;
  const avg = Math.round(pts.reduce((s, p) => s + p.score, 0) / pts.length);
  const peak = Math.max(...pts.map(p => p.score));
  const floor = Math.min(...pts.map(p => p.score));
  let biggestJump = 0, jumpFrom = null, jumpTo = null;
  for (let i = 1; i < pts.length; i++) {
    const delta = pts[i].score - pts[i - 1].score;
    if (delta > biggestJump) { biggestJump = delta; jumpFrom = pts[i - 1]; jumpTo = pts[i]; }
  }
  const driftPositive = drift >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, background: driftPositive ? C.greenTint : C.redTint, border: `1px solid ${driftPositive ? C.green : C.red}30` }}>
        <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: driftPositive ? C.green : C.red, lineHeight: 1 }}>{driftPositive ? "+" : ""}{drift} pts</span>
        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.sub }}>session drift</span>
      </div>
      {[{ label: "avg", value: avg, color: C.blue500 }, { label: "peak", value: peak, color: C.green }, { label: "floor", value: floor, color: C.red }].map(c => (
        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 999, background: cardAlt, border: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: c.color }}>{c.value}</span>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{c.label}</span>
        </div>
      ))}
      {biggestJump >= 10 && jumpFrom && jumpTo && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 999, background: C.violetTint, border: `1px solid ${C.violet}40` }}>
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.violet, fontWeight: 700 }}>biggest jump Q{jumpFrom.index + 1}→Q{jumpTo.index + 1}: +{biggestJump} pts</span>
        </div>
      )}
    </div>
  );
};

// ─── ScoreProgression (unchanged) ───────────────────────────────────────────
const ScoreProgression = ({ questions }) => {
  const points = questions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number").map(q => q.aiFeedback.score);
  if (points.length < 2) {
    const single = points[0];
    return (
      <div style={{ padding: "22px 20px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
        {single != null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: F.display, fontSize: 34, fontWeight: 900, color: scoreColor(single), flexShrink: 0 }}>{single}</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.55 }}>Only one question was scored this session, so there's no curve to plot yet.</div>
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>No evaluated questions yet.</div>
        )}
      </div>
    );
  }
  const min = Math.min(...points), max = Math.max(...points);
  const avg = points.reduce((s, v) => s + v, 0) / points.length;
  const variance = points.reduce((s, v) => s + (v - avg) ** 2, 0) / points.length;
  const stdDev = Math.round(Math.sqrt(variance));
  const spread = max - min;
  const consistencyRead = spread <= 15 ? { label: "Steady", detail: "Score barely moved — even, predictable form.", color: C.green } : spread <= 35 ? { label: "Some swing", detail: "A moderate spread between your best and weakest answers.", color: C.blue500 } : { label: "High swing", detail: "A big gap between best and weakest — form varied a lot within this session.", color: C.amber };
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
          <defs><linearGradient id="resAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue500} stopOpacity="0.18" /><stop offset="100%" stopColor={C.blue500} stopOpacity="0" /></linearGradient></defs>
          {[40, 60, 80].map(l => (<g key={l}><line x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} stroke={C.border} strokeDasharray="4 5" /><text x={2} y={y(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text></g>))}
          {spread > 0 && <rect x={padX} y={bandTop} width={W - padX * 2} height={bandBottom - bandTop} fill={consistencyRead.color} opacity={0.07} />}
          <line x1={padX} x2={W - padX} y1={y(avg)} y2={y(avg)} stroke={C.muted} strokeWidth="1" strokeDasharray="2 4" opacity={0.55} />
          <path d={area} fill="url(#resAreaGrad)" />
          <path d={path} fill="none" stroke={C.blue500} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((v, i) => (<g key={i}><circle cx={x(i)} cy={y(v)} r="5" fill={scoreColor(v)} stroke="#fff" strokeWidth="2" /><text x={x(i)} y={H - 4} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>Q{i + 1}</text></g>))}
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "5px 11px", whiteSpace: "nowrap", color: consistencyRead.color, background: `${consistencyRead.color}14`, border: `1px solid ${consistencyRead.color}30` }}>{consistencyRead.label} · ±{stdDev} pts</span>
        <span style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>{consistencyRead.detail}</span>
      </div>
    </div>
  );
};

// ─── TopicBreakdown (unchanged) ──────────────────────────────────────────────
const RANK_GLYPHS = ["◆", "▲", "●", "■", "▼"];
const TopicBreakdown = ({ topicAverages, status, onTopicClick }) => {
  const sorted = [...topicAverages].sort((a, b) => b.avg - a.avg);
  const bestAvg = sorted[0]?.avg || 1;
  if (!sorted.length) {
    if (status === "no-eval") return <p style={S.cardSub}>No questions scored yet — topic breakdown appears once questions are evaluated.</p>;
    if (status === "no-topic-field") return <p style={S.cardSub}>Questions scored but none had a topic label — this needs the topic field from interview data.</p>;
    return <p style={S.cardSub}>Topic-level scoring not available for this session.</p>;
  }
  return (
    <div style={S.dimList}>
      {sorted.map((t, rank) => {
        const col = scoreColor(t.avg);
        const glyph = RANK_GLYPHS[Math.min(rank, RANK_GLYPHS.length - 1)];
        const relPct = (t.avg / bestAvg) * 100;
        return (
          <button key={t.topic} style={S.dimRow} className="res-dim-row" onClick={() => onTopicClick?.(t.topic)}>
            <div style={S.dimMeta}>
              <div style={S.dimLeft}>
                <span style={{ fontSize: 11, fontWeight: 700, color: col, flexShrink: 0, width: 14, textAlign: "center" }}>{glyph}</span>
                <span style={S.dimName}>{t.topic}</span>
              </div>
              <span style={{ ...S.dimScore, color: col }}>{t.avg}</span>
            </div>
            <div style={{ ...S.dimTrack, position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${relPct}%`, background: `${col}22`, borderRadius: 999 }} />
              <div style={{ position: "relative", height: "100%", width: `${t.avg}%`, background: col, borderRadius: 999, transition: "width 1.2s cubic-bezier(.16,1,.3,1)" }} />
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── PaceVsScoreLabeled (unchanged) ─────────────────────────────────────────
const PaceVsScoreLabeled = ({ questions }) => {
  const points = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && Number(q.timeTaken) > 0).map(q => ({ time: Number(q.timeTaken), score: clamp(q.aiFeedback.score), index: q.index, topic: q.topic }));
  if (points.length < 3) {
    return (
      <div style={{ padding: "20px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
        {points.length > 0 ? (
          <><div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>{points.map(p => (<div key={p.index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}><span style={{ fontSize: 11.5, fontWeight: 600, color: C.text }}>Q{p.index + 1} · {p.topic}</span><span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>{formatTime(p.time)}</span><span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: scoreColor(p.score) }}>{p.score}</span></span></div>))}</div><div style={{ fontSize: 11.5, color: C.sub }}>Need at least 3 timed, evaluated questions for the pace chart — {points.length} so far.</div></>
        ) : (<div style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>No timed, evaluated questions yet.</div>)}
      </div>
    );
  }
  const times = points.map(p => p.time);
  const sortedTimes = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sortedTimes.length / 2);
  const medianTime = sortedTimes.length % 2 ? sortedTimes[mid] : (sortedTimes[mid - 1] + sortedTimes[mid]) / 2;
  const scoreThreshold = 60;
  const fast = points.filter(p => p.time <= medianTime), slow = points.filter(p => p.time > medianTime);
  const avgOf = list => (list.length ? Math.round(list.reduce((s, p) => s + p.score, 0) / list.length) : null);
  const fastAvg = avgOf(fast), slowAvg = avgOf(slow);
  let read = null;
  if (fastAvg != null && slowAvg != null) {
    const gap = fastAvg - slowAvg;
    if (gap >= 12) read = { text: `Quicker answers scored ${gap} pts higher — extra time isn't converting here.`, color: C.blue500 };
    else if (gap <= -12) read = { text: `Slower, considered answers scored ${Math.abs(gap)} pts higher — depth pays off.`, color: C.green };
    else read = { text: "Score held steady regardless of pace — timing isn't the lever this session.", color: C.muted };
  }
  const W = 640, H = 220, padX = 34, padY = 24;
  const maxTime = Math.max(...times) * 1.08;
  const xp = t => padX + (Math.min(t, maxTime) / maxTime) * (W - padX * 2);
  const yp = s => H - padY - (clamp(s) / 100) * (H - padY * 2);
  const midX = xp(medianTime), midY = yp(scoreThreshold);
  const inQ = (lx, ly, hx, hy) => points.some(p => xp(p.time) >= lx && xp(p.time) < hx && yp(p.score) >= ly && yp(p.score) < hy);
  const qLabels = [
    { label: "fast + strong", desc: "ideal",        lx: padX,  ly: padY,  hx: midX, hy: midY, col: C.green,  tx: padX + 6,  ty: padY + 14 },
    { label: "slow + strong", desc: "depth works",  lx: midX,  ly: padY,  hx: W,    hy: midY, col: C.blue500,tx: midX + 8,  ty: padY + 14 },
    { label: "fast + weak",   desc: "rushing",      lx: padX,  ly: midY,  hx: midX, hy: H,    col: C.amber,  tx: padX + 6,  ty: midY + 14 },
    { label: "slow + weak",   desc: "rethink prep", lx: midX,  ly: midY,  hx: W,    hy: H,    col: C.red,    tx: midX + 8,  ty: midY + 14 },
  ].filter(q => inQ(q.lx, q.ly, q.hx, q.hy));
  return (
    <div>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380, display: "block" }}>
          {[40, 60, 80].map(l => (<g key={l}><line x1={padX} x2={W - padX} y1={yp(l)} y2={yp(l)} stroke={C.border} strokeDasharray="4 5" /><text x={2} y={yp(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text></g>))}
          <line x1={midX} x2={midX} y1={padY} y2={H - padY} stroke={C.borderMd} strokeDasharray="3 4" />
          <line x1={padX} x2={W - padX} y1={midY} y2={midY} stroke={C.borderMd} strokeDasharray="3 4" />
          {qLabels.map((q, i) => (<g key={i}><text x={q.tx} y={q.ty} fontSize="8.5" fontFamily={F.mono} fontWeight="700" fill={q.col} opacity="0.72">{q.label}</text><text x={q.tx} y={q.ty + 11} fontSize="7.5" fontFamily={F.mono} fill={q.col} opacity="0.42">{q.desc}</text></g>))}
          <text x={midX} y={H - 5} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>median pace · {formatTime(medianTime)}</text>
          {points.map((p, i) => (<circle key={i} cx={xp(p.time)} cy={yp(p.score)} r="6.5" fill={scoreColor(p.score)} fillOpacity="0.88" stroke="#fff" strokeWidth="1.5"><title>{`Q${p.index + 1} · ${p.topic} · ${formatTime(p.time)} · ${p.score}/100`}</title></circle>))}
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        {[{ label: `faster half · ${fast.length}q`, value: fastAvg, bg: C.blue50, border: C.blue500 }, { label: `slower half · ${slow.length}q`, value: slowAvg, bg: C.greenTint, border: C.green }].map((cell, i) => (
          <div key={i} style={{ padding: "12px 14px", borderRadius: 12, background: cell.bg, border: `1px solid ${cell.border}30` }}>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{cell.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text }}>{cell.value != null ? `${cell.value}/100` : "—"}</div>
          </div>
        ))}
      </div>
      {read && <div style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{read.text}</div>}
    </div>
  );
};

// ─── Insight + QuestionReview (with CrossSignalInsight wired in) ─────────────
const Insight = ({ label, value, text, color, background }) => (
  <div style={{ padding: 14, borderRadius: 12, background, border: `1px solid ${color}30` }}>
    <div style={S.insightLabel}>{label}</div>
    <div style={{ ...S.insightVal, color: C.text }}>{value}</div>
    <div style={S.insightText}>{text}</div>
  </div>
);

const FeedbackBlock = ({ label, value, color, background }) => (
  <div style={{ padding: 13, borderRadius: 12, background, border: `1px solid ${color}25` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color, letterSpacing: "0.5px", marginBottom: 6, textTransform: "lowercase" }}>{label}</div>
    <div style={{ fontSize: 11.5, lineHeight: 1.65, color: C.text }}>{value || "No additional readout."}</div>
  </div>
);

const Pill = ({ children, color = C.blue500, background = C.blue50 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 9px", background, color, fontFamily: F.mono, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.4px", border: `1px solid ${color}30` }}>{children}</span>
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
  const badgeColor = question.skipped ? C.muted : objective ? (feedback?.correct === true ? C.green : feedback?.correct === false ? C.red : C.muted) : (isEval ? scoreColor(score) : C.muted);
  const badgeBg = question.skipped ? cardAlt : objective ? (feedback?.correct === true ? C.greenTint : feedback?.correct === false ? C.redTint : cardAlt) : (isEval ? scoreTint(score) : cardAlt);
  return (
    <div style={{ border: `1px solid ${open ? C.borderMd : C.border}`, borderRadius: 14, background: open ? cardAlt : C.card, overflow: "hidden", transition: "border-color 0.2s ease, background 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <button type="button" onClick={() => onToggle(idx)} aria-expanded={open} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14, padding: "14px 8px 14px 16px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}>
          <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}25` }}>
            {question.skipped ? <span style={{ fontSize: 15, fontWeight: 700 }}>—</span> : objective ? <span style={{ fontSize: 19, fontWeight: 900 }}>{feedback?.correct === true ? "✓" : feedback?.correct === false ? "✕" : "?"}</span> : isEval ? <><span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{score}</span><span style={{ fontFamily: F.mono, fontSize: 7, opacity: 0.7, marginTop: 1 }}>/100</span></> : <span style={{ fontSize: 13, fontWeight: 700 }}>—</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.faint }}>Q{idx + 1}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: C.sub }}>{question.topic}</span>
              {!question.hasTopicField && <span title="No topic field" style={{ fontSize: 9, color: C.faint }}>(untagged)</span>}
              {hasTime && <><span style={{ color: C.border }}>·</span><span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>{formatTime(question.timeTaken)}</span></>}
              {question.skipped && <Pill color={C.amber} background={C.amberTint}>skipped</Pill>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{question.text}</div>
            {takeaway.text && <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, color: toneColor(takeaway.tone), overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{takeaway.text}</div>}
          </div>
        </button>
        <button type="button" onClick={() => onToggle(idx)} aria-expanded={open} aria-label={open ? `Collapse Q${idx + 1}` : `Expand Q${idx + 1}`} style={{ flexShrink: 0, width: 44, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.faint }}>
          <span style={{ display: "inline-block", fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>▾</span>
        </button>
      </div>
      {!question.skipped && <div style={{ height: 2.5, background: C.border }}><div style={{ width: objective ? (feedback?.correct !== null ? "100%" : "0%") : `${score || 0}%`, height: "100%", background: badgeColor, opacity: 0.4, transition: "width 0.7s ease" }} /></div>}
      <div style={{ maxHeight: open ? 1400 : 0, opacity: open ? 1 : 0, overflow: "hidden", transition: "max-height 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s ease" }}>
        <div style={{ padding: "8px 18px 20px" }}>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: C.text, fontWeight: 700, marginBottom: 14 }}>{question.text}</div>
          {question.userAnswer && !question.skipped && question.userAnswer !== "Skipped" && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: C.surfaceAlt || cardAlt, border: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", marginBottom: 6 }}>your answer</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: C.sub, whiteSpace: "pre-wrap" }}>{question.userAnswer}</div>
            </div>
          )}
          {question.skipped && <div style={{ padding: "11px 14px", borderRadius: 12, background: C.amberTint, border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 11.5, lineHeight: 1.55, marginBottom: 12 }}>You skipped this question. Use this as a pacing signal rather than a failure.</div>}
          {objective && isEval && <div style={{ padding: "11px 14px", border: `1px solid ${C.border}`, borderRadius: 12, background: cardAlt, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}><span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>result</span><strong style={{ color: badgeColor, fontSize: 13 }}>{feedback?.correct ? "Correct" : "Incorrect"}</strong></div>}
          {!objective && isEval && feedback && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FeedbackBlock label="what worked"     value={feedback.good}        color={C.green}  background={C.greenTint} />
              <FeedbackBlock label="what was missing" value={feedback.missing}    color={C.red}    background={C.redTint}   />
              <FeedbackBlock label="key idea"         value={feedback.idealHint}  color={C.blue500}background={C.blue50}    />
              <FeedbackBlock label="next move"        value={feedback.tip}        color={C.amber}  background={C.amberTint} />
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
              <button type="button" onClick={() => onRetry(question.id)} disabled={retrying} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.borderMd}`, background: retrying ? cardAlt : C.card, color: retrying ? C.muted : C.blue500, fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.3px", cursor: retrying ? "not-allowed" : "pointer" }}>{retrying ? "Re-evaluating…" : "Retry AI evaluation"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const QuestionReview = ({ questions, sessionId }) => {
  const [expanded, setExpanded] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const normalizedQuestions = useMemo(() => questions.map(q => { const override = overrides.find(o => o.id === q.id); return override ? { ...q, score: override.score, aiFeedback: override.aiFeedback } : q; }), [questions, overrides]);
  const strongCount  = normalizedQuestions.filter(q => !q.skipped && q.score >= 80).length;
  const weakCount    = normalizedQuestions.filter(q => !q.skipped && q.score < 60).length;
  const skippedCount = normalizedQuestions.filter(q => q.skipped).length;
  const filters = [{ key: "all", label: `All · ${normalizedQuestions.length}` }, { key: "strong", label: `Strong · ${strongCount}` }, { key: "weak", label: `Needs work · ${weakCount}` }, { key: "skipped", label: `Skipped · ${skippedCount}` }];
  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedQuestions.map((q, i) => ({ ...q, _index: i })).filter(q => {
      if (activeFilter === "strong"  && (q.skipped || q.score < 80))  return false;
      if (activeFilter === "weak"    && (q.skipped || q.score >= 60)) return false;
      if (activeFilter === "skipped" && !q.skipped)                   return false;
      if (needle) { const hay = `${q.text} ${q.topic} ${q.userAnswer}`.toLowerCase(); if (!hay.includes(needle)) return false; }
      return true;
    });
  }, [normalizedQuestions, activeFilter, search]);
  const toggleExpand  = useCallback(index => setExpanded(prev => ({ ...prev, [index]: !prev[index] })), []);
  const handleRetry   = useCallback(async questionId => {
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
    <div style={S.card}>
      <div style={S.eyebrow}>Question-by-question review</div>
      <h2 style={S.cardH2}>Full breakdown</h2>
      <p style={S.cardSub}>Score, time, and a quick takeaway for every question — open any card for feedback, sample answer, and retry.</p>

      {/* Phase 6 — CrossSignalInsight at the top of review */}
      <div style={{ marginTop: 18 }}>
        <CrossSignalInsight questions={questions} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "14px 0 14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {filters.map(f => (<button key={f.key} onClick={() => setActiveFilter(f.key)} style={{ border: `1px solid ${activeFilter === f.key ? C.blue500 : C.border}`, background: activeFilter === f.key ? C.blue500 : C.card, color: activeFilter === f.key ? "#fff" : C.sub, borderRadius: 999, padding: "7px 13px", fontFamily: F.body, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease" }}>{f.label}</button>))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions or answers…" style={{ width: 240, maxWidth: "100%", border: `1px solid ${C.border}`, background: cardAlt, borderRadius: 10, padding: "9px 13px", fontFamily: F.body, fontSize: 12, color: C.text, outline: "none" }} />
      </div>
      {!filteredQuestions.length && <div style={{ border: `1px dashed ${C.borderMd}`, borderRadius: 12, padding: 32, textAlign: "center", color: C.muted, fontSize: 12 }}>No questions match the current filter.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {filteredQuestions.map(q => (<QuestionCard key={q._index} question={q} open={Boolean(expanded[q._index])} onToggle={toggleExpand} onRetry={handleRetry} retrying={retryingId === q.id} />))}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    @keyframes livePulse        { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes mmHeroScan       { 0% { transform:translateX(-100%); } 100% { transform:translateX(650%); } }
    @keyframes scaleIn          { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
    @keyframes badgeGlow        { 0%,100% { box-shadow:0 0 0 rgba(139,92,246,0); } 50% { box-shadow:0 0 10px rgba(139,92,246,0.35); } }
    @keyframes insightBarPulse  { 0% { opacity:0; transform:scaleY(0); transform-origin:top; } 40% { opacity:1; transform:scaleY(1); } 70% { opacity:1; } 100% { opacity:0.7; } }

    *, *::before, *::after { box-sizing: border-box; }

    .res-page button:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 3px; border-radius: 6px; }

    .res-rail-cell { transition: background 0.18s ease !important; }
    .res-rail-cell:hover { background: ${cardAlt} !important; }

    .res-dim-row { width:100%; text-align:left; border:none; cursor:pointer; transition: background 0.16s ease, border-color 0.16s ease !important; }
    .res-dim-row:hover { background: ${C.blue50} !important; }

    .res-btn-primary { transition: transform 0.15s cubic-bezier(.16,1,.3,1), box-shadow 0.15s ease !important; }
    .res-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 26px rgba(0,0,0,0.28) !important; }

    .res-btn-ghost { transition: background 0.15s ease, transform 0.15s ease !important; }
    .res-btn-ghost:hover { background: rgba(255,255,255,0.14) !important; transform: translateY(-1px) !important; }

    .res-btn-gradient { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .res-btn-gradient:hover { transform: translateY(-2px) !important; }

    @media (prefers-reduced-motion: reduce) {
      .res-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }
    @media (max-width: 1020px) {
      .res-two-col   { grid-template-columns: 1fr !important; }
      .res-hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
      .res-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 760px) {
      .res-banner        { flex-direction: column !important; align-items: flex-start !important; }
      .res-strip-r       { display: none !important; }
      .res-hero          { padding: 28px 22px !important; }
      .res-hero-grid     { grid-template-columns: 1fr !important; gap: 24px !important; }
      .res-hero-grid > div:first-child { align-items: center !important; }
      .res-recovery-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 520px) {
      .res-difficulty-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 480px) {
      .res-stat-rail { grid-template-columns: 1fr !important; }
      .res-page      { padding: 14px 12px 60px !important; }
      .res-hero      { padding: 22px 16px !important; border-radius: 16px !important; }
      .res-hero-actions button { flex: 1 1 auto !important; min-width: 0 !important; }

      @media (max-width: 640px) {
  .res-hero-v2 .res-v2-instruments {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
  }
}
@media (max-width: 400px) {
  .res-hero-v2 .res-v2-instruments {
    grid-template-columns: 1fr !important;
  }
}
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: { minHeight: "100vh", background: C.bg, backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(26,110,255,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,200,240,0.04) 0%, transparent 40%)`, padding: "24px 28px 80px", fontFamily: F.body },
  container: { maxWidth: 1200, margin: "0 auto" },

  strip:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", marginBottom: 20, borderRadius: 11, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripL: { display: "flex", alignItems: "center", gap: 9 },
  stripR: { display: "flex", alignItems: "center", gap: 10 },
  liveDot:{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "livePulse 2.4s ease-in-out infinite" },
  mono:   { fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.3px", color: C.muted },

  hero:     { position: "relative", overflow: "hidden", padding: "40px 36px", marginBottom: 20, borderRadius: 22, background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 44%, ${C.blue600} 72%, ${C.cyan600} 100%)`, boxShadow: "0 28px 70px rgba(10,30,100,0.38)" },
  heroScan: { position: "absolute", top: 0, left: 0, width: "18%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)", animation: "mmHeroScan 10s linear infinite", pointerEvents: "none" },
  heroGrid: { position: "relative", display: "grid", gridTemplateColumns: "240px 1fr", gap: 44, alignItems: "center" },

  trendChip: { display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: F.mono, fontSize: 10.5, marginTop: 8 },
  heroKicker:{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: "1.8px", color: C.cyan400, textTransform: "uppercase", opacity: 0.9 },
  heroH1:    { margin: "14px 0 0", fontFamily: F.display, fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.18, letterSpacing: "-1px", maxWidth: 540 },
  heroSub:   { margin: "14px 0 0", fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,0.62)", maxWidth: 500, fontWeight: 400 },

  miniStats:   { display: "flex", alignItems: "center", gap: 0, marginTop: 22, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(8px)", width: "fit-content" },
  miniDivider: { width: 1, height: 32, background: "rgba(255,255,255,0.12)", flexShrink: 0 },
  heroActions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 },
  btnPrimary:  { border: "none", borderRadius: 11, background: "#fff", color: C.blue900, padding: "11px 20px", fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.22)" },
  btnGhost:    { border: "1px solid rgba(255,255,255,0.18)", borderRadius: 11, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.82)", padding: "11px 20px", fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: "pointer" },

  card:    { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 26, boxShadow: C.shadow, marginBottom: 18 },
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", color: C.blue500, marginBottom: 7, textTransform: "lowercase" },
  cardH2:  { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.3px" },
  cardSub: { margin: "7px 0 0", fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 480 },

  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 },

  insightLabel: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, letterSpacing: "0.5px", marginBottom: 8, color: C.sub, textTransform: "lowercase" },
  insightVal:   { fontFamily: F.display, fontSize: 17, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  insightText:  { marginTop: 4, fontSize: 11, color: C.sub, lineHeight: 1.4 },

  dimList:  { display: "flex", flexDirection: "column", gap: 10 },
  dimRow:   { padding: "13px 15px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` },
  dimMeta:  { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  dimLeft:  { display: "flex", alignItems: "center", gap: 10 },
  dimName:  { fontSize: 12.5, fontWeight: 700, color: C.text },
  dimScore: { fontFamily: F.display, fontSize: 17, fontWeight: 800 },
  dimTrack: { height: 6, borderRadius: 999, background: C.border, overflow: "hidden", position: "relative" },
  dimFill:  { height: "100%", borderRadius: 999, transition: "width 1s cubic-bezier(.16,1,.3,1)" },

  footerRow: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, padding: "20px 4px 0", opacity: 0.42 },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESULT PAGE
// ═══════════════════════════════════════════════════════════════════════════
const Result = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const result    = location.state?.result;

  const [copied,          setCopied]          = useState(false);
  const [downloadingImage,setDownloadingImage] = useState(false);
  const topicRef    = useRef(null);
  const shareCardRef = useRef(null);

  useEffect(() => { if (!result) navigate("/"); }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  const normalizedQuestions = useMemo(() => questions.map((q, i) => normalizeQuestion(q, i)), [questions]);

  const evaluatedQuestions  = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number"), [normalizedQuestions]);
  const answeredQuestions   = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped"), [normalizedQuestions]);
  const skippedQuestions    = useMemo(() => normalizedQuestions.filter(q => q.skipped), [normalizedQuestions]);
  const strongAnswers = evaluatedQuestions.filter(q => q.aiFeedback.score >= 80).length;
  const weakAnswers   = evaluatedQuestions.filter(q => q.aiFeedback.score < 60).length;

  const averageTime = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0) / answeredQuestions.length)
    : 0;

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
  const weakestTopic   = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

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
      weakestTopic   ? `Focus area: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : "",
    ].filter(Boolean);
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard unavailable */ }
  }, [totalScore, answeredQuestions.length, normalizedQuestions.length, strongAnswers, weakAnswers, skippedQuestions.length, strongestTopic, weakestTopic]);

  const handleTopicClick = useCallback(() => {
    topicRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleDownloadImage = useCallback(async () => {
    if (!shareCardRef.current || downloadingImage) return;
    setDownloadingImage(true);
    const toastId = toast.loading("Preparing your image…");
    try {
      const url = await toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2.5, width: shareCardRef.current.offsetWidth, height: shareCardRef.current.offsetHeight });
      const link = document.createElement("a");
      link.download = `mockmate-result-${Date.now()}.png`;
      link.href = url; link.click();
      toast.dismiss(toastId); toast.success("Image saved!");
    } catch (err) { toast.dismiss(toastId); console.error("Result image export failed:", err); toast.error("Could not create the image — try again."); }
    finally { setDownloadingImage(false); }
  }, [downloadingImage]);

  const heroResult = {
    score:             totalScore,
    sessionId,
    totalQuestions:    normalizedQuestions.length,
    answeredQuestions: answeredQuestions.length,
    skippedQuestions:  skippedQuestions.length,
    strongAnswers,
    weakAnswers,
    averageTime,
    topTopic:          strongestTopic?.topic ?? null,
    weakestTopicName:  weakestTopic?.topic   ?? null,
    trendDelta:        result?.trendDelta    ?? null,
    scoreHistory:      result?.scoreHistory  ?? [],
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

        {/* Hero — Phase 6 sequential reveal + grade flash */}
        <AnimatedSection delay={60}>
          <SectionErrorBoundary>
            <ResultHeroV2 result={heroResult} navigate={navigate} onCopy={handleCopy} copied={copied} onDownloadImage={handleDownloadImage} downloading={downloadingImage} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Off-screen share card */}
        <ShareCard result={heroResult} cardRef={shareCardRef} />

        {/* Phase 5 — StatRailV2 (sparkline tiles) */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <StatRailV2 result={heroResult} scoreHistory={result?.scoreHistory ?? []} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Phase 1 — Cognitive Load Heatmap */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <CognitiveLoadHeatmap questions={normalizedQuestions} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Next step banner */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <NextStepBanner nextStepText={nextStepText} weakestTopic={weakestTopic} navigate={navigate} score={totalScore} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Phase 2 — Session DNA Fingerprint */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <SessionDNAFingerprint questions={normalizedQuestions} totalScore={totalScore} result={result} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Readout + Topic breakdown */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <section style={S.twoCol} className="res-two-col">
              <div style={S.card}>
                <div style={S.eyebrow}>Session at a glance</div>
                <h2 style={S.cardH2}>Your readout</h2>
                <p style={S.cardSub}>The fastest summary of what this session says about your current form.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
                  <Insight label="strongest topic" value={strongestTopic?.topic || (topicStatus === "no-eval" ? "Pending" : "No data")} text={strongestTopic ? `${strongestTopic.avg}/100 avg` : topicStatus === "no-eval" ? "Awaiting evaluation" : "No topic field returned"} color={C.green}  background={C.greenTint} />
                  <Insight label="next focus"      value={weakestTopic?.topic   || (topicStatus === "no-eval" ? "Pending" : "No data")} text={weakestTopic   ? `${weakestTopic.avg}/100 avg`  : topicStatus === "no-eval" ? "Awaiting evaluation" : "No topic field returned"} color={C.amber}  background={C.amberTint} />
                  <Insight label="pace"            value={formatTime(averageTime)} text={answeredQuestions.length ? "Avg time per question" : "No answered questions yet"} color={C.blue500} background={C.blue50}    />
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
                <ScoreProgressionHeader questions={normalizedQuestions} />
                <ScoreProgression questions={normalizedQuestions} />
              </div>
            </div>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Phase 3 — Momentum Arrow */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <MomentumArrow scoreHistory={result?.scoreHistory ?? []} currentScore={totalScore} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Pace vs score + Phase 4 Answer Confidence Arc */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <section style={S.twoCol} className="res-two-col">
              <div style={S.card}>
                <div style={S.eyebrow}>Pace vs. score</div>
                <h2 style={S.cardH2}>Is speed helping or hurting?</h2>
                <p style={S.cardSub}>Each dot is one question — time taken against the score it earned.</p>
                <div style={{ marginTop: 16 }}>
                  <PaceVsScoreLabeled questions={normalizedQuestions} />
                </div>
              </div>
              <div style={S.card}>
                <div style={S.eyebrow}>Answer confidence</div>
                <h2 style={S.cardH2}>Full session in one ring</h2>
                <p style={S.cardSub}>Every question as an arc — fill depth is score, color is tier. Hover any segment.</p>
                <div style={{ marginTop: 16 }}>
                  <AnswerConfidenceArc questions={normalizedQuestions} />
                </div>
              </div>
            </section>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Phase 1 — Question Difficulty Calibration */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <QuestionDifficultyCalibration questions={normalizedQuestions} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Phase 2 — Recovery Pattern Detector (replaces RepeatedMistake) */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <RecoveryPatternDetector questions={normalizedQuestions} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Phase 5 — Badge Session Bridge (replaces StreakBadgesCard) */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <BadgeSessionBridge streak={streak} newBadges={newBadges} navigate={navigate} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Question-by-question review — CrossSignalInsight wired inside */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <QuestionReview questions={normalizedQuestions} sessionId={sessionId} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* ScoreCard — Mission Report (unchanged) */}
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
            <span style={S.mono}>mockmate result page · v13</span>
            <span style={S.mono}>scores normalized 0–100 · computed post-session</span>
          </footer>
        </AnimatedSection>

      </div>
    </div>
  );
};

export default Result;
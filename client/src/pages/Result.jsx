// MockMate — Result Page: v5 Hero Design + All v4 Sections Restored
// ─────────────────────────────────────────────────────────────────────────────
// Hero, KPI rail, ScoreCard, and all visual design: UNCHANGED from v5 redesign.
// Added back from v4 (zero design changes to existing v5 sections):
//   • SessionDNA ribbon
//   • "Your readout" insight tiles + Score distribution (side-by-side)
//   • Score progression chart + Topic performance (side-by-side)
//   • Streak / Badges card
//   • Question-by-question review (full expand/collapse, feedback blocks, retry, filters, search)
//   • ScoreCard (Mission Report) render
//   • Bottom CTA banner
// All ported components use the v5 C/F token system.

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ScoreCard from "../components/ScoreCard";
import { retryQuestion } from "../Services/interviewService";

// ─── Design tokens — v5 instrument-panel palette (UNCHANGED) ─────────────────
const C = {
  paper:        '#F6F8FD',
  surface:      '#FFFFFF',
  surfaceSunk:  '#F3F6FD',
  ink:          '#0A1628',
  ink2:         '#111F38',
  sub:          '#41547B',
  muted:        '#7C8CAD',
  faint:        '#AFBCDA',
  line:         '#DEE6F7',
  lineMd:       '#C4D2F0',
  signal:       '#0057E8',
  signalDeep:   '#0041B8',
  signalTint:   '#EAF1FF',
  signalSoft:   '#4D8FFF',
  pulse:        '#00C2E8',
  pulseDeep:    '#0093C4',
  pulseTint:    '#E6FAFF',
  green:        '#0E8F63',
  greenTint:    '#E9F9F1',
  amber:        '#B4790A',
  amberTint:    '#FFF6E5',
  red:          '#C22626',
  redTint:      '#FDECEC',
  shadow:       '0 1px 2px rgba(10,22,40,0.04), 0 8px 24px rgba(15,45,120,0.06)',
  shadowMd:     '0 4px 14px rgba(15,45,120,0.08)',
  shadowLg:     '0 24px 64px rgba(6,16,50,0.28)',
};

const F = {
  serif: "'Fraunces', 'Georgia', serif",
  body:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:  "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } },
};
const fadeUpStagger = (delay = 0) => ({
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay } },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const scoreColor = s => {
  const n = clamp(s);
  if (n >= 80) return C.green;
  if (n >= 60) return C.signal;
  if (n >= 40) return C.amber;
  return C.red;
};
const scoreTint = s => {
  const n = clamp(s);
  if (n >= 80) return C.greenTint;
  if (n >= 60) return C.signalTint;
  if (n >= 40) return C.amberTint;
  return C.redTint;
};

const getLabel = s =>
  s >= 90 ? 'Elite' : s >= 80 ? 'Strong' : s >= 70 ? 'Solid' : s >= 60 ? 'Developing' : 'Needs Practice';

const getVerdict = s => {
  if (s >= 80) return { eyebrow: 'strong session', headline: 'You are building reliable interview form.', body: 'Fundamentals landing well. Fastest gains now come from tightening weak spots, not adding random topics.' };
  if (s >= 60) return { eyebrow: 'developing session', headline: 'The foundation is there — sharpen the edges.', body: 'Enough signal to improve fast. Focus on questions where technical depth or clarity dropped.' };
  return { eyebrow: 'practice session', headline: 'This session exposed useful gaps.', body: 'Treat the result as a diagnostic. Weak answers are the roadmap for your next rep.' };
};

const formatTime = s => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
};

const toOneLine = (text, maxLen = 92) => {
  if (!text) return '';
  const s = (text.split(/(?<=[.!?])\s+/)[0] || text).trim();
  return s.length <= maxLen ? s : `${s.slice(0, maxLen - 1).trim()}…`;
};

const getTakeaway = question => {
  if (question.skipped) return { text: 'Skipped — no answer submitted.', tone: 'neutral' };
  const objective = ['mcq', 'aptitude'].includes(question.questionType);
  const fb = question.aiFeedback;
  if (objective) {
    if (fb?.correct === true)  return { text: 'Correct answer.', tone: 'good' };
    if (fb?.correct === false) return { text: 'Incorrect — see the explanation below.', tone: 'bad' };
    return { text: 'Answer recorded.', tone: 'neutral' };
  }
  if (!fb || fb.aiAvailable === false) return { text: 'AI evaluation unavailable for this answer.', tone: 'neutral' };
  const score = clamp(fb.score);
  if (score >= 80 && fb.good)    return { text: toOneLine(fb.good),    tone: 'good' };
  if (score < 60  && fb.missing) return { text: toOneLine(fb.missing), tone: 'bad' };
  if (fb.tip)  return { text: toOneLine(fb.tip),  tone: 'neutral' };
  if (fb.good) return { text: toOneLine(fb.good), tone: 'neutral' };
  return { text: 'Reviewed — open for the full breakdown.', tone: 'neutral' };
};

// ─── Feedback normalization ───────────────────────────────────────────────────
const normalizeFeedback = question => {
  if (!question) return null;
  const raw = question.feedback;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      score:        typeof question.score === 'number' ? question.score : Number(question.score || 0),
      correct:      question.correct ?? parsed.correct ?? null,
      good:         parsed.good        || '',
      missing:      parsed.missing     || '',
      idealHint:    parsed.idealHint   || '',
      tip:          parsed.tip         || '',
      sampleAnswer: parsed.sampleAnswer|| '',
      aiAvailable:  parsed.aiAvailable !== false,
      fallback:     parsed.fallback === true,
    };
  } catch { return null; }
};

const normalizeQuestion = (question, index) => {
  const aiFeedback = normalizeFeedback(question);
  const scoreValue = typeof question?.score === 'number' ? question.score : Number(question?.score || 0);
  return {
    ...question,
    index,
    text:         question?.text || question?.question || `Question ${index + 1}`,
    topic:        question?.topic || 'General',
    questionType: question?.questionType || 'open',
    userAnswer:   question?.userAnswer || '',
    skipped:      Boolean(question?.skipped),
    score:        clamp(scoreValue),
    aiFeedback,
  };
};

// ─── Gauge — Fraunces serif score (UNCHANGED from v5) ────────────────────────
const ScoreGauge = ({ score, mounted }) => {
  const r = 82, size = 220, cx = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="gaugeG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.signalSoft} />
            <stop offset="100%" stopColor={C.pulse} />
          </linearGradient>
          <linearGradient id="gaugeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.signalSoft} stopOpacity="0.3" />
            <stop offset="100%" stopColor={C.pulse} stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="url(#gaugeGlow)" strokeWidth="18" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none" stroke="url(#gaugeG)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)', filter: 'drop-shadow(0 0 6px rgba(0,194,232,0.5))' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: F.serif, fontSize: 64, fontWeight: 500, lineHeight: 0.9, color: '#fff', letterSpacing: '-2px' }}>
          {score}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>/ 100</div>
        <div style={{ marginTop: 9, fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: '1.2px', color: C.pulse }}>
          {getLabel(score).toUpperCase()}
        </div>
      </div>
    </div>
  );
};

// ─── KPI rail — inside the dark hero panel (UNCHANGED from v5) ───────────────
const HeroKpiRail = ({ data }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    marginTop: 28,
  }}>
    {data.map((item, i) => (
      <div key={i} style={{
        padding: '14px 18px',
        borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
      }}>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.38)', marginBottom: 6 }}>
          {item.label}
        </div>
        <div style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 500, color: item.color, lineHeight: 1, letterSpacing: '-0.5px' }}>
          {item.value}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>
          {item.sub}
        </div>
      </div>
    ))}
  </div>
);

// ─── Verdict strip (UNCHANGED from v5) ───────────────────────────────────────
const VerdictStrip = ({ score }) => {
  const v = getVerdict(score);
  return (
    <div style={{
      padding: '16px 20px', borderRadius: 14,
      background: 'rgba(0,194,232,0.07)',
      border: '1px solid rgba(0,194,232,0.16)',
      borderLeft: `3px solid ${C.pulse}`,
      marginTop: 18,
    }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '1.1px', color: C.pulse, marginBottom: 7 }}>
        {v.eyebrow}
      </div>
      <div style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 500, color: '#fff', lineHeight: 1.35, fontStyle: 'italic', marginBottom: 7 }}>
        {v.headline}
      </div>
      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
        {v.body}
      </div>
    </div>
  );
};

// ─── Sparkline (UNCHANGED from v5) ───────────────────────────────────────────
const Sparkline = ({ values }) => {
  if (values.length < 2) return null;
  const W = 120, H = 36;
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const x = i => (i / (values.length - 1)) * W;
  const y = v => H - ((v - min) / (max - min)) * H;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L ${x(values.length - 1)} ${H} L 0 ${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.pulse} stopOpacity="0.2" />
          <stop offset="100%" stopColor={C.pulse} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={d} fill="none" stroke={C.pulse} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="3" fill={C.pulse} />
    </svg>
  );
};

// ─── Topic pills (UNCHANGED from v5) ─────────────────────────────────────────
const TopicPills = ({ topics }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
    {topics.map(t => {
      const col = scoreColor(t.avg);
      return (
        <div key={t.topic} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />
          <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: col }}>{t.avg}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 500 }}>{t.topic}</span>
        </div>
      );
    })}
  </div>
);

// ─── Mini ScoreCard (UNCHANGED from v5) ──────────────────────────────────────
const MiniScoreCard = ({ result, mounted }) => {
  const bars = result.topicAverages;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 18, padding: '22px 24px',
      boxShadow: C.shadow, marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.8px', color: C.signal, marginBottom: 7 }}>
            session scorecard
          </div>
          <h2 style={{ margin: 0, fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink }}>
            Performance at a glance
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            Topic breakdown, timing, and quick stats — everything before you drill into each question.
          </p>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '12px 18px', borderRadius: 14,
          background: 'linear-gradient(160deg, #060E20 0%, #0A1A38 100%)',
          border: '1px solid rgba(0,194,232,0.2)',
          minWidth: 90,
        }}>
          <div style={{ fontFamily: F.serif, fontSize: 36, fontWeight: 500, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>
            {result.score}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.pulse, letterSpacing: '0.8px', marginTop: 5 }}>
            session score
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${C.line}`,
        marginBottom: 20,
      }}>
        {[
          { label: 'answered',       value: `${result.answeredQuestions}/${result.totalQuestions}`, color: C.green },
          { label: 'strong (80+)',   value: result.strongAnswers,   color: C.signal },
          { label: 'needs work (<60)', value: result.weakAnswers,  color: C.red },
          { label: 'avg time/q',     value: formatTime(result.averageTime), color: C.sub },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            borderRight: i < 3 ? `1px solid ${C.line}` : 'none',
            background: i % 2 === 1 ? C.surfaceSunk : C.surface,
          }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.4px', marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 500, color: s.color, lineHeight: 1, letterSpacing: '-0.3px' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {bars.map(t => {
          const col = scoreColor(t.avg);
          return (
            <div key={t.topic}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{t.topic}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: col }}>{t.avg}/100</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: C.line, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: mounted ? `${t.avg}%` : '0%',
                  background: col,
                  transition: 'width 1s cubic-bezier(.16,1,.3,1)',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 18, padding: '13px 16px', borderRadius: 12,
        background: C.signalTint, border: `1px solid ${C.lineMd}`,
        borderLeft: `2px solid ${C.signal}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.signal, letterSpacing: '0.6px', flexShrink: 0 }}>next focus</div>
        <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 500, lineHeight: 1.55 }}>
          Drill <strong style={{ color: C.signalDeep }}>{result.weakestTopic.topic}</strong> — at {result.weakestTopic.avg}/100 it's your highest-ROI move before the next session.
        </div>
      </div>
    </div>
  );
};

// ─── Hero stat chip — inline data point for the right column ─────────────────
const HeroChip = ({ label, value, color = 'rgba(255,255,255,0.82)', dim = false }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 3,
    padding: '10px 14px', borderRadius: 10,
    background: dim ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${dim ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)'}`,
    minWidth: 72,
  }}>
    <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: '0.7px', color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 500, color, lineHeight: 1, letterSpacing: '-0.3px' }}>{value}</div>
  </div>
);

// ─── Hero session meta row — session ID, date, mode ──────────────────────────
const HeroMeta = ({ sessionId, archetype }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE9C', boxShadow: '0 0 6px #4ADE9C88' }} />
      <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.pulse, letterSpacing: '1px', fontWeight: 500 }}>
        post-interview debrief
      </span>
    </div>
    <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
    {sessionId && (
      <span style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.4px' }}>
        {sessionId}
      </span>
    )}
    {archetype && <>
      <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
      <span style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.36)', letterSpacing: '0.4px' }}>
        {archetype}
      </span>
    </>}
    <span style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.4px', marginLeft: 'auto' }}>
      {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toLowerCase()}
    </span>
  </div>
);

// ─── Hero — enhanced instrument-panel ────────────────────────────────────────
const ResultHero = ({ result, mounted, onCopy, copied, onNavigate }) => {
  const answered    = result.answeredQuestions;
  const total       = result.totalQuestions;
  const strong      = result.strongAnswers;
  const weak        = result.weakAnswers;
  const skipped     = result.skippedQuestions;
  const avgTime     = result.averageTime;
  const strongRate  = answered ? Math.round((strong / answered) * 100) : 0;
  const completionPct = total ? Math.round((answered / total) * 100) : 0;

  // Trend value — show signed delta if available
  const trendValue  = result.trendDelta != null
    ? `${result.trendDelta >= 0 ? '+' : ''}${Number(result.trendDelta).toFixed(1)}`
    : '—';
  const trendColor  = result.trendDelta >= 0 ? '#4ADE9C' : '#FF8080';

  // Bottom KPI rail — 5 tiles now
  const kpis = [
    {
      label: 'answered',
      value: `${answered}/${total}`,
      sub: `${completionPct}% completion`,
      color: '#fff',
    },
    {
      label: 'strongest topic',
      value: result.strongestTopic?.topic?.split(' ')[0] || '—',
      sub: `${result.strongestTopic?.avg ?? '—'}/100 avg`,
      color: C.pulse,
    },
    {
      label: 'focus area',
      value: result.weakestTopic?.topic?.split(' ')[0] || '—',
      sub: `${result.weakestTopic?.avg ?? '—'}/100 · lowest`,
      color: '#FFB86C',
    },
    {
      label: 'session trend',
      value: trendValue,
      sub: 'pts vs last 3 sessions',
      color: trendColor,
    },
    {
      label: 'readiness tier',
      value: result.tier || '—',
      sub: result.archetype || 'current trajectory',
      color: 'rgba(255,255,255,0.72)',
    },
  ];

  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 22, marginBottom: 20,
      background: 'linear-gradient(150deg, #060E20 0%, #0A1A38 38%, #0C2242 66%, #0E3358 100%)',
      boxShadow: '0 28px 70px rgba(4,12,34,0.38)',
      padding: '32px 34px 0',
    }}>
      {/* Sweep shimmer */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent)', animation: 'heroSweep 11s linear infinite', pointerEvents: 'none' }} />
      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,194,232,0.12), transparent 68%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: 60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,87,232,0.08), transparent 70%)', pointerEvents: 'none' }} />
      {/* Dot grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.032) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div style={{ position: 'relative', display: 'flex', gap: 36, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── LEFT: gauge column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <ScoreGauge score={result.score} mounted={mounted} />

          {/* Tier + archetype pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.pulse }} />
            {result.tier} eligible
          </div>

          {/* Sparkline + trend label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.6px' }}>score history</div>
            <Sparkline values={result.scoreHistory || []} />
            {result.scoreHistory?.length >= 2 && (
              <div style={{ fontFamily: F.mono, fontSize: 9, color: trendColor, fontWeight: 600, letterSpacing: '0.4px' }}>
                {trendValue} this session
              </div>
            )}
          </div>

          {/* Mini session stats — answered / skipped / avg time stacked */}
          <div style={{
            width: '100%', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            {[
              { label: 'answered', value: `${answered}/${total}` },
              { label: 'skipped',  value: skipped > 0 ? skipped : '—' },
              { label: 'avg / q',  value: formatTime(avgTime) },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 12px',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}>
                <span style={{ fontFamily: F.mono, fontSize: 8.5, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>{row.label}</span>
                <span style={{ fontFamily: F.serif, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.75)', letterSpacing: '-0.2px' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: content column ── */}
        <div style={{ flex: 1, minWidth: 260, paddingTop: 4 }}>

          {/* Session meta row */}
          <HeroMeta sessionId={result.sessionId} archetype={result.archetype} />

          {/* Headline */}
          <h1 style={{ margin: '0 0 6px', fontFamily: F.serif, fontSize: 30, fontWeight: 500, color: '#fff', lineHeight: 1.24, letterSpacing: '-0.4px', maxWidth: 540 }}>
            {result.score >= 80
              ? 'You looked placement-ready.'
              : result.score >= 60
              ? 'The foundation is solid.'
              : 'Good reps from a useful diagnostic.'}
          </h1>

          {/* Performance sub-label */}
          <div style={{ fontFamily: F.mono, fontSize: 10, color: 'rgba(255,255,255,0.42)', letterSpacing: '0.5px', marginBottom: 14 }}>
            {getLabel(result.score)} · {answered} answered · {strong} strong · {weak} need work
          </div>

          {/* Inline stat chips row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <HeroChip label="strong (80+)"   value={strong}        color={strong > 0 ? '#4ADE9C' : 'rgba(255,255,255,0.5)'} />
            <HeroChip label="needs work"     value={weak}          color={weak > 0 ? '#FF8080' : 'rgba(255,255,255,0.5)'} />
            <HeroChip label="avg time / q"   value={formatTime(avgTime)} />
            <HeroChip label="strong rate"    value={`${strongRate}%`} color={strongRate >= 60 ? '#4ADE9C' : strongRate >= 40 ? '#FFB86C' : '#FF8080'} />
            {skipped > 0 && <HeroChip label="skipped" value={skipped} color="#FFB86C" dim />}
          </div>

          {/* Topic pills */}
          <TopicPills topics={result.topicAverages || []} />

          {/* Verdict strip */}
          <VerdictStrip score={result.score} />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate('/interview')} style={{ border: 'none', borderRadius: 11, background: '#fff', color: C.ink, padding: '12px 22px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
              Try again →
            </button>
            <button onClick={() => onNavigate('/dashboard')} style={{ border: '1px solid rgba(255,255,255,0.16)', borderRadius: 11, background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '12px 20px', fontSize: 13, fontWeight: 500, fontFamily: F.body, cursor: 'pointer' }}>
              ← Dashboard
            </button>
            <button onClick={onCopy} style={{ border: '1px solid rgba(0,194,232,0.3)', borderRadius: 11, background: 'rgba(0,194,232,0.1)', color: '#8FE9FF', padding: '12px 20px', fontSize: 13, fontWeight: 500, fontFamily: F.body, cursor: 'pointer' }}>
              {copied ? '✓ Copied' : 'Copy summary'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI rail — 5 tiles, richer sub-labels ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        marginTop: 28,
      }}>
        {kpis.map((item, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            borderRight: i < 4 ? '1px solid rgba(255,255,255,0.07)' : 'none',
          }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: '0.7px', color: 'rgba(255,255,255,0.32)', marginBottom: 6 }}>
              {item.label}
            </div>
            <div style={{ fontFamily: F.serif, fontSize: i === 3 ? 22 : 20, fontWeight: 500, color: item.color, lineHeight: 1, letterSpacing: '-0.3px', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.value}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, color: 'rgba(255,255,255,0.26)', lineHeight: 1.4 }}>
              {item.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Next-step banner (UNCHANGED from v5) ─────────────────────────────────────
const NextStepBanner = ({ nextStepText }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '16px 20px', marginBottom: 18, borderRadius: 14,
    background: `linear-gradient(135deg, ${C.signalTint} 0%, ${C.pulseTint} 100%)`,
    border: `1px solid ${C.lineMd}`,
  }}>
    <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${C.signalDeep}, ${C.signal})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, boxShadow: `0 4px 12px rgba(0,87,232,0.28)` }}>→</div>
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, color: C.signalDeep, letterSpacing: '1px', marginBottom: 4 }}>what to do next</div>
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, lineHeight: 1.65 }}>{nextStepText}</div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS RESTORED FROM v4 — styled with v5 tokens
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Shared card wrapper ──────────────────────────────────────────────────────
const Card = ({ children, style = {}, delay = 0 }) => (
  <motion.div
    variants={fadeUpStagger(delay)} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.12 }}
    style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: '22px 24px', boxShadow: C.shadow, ...style }}
  >
    {children}
  </motion.div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.8px', color: C.signal, marginBottom: 7 }}>
    {children}
  </div>
);

// ─── SessionDNA — 4-tile grid ─────────────────────────────────────────────────
const SessionDNA = ({ topicAverages, strongCount, weakCount, totalAnswered, totalQuestions }) => {
  if (!topicAverages.length) return null;
  const best  = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const worst = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];
  const completion = totalQuestions ? Math.round((totalAnswered / totalQuestions) * 100) : 0;
  const strongRate = totalAnswered ? Math.round((strongCount / totalAnswered) * 100) : 0;

  const tiles = [
    { icon: '🏆', label: 'top topic',   value: best.topic,        sub: `${best.avg}/100`,          valueColor: C.green },
    { icon: '📈', label: 'focus area',  value: worst.topic,       sub: `${worst.avg}/100`,          valueColor: C.amber },
    { icon: '✅', label: 'completion',  value: `${completion}%`,  sub: `${totalAnswered}/${totalQuestions}`, valueColor: C.signal },
    { icon: '🔥', label: 'strong rate', value: `${strongRate}%`,  sub: `${strongCount} of ${totalAnswered}`, valueColor: C.pulse },
  ];

  return (
    <motion.div
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}
      className="result-dna-grid"
    >
      {tiles.map(tile => (
        <div key={tile.label} style={{
          background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14,
          padding: '14px 16px', boxShadow: C.shadow,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{tile.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.8px', marginBottom: 3 }}>{tile.label}</div>
            <div style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 500, color: tile.valueColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tile.value}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.signal, fontWeight: 600, marginTop: 2 }}>{tile.sub}</div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Insight tile ─────────────────────────────────────────────────────────────
const Insight = ({ label, value, text, color, background }) => (
  <div style={{ padding: 15, borderRadius: 13, background, border: `1px solid ${color}30` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color, letterSpacing: '0.8px', marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 500, color: C.ink, lineHeight: 1.15, letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    <div style={{ marginTop: 4, fontSize: 11, color: C.sub, lineHeight: 1.4 }}>{text}</div>
  </div>
);

// ─── Score distribution ───────────────────────────────────────────────────────
const ScoreDistribution = ({ questions }) => {
  const buckets = [
    { label: 'Strong',     range: '80–100', count: questions.filter(q => !q.skipped && q.score >= 80).length, color: C.green },
    { label: 'Solid',      range: '60–79',  count: questions.filter(q => !q.skipped && q.score >= 60 && q.score < 80).length, color: C.signal },
    { label: 'Needs work', range: '0–59',   count: questions.filter(q => !q.skipped && q.score < 60).length, color: C.red },
  ];
  const answered = questions.filter(q => !q.skipped).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {buckets.map(b => {
        const pct = answered ? Math.round((b.count / answered) * 100) : 0;
        return (
          <div key={b.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{b.label}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{b.range}</span>
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: b.color }}>{b.count}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: C.line, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: b.color, transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Topic performance bars ───────────────────────────────────────────────────
const TopicPerformance = ({ topicAverages }) => {
  const sorted = [...topicAverages].sort((a, b) => b.avg - a.avg);
  if (!sorted.length) return (
    <div style={{ padding: '28px 10px', color: C.muted, fontSize: 12, textAlign: 'center' }}>
      Topic-level scoring not available for this session.
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {sorted.map(t => {
        const col = scoreColor(t.avg);
        return (
          <div key={t.topic}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{t.topic}</span>
              <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: col }}>{t.avg}/100</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: C.line, overflow: 'hidden' }}>
              <div style={{ width: `${t.avg}%`, height: '100%', borderRadius: 999, background: col, transition: 'width 0.9s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Score progression SVG chart ──────────────────────────────────────────────
const ScoreProgression = ({ questions }) => {
  const points = questions
    .filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === 'number')
    .map(q => q.aiFeedback.score);

  if (points.length < 2) return (
    <div style={{ padding: 28, borderRadius: 12, background: C.surfaceSunk, color: C.muted, fontSize: 12, textAlign: 'center' }}>
      At least two evaluated questions are needed to show progression.
    </div>
  );

  const W = 680, H = 190, padX = 28, padY = 18;
  const x = i => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = v => H - padY - (clamp(v) / 100) * (H - padY * 2);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L ${x(points.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 400, display: 'block' }}>
        <defs>
          <linearGradient id="areaGradR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.signal} stopOpacity="0.13" />
            <stop offset="100%" stopColor={C.signal} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 60, 80].map(l => (
          <g key={l}>
            <line x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} stroke={C.line} strokeDasharray="4 5" />
            <text x={4} y={y(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text>
          </g>
        ))}
        <path d={area} fill="url(#areaGradR)" />
        <path d={path} fill="none" stroke={C.signal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r="5" fill={scoreColor(v)} stroke="#fff" strokeWidth="2" />
            <text x={x(i)} y={H - 3} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>Q{i + 1}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ─── Feedback block ───────────────────────────────────────────────────────────
const FeedbackBlock = ({ label, value, color, background }) => (
  <div style={{ padding: 13, borderRadius: 12, background, border: `1px solid ${color}25` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color, letterSpacing: '0.8px', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 11.5, lineHeight: 1.65, color: C.ink }}>{value || 'No additional readout.'}</div>
  </div>
);

// ─── Pill badge ───────────────────────────────────────────────────────────────
const Pill = ({ children, color = C.signal, background = C.signalTint }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', borderRadius: 999,
    padding: '4px 10px', background, color,
    fontFamily: F.mono, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.5px',
    border: `1px solid ${color}30`,
  }}>
    {children}
  </span>
);

// ─── Question card (full v4 logic, v5 tokens) ─────────────────────────────────
const toneColor = tone => tone === 'good' ? C.green : tone === 'bad' ? C.red : C.sub;

const QuestionCard = ({ question, open, onToggle, onRetry, retrying }) => {
  const idx       = question._index;
  const feedback  = question.aiFeedback;
  const objective = ['mcq', 'aptitude'].includes(question.questionType);
  const isEval    = Boolean(feedback && feedback.aiAvailable !== false && (typeof feedback.score === 'number' || objective));
  const score     = isEval && !objective ? feedback.score : null;
  const takeaway  = useMemo(() => getTakeaway(question), [question]);
  const hasTime   = Number(question.timeTaken) > 0;
  const canRetry  = !objective && !question.skipped && question.userAnswer?.trim() && question.id;

  const badgeColor = question.skipped ? C.muted
    : objective
      ? (feedback?.correct === true ? C.green : feedback?.correct === false ? C.red : C.muted)
      : (isEval ? scoreColor(score) : C.muted);

  const badgeBg = question.skipped ? C.surfaceSunk
    : objective
      ? (feedback?.correct === true ? C.greenTint : feedback?.correct === false ? C.redTint : C.surfaceSunk)
      : (isEval ? scoreTint(score) : C.surfaceSunk);

  return (
    <div style={{
      border: `1px solid ${open ? C.lineMd : C.line}`,
      borderRadius: 14,
      background: open ? C.surfaceSunk : C.surface,
      boxShadow: open ? C.shadowMd : C.shadow,
      overflow: 'hidden',
      transition: 'box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button
          type="button"
          onClick={() => onToggle(idx)}
          aria-expanded={open}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 8px 14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
        >
          {/* Score badge */}
          <div style={{
            flexShrink: 0, width: 48, height: 48, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}25`,
          }}>
            {question.skipped
              ? <span style={{ fontSize: 16, fontWeight: 700 }}>—</span>
              : objective
                ? <span style={{ fontSize: 20, fontWeight: 900 }}>{feedback?.correct === true ? '✓' : feedback?.correct === false ? '✕' : '?'}</span>
                : isEval
                  ? <>
                      <span style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 500, lineHeight: 1 }}>{score}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 7, opacity: 0.7, marginTop: 1 }}>/100</span>
                    </>
                  : <span style={{ fontSize: 14, fontWeight: 700 }}>—</span>
            }
          </div>

          {/* Meta + text */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.faint, letterSpacing: '0.5px' }}>Q{idx + 1}</span>
              <span style={{ color: C.line }}>·</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: C.sub }}>{question.topic}</span>
              {hasTime && <>
                <span style={{ color: C.line }}>·</span>
                <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>◷ {formatTime(question.timeTaken)}</span>
              </>}
              {question.skipped && <Pill color={C.amber} background={C.amberTint}>SKIPPED</Pill>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: C.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
              {question.text}
            </div>
            {takeaway.text && (
              <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, color: toneColor(takeaway.tone), overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                {takeaway.text}
              </div>
            )}
          </div>
        </button>

        {/* Chevron */}
        <button
          type="button"
          onClick={() => onToggle(idx)}
          aria-expanded={open}
          aria-label={open ? `Collapse Q${idx + 1}` : `Expand Q${idx + 1}`}
          style={{ flexShrink: 0, width: 46, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint }}
        >
          <span style={{ display: 'inline-block', fontSize: 12, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>▾</span>
        </button>
      </div>

      {/* Progress hairline */}
      {!question.skipped && (
        <div style={{ height: 2.5, background: C.surfaceSunk }}>
          <div style={{
            width: objective
              ? (feedback?.correct !== null ? '100%' : '0%')
              : `${score || 0}%`,
            height: '100%', background: badgeColor, opacity: 0.4,
            transition: 'width 0.7s ease',
          }} />
        </div>
      )}

      {/* Expanded body */}
      <div style={{ maxHeight: open ? 1400 : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s ease' }}>
        <div style={{ padding: '8px 18px 20px' }}>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: C.ink, fontWeight: 700, marginBottom: 14 }}>{question.text}</div>

          {question.userAnswer && !question.skipped && question.userAnswer !== 'Skipped' && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: C.surfaceSunk, border: `1px solid ${C.line}`, marginBottom: 12 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: '0.8px', marginBottom: 6 }}>your answer</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: C.sub, whiteSpace: 'pre-wrap' }}>{question.userAnswer}</div>
            </div>
          )}

          {question.skipped && (
            <div style={{ padding: '11px 14px', borderRadius: 12, background: C.amberTint, border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 11.5, lineHeight: 1.55, marginBottom: 12 }}>
              You skipped this question. Use this as a pacing signal rather than a failure.
            </div>
          )}

          {objective && isEval && (
            <div style={{ padding: '11px 14px', border: `1px solid ${C.line}`, borderRadius: 12, background: C.surfaceSunk, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.6px' }}>result</span>
              <strong style={{ color: badgeColor, fontSize: 13 }}>{feedback?.correct ? 'Correct' : 'Incorrect'}</strong>
            </div>
          )}

          {objective && feedback?.raw && (
            <div style={{ padding: 13, borderRadius: 12, background: C.surfaceSunk, border: `1px solid ${C.line}`, color: C.sub, fontSize: 12.5, lineHeight: 1.6, wordBreak: 'break-word', marginBottom: 12 }}>{feedback.raw}</div>
          )}

          {!objective && isEval && feedback && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FeedbackBlock label="what worked"      value={feedback.good}       color={C.green}  background={C.greenTint} />
              <FeedbackBlock label="what was missing" value={feedback.missing}    color={C.red}    background={C.redTint} />
              <FeedbackBlock label="key idea"         value={feedback.idealHint}  color={C.signal} background={C.signalTint} />
              <FeedbackBlock label="next move"        value={feedback.tip}        color={C.amber}  background={C.amberTint} />
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: '1 / -1', padding: 13, borderRadius: 12, background: C.surfaceSunk, border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: '0.8px', marginBottom: 6 }}>better answer pattern</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: C.ink }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {canRetry && onRetry && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => onRetry(question.id)}
                disabled={retrying}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  border: `1px solid ${C.lineMd}`,
                  background: retrying ? C.surfaceSunk : C.surface,
                  color: retrying ? C.muted : C.signal,
                  fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.4px',
                  cursor: retrying ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease',
                }}
              >
                {retrying ? 'Re-evaluating…' : 'Retry AI evaluation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Question review section ──────────────────────────────────────────────────
const QuestionReview = ({ questions, sessionId }) => {
  const [expanded,     setExpanded]     = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const [retryingId,   setRetryingId]   = useState(null);
  const [overrides,    setOverrides]    = useState([]);

  const normalizedQuestions = useMemo(() => {
    return questions.map((q, i) => {
      const override = overrides.find(o => o.id === q.id);
      return override ? { ...q, score: override.score, aiFeedback: override.aiFeedback } : q;
    });
  }, [questions, overrides]);

  const strongCount      = normalizedQuestions.filter(q => !q.skipped && q.score >= 80).length;
  const weakCount        = normalizedQuestions.filter(q => !q.skipped && q.score < 60).length;
  const skippedCount     = normalizedQuestions.filter(q => q.skipped).length;

  const filters = [
    { key: 'all',     label: `All · ${normalizedQuestions.length}` },
    { key: 'strong',  label: `Strong · ${strongCount}` },
    { key: 'weak',    label: `Needs work · ${weakCount}` },
    { key: 'skipped', label: `Skipped · ${skippedCount}` },
  ];

  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedQuestions
      .map((q, i) => ({ ...q, _index: i }))
      .filter(q => {
        if (activeFilter === 'strong'  && (q.skipped || q.score < 80))  return false;
        if (activeFilter === 'weak'    && (q.skipped || q.score >= 60)) return false;
        if (activeFilter === 'skipped' && !q.skipped)                   return false;
        if (needle) {
          const hay = `${q.text} ${q.topic} ${q.userAnswer}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
  }, [normalizedQuestions, activeFilter, search]);

  const toggleExpand = useCallback(index => {
    setExpanded(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleRetry = useCallback(async questionId => {
    if (!sessionId || !questionId || retryingId) return;
    setRetryingId(questionId);
    try {
      const data = await retryQuestion(sessionId, questionId);
      const parsedFeedback = normalizeFeedback({ feedback: data?.feedback, score: data?.score });
      setOverrides(prev => [
        ...prev.filter(q => q.id !== questionId),
        { id: questionId, score: clamp(Number(data?.score) || 0), aiFeedback: parsedFeedback },
      ]);
    } catch (err) { console.error('Retry failed:', err); }
    finally { setRetryingId(null); }
  }, [sessionId, retryingId]);

  return (
    <Card style={{ marginBottom: 18 }} delay={0.05}>
      <SectionLabel>question-by-question review</SectionLabel>
      <h2 style={{ margin: '0 0 4px', fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink }}>Full breakdown</h2>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
        Score, time, and a quick takeaway for every question — open any card for feedback, sample answer, and retry.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{
              border: `1px solid ${activeFilter === f.key ? C.signal : C.line}`,
              background: activeFilter === f.key ? C.signal : C.surface,
              color: activeFilter === f.key ? '#fff' : C.sub,
              borderRadius: 999, padding: '7px 13px',
              fontFamily: F.body, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>{f.label}</button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search questions or answers…"
          style={{ width: 240, maxWidth: '100%', border: `1px solid ${C.line}`, background: C.surfaceSunk, borderRadius: 10, padding: '9px 13px', fontFamily: F.body, fontSize: 12, color: C.ink, outline: 'none' }}
        />
      </div>

      {!filteredQuestions.length && (
        <div style={{ border: `1px dashed ${C.lineMd}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.muted, fontSize: 12 }}>
          No questions match the current filter.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {filteredQuestions.map(q => (
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
    </Card>
  );
};

// ─── Streak / Badges card ─────────────────────────────────────────────────────
const StreakBadgesCard = ({ streak, newBadges }) => {
  if (!streak && (!newBadges || !newBadges.length)) return null;
  return (
    <Card style={{ padding: '18px 22px', borderRadius: 16, marginBottom: 18 }} delay={0.05}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        {streak && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: C.amberTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔥</div>
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 500, color: C.ink }}>{streak.current || 0} day streak</div>
              <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.6px' }}>consistency compounds</div>
            </div>
          </div>
        )}
        {newBadges && newBadges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {newBadges.map((badge, i) => {
              const label = typeof badge === 'string' ? badge : badge?.label || 'New badge';
              return <Pill key={`${label}-${i}`} color={C.signalDeep} background={C.signalTint}>🏆 {label}</Pill>;
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── Bottom CTA banner ────────────────────────────────────────────────────────
const CtaBanner = ({ weakestTopic, onNavigate }) => (
  <motion.section
    variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
    style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '26px 28px',
      background: 'linear-gradient(150deg, #060E20 0%, #0A1A38 38%, #0C2242 66%, #0E3358 100%)',
      boxShadow: '0 28px 70px rgba(4,12,34,0.38)',
      marginBottom: 28,
    }}
  >
    <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', right: -100, top: -140, background: 'radial-gradient(circle, rgba(0,194,232,0.12), transparent 68%)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 500, letterSpacing: '1.2px', color: C.pulse, marginBottom: 10 }}>next move</div>
        <h2 style={{ margin: 0, fontFamily: F.serif, fontSize: 22, fontWeight: 500, color: '#fff', letterSpacing: '-0.3px' }}>
          Turn this feedback into your next rep.
        </h2>
        <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 1.6 }}>
          Focus on {weakestTopic?.topic || 'your weakest area'} next.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => onNavigate('/interview')} style={{ border: 'none', borderRadius: 11, background: '#fff', color: C.ink, padding: '12px 20px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
          Start another interview
        </button>
        <button onClick={() => onNavigate('/analytics')} style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 11, background: 'rgba(255,255,255,0.07)', color: '#fff', padding: '12px 20px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          Open analytics →
        </button>
      </div>
    </div>
  </motion.section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RESULT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const Result = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const result    = location.state?.result;

  const [mounted, setMounted] = useState(false);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    if (!result) { navigate('/'); return; }
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  // Derived data
  const normalizedQuestions = useMemo(
    () => questions.map((q, i) => normalizeQuestion(q, i)),
    [questions]
  );

  const evaluatedQuestions   = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === 'number'), [normalizedQuestions]);
  const answeredQuestions    = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== 'Skipped'), [normalizedQuestions]);
  const skippedQuestions     = useMemo(() => normalizedQuestions.filter(q => q.skipped), [normalizedQuestions]);
  const strongAnswers        = evaluatedQuestions.filter(q => q.aiFeedback.score >= 80).length;
  const weakAnswers          = evaluatedQuestions.filter(q => q.aiFeedback.score < 60).length;

  const averageTime = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0) / answeredQuestions.length)
    : 0;

  const averageQuestionScore = evaluatedQuestions.length
    ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + q.aiFeedback.score, 0) / evaluatedQuestions.length)
    : totalScore;

  const topicAverages = useMemo(() => {
    const map = {};
    normalizedQuestions.forEach(q => {
      if (q.skipped || typeof q.aiFeedback?.score !== 'number') return;
      const topic = q.topic || 'General';
      if (!map[topic]) map[topic] = { total: 0, count: 0 };
      map[topic].total += q.aiFeedback.score;
      map[topic].count += 1;
    });
    return Object.entries(map).map(([topic, d]) => ({ topic, avg: Math.round(d.total / d.count) }));
  }, [normalizedQuestions]);

  const strongestTopic = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const weakestTopic   = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

  // Fastest/slowest
  const fastestQuestion = useMemo(() => {
    const timed = answeredQuestions.filter(q => Number(q.timeTaken || 0) > 0).sort((a, b) => a.timeTaken - b.timeTaken);
    return timed[0] || null;
  }, [answeredQuestions]);
  const slowestQuestion = useMemo(() => {
    const timed = answeredQuestions.filter(q => Number(q.timeTaken || 0) > 0).sort((a, b) => b.timeTaken - a.timeTaken);
    return timed[0] || null;
  }, [answeredQuestions]);

  // Next step text
  const nextStepText = useMemo(() => {
    if (skippedQuestions.length > 0 && weakAnswers === 0)
      return `You skipped ${skippedQuestions.length} question${skippedQuestions.length > 1 ? 's' : ''} — a full pass at your current pace would likely raise this score.`;
    if (weakestTopic && weakAnswers > 0)
      return `${weakAnswers} answer${weakAnswers > 1 ? 's' : ''} scored below 60, concentrated in ${weakestTopic.topic}. Start your next rep there.`;
    if (strongAnswers === evaluatedQuestions.length && evaluatedQuestions.length > 0)
      return `Every evaluated answer scored 80+. Raise the difficulty next time to keep the signal useful.`;
    return 'Review the answers below, then queue another session to build on this one.';
  }, [skippedQuestions.length, weakAnswers, weakestTopic, strongAnswers, evaluatedQuestions.length]);

  // Copy summary
  const handleCopy = useCallback(async () => {
    const lines = [
      `MockMate result: ${totalScore}/100 — ${getLabel(totalScore)}`,
      `${answeredQuestions.length}/${normalizedQuestions.length} answered`,
      `${strongAnswers} strong · ${weakAnswers} need work · ${skippedQuestions.length} skipped`,
      strongestTopic ? `Strongest: ${strongestTopic.topic} (${strongestTopic.avg}/100)` : '',
      weakestTopic   ? `Focus area: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }, [totalScore, answeredQuestions.length, normalizedQuestions.length, strongAnswers, weakAnswers, skippedQuestions.length, strongestTopic, weakestTopic]);

  // Build result object for hero / MiniScoreCard
  const heroResult = {
    score: totalScore,
    sessionId,
    totalQuestions:    normalizedQuestions.length,
    answeredQuestions: answeredQuestions.length,
    skippedQuestions:  skippedQuestions.length,
    strongAnswers,
    weakAnswers,
    averageTime,
    strongestTopic: strongestTopic || { topic: '—', avg: 0 },
    weakestTopic:   weakestTopic   || { topic: '—', avg: 0 },
    topicAverages,
    trend:       result?.trend ?? 'up',
    trendDelta:  result?.trendDelta ?? 0,
    archetype:   result?.archetype  ?? '',
    tier:        result?.tier       ?? '₹6–12 LPA',
    scoreHistory: result?.scoreHistory ?? [],
  };

  if (!result) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 6% -4%, rgba(0,87,232,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,194,232,0.04) 0%, transparent 40%), ${C.paper}`,
      padding: '24px 28px 80px',
      fontFamily: F.body,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes heroSweep { 0% { transform: translateX(-30%); } 100% { transform: translateX(130%); } }
        * { box-sizing: border-box; }
        .result-dna-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        .result-grid-2    { display: grid; grid-template-columns: 1fr 1fr; }
        @media (max-width: 900px) {
          .result-dna-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .result-grid-2   { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 580px) {
          .result-dna-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Status strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', marginBottom: 20, borderRadius: 11,
          background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
            <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted, letterSpacing: '0.3px' }}>
              mockmate · post-interview debrief
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {sessionId && <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>session {sessionId}</span>}
            <span style={{ color: C.lineMd }}>·</span>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase()}
            </span>
          </div>
        </div>

        {/* 1 ─ HERO (UNCHANGED) */}
        <ResultHero result={heroResult} mounted={mounted} onCopy={handleCopy} copied={copied} onNavigate={navigate} />

        {/* 2 ─ NEXT STEP BANNER (UNCHANGED) */}
        <NextStepBanner nextStepText={nextStepText} />

        {/* 3 ─ MINI SCORECARD (UNCHANGED) */}
        <MiniScoreCard result={heroResult} mounted={mounted} />

        {/* ── SECTIONS RESTORED FROM v4 ───────────────────────────────────── */}

        {/* 4 ─ SESSION DNA */}
        <SessionDNA
          topicAverages={topicAverages}
          strongCount={strongAnswers}
          weakCount={weakAnswers}
          totalAnswered={answeredQuestions.length}
          totalQuestions={normalizedQuestions.length}
        />

        {/* 5 ─ READOUT + DISTRIBUTION */}
        <div className="result-grid-2" style={{ gap: 14, marginBottom: 18 }}>
          <Card delay={0.05}>
            <SectionLabel>your readout</SectionLabel>
            <h2 style={{ margin: '0 0 4px', fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink }}>Session at a glance</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
              The fastest summary of what this session says about your current form.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Insight label="overall"      value={`${totalScore}/100`}            text={`${getLabel(totalScore)} session`}       color={scoreColor(totalScore)} background={scoreTint(totalScore)} />
              <Insight label="question avg" value={`${averageQuestionScore}/100`}  text="Across evaluated answers"                color={C.signal}              background={C.signalTint} />
              <Insight label="strongest"    value={strongestTopic?.topic || '—'}   text={strongestTopic ? `${strongestTopic.avg}/100 avg` : 'No topic data'} color={C.green} background={C.greenTint} />
              <Insight label="next focus"   value={weakestTopic?.topic   || '—'}   text={weakestTopic   ? `${weakestTopic.avg}/100 avg`   : 'No topic data'} color={C.amber} background={C.amberTint} />
            </div>
          </Card>

          <Card delay={0.1}>
            <SectionLabel>distribution</SectionLabel>
            <h2 style={{ margin: '0 0 4px', fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink }}>Score spread</h2>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
              How your evaluated answers were distributed across bands.
            </p>
            <ScoreDistribution questions={normalizedQuestions} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, letterSpacing: '0.8px', marginBottom: 5 }}>fastest</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{fastestQuestion ? `Q${fastestQuestion.index + 1} · ${formatTime(fastestQuestion.timeTaken)}` : '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, letterSpacing: '0.8px', marginBottom: 5 }}>slowest</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{slowestQuestion ? `Q${slowestQuestion.index + 1} · ${formatTime(slowestQuestion.timeTaken)}` : '—'}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* 6 ─ SCORE PROGRESSION + TOPIC PERFORMANCE */}
        <div className="result-grid-2" style={{ gap: 14, marginBottom: 18 }}>
          <Card delay={0.05}>
            <SectionLabel>score progression</SectionLabel>
            <h2 style={{ margin: '0 0 4px', fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink }}>Answer-by-answer curve</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
              How your score moved from question to question across the session.
            </p>
            <ScoreProgression questions={normalizedQuestions} />
          </Card>

          <Card delay={0.1}>
            <SectionLabel>topic performance</SectionLabel>
            <h2 style={{ margin: '0 0 4px', fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink }}>Where to drill next</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
              Where you were strongest, and where the next rep should go.
            </p>
            <TopicPerformance topicAverages={topicAverages} />
          </Card>
        </div>

        {/* 7 ─ STREAK / BADGES */}
        <StreakBadgesCard streak={streak} newBadges={newBadges} />

        {/* 8 ─ QUESTION-BY-QUESTION REVIEW */}
        <QuestionReview questions={normalizedQuestions} sessionId={sessionId} />

        {/* 9 ─ SCORECARD (Mission Report component) */}
        <Card style={{ marginBottom: 18 }} delay={0.05}>
          <SectionLabel>mission report</SectionLabel>
          <ScoreCard totalScore={totalScore} questions={normalizedQuestions} />
        </Card>

        {/* 10 ─ CTA BANNER */}
        <CtaBanner weakestTopic={weakestTopic} onNavigate={navigate} />

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 6,
          padding: '16px 4px 0', opacity: 0.38,
          fontFamily: F.mono, fontSize: 9, color: C.sub, letterSpacing: '0.4px',
        }}>
          <span>mockmate result page · v5</span>
          <span>scores normalized 0–100 · irs computed post-session</span>
        </div>
      </div>
    </div>
  );
};

export default Result;
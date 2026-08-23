import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreCard from '../components/ScoreCard';
import { retryQuestion } from '../Services/interviewService';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKMATE — RESULT / POST-INTERVIEW DEBRIEF (v4)
// Enhancements: polished hero gradient, improved KPI tiles, session DNA
// ribbon, refined question card expand UX, mission-report ScoreCard.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  page:     '#F2F5FB',

  white:      '#FFFFFF',
  surface:    '#FBFCFE',
  surfaceAlt: '#F6F9FD',

  ink:  '#0B1730',
  text: '#0E1E38',
  sub:  '#4A5E78',
  muted:'#7A8EA6',
  faint:'#A8B7CB',

  line:      '#DDE5F0',
  lineStrong:'#C8D4E4',

  blue:     '#1E67FF',
  blueDark: '#0845C2',
  blueSoft: '#EDF4FF',
  blueSoft2:'#E0ECFF',
  blueMid:  '#3B7FFF',

  cyan:    '#10B8D8',
  cyanSoft:'#E8FAFD',

  green:    '#0B9268',
  greenSoft:'#E7F8F2',
  greenMid: '#0FAE7E',

  amber:    '#C97D10',
  amberSoft:'#FFF5E5',
  amberMid: '#E08E1A',

  red:    '#CE4545',
  redSoft:'#FFF0F0',
  redMid: '#E05050',

  navy:'#09265F',

  shadowXs:'0 2px 8px rgba(14,30,56,0.04)',
  shadowSm:'0 4px 16px rgba(14,30,56,0.06)',
  shadow:  '0 8px 28px rgba(14,30,56,0.09)',
  shadowMd:'0 14px 40px rgba(14,30,56,0.10)',
  shadowLg:'0 24px 64px rgba(14,30,56,0.13)',
};

const F = {
  display:"'Plus Jakarta Sans', 'Inter', sans-serif",
  body:   "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:   "'JetBrains Mono', 'SFMono-Regular', monospace",
};

// ─── Animation variants ─────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } },
};
const fadeUpStagger = (delay = 0) => ({
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay } },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));

const scoreColor = score => {
  const n = clamp(score);
  if (n >= 80) return C.green;
  if (n >= 60) return C.blue;
  if (n >= 40) return C.amber;
  return C.red;
};
const scoreSoft = score => {
  const n = clamp(score);
  if (n >= 80) return C.greenSoft;
  if (n >= 60) return C.blueSoft;
  if (n >= 40) return C.amberSoft;
  return C.redSoft;
};
const formatTime = seconds => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
};
const getPerformanceLabel = score => {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Solid';
  if (score >= 60) return 'Developing';
  return 'Needs Practice';
};
const getPerformanceMessage = score => {
  if (score >= 90) return { eyebrow: 'OUTSTANDING SESSION', title: 'You looked placement-ready.', text: 'Excellent overall execution. Preserve this level while increasing consistency on your weakest topics.', icon: '✦' };
  if (score >= 80) return { eyebrow: 'STRONG SESSION', title: 'You are building reliable interview form.', text: 'Your fundamentals are landing well. The fastest gains now come from tightening weak spots rather than adding random topics.', icon: '↗' };
  if (score >= 60) return { eyebrow: 'DEVELOPING SESSION', title: 'The foundation is there.', text: 'You have enough signal to improve quickly. Focus on the questions where technical depth or clarity dropped.', icon: '◐' };
  return { eyebrow: 'PRACTICE SESSION', title: 'This session exposed useful gaps.', text: 'Treat the result as a diagnostic. The weak answers are the roadmap for your next practice round.', icon: '◔' };
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

// ─── Feedback normalization ──────────────────────────────────────────────────
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
  const aiFeedback  = normalizeFeedback(question);
  const scoreValue  = typeof question?.score === 'number' ? question.score : Number(question?.score || 0);
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

// ─── Primitives ──────────────────────────────────────────────────────────────
const Eyebrow = ({ children, color = C.blue }) => (
  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle, action }) => (
  <motion.div
    variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 20, flexWrap: 'wrap' }}
  >
    <div>
      <h2 style={{ margin: 0, color: C.text, fontFamily: F.display, fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.25 }}>{title}</h2>
      {subtitle && <p style={{ margin: '5px 0 0', color: C.muted, fontFamily: F.body, fontSize: 12, lineHeight: 1.65, maxWidth: 560 }}>{subtitle}</p>}
    </div>
    {action}
  </motion.div>
);

const Pill = ({ children, color = C.blue, background = C.blueSoft, border = C.lineStrong }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 10px',
    background, border: `1px solid ${border}`, color,
    fontFamily: F.mono, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.6px',
  }}>
    {children}
  </span>
);

// ─── Hero gauge ───────────────────────────────────────────────────────────────
const HeroGauge = ({ score, mounted }) => {
  const size = 200, center = size / 2, radius = 76;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamp(score) / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#5599FF" />
            <stop offset="100%" stopColor="#10B8D8" />
          </linearGradient>
          <filter id="gaugeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10" />
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? dashOffset : circumference}
          filter="url(#gaugeGlow)"
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: F.display, fontSize: 52, lineHeight: 1, fontWeight: 900, color: '#fff', letterSpacing: '-3px' }}>{Math.round(score)}</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, marginTop: 5, color: 'rgba(255,255,255,0.45)', letterSpacing: '1px' }}>/ 100</div>
        <div style={{ marginTop: 9, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1px', color: '#18C8E8' }}>
          {getPerformanceLabel(score).toUpperCase()}
        </div>
      </div>
    </div>
  );
};

// ─── KPI tile ─────────────────────────────────────────────────────────────────
const Kpi = ({ icon, label, value, helper, color, background, delay = 0 }) => (
  <motion.div
    variants={fadeUpStagger(delay)} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
    className="result-kpi"
    style={{
      background: C.white, border: `1.5px solid ${C.line}`, borderRadius: 18,
      padding: '18px 20px 16px', boxShadow: C.shadowSm,
      display: 'flex', flexDirection: 'column', gap: 0,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{icon}</div>
      <span style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, letterSpacing: '1.2px', paddingTop: 2 }}>SESSION</span>
    </div>
    <div style={{ marginTop: 14, fontFamily: F.display, fontSize: 30, fontWeight: 900, lineHeight: 1, color: C.text, letterSpacing: '-1px' }}>{value}</div>
    <div style={{ marginTop: 6, fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.sub }}>{label}</div>
    {helper && <div style={{ marginTop: 3, fontFamily: F.body, fontSize: 10.5, color: C.muted, lineHeight: 1.4 }}>{helper}</div>}
  </motion.div>
);

// ─── Score distribution ─────────────────────────────────────────────────────
const ScoreDistribution = ({ questions }) => {
  const buckets = [
    { label: 'Strong',     range: '80–100', count: questions.filter(q => q.score >= 80).length, color: C.green },
    { label: 'Solid',      range: '60–79',  count: questions.filter(q => q.score >= 60 && q.score < 80).length, color: C.blue },
    { label: 'Needs work', range: '0–59',   count: questions.filter(q => q.score < 60 && !q.skipped).length, color: C.red },
  ];
  const answered = questions.filter(q => !q.skipped).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {buckets.map(bucket => {
        const pct = answered ? Math.round((bucket.count / answered) * 100) : 0;
        return (
          <div key={bucket.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: bucket.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{bucket.label}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{bucket.range}</span>
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: bucket.color }}>{bucket.count}</span>
            </div>
            <div style={{ height: 7, background: C.surfaceAlt, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: bucket.color, transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Topic performance ──────────────────────────────────────────────────────
const TopicPerformance = ({ topicAverages }) => {
  const sorted = [...topicAverages].sort((a, b) => b.avg - a.avg);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sorted.length ? sorted.map(item => {
        const color = scoreColor(item.avg);
        return (
          <div key={item.topic}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, minWidth: 0 }}>{item.topic}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color, fontWeight: 700, flexShrink: 0 }}>{item.avg}/100</div>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: C.surfaceAlt, overflow: 'hidden' }}>
              <div style={{ width: `${item.avg}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .9s ease' }} />
            </div>
          </div>
        );
      }) : (
        <div style={{ padding: '28px 10px', color: C.muted, fontSize: 12, textAlign: 'center' }}>Topic-level scoring is not available for this session.</div>
      )}
    </div>
  );
};

// ─── Score progression chart ─────────────────────────────────────────────────
const ScoreProgression = ({ questions }) => {
  const points = questions
    .filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === 'number')
    .map(q => q.aiFeedback.score);

  if (points.length < 2) return (
    <div style={{ padding: 28, borderRadius: 14, background: C.surfaceAlt, color: C.muted, fontSize: 12, textAlign: 'center' }}>
      At least two evaluated questions are needed to show progression.
    </div>
  );

  const W = 720, H = 200, padX = 28, padY = 20;
  const x = i => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = v => H - padY - (clamp(v) / 100) * (H - padY * 2);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L ${x(points.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480, display: 'block' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.blue} stopOpacity="0.14" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 60, 80].map(l => (
          <g key={l}>
            <line x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} stroke={C.line} strokeDasharray="4 5" />
            <text x={4} y={y(l) + 3} fontSize="8.5" fontFamily={F.mono} fill={C.faint}>{l}</text>
          </g>
        ))}
        <path d={area} fill="url(#areaGrad)" />
        <path d={path} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r="5" fill={scoreColor(v)} stroke="#fff" strokeWidth="2" />
            <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>Q{i + 1}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ─── Question card ────────────────────────────────────────────────────────────
const toneColor = tone => tone === 'good' ? C.green : tone === 'bad' ? C.red : C.sub;

const QuestionCard = ({ question, open, onToggle, onRetry, retrying }) => {
  const index     = question._index;
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

  const badgeBg = question.skipped ? C.surfaceAlt
    : objective
      ? (feedback?.correct === true ? C.greenSoft : feedback?.correct === false ? C.redSoft : C.surfaceAlt)
      : (isEval ? scoreSoft(score) : C.surfaceAlt);

  return (
    <div
      className="result-question"
      style={{
        border: `1.5px solid ${open ? C.lineStrong : C.line}`,
        borderRadius: 16,
        background: open ? C.surface : C.white,
        boxShadow: open ? C.shadowSm : C.shadowXs,
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Toggle button */}
        <button
          type="button"
          className="result-card-toggle"
          onClick={() => onToggle(index)}
          aria-expanded={open}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 8px 14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
        >
          {/* Score badge */}
          <div style={{
            flexShrink: 0, width: 48, height: 48, borderRadius: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            background: badgeBg, color: badgeColor, border: `1.5px solid ${badgeColor}22`,
          }}>
            {question.skipped
              ? <span style={{ fontSize: 16, fontWeight: 800 }}>—</span>
              : objective
                ? <span style={{ fontSize: 20, fontWeight: 900 }}>{feedback?.correct === true ? '✓' : feedback?.correct === false ? '×' : '?'}</span>
                : isEval
                  ? <>
                      <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{score}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 7, opacity: 0.7, marginTop: 1 }}>/100</span>
                    </>
                  : <span style={{ fontSize: 14, fontWeight: 800 }}>—</span>
            }
          </div>

          {/* Text */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.faint, letterSpacing: '0.5px' }}>Q{index + 1}</span>
              <span style={{ color: C.line }}>·</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.sub }}>{question.topic}</span>
              {hasTime && <>
                <span style={{ color: C.line }}>·</span>
                <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>◷ {formatTime(question.timeTaken)}</span>
              </>}
              {question.skipped && <Pill color={C.amber} background={C.amberSoft} border="#F0CB78">SKIPPED</Pill>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
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
          className="result-card-chevron"
          onClick={() => onToggle(index)}
          aria-expanded={open}
          aria-label={open ? `Collapse Q${index + 1}` : `Expand Q${index + 1}`}
          style={{ flexShrink: 0, width: 46, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint }}
        >
          <span style={{ display: 'inline-block', fontSize: 12, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>▾</span>
        </button>
      </div>

      {/* Progress hairline */}
      {!question.skipped && (
        <div style={{ height: 2.5, background: C.surfaceAlt }}>
          <div style={{
            width: objective ? (feedback?.correct !== null ? '100%' : '0%') : `${score || 0}%`,
            height: '100%', background: badgeColor, opacity: 0.45, transition: 'width 0.7s ease',
          }} />
        </div>
      )}

      {/* Expanded body */}
      <div style={{ maxHeight: open ? 1400 : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s ease' }}>
        <div style={{ padding: '6px 18px 18px' }}>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: C.text, fontWeight: 700, marginBottom: 12 }}>{question.text}</div>

          {question.userAnswer && !question.skipped && question.userAnswer !== 'Skipped' && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: C.surfaceAlt, border: `1px solid ${C.line}`, marginBottom: 12 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, letterSpacing: '.9px', textTransform: 'uppercase', marginBottom: 6 }}>Your answer</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: C.sub, whiteSpace: 'pre-wrap' }}>{question.userAnswer}</div>
            </div>
          )}

          {question.skipped && (
            <div style={{ padding: '11px 14px', borderRadius: 12, background: C.amberSoft, border: '1px solid #EEC96A', color: '#7A4D08', fontSize: 11.5, lineHeight: 1.55, marginBottom: 12 }}>
              You skipped this question. Use this as a pacing signal rather than a failure.
            </div>
          )}

          {objective && isEval && (
            <div style={{ padding: '11px 14px', border: `1px solid ${C.line}`, borderRadius: 12, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, letterSpacing: '0.6px' }}>RESULT</span>
              <strong style={{ color: badgeColor, fontSize: 13 }}>{feedback?.correct ? 'Correct' : 'Incorrect'}</strong>
            </div>
          )}

          {objective && feedback?.raw && (
            <div style={{ padding: 13, borderRadius: 12, background: C.surfaceAlt, border: `1px solid ${C.line}`, color: C.sub, fontSize: 12.5, lineHeight: 1.6, wordBreak: 'break-word', marginBottom: 12 }}>{feedback.raw}</div>
          )}

          {!objective && isEval && feedback && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="result-feedback-grid">
              <FeedbackBlock label="What worked"     value={feedback.good}      color={C.green} background={C.greenSoft} />
              <FeedbackBlock label="What was missing" value={feedback.missing}  color={C.red}   background={C.redSoft} />
              <FeedbackBlock label="Key idea"         value={feedback.idealHint} color={C.blue}  background={C.blueSoft} />
              <FeedbackBlock label="Next move"        value={feedback.tip}       color={C.amber} background={C.amberSoft} />
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: '1 / -1', padding: 13, borderRadius: 12, background: C.surfaceAlt, border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, letterSpacing: '.9px', textTransform: 'uppercase', marginBottom: 6 }}>Better answer pattern</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: C.text }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {canRetry && onRetry && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => onRetry(question.id)}
                disabled={retrying}
                className="result-retry-btn"
                style={{
                  padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${C.lineStrong}`,
                  background: retrying ? C.surfaceAlt : C.white,
                  color: retrying ? C.muted : C.blue,
                  fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px',
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

// ─── Card wrapper ─────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, delay = 0 }) => (
  <motion.div
    variants={fadeUpStagger(delay)} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
    style={{ background: C.white, border: `1.5px solid ${C.line}`, borderRadius: 22, padding: 24, boxShadow: C.shadowSm, ...style }}
  >
    {children}
  </motion.div>
);

// ─── Insight tile ─────────────────────────────────────────────────────────────
const Insight = ({ label, value, text, color, background }) => (
  <div style={{ padding: 15, borderRadius: 14, background, border: `1.5px solid ${color}1E` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ marginTop: 8, fontFamily: F.display, fontSize: 19, fontWeight: 900, color: C.text, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    <div style={{ marginTop: 4, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{text}</div>
  </div>
);

// ─── Feedback block ───────────────────────────────────────────────────────────
const FeedbackBlock = ({ label, value, color, background }) => (
  <div style={{ padding: 13, borderRadius: 12, background, border: `1.5px solid ${color}1E` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color, letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 11.5, lineHeight: 1.6, color: C.text }}>{value || 'No additional readout.'}</div>
  </div>
);

// ─── Session DNA ribbon ───────────────────────────────────────────────────────
// A compact at-a-glance strip sitting just below the hero KPIs
const SessionDNA = ({ topicAverages, strongCount, weakCount, totalAnswered, totalQuestions }) => {
  if (!topicAverages.length) return null;
  const best  = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const worst = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];
  const completion = totalQuestions ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  const items = [
    { icon: '🏆', label: 'Top topic',  value: best.topic,  sub: `${best.avg}/100` },
    { icon: '📈', label: 'Focus area', value: worst.topic, sub: `${worst.avg}/100` },
    { icon: '✅', label: 'Completion', value: `${completion}%`, sub: `${totalAnswered}/${totalQuestions}` },
    { icon: '🔥', label: 'Strong rate', value: `${totalAnswered ? Math.round((strongCount / totalAnswered) * 100) : 0}%`, sub: `${strongCount} of ${totalAnswered}` },
  ];

  return (
    <motion.div
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14,
      }}
      className="result-dna-grid"
    >
      {items.map(item => (
        <div key={item.label} style={{
          background: C.white, border: `1.5px solid ${C.line}`, borderRadius: 14,
          padding: '12px 14px', boxShadow: C.shadowXs,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.muted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{item.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.blue, fontWeight: 700 }}>{item.sub}</div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Main Result component ────────────────────────────────────────────────────
const Result = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const result    = location.state?.result;

  const [mounted, setMounted]     = useState(false);
  const [expanded, setExpanded]   = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]       = useState('');
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    if (!result) { navigate('/'); return; }
    const id = requestAnimationFrame(() => setTimeout(() => setMounted(true), 40));
    return () => cancelAnimationFrame(id);
  }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  const [normalizedQuestionsState, setNormalizedQuestionsState] = useState([]);
  const [retryingId, setRetryingId] = useState(null);

  const normalizedQuestions = useMemo(() => {
    const base = questions.map((q, i) => normalizeQuestion(q, i));
    if (!normalizedQuestionsState.length) return base;
    return base.map(q => {
      const override = normalizedQuestionsState.find(o => o.id === q.id);
      return override ? { ...q, score: override.score, aiFeedback: override.aiFeedback } : q;
    });
  }, [questions, normalizedQuestionsState]);

  const handleRetryQuestion = useCallback(async questionId => {
    if (!sessionId || !questionId || retryingId) return;
    setRetryingId(questionId);
    try {
      const data = await retryQuestion(sessionId, questionId);
      const parsedFeedback = normalizeFeedback({ feedback: data?.feedback, score: data?.score });
      setNormalizedQuestionsState(prev => [
        ...prev.filter(q => q.id !== questionId),
        { id: questionId, score: clamp(Number(data?.score) || 0), aiFeedback: parsedFeedback },
      ]);
    } catch (err) { console.error('Retry failed:', err); }
    finally { setRetryingId(null); }
  }, [sessionId, retryingId]);

  const evaluatedQuestions  = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === 'number'), [normalizedQuestions]);
  const skippedQuestions    = useMemo(() => normalizedQuestions.filter(q => q.skipped), [normalizedQuestions]);
  const answeredQuestions   = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== 'Skipped'), [normalizedQuestions]);
  const strongQuestions     = evaluatedQuestions.filter(q => q.aiFeedback.score >= 80).length;
  const improvementQuestions= evaluatedQuestions.filter(q => q.aiFeedback.score < 60).length;

  const averageQuestionScore = evaluatedQuestions.length
    ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + q.aiFeedback.score, 0) / evaluatedQuestions.length)
    : totalScore;

  const averageTime = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0) / answeredQuestions.length)
    : 0;

  const topicAverages = useMemo(() => {
    const map = {};
    normalizedQuestions.forEach(q => {
      if (q.skipped || typeof q.aiFeedback?.score !== 'number') return;
      const topic = q.topic || 'General';
      if (!map[topic]) map[topic] = { total: 0, count: 0 };
      map[topic].total += q.aiFeedback.score;
      map[topic].count += 1;
    });
    return Object.entries(map).map(([topic, data]) => ({ topic, avg: Math.round(data.total / data.count) }));
  }, [normalizedQuestions]);

  const strongestTopic = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const weakestTopic   = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

  const fastestQuestion = useMemo(() => {
    const timed = answeredQuestions.filter(q => Number(q.timeTaken || 0) > 0).sort((a, b) => a.timeTaken - b.timeTaken);
    return timed[0] || null;
  }, [answeredQuestions]);

  const slowestQuestion = useMemo(() => {
    const timed = answeredQuestions.filter(q => Number(q.timeTaken || 0) > 0).sort((a, b) => b.timeTaken - a.timeTaken);
    return timed[0] || null;
  }, [answeredQuestions]);

  const nextStepText = useMemo(() => {
    if (skippedQuestions.length > 0 && improvementQuestions === 0)
      return `You skipped ${skippedQuestions.length} question${skippedQuestions.length > 1 ? 's' : ''} — a full pass at your current pace would likely raise this score.`;
    if (weakestTopic && improvementQuestions > 0)
      return `${improvementQuestions} answer${improvementQuestions > 1 ? 's' : ''} scored below 60, concentrated in ${weakestTopic.topic}. Start your next rep there.`;
    if (strongestTopic && strongQuestions === evaluatedQuestions.length && evaluatedQuestions.length > 0)
      return `Every evaluated answer scored 80+. Raise the difficulty next time to keep the signal useful.`;
    return 'Review the answers below, then queue another session to build on this one.';
  }, [skippedQuestions.length, improvementQuestions, weakestTopic, strongestTopic, strongQuestions, evaluatedQuestions.length]);

  const performance      = getPerformanceMessage(totalScore);
  const performanceLabel = getPerformanceLabel(totalScore);

  const filters = [
    { key: 'all',     label: `All · ${normalizedQuestions.length}` },
    { key: 'strong',  label: `Strong · ${strongQuestions}` },
    { key: 'weak',    label: `Needs work · ${improvementQuestions}` },
    { key: 'skipped', label: `Skipped · ${skippedQuestions.length}` },
  ];

  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedQuestions
      .map((q, i) => ({ ...q, _index: i }))
      .filter(q => {
        if (activeFilter === 'strong'  && (!q.aiFeedback || q.aiFeedback.score < 80))  return false;
        if (activeFilter === 'weak'    && (q.skipped || !q.aiFeedback || q.aiFeedback.score >= 60)) return false;
        if (activeFilter === 'skipped' && !q.skipped) return false;
        if (needle) { const hay = `${q.text} ${q.topic} ${q.userAnswer}`.toLowerCase(); if (!hay.includes(needle)) return false; }
        return true;
      });
  }, [normalizedQuestions, activeFilter, search]);

  const toggleExpand = useCallback(index => {
    setExpanded(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleCopySummary = useCallback(async () => {
    const lines = [
      `MockMate result: ${totalScore}/100 — ${performanceLabel}`,
      `${answeredQuestions.length}/${normalizedQuestions.length} answered`,
      `${strongQuestions} strong · ${improvementQuestions} need work · ${skippedQuestions.length} skipped`,
      strongestTopic ? `Strongest: ${strongestTopic.topic} (${strongestTopic.avg}/100)` : '',
      weakestTopic   ? `Focus area: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }, [totalScore, performanceLabel, answeredQuestions.length, normalizedQuestions.length, strongQuestions, improvementQuestions, skippedQuestions.length, strongestTopic, weakestTopic]);

  if (!result) return null;

  return (
    <div
      className="result-page"
      style={{
        minHeight: 'calc(100vh - 64px)',
        background: `radial-gradient(ellipse 900px 500px at 0% 0%, rgba(30,103,255,0.07), transparent),
                     radial-gradient(ellipse 700px 400px at 100% 5%, rgba(16,184,216,0.06), transparent),
                     ${C.page}`,
        padding: '28px 20px 80px',
        fontFamily: F.body,
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .result-page { color: ${C.text}; }
        .result-shell { max-width: 1160px; margin: 0 auto; }

        .result-btn { transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
        .result-btn:hover { transform: translateY(-2px); }
        .result-btn:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .result-btn-primary:hover { box-shadow: 0 14px 36px rgba(30,103,255,.32) !important; }

        .result-card-toggle, .result-card-chevron { transition: background .15s ease; }
        .result-card-toggle:hover, .result-card-chevron:hover { background: rgba(30,103,255,0.04) !important; }
        .result-card-toggle:focus-visible, .result-card-chevron:focus-visible { outline: 2px solid ${C.blue}; outline-offset: -2px; }

        .result-filter { transition: all .15s ease; }
        .result-filter:hover { border-color: ${C.blue} !important; color: ${C.blue} !important; }
        .result-filter:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }

        .result-retry-btn:hover:not(:disabled) { background: ${C.blueSoft} !important; border-color: ${C.blue} !important; }

        input { transition: border-color .15s ease, box-shadow .15s ease; }
        input:focus-visible { outline: none !important; border-color: ${C.blue} !important; box-shadow: 0 0 0 3px ${C.blueSoft} !important; }

        @media (max-width: 900px) {
          .result-hero { grid-template-columns: 1fr !important; text-align: center; }
          .result-hero-score { justify-content: center !important; }
          .result-hero-content { align-items: center !important; }
          .result-hero-actions { justify-content: center !important; }
          .result-grid-2 { grid-template-columns: 1fr !important; }
          .result-dna-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 700px) {
          .result-page { padding: 16px 14px 60px !important; }
          .result-kpis { grid-template-columns: repeat(2, 1fr) !important; }
          .result-actions { flex-direction: column !important; }
          .result-actions button { width: 100% !important; }
          .result-review-controls { flex-direction: column !important; align-items: stretch !important; }
          .result-review-controls input { width: 100% !important; }
        }
        @media (max-width: 460px) {
          .result-kpis { grid-template-columns: 1fr !important; }
          .result-hero-panel { padding: 22px 18px !important; border-radius: 22px !important; }
          .result-feedback-grid { grid-template-columns: 1fr !important; }
          .result-dna-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .result-page * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <motion.div
        className="result-shell"
        initial={{ opacity: 0, y: 10 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* ── PAGE HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <Eyebrow>Post-Interview Debrief</Eyebrow>
            <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.15, color: C.text }}>
              Your interview report
            </h1>
          </div>
          <Pill>READINESS ENGINE</Pill>
        </div>

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          className="result-hero-panel"
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 28,
            padding: '32px 28px', marginBottom: 14,
            background: 'linear-gradient(140deg, #081E52 0%, #0C49C0 52%, #0FAED4 100%)',
            boxShadow: '0 28px 72px rgba(8, 49, 115, .24)',
          }}
        >
          {/* Orbs */}
          <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', right: -160, top: -200, background: 'radial-gradient(circle, rgba(255,255,255,.09), transparent 68%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', left: -70, bottom: -100, background: 'radial-gradient(circle, rgba(16,184,216,.18), transparent 70%)', pointerEvents: 'none' }} />
          {/* Subtle grid texture */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

          <div className="result-hero" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, alignItems: 'center' }}>
            <div className="result-hero-score" style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <HeroGauge score={totalScore} mounted={mounted} />
            </div>

            <div className="result-hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '2px', color: 'rgba(255,255,255,.6)', marginBottom: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#18C8E8', boxShadow: '0 0 8px #18C8E8' }} />
                {performance.eyebrow}
              </div>

              <h2 style={{ margin: 0, color: '#fff', fontFamily: F.display, fontSize: 'clamp(20px, 3.2vw, 32px)', fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.8px', maxWidth: 700 }}>
                {performance.icon} {performance.title}
              </h2>

              <p style={{ margin: '12px 0 0', maxWidth: 660, color: 'rgba(255,255,255,.7)', fontSize: 13.5, lineHeight: 1.8 }}>{performance.text}</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                <Pill color="#fff" background="rgba(255,255,255,.11)" border="rgba(255,255,255,.22)">{performanceLabel.toUpperCase()}</Pill>
                {strongestTopic && <Pill color="#D8F8FF" background="rgba(16,184,216,.13)" border="rgba(16,184,216,.28)">STRONGEST · {strongestTopic.topic}</Pill>}
                {weakestTopic   && <Pill color="#FFE8C4" background="rgba(215,134,20,.11)" border="rgba(215,134,20,.26)">FOCUS · {weakestTopic.topic}</Pill>}
              </div>

              <div className="result-hero-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                <button className="result-btn result-btn-primary" onClick={() => navigate('/interview')}
                  style={{ border: 'none', borderRadius: 12, background: '#fff', color: C.blueDark, padding: '12px 20px', fontFamily: F.body, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 22px rgba(0,0,0,.16)' }}>
                  Try again →
                </button>
                <button className="result-btn" onClick={() => navigate('/dashboard')}
                  style={{ border: '1px solid rgba(255,255,255,.24)', borderRadius: 12, background: 'rgba(255,255,255,.09)', color: '#fff', padding: '12px 20px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  ← Dashboard
                </button>
                <button className="result-btn" onClick={handleCopySummary}
                  style={{ border: '1px solid rgba(255,255,255,.24)', borderRadius: 12, background: 'rgba(255,255,255,.09)', color: '#fff', padding: '12px 20px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  {copied ? '✓ Copied' : '⧉ Copy summary'}
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── KPI ROW ── */}
        <section className="result-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
          <Kpi icon="✓"  label="Answered"       value={`${answeredQuestions.length}/${normalizedQuestions.length}`} helper="Questions completed"      color={C.green} background={C.greenSoft} delay={0.05} />
          <Kpi icon="↗"  label="Strong answers"  value={strongQuestions}       helper="Scores of 80 or higher"      color={C.blue}  background={C.blueSoft}  delay={0.10} />
          <Kpi icon="!"   label="Needs work"      value={improvementQuestions}  helper="Scores below 60"             color={C.red}   background={C.redSoft}   delay={0.15} />
          <Kpi icon="◷"  label="Average time"    value={formatTime(averageTime)} helper="Per answered question"     color={C.sub}   background={C.surfaceAlt} delay={0.20} />
        </section>

        {/* ── SESSION DNA ── */}
        <SessionDNA
          topicAverages={topicAverages}
          strongCount={strongQuestions}
          weakCount={improvementQuestions}
          totalAnswered={answeredQuestions.length}
          totalQuestions={normalizedQuestions.length}
        />

        {/* ── READOUT + DISTRIBUTION ── */}
        <section className="result-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 12, marginBottom: 14 }}>
          <Card delay={0.05}>
            <SectionTitle title="Your readout" subtitle="The fastest summary of what this session says about your current form." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Insight label="Overall"       value={`${totalScore}/100`}         text={`${performanceLabel} session`}          color={scoreColor(totalScore)} background={scoreSoft(totalScore)} />
              <Insight label="Question avg"  value={`${averageQuestionScore}/100`} text="Across evaluated answers"              color={C.blue}                background={C.blueSoft} />
              <Insight label="Strongest"     value={strongestTopic?.topic || '—'} text={strongestTopic ? `${strongestTopic.avg}/100 avg` : 'No topic data'} color={C.green} background={C.greenSoft} />
              <Insight label="Next focus"    value={weakestTopic?.topic   || '—'} text={weakestTopic   ? `${weakestTopic.avg}/100 avg`   : 'No topic data'} color={C.amber} background={C.amberSoft} />
            </div>
          </Card>

          <Card delay={0.1}>
            <SectionTitle title="Score distribution" subtitle="How your evaluated answers were distributed." />
            <ScoreDistribution questions={normalizedQuestions} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Fastest</div>
                <div style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: C.text }}>{fastestQuestion ? `Q${fastestQuestion.index + 1} · ${formatTime(fastestQuestion.timeTaken)}` : '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Slowest</div>
                <div style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: C.text }}>{slowestQuestion ? `Q${slowestQuestion.index + 1} · ${formatTime(slowestQuestion.timeTaken)}` : '—'}</div>
              </div>
            </div>
          </Card>
        </section>

        {/* ── TREND + TOPIC ── */}
        <section className="result-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 12, marginBottom: 14 }}>
          <Card delay={0.05}>
            <SectionTitle title="Score progression" subtitle="Your score as the interview moved from question to question." />
            <ScoreProgression questions={normalizedQuestions} />
          </Card>
          <Card delay={0.1}>
            <SectionTitle title="Topic performance" subtitle="Where you were strongest and where the next rep should go." />
            <TopicPerformance topicAverages={topicAverages} />
          </Card>
        </section>

        {/* ── STREAK / BADGES ── */}
        {(streak || newBadges.length > 0) && (
          <Card style={{ padding: '18px 22px', borderRadius: 18, marginBottom: 14 }} delay={0.05}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              {streak && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: C.amberSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔥</div>
                  <div>
                    <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: C.text }}>{streak.current || 0} day streak</div>
                    <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.8px' }}>CONSISTENCY COMPOUNDS</div>
                  </div>
                </div>
              )}
              {newBadges.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {newBadges.map((badge, i) => {
                    const label = typeof badge === 'string' ? badge : badge?.label || 'New badge';
                    return <Pill key={`${label}-${i}`} color={C.blueDark} background={C.blueSoft} border={C.lineStrong}>🏆 {label}</Pill>;
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── NEXT STEP ── */}
        <motion.section
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', marginBottom: 14,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${C.blueSoft} 0%, ${C.cyanSoft} 100%)`,
            border: `1.5px solid ${C.blueSoft2}`,
          }}
        >
          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: '#fff', color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, boxShadow: C.shadowXs }}>→</div>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.blueDark, letterSpacing: '1.2px', marginBottom: 4, textTransform: 'uppercase' }}>What to do next</div>
            <div style={{ fontSize: 13, lineHeight: 1.65, color: C.text, fontWeight: 500 }}>{nextStepText}</div>
          </div>
        </motion.section>

        {/* ── QUESTION REVIEW ── */}
        <Card style={{ marginBottom: 14 }} delay={0.05}>
          <SectionTitle title="Question-by-question review" subtitle="Score, time and a quick takeaway for every question — open any card for the full breakdown." />

          <div className="result-review-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {filters.map(f => (
                <button key={f.key} className="result-filter" onClick={() => setActiveFilter(f.key)}
                  style={{
                    border: `1.5px solid ${activeFilter === f.key ? C.blue : C.line}`,
                    background: activeFilter === f.key ? C.blue : C.white,
                    color: activeFilter === f.key ? '#fff' : C.sub,
                    borderRadius: 999, padding: '7px 13px',
                    fontFamily: F.body, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >{f.label}</button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions or answers…"
              style={{ width: 250, maxWidth: '100%', border: `1.5px solid ${C.line}`, background: C.surface, borderRadius: 11, padding: '9px 13px', fontFamily: F.body, fontSize: 12, color: C.text, outline: 'none' }}
            />
          </div>

          {!filteredQuestions.length && (
            <div style={{ border: `1.5px dashed ${C.lineStrong}`, borderRadius: 14, padding: 32, textAlign: 'center', color: C.muted, fontSize: 12 }}>
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
                onRetry={handleRetryQuestion}
                retrying={retryingId === q.id}
              />
            ))}
          </div>
        </Card>

        {/* ── SCORE CARD (Mission Report) ── */}
        <Card style={{ marginBottom: 14 }} delay={0.05}>
          <ScoreCard totalScore={totalScore} questions={normalizedQuestions} />
        </Card>

        {/* ── CTA BANNER ── */}
        <motion.section
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 22, padding: '26px 28px',
            background: 'linear-gradient(140deg, #0A2260 0%, #0E52C7 58%, #11B3D4 100%)',
            boxShadow: C.shadowLg,
          }}
        >
          <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', right: -100, top: -140, background: 'radial-gradient(circle, rgba(255,255,255,.08), transparent 68%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '2px', color: 'rgba(255,255,255,.58)', marginBottom: 8, textTransform: 'uppercase' }}>Next move</div>
              <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.4px' }}>Turn this feedback into your next rep.</h2>
              <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,.68)', fontSize: 12, lineHeight: 1.6 }}>
                Focus on {weakestTopic?.topic || 'your weakest area'} next.
              </p>
            </div>
            <div className="result-actions" style={{ display: 'flex', gap: 10 }}>
              <button className="result-btn" onClick={() => navigate('/interview')}
                style={{ border: 'none', borderRadius: 12, background: '#fff', color: C.blueDark, padding: '12px 20px', fontFamily: F.body, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
                Start another interview
              </button>
              <button className="result-btn" onClick={() => navigate('/analytics')}
                style={{ border: '1px solid rgba(255,255,255,.26)', borderRadius: 12, background: 'rgba(255,255,255,.09)', color: '#fff', padding: '12px 20px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Open analytics →
              </button>
            </div>
          </div>
        </motion.section>

        <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '20px 2px 0', color: C.faint, fontFamily: F.mono, fontSize: 8.5, letterSpacing: '1px', textTransform: 'uppercase' }}>
          <span>MockMate · Session Debrief</span>
          <span>Scores normalized 0–100</span>
        </footer>
      </motion.div>
    </div>
  );
};

export default Result;
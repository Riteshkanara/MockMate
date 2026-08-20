import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ScoreCard from '../components/ScoreCard';
import { retryQuestion } from '../Services/interviewService';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKMATE — RESULT / POST-INTERVIEW DEBRIEF (v2)
// A premium, light-mode performance debrief. This pass focuses on the
// question-by-question review: folded cards now carry real signal — score,
// time, and a one-line takeaway pulled from the actual AI feedback — so the
// list is informative before anyone opens a single card. Opening is now an
// explicit, keyboard-accessible button rather than a click-anywhere div.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Design system ────────────────────────────────────────────────────────────

const C = {
  page: '#F4F7FC',
  pageGlow: '#EDF4FF',

  white: '#FFFFFF',
  surface: '#FBFCFE',
  surfaceAlt: '#F6F9FD',

  ink: '#0B1730',
  text: '#12213B',
  sub: '#53657F',
  muted: '#7F8DA3',
  faint: '#AAB5C5',

  line: '#E2E8F1',
  lineStrong: '#CED8E6',

  blue: '#1E67FF',
  blueDark: '#0845C2',
  blueSoft: '#EDF4FF',
  blueSoft2: '#E5EEFF',

  cyan: '#10B8D8',
  cyanSoft: '#EAFBFE',

  green: '#0D9B73',
  greenSoft: '#EAF9F3',

  amber: '#D78614',
  amberSoft: '#FFF6E8',

  red: '#D84D4D',
  redSoft: '#FFF0F0',

  navy: '#09265F',

  shadowSm: '0 4px 14px rgba(18, 48, 90, 0.05)',
  shadow: '0 10px 28px rgba(24, 53, 95, 0.08)',
  shadowLg: '0 24px 64px rgba(24, 53, 95, 0.12)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Inter', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', monospace",
};

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
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getPerformanceLabel = score => {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Solid';
  if (score >= 60) return 'Developing';
  return 'Needs practice';
};

const getPerformanceMessage = score => {
  if (score >= 90) {
    return {
      eyebrow: 'OUTSTANDING SESSION',
      title: 'You looked placement-ready.',
      text: 'Excellent overall execution. Preserve this level while increasing consistency on your weakest topics.',
      icon: '✦',
    };
  }
  if (score >= 80) {
    return {
      eyebrow: 'STRONG SESSION',
      title: 'You are building reliable interview form.',
      text: 'Your fundamentals are landing well. The fastest gains now come from tightening weak spots rather than adding random topics.',
      icon: '↗',
    };
  }
  if (score >= 60) {
    return {
      eyebrow: 'DEVELOPING SESSION',
      title: 'The foundation is there.',
      text: 'You have enough signal to improve quickly. Focus on the questions where technical depth or clarity dropped.',
      icon: '◐',
    };
  }
  return {
    eyebrow: 'PRACTICE SESSION',
    title: 'This session exposed useful gaps.',
    text: 'Treat the result as a diagnostic. The weak answers are the roadmap for your next practice round.',
    icon: '◔',
  };
};

// Trim any feedback fragment down to a single clean clause for the folded
// card — cut at the first sentence boundary, then hard-cap the length.
const toOneLine = (text, maxLen = 92) => {
  if (!text) return '';
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  const trimmed = firstSentence.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
};

// The folded-card takeaway: always derived from real data, never invented.
// Objective questions get a plain correct/incorrect line; open questions
// pull from whichever feedback field is most useful at that score band.
const getTakeaway = question => {
  if (question.skipped) {
    return { text: 'Skipped — no answer submitted.', tone: 'neutral' };
  }

  const objective = ['mcq', 'aptitude'].includes(question.questionType);
  const fb = question.aiFeedback;

  if (objective) {
    if (fb?.correct === true) return { text: 'Correct answer.', tone: 'good' };
    if (fb?.correct === false) return { text: 'Incorrect — see the explanation below.', tone: 'bad' };
    return { text: 'Answer recorded.', tone: 'neutral' };
  }

  if (!fb || fb.aiAvailable === false) {
    return { text: 'AI evaluation unavailable for this answer.', tone: 'neutral' };
  }

  const score = clamp(fb.score);
  if (score >= 80 && fb.good) return { text: toOneLine(fb.good), tone: 'good' };
  if (score < 60 && fb.missing) return { text: toOneLine(fb.missing), tone: 'bad' };
  if (fb.tip) return { text: toOneLine(fb.tip), tone: 'neutral' };
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
      score: typeof question.score === 'number' ? question.score : Number(question.score || 0),
      correct: question.correct ?? parsed.correct ?? null,
      good: parsed.good || '',
      missing: parsed.missing || '',
      idealHint: parsed.idealHint || '',
      tip: parsed.tip || '',
      sampleAnswer: parsed.sampleAnswer || '',
      aiAvailable: parsed.aiAvailable !== false,
      fallback: parsed.fallback === true,
    };
  } catch {
    return null;
  }
};

const normalizeQuestion = (question, index) => {
  const aiFeedback = normalizeFeedback(question);
  const scoreValue = typeof question?.score === 'number' ? question.score : Number(question?.score || 0);

  return {
    ...question,
    index,
    text: question?.text || question?.question || `Question ${index + 1}`,
    topic: question?.topic || 'General',
    questionType: question?.questionType || 'open',
    userAnswer: question?.userAnswer || '',
    skipped: Boolean(question?.skipped),
    score: clamp(scoreValue),
    aiFeedback,
  };
};

// ─── Small reusable UI ────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: 9.5,
      fontWeight: 700,
      color: C.blue,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      marginBottom: 7,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle, action }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 18,
      marginBottom: 18,
      flexWrap: 'wrap',
    }}
  >
    <div>
      <h2
        style={{
          margin: 0,
          color: C.text,
          fontFamily: F.display,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.4px',
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            margin: '6px 0 0',
            color: C.sub,
            fontFamily: F.body,
            fontSize: 12.5,
            lineHeight: 1.65,
            maxWidth: 580,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </div>
);

const Pill = ({ children, color = C.blue, background = C.blueSoft, border = C.lineStrong }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 999,
      padding: '5px 9px',
      background,
      border: `1px solid ${border}`,
      color,
      fontFamily: F.mono,
      fontSize: 9.5,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

// ─── Hero score ───────────────────────────────────────────────────────────────

const HeroGauge = ({ score, mounted }) => {
  const size = 210;
  const center = size / 2;
  const radius = 79;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = clamp(score);
  const dashOffset = circumference - (normalizedScore / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="resultHeroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.blue} />
            <stop offset="100%" stopColor={C.cyan} />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="11" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#resultHeroGradient)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? dashOffset : circumference}
          style={{ transition: 'stroke-dashoffset 1.35s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: F.display, fontSize: 56, lineHeight: 1, fontWeight: 900, color: '#fff', letterSpacing: '-2px' }}>
          {Math.round(score)}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, marginTop: 6, color: 'rgba(255,255,255,0.6)' }}>/ 100</div>
        <div style={{ marginTop: 10, fontFamily: F.body, fontSize: 11, fontWeight: 700, color }}>{getPerformanceLabel(score)}</div>
      </div>
    </div>
  );
};

// ─── KPI tile ─────────────────────────────────────────────────────────────────

const Kpi = ({ icon, label, value, helper, color, background }) => (
  <div className="result-kpi" style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, boxShadow: C.shadowSm }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
        {icon}
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.faint, letterSpacing: '1px' }}>SESSION</span>
    </div>
    <div style={{ marginTop: 15, fontFamily: F.display, fontSize: 28, fontWeight: 800, lineHeight: 1, color: C.text }}>{value}</div>
    <div style={{ marginTop: 7, fontFamily: F.body, fontSize: 11.5, fontWeight: 700, color: C.sub }}>{label}</div>
    {helper && <div style={{ marginTop: 4, fontFamily: F.body, fontSize: 10.5, color: C.muted, lineHeight: 1.4 }}>{helper}</div>}
  </div>
);

// ─── Score distribution bars ──────────────────────────────────────────────────

const ScoreDistribution = ({ questions }) => {
  const buckets = [
    { label: 'Strong', range: '80–100', count: questions.filter(q => q.score >= 80).length, color: C.green, bg: C.greenSoft },
    { label: 'Solid', range: '60–79', count: questions.filter(q => q.score >= 60 && q.score < 80).length, color: C.blue, bg: C.blueSoft },
    { label: 'Needs work', range: '0–59', count: questions.filter(q => q.score < 60 && !q.skipped).length, color: C.red, bg: C.redSoft },
  ];
  const answered = questions.filter(q => !q.skipped).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {buckets.map(bucket => {
        const pct = answered ? Math.round((bucket.count / answered) * 100) : 0;
        return (
          <div key={bucket.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: bucket.color }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{bucket.label}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{bucket.range}</span>
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.sub }}>{bucket.count}</span>
            </div>
            <div style={{ height: 8, background: C.pageGlow, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: bucket.color, transition: 'width 0.9s cubic-bezier(.16,1,.3,1)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Topic performance ────────────────────────────────────────────────────────

const TopicPerformance = ({ topicAverages }) => {
  const sorted = [...topicAverages].sort((a, b) => b.avg - a.avg);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.length ? (
        sorted.map(item => {
          const color = scoreColor(item.avg);
          return (
            <div key={item.topic}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <div style={{ minWidth: 0, fontSize: 11.5, fontWeight: 700, color: C.text }}>{item.topic}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color, fontWeight: 700, flexShrink: 0 }}>{item.avg}/100</div>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: C.pageGlow, overflow: 'hidden' }}>
                <div style={{ width: `${item.avg}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .8s ease' }} />
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ padding: '26px 10px', color: C.muted, fontSize: 12, textAlign: 'center' }}>
          Topic-level scoring is not available for this session.
        </div>
      )}
    </div>
  );
};

// ─── Trend chart ──────────────────────────────────────────────────────────────

const ScoreProgression = ({ questions }) => {
  const points = questions
    .filter(q => !q.skipped && q.aiFeedback && q.aiFeedback.aiAvailable !== false && typeof q.aiFeedback.score === 'number')
    .map(q => q.aiFeedback.score);

  if (points.length < 2) {
    return (
      <div style={{ padding: 26, borderRadius: 14, background: C.surfaceAlt, color: C.muted, fontSize: 12, textAlign: 'center' }}>
        At least two evaluated questions are needed to show progression.
      </div>
    );
  }

  const width = 720;
  const height = 210;
  const padX = 28;
  const padY = 22;
  const x = index => padX + (index / (points.length - 1)) * (width - padX * 2);
  const y = value => height - padY - (clamp(value) / 100) * (height - padY * 2);
  const path = points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const area = `${path} L ${x(points.length - 1)} ${height - padY} L ${x(0)} ${height - padY} Z`;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: 520, display: 'block' }}>
        <defs>
          <linearGradient id="resultAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.16" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 60, 80].map(line => (
          <g key={line}>
            <line x1={padX} x2={width - padX} y1={y(line)} y2={y(line)} stroke={C.line} strokeDasharray="4 5" />
            <text x={4} y={y(line) + 3} fontSize="9" fontFamily={F.mono} fill={C.faint}>{line}</text>
          </g>
        ))}
        <path d={area} fill="url(#resultAreaGradient)" />
        <path d={path} fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((value, index) => (
          <g key={index}>
            <circle cx={x(index)} cy={y(value)} r="5" fill={scoreColor(value)} stroke="#fff" strokeWidth="2" />
            <text x={x(index)} y={height - 4} textAnchor="middle" fontSize="8.5" fontFamily={F.mono} fill={C.muted}>Q{index + 1}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ─── Question review card (folded by default) ─────────────────────────────────

const toneColor = tone => (tone === 'good' ? C.green : tone === 'bad' ? C.red : C.sub);

const QuestionCard = ({ question, open, onToggle, onRetry, retrying }) => {
  const index = question._index;
  const feedback = question.aiFeedback;
  const objective = ['mcq', 'aptitude'].includes(question.questionType);
  const isEvaluated = Boolean(feedback && feedback.aiAvailable !== false && (typeof feedback.score === 'number' || objective));
  const score = isEvaluated && !objective ? feedback.score : null;
  const takeaway = useMemo(() => getTakeaway(question), [question]);
  const hasTime = Number(question.timeTaken) > 0;

  // Retry only makes sense for open-ended questions that were actually
  // answered — nothing to re-evaluate for MCQ/aptitude or skipped ones.
  const canRetry = !objective && !question.skipped && question.userAnswer && question.userAnswer.trim() && question.id;

  const scoreBadgeColor = question.skipped
    ? C.muted
    : objective
      ? (feedback?.correct === true ? C.green : feedback?.correct === false ? C.red : C.muted)
      : (isEvaluated ? scoreColor(score) : C.muted);

  const scoreBadgeBg = question.skipped
    ? C.surfaceAlt
    : objective
      ? (feedback?.correct === true ? C.greenSoft : feedback?.correct === false ? C.redSoft : C.surfaceAlt)
      : (isEvaluated ? scoreSoft(score) : C.surfaceAlt);

  return (
    <div
      className="result-question"
      style={{
        border: `1px solid ${open ? C.lineStrong : C.line}`,
        borderRadius: 16,
        background: open ? C.surface : C.white,
        boxShadow: open ? C.shadowSm : 'none',
        overflow: 'hidden',
      }}
    >
      {/* ── Folded header — always visible, carries real signal ────────── */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        <button
          type="button"
          className="result-card-toggle"
          onClick={() => onToggle(index)}
          aria-expanded={open}
          aria-controls={`review-body-${index}`}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 8px 14px 16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          {/* Score / correctness badge */}
          <div
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              background: scoreBadgeBg,
              color: scoreBadgeColor,
            }}
          >
            {question.skipped ? (
              <span style={{ fontSize: 16, fontWeight: 800 }}>—</span>
            ) : objective ? (
              <span style={{ fontSize: 18, fontWeight: 800 }}>{feedback?.correct === true ? '✓' : feedback?.correct === false ? '×' : '?'}</span>
            ) : isEvaluated ? (
              <>
                <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{score}</span>
                <span style={{ fontFamily: F.mono, fontSize: 7, opacity: 0.75, marginTop: 1 }}>/100</span>
              </>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 800 }}>—</span>
            )}
          </div>

          {/* Question text + meta row + takeaway */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.faint, letterSpacing: '0.4px' }}>Q{index + 1}</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>·</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.sub }}>{question.topic}</span>
              {hasTime && (
                <>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>
                    ◷ {formatTime(question.timeTaken)}
                  </span>
                </>
              )}
              {question.skipped && (
                <Pill color={C.amber} background={C.amberSoft} border="#F4D28E">SKIPPED</Pill>
              )}
            </div>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.45,
                color: C.text,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {question.text}
            </div>

            {takeaway.text && (
              <div
                style={{
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 5,
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: toneColor(takeaway.tone),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {takeaway.text}
              </div>
            )}
          </div>
        </button>

        {/* Explicit expand/collapse control */}
        <button
          type="button"
          className="result-card-chevron"
          onClick={() => onToggle(index)}
          aria-expanded={open}
          aria-controls={`review-body-${index}`}
          aria-label={open ? `Collapse question ${index + 1}` : `Expand question ${index + 1}`}
          style={{
            flexShrink: 0,
            width: 44,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.faint,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: 13,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s ease',
            }}
          >
            ▾
          </span>
        </button>
      </div>

      {/* Score/progress hairline — subtle, always visible under the header */}
      {!question.skipped && (
        <div style={{ height: 3, background: C.pageGlow, marginTop: -1 }}>
          <div
            style={{
              width: objective ? (feedback?.correct ? '100%' : feedback?.correct === false ? '100%' : '0%') : `${score || 0}%`,
              height: '100%',
              background: scoreBadgeColor,
              opacity: 0.55,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      )}

      {/* ── Unfolded body ────────────────────────────────────────────── */}
      <div
        id={`review-body-${index}`}
        style={{
          maxHeight: open ? 1200 : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.32s cubic-bezier(.16,1,.3,1), opacity 0.24s ease',
        }}
      >
        <div style={{ padding: '4px 16px 16px' }}>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: C.text, fontWeight: 700, marginBottom: 10 }}>{question.text}</div>

          {question.userAnswer && !question.skipped && question.userAnswer !== 'Skipped' && (
            <div style={{ padding: '11px 12px', borderRadius: 11, background: C.surfaceAlt, border: `1px solid ${C.line}`, marginBottom: 10 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 5 }}>
                Your answer
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.65, color: C.sub, whiteSpace: 'pre-wrap' }}>{question.userAnswer}</div>
            </div>
          )}

          {question.skipped && (
            <div style={{ padding: '10px 12px', borderRadius: 11, background: C.amberSoft, border: '1px solid #F4D28E', color: '#8B5E12', fontSize: 11, lineHeight: 1.55, marginBottom: 10 }}>
              You skipped this question. Use this as a pacing signal rather than a failure.
            </div>
          )}

          {objective && isEvaluated && (
            <div style={{ padding: '12px 14px', border: `1px solid ${C.line}`, borderRadius: 12, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, letterSpacing: '0.6px' }}>RESULT</span>
              <strong style={{ color: scoreBadgeColor }}>{feedback?.correct ? 'Correct' : 'Incorrect'}</strong>
            </div>
          )}
          {objective && feedback?.raw && (
            <div style={{ padding: 12, borderRadius: 12, background: C.cardAlt || C.surfaceAlt, border: `1px solid ${C.line}`, color: C.sub, fontSize: 12.5, lineHeight: 1.55, wordBreak: 'break-word', marginBottom: 10 }}>
              {feedback.raw}
            </div>
          )}

          {!objective && isEvaluated && feedback && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }} className="result-feedback-grid">
              <FeedbackBlock label="What worked" value={feedback.good} color={C.green} background={C.greenSoft} />
              <FeedbackBlock label="What was missing" value={feedback.missing} color={C.red} background={C.redSoft} />
              <FeedbackBlock label="Key idea" value={feedback.idealHint} color={C.blue} background={C.blueSoft} />
              <FeedbackBlock label="Next move" value={feedback.tip} color={C.amber} background={C.amberSoft} />
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: '1 / -1', padding: 12, borderRadius: 11, background: C.surfaceAlt, border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 5 }}>
                    Better answer pattern
                  </div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.65, color: C.text }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {canRetry && onRetry && (
            <div style={{ gridColumn: '1 / -1', marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => onRetry(question.id)}
                disabled={retrying}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: `1px solid ${C.lineStrong}`,
                  background: retrying ? C.surfaceAlt : C.white,
                  color: retrying ? C.muted : C.blue,
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  cursor: retrying ? 'not-allowed' : 'pointer',
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

// ─── Main component ───────────────────────────────────────────────────────────

const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result;

  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!result) {
      navigate('/');
      return;
    }
    const id = requestAnimationFrame(() => setTimeout(() => setMounted(true), 40));
    return () => cancelAnimationFrame(id);
  }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  const [normalizedQuestionsState, setNormalizedQuestionsState] = useState([]);
  const [retryingId, setRetryingId] = useState(null);

  const normalizedQuestions = useMemo(() => {
    const base = questions.map((q, i) => normalizeQuestion(q, i));
    // Merge in any locally-retried scores/feedback so re-evaluated cards
    // reflect the fresh result without needing a full page reload.
    if (!normalizedQuestionsState.length) return base;
    return base.map(q => {
      const override = normalizedQuestionsState.find(o => o.id === q.id);
      return override ? { ...q, score: override.score, aiFeedback: override.aiFeedback } : q;
    });
  }, [questions, normalizedQuestionsState]);

  const handleRetryQuestion = useCallback(
    async questionId => {
      if (!sessionId || !questionId || retryingId) return;

      setRetryingId(questionId);

      try {
        const data = await retryQuestion(sessionId, questionId);

        const parsedFeedback = normalizeFeedback({ feedback: data?.feedback, score: data?.score });

        setNormalizedQuestionsState(previous => {
          const withoutThis = previous.filter(q => q.id !== questionId);
          return [
            ...withoutThis,
            {
              id: questionId,
              score: clamp(Number(data?.score) || 0),
              aiFeedback: parsedFeedback,
            },
          ];
        });
      } catch (err) {
        console.error('Retry question failed:', err);
      } finally {
        setRetryingId(null);
      }
    },
    [sessionId, retryingId]
  );

  const evaluatedQuestions = useMemo(
    () => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback && q.aiFeedback.aiAvailable !== false && typeof q.aiFeedback.score === 'number'),
    [normalizedQuestions]
  );

  const skippedQuestions = useMemo(() => normalizedQuestions.filter(q => q.skipped), [normalizedQuestions]);

  const answeredQuestions = useMemo(
    () => normalizedQuestions.filter(q => !q.skipped && q.userAnswer && q.userAnswer.trim() && q.userAnswer !== 'Skipped'),
    [normalizedQuestions]
  );

  const strongQuestions = evaluatedQuestions.filter(q => q.aiFeedback.score >= 80).length;
  const improvementQuestions = evaluatedQuestions.filter(q => q.aiFeedback.score < 60).length;

  const averageQuestionScore = evaluatedQuestions.length
    ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + q.aiFeedback.score, 0) / evaluatedQuestions.length)
    : totalScore;

  const averageTime = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0) / answeredQuestions.length)
    : 0;

  const topicAverages = useMemo(() => {
    const map = {};
    normalizedQuestions.forEach(question => {
      if (question.skipped || !question.aiFeedback || typeof question.aiFeedback.score !== 'number') return;
      const topic = question.topic || 'General';
      if (!map[topic]) map[topic] = { total: 0, count: 0 };
      map[topic].total += question.aiFeedback.score;
      map[topic].count += 1;
    });
    return Object.entries(map).map(([topic, data]) => ({ topic, avg: Math.round(data.total / data.count) }));
  }, [normalizedQuestions]);

  const strongestTopic = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const weakestTopic = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

  const fastestQuestion = useMemo(() => {
    const timed = answeredQuestions.filter(q => Number(q.timeTaken || 0) > 0).sort((a, b) => a.timeTaken - b.timeTaken);
    return timed[0] || null;
  }, [answeredQuestions]);

  const slowestQuestion = useMemo(() => {
    const timed = answeredQuestions.filter(q => Number(q.timeTaken || 0) > 0).sort((a, b) => b.timeTaken - a.timeTaken);
    return timed[0] || null;
  }, [answeredQuestions]);

  // New: a plain-language "what to do next" line, derived from real
  // computed values above — no invented claims.
  const nextStepText = useMemo(() => {
    if (skippedQuestions.length > 0 && improvementQuestions === 0) {
      return `You skipped ${skippedQuestions.length} question${skippedQuestions.length > 1 ? 's' : ''} — a full pass at your current pace would likely raise this score.`;
    }
    if (weakestTopic && improvementQuestions > 0) {
      return `${improvementQuestions} answer${improvementQuestions > 1 ? 's' : ''} scored below 60, concentrated in ${weakestTopic.topic}. Start your next rep there.`;
    }
    if (strongestTopic && strongQuestions === evaluatedQuestions.length && evaluatedQuestions.length > 0) {
      return `Every evaluated answer scored 80+. Raise the difficulty next time to keep the signal useful.`;
    }
    return 'Review the answers below, then queue another session to build on this one.';
  }, [skippedQuestions.length, improvementQuestions, weakestTopic, strongestTopic, strongQuestions, evaluatedQuestions.length]);

  const performance = getPerformanceMessage(totalScore);
  const performanceLabel = getPerformanceLabel(totalScore);

  const filters = [
    { key: 'all', label: `All · ${normalizedQuestions.length}` },
    { key: 'strong', label: `Strong · ${strongQuestions}` },
    { key: 'weak', label: `Needs work · ${improvementQuestions}` },
    { key: 'skipped', label: `Skipped · ${skippedQuestions.length}` },
  ];

  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedQuestions
      .map((question, index) => ({ ...question, _index: index }))
      .filter(question => {
        if (activeFilter === 'strong' && (!question.aiFeedback || question.aiFeedback.score < 80)) return false;
        if (activeFilter === 'weak' && (question.skipped || !question.aiFeedback || question.aiFeedback.score >= 60)) return false;
        if (activeFilter === 'skipped' && !question.skipped) return false;
        if (needle) {
          const haystack = `${question.text} ${question.topic} ${question.userAnswer}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      });
  }, [normalizedQuestions, activeFilter, search]);

  const toggleExpand = useCallback(index => {
    setExpanded(previous => ({ ...previous, [index]: !previous[index] }));
  }, []);

  const handleCopySummary = useCallback(async () => {
    const lines = [
      `MockMate result: ${totalScore}/100 — ${performanceLabel}`,
      `${answeredQuestions.length}/${normalizedQuestions.length} answered`,
      `${strongQuestions} strong · ${improvementQuestions} need work · ${skippedQuestions.length} skipped`,
      strongestTopic ? `Strongest topic: ${strongestTopic.topic} (${strongestTopic.avg}/100)` : '',
      weakestTopic ? `Focus area: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : '',
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable.
    }
  }, [totalScore, performanceLabel, answeredQuestions.length, normalizedQuestions.length, strongQuestions, improvementQuestions, skippedQuestions.length, strongestTopic, weakestTopic]);

  if (!result) return null;

  return (
    <div
      className="result-page"
      style={{
        minHeight: 'calc(100vh - 64px)',
        background: `radial-gradient(circle at 0% 0%, rgba(30,103,255,0.08), transparent 35%), radial-gradient(circle at 100% 8%, rgba(16,184,216,0.07), transparent 30%), ${C.page}`,
        padding: '24px 20px 72px',
        fontFamily: F.body,
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .result-page { color: ${C.text}; }
        .result-shell { max-width: 1180px; margin: 0 auto; }

        .result-btn { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease; }
        .result-btn:hover { transform: translateY(-1px); }
        .result-btn:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .result-btn-primary:hover { box-shadow: 0 12px 30px rgba(30,103,255,.28) !important; }

        .result-question { transition: border-color .16s ease, box-shadow .16s ease, background .16s ease; }

        .result-card-toggle, .result-card-chevron { transition: background .14s ease; }
        .result-card-toggle:hover, .result-card-chevron:hover { background: rgba(30,103,255,0.045) !important; }
        .result-card-toggle:focus-visible, .result-card-chevron:focus-visible {
          outline: 2px solid ${C.blue};
          outline-offset: -2px;
        }

        .result-filter { transition: all .14s ease; }
        .result-filter:hover { border-color: ${C.blue} !important; }
        .result-filter:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }

        input:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 1px; }

        @media (max-width: 900px) {
          .result-hero { grid-template-columns: 1fr !important; text-align: center; }
          .result-hero-score { justify-content: center !important; }
          .result-hero-content { align-items: center !important; }
          .result-hero-actions { justify-content: center !important; }
          .result-grid-2 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          .result-page { padding: 16px 12px 54px !important; }
          .result-kpis { grid-template-columns: repeat(2, 1fr) !important; }
          .result-actions { flex-direction: column !important; }
          .result-actions button { width: 100% !important; }
          .result-review-controls { flex-direction: column !important; align-items: stretch !important; }
          .result-review-controls input { width: 100% !important; }
        }
        @media (max-width: 460px) {
          .result-kpis { grid-template-columns: 1fr !important; }
          .result-hero-panel { padding: 22px 18px !important; border-radius: 20px !important; }
          .result-feedback-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .result-page * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div
        className="result-shell"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(8px)',
          transition: 'opacity .45s ease, transform .45s cubic-bezier(.16,1,.3,1)',
        }}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <SectionLabel>POST-INTERVIEW DEBRIEF</SectionLabel>
            <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 800, letterSpacing: '-0.7px' }}>Your interview report</h1>
          </div>
          <Pill>READINESS ENGINE</Pill>
        </div>

        {/* HERO */}
        <section
          className="result-hero-panel"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 28,
            padding: 28,
            marginBottom: 16,
            background: 'linear-gradient(135deg, #09265F 0%, #0B4FC7 48%, #10B8D8 100%)',
            boxShadow: '0 24px 64px rgba(8, 49, 115, .20)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 280,
              height: 280,
              borderRadius: '50%',
              right: -120,
              top: -150,
              background: 'radial-gradient(circle, rgba(255,255,255,.14), transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div className="result-hero" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '210px 1fr', gap: 30, alignItems: 'center' }}>
            <div className="result-hero-score" style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <HeroGauge score={totalScore} mounted={mounted} />
            </div>

            <div className="result-hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(255,255,255,.68)', marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.cyan }} />
                {performance.eyebrow}
              </div>

              <h2 style={{ margin: 0, color: '#fff', fontFamily: F.display, fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.7px', maxWidth: 720 }}>
                {performance.icon} {performance.title}
              </h2>

              <p style={{ margin: '12px 0 0', maxWidth: 680, color: 'rgba(255,255,255,.75)', fontSize: 13.5, lineHeight: 1.75 }}>{performance.text}</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <Pill color="#fff" background="rgba(255,255,255,.12)" border="rgba(255,255,255,.22)">{performanceLabel.toUpperCase()}</Pill>
                {strongestTopic && (
                  <Pill color="#DFFAFF" background="rgba(16,184,216,.14)" border="rgba(16,184,216,.30)">STRONGEST · {strongestTopic.topic}</Pill>
                )}
                {weakestTopic && (
                  <Pill color="#FFF3D2" background="rgba(215,134,20,.12)" border="rgba(215,134,20,.28)">FOCUS · {weakestTopic.topic}</Pill>
                )}
              </div>

              <div className="result-hero-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 20 }}>
                <button
                  className="result-btn result-btn-primary"
                  onClick={() => navigate('/interview')}
                  style={{ border: 'none', borderRadius: 12, background: '#fff', color: C.blueDark, padding: '12px 18px', fontFamily: F.body, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 7px 18px rgba(0,0,0,.14)' }}
                >
                  Try again →
                </button>
                <button
                  className="result-btn"
                  onClick={() => navigate('/dashboard')}
                  style={{ border: '1px solid rgba(255,255,255,.26)', borderRadius: 12, background: 'rgba(255,255,255,.08)', color: '#fff', padding: '12px 18px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  ← Dashboard
                </button>
                <button
                  className="result-btn"
                  onClick={handleCopySummary}
                  style={{ border: '1px solid rgba(255,255,255,.26)', borderRadius: 12, background: 'rgba(255,255,255,.08)', color: '#fff', padding: '12px 18px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  {copied ? '✓ Copied' : '⧉ Copy summary'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* KPI ROW */}
        <section className="result-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <Kpi icon="✓" label="Answered" value={`${answeredQuestions.length}/${normalizedQuestions.length}`} helper="Questions completed" color={C.green} background={C.greenSoft} />
          <Kpi icon="↗" label="Strong answers" value={strongQuestions} helper="Scores of 80 or higher" color={C.blue} background={C.blueSoft} />
          <Kpi icon="!" label="Needs work" value={improvementQuestions} helper="Scores below 60" color={C.red} background={C.redSoft} />
          <Kpi icon="◷" label="Average time" value={formatTime(averageTime)} helper="Per answered question" color={C.sub} background={C.surfaceAlt} />
        </section>

        {/* TOP INSIGHTS */}
        <section className="result-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 14, marginBottom: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, boxShadow: C.shadow }}>
            <SectionTitle title="Your readout" subtitle="The fastest summary of what this session says about your current form." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Insight label="Overall" value={`${totalScore}/100`} text={`${performanceLabel} session`} color={scoreColor(totalScore)} background={scoreSoft(totalScore)} />
              <Insight label="Question avg" value={`${averageQuestionScore}/100`} text="Across evaluated answers" color={C.blue} background={C.blueSoft} />
              <Insight label="Strongest" value={strongestTopic?.topic || '—'} text={strongestTopic ? `${strongestTopic.avg}/100 average` : 'No topic data'} color={C.green} background={C.greenSoft} />
              <Insight label="Next focus" value={weakestTopic?.topic || '—'} text={weakestTopic ? `${weakestTopic.avg}/100 average` : 'No topic data'} color={C.amber} background={C.amberSoft} />
            </div>
          </div>

          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, boxShadow: C.shadow }}>
            <SectionTitle title="Score distribution" subtitle="How your evaluated answers were distributed." />
            <ScoreDistribution questions={normalizedQuestions} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, textTransform: 'uppercase' }}>Fastest</div>
                <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: C.text }}>
                  {fastestQuestion ? `Q${fastestQuestion.index + 1} · ${formatTime(fastestQuestion.timeTaken)}` : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, textTransform: 'uppercase' }}>Slowest</div>
                <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: C.text }}>
                  {slowestQuestion ? `Q${slowestQuestion.index + 1} · ${formatTime(slowestQuestion.timeTaken)}` : '—'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TREND + TOPIC */}
        <section className="result-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 14, marginBottom: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, boxShadow: C.shadow }}>
            <SectionTitle title="Score progression" subtitle="Your score as the interview moved from question to question." />
            <ScoreProgression questions={normalizedQuestions} />
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, boxShadow: C.shadow }}>
            <SectionTitle title="Topic performance" subtitle="Where you were strongest and where the next rep should go." />
            <TopicPerformance topicAverages={topicAverages} />
          </div>
        </section>

        {/* STREAK / BADGES */}
        {(streak || newBadges.length > 0) && (
          <section style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: C.shadowSm }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              {streak && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.amberSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔥</div>
                  <div>
                    <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text }}>{streak.current || 0} day streak</div>
                    <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>Consistency compounds</div>
                  </div>
                </div>
              )}
              {newBadges.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {newBadges.map((badge, index) => {
                    const label = typeof badge === 'string' ? badge : badge?.label || 'New badge';
                    return (
                      <Pill key={`${label}-${index}`} color={C.blueDark} background={C.blueSoft} border={C.lineStrong}>🏆 {label}</Pill>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* NEXT STEP — new: a single derived, data-grounded action line */}
        <section
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '15px 18px',
            marginBottom: 16,
            borderRadius: 16,
            background: C.blueSoft,
            border: `1px solid ${C.blueSoft2}`,
          }}
        >
          <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: '#fff', color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>→</div>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.blueDark, letterSpacing: '0.8px', marginBottom: 3 }}>WHAT TO DO NEXT</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: C.text }}>{nextStepText}</div>
          </div>
        </section>

        {/* QUESTION REVIEW */}
        <section style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, marginBottom: 16, boxShadow: C.shadow }}>
          <SectionTitle title="Question-by-question review" subtitle="Score, time and a quick takeaway for every question — open any card for the full breakdown." />

          <div className="result-review-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {filters.map(filter => (
                <button
                  key={filter.key}
                  className="result-filter"
                  onClick={() => setActiveFilter(filter.key)}
                  style={{
                    border: `1px solid ${activeFilter === filter.key ? C.blue : C.line}`,
                    background: activeFilter === filter.key ? C.blue : C.white,
                    color: activeFilter === filter.key ? '#fff' : C.sub,
                    borderRadius: 999,
                    padding: '7px 11px',
                    fontFamily: F.body,
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search questions or answers…"
              style={{ width: 250, maxWidth: '100%', border: `1px solid ${C.line}`, background: C.surface, borderRadius: 10, padding: '9px 11px', fontFamily: F.body, fontSize: 11.5, color: C.text, outline: 'none' }}
            />
          </div>

          {!filteredQuestions.length && (
            <div style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 14, padding: 28, textAlign: 'center', color: C.muted, fontSize: 12 }}>
              No questions match the current filter.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {filteredQuestions.map(question => (
              <QuestionCard
                key={question._index}
                question={question}
                open={Boolean(expanded[question._index])}
                onToggle={toggleExpand}
                onRetry={handleRetryQuestion}
                retrying={retryingId === question.id}
              />
            ))}
          </div>
        </section>

        {/* EXISTING SCORE CARD */}
        <div style={{ marginBottom: 16 }}>
          <ScoreCard totalScore={totalScore} questions={normalizedQuestions} />
        </div>

        {/* CTA */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 20,
            padding: 22,
            background: 'linear-gradient(135deg, #0B275F 0%, #0E52C7 60%, #12B7D8 100%)',
            boxShadow: C.shadowLg,
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.4px', color: 'rgba(255,255,255,.65)', marginBottom: 6 }}>NEXT MOVE</div>
              <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 21, fontWeight: 800, color: '#fff' }}>Turn this feedback into your next rep.</h2>
              <p style={{ margin: '7px 0 0', color: 'rgba(255,255,255,.72)', fontSize: 11.5, lineHeight: 1.55 }}>
                Focus on {weakestTopic?.topic || 'your weakest area'} next.
              </p>
            </div>
            <div className="result-actions" style={{ display: 'flex', gap: 9 }}>
              <button
                className="result-btn"
                onClick={() => navigate('/interview')}
                style={{ border: 'none', borderRadius: 12, background: '#fff', color: C.blueDark, padding: '12px 18px', fontFamily: F.body, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
              >
                Start another interview
              </button>
              <button
                className="result-btn"
                onClick={() => navigate('/analytics')}
                style={{ border: '1px solid rgba(255,255,255,.28)', borderRadius: 12, background: 'rgba(255,255,255,.08)', color: '#fff', padding: '12px 18px', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                Open full analytics →
              </button>
            </div>
          </div>
        </section>

        <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '18px 2px 0', color: C.faint, fontFamily: F.mono, fontSize: 9 }}>
          <span>MOCKMATE · SESSION DEBRIEF</span>
          <span>SCORES NORMALIZED TO 0–100</span>
        </footer>
      </div>
    </div>
  );
};

// ─── Small insight block ──────────────────────────────────────────────────────

const Insight = ({ label, value, text, color, background }) => (
  <div style={{ padding: 14, borderRadius: 13, background, border: `1px solid ${color}22` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color, letterSpacing: '0.8px' }}>{label}</div>
    <div style={{ marginTop: 7, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    <div style={{ marginTop: 4, fontSize: 10.5, color: C.sub, lineHeight: 1.4 }}>{text}</div>
  </div>
);

// ─── Feedback block ───────────────────────────────────────────────────────────

const FeedbackBlock = ({ label, value, color, background }) => (
  <div style={{ padding: 12, borderRadius: 11, background, border: `1px solid ${color}22` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color, letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 11, lineHeight: 1.55, color: C.text }}>{value || 'No additional readout.'}</div>
  </div>
);

export default Result;
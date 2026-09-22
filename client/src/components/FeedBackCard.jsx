import { useEffect, useMemo, useState } from 'react';
import { C, F } from '../styles/token';

// ─── Score helpers (unchanged) ────────────────────────────────────────────

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

const scoreTint = (s) =>
  s >= 80 ? C.greenTint : s >= 60 ? C.blue50 : s >= 40 ? C.amberTint : C.orangeTint;

const verdictCopy = (s) => {
  if (s >= 80) return { label: 'Strong answer',  icon: '◎', sub: 'This would land well in a live round.' };
  if (s >= 60) return { label: 'Solid attempt',  icon: '◐', sub: 'On the right track — a few gaps to close.' };
  if (s >= 40) return { label: 'Needs work',     icon: '◔', sub: 'The core idea is there but under-developed.' };
  return             { label: 'Off target',      icon: '○', sub: "Let's rebuild this one from the sample answer." };
};

// ─── New section helpers ──────────────────────────────────────────────────

const confidenceLabel = (s) => {
  if (s >= 75) return { text: 'Confident',      color: C.green  };
  if (s >= 50) return { text: 'Neutral',         color: C.blue500 };
  if (s >= 30) return { text: 'Hesitant',        color: C.amber  };
  return              { text: 'Uncertain',        color: C.orange };
};

const complexityMeta = (r = '') => {
  const v = String(r).toLowerCase();
  if (v === 'advanced')     return { label: 'Advanced',     color: C.red,    tint: C.redTint    };
  if (v === 'intermediate') return { label: 'Intermediate', color: C.amber,  tint: C.amberTint  };
  return                           { label: 'Basic',        color: C.green,  tint: C.greenTint  };
};

const timeEfficiencyMeta = (r = '') => {
  const v = String(r).toLowerCase();
  if (v === 'efficient') return { color: C.green,  icon: '⚡' };
  if (v === 'rushed')    return { color: C.amber,  icon: '⏩' };
  return                        { color: C.red,    icon: '⏱' };
};

const frameworkColor = (followed) => followed ? C.green : C.amber;

// Safe getter — returns [] if value is not a real non-empty array
const safeArr = (v) => (Array.isArray(v) && v.length > 0 ? v : []);

// ─── ScoreRing (unchanged) ────────────────────────────────────────────────

const ScoreRing = ({ score = 0, size = 108, mounted }) => {
  const r      = size / 2 - 8;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color  = scoreColor(pct);
  const gradId = 'fb-ring-grad';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={C.blue500} />
            <stop offset="100%" stopColor={color}     />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={7}
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: F.display, fontSize: size * 0.30, fontWeight: 800, color, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: size * 0.085, color: C.muted, marginTop: 2, letterSpacing: '0.3px' }}>
          / 100
        </div>
      </div>
    </div>
  );
};

// ─── ReadoutSection (unchanged) ───────────────────────────────────────────

const ReadoutSection = ({ icon, label, tone, tint, border, content, accent, delay, mounted }) => (
  <div
    className="fb-section"
    style={{
      background: tint,
      border: `1.5px solid ${border}`,
      borderRadius: 14,
      padding: '16px 18px',
      marginBottom: 12,
      opacity: mounted ? 1 : 0,
      transform: mounted ? 'none' : 'translateY(8px)',
      transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(.16,1,.3,1) ${delay}ms`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8,
        background: accent, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, flexShrink: 0,
        fontFamily: F.mono,
      }}>
        {icon}
      </div>
      <span style={{
        fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
        color: tone, letterSpacing: '1.1px', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
    <p style={{ margin: 0, fontFamily: F.body, fontSize: 13.5, lineHeight: 1.65, color: C.text }}>
      {content}
    </p>
  </div>
);

// ─── NEW: KeywordCoverage ─────────────────────────────────────────────────

const KeywordCoverage = ({ keywords, mounted, delay }) => {
  const hit    = safeArr(keywords?.hit);
  const missed = safeArr(keywords?.missed);
  if (!hit.length && !missed.length) return null;

  const total   = hit.length + missed.length;
  const pct     = total > 0 ? Math.round((hit.length / total) * 100) : 0;
  const barColor = pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;

  return (
    <div
      style={{
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(8px)',
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: barColor, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, fontFamily: F.mono,
          }}>
            #
          </div>
          <span style={{
            fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
            color: barColor, letterSpacing: '1.1px', textTransform: 'uppercase',
          }}>
            Keyword coverage
          </span>
        </div>
        <span style={{
          fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: barColor,
        }}>
          {hit.length}/{total}
        </span>
      </div>

      {/* Coverage bar */}
      <div style={{
        height: 6, borderRadius: 999, background: C.border,
        marginBottom: 14, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 999,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
          transition: 'width 1s cubic-bezier(.16,1,.3,1)',
        }} />
      </div>

      {/* Keyword pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hit.length > 0 && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.green, marginBottom: 6, fontFamily: F.mono, letterSpacing: '0.5px' }}>
              ✓ Used
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hit.map((kw, i) => (
                <span key={i} style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: C.greenTint, border: `1px solid ${C.green}35`,
                  color: C.green, fontSize: 12, fontWeight: 700,
                }}>
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
        {missed.length > 0 && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.red, marginBottom: 6, fontFamily: F.mono, letterSpacing: '0.5px' }}>
              ✗ Missed
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {missed.map((kw, i) => (
                <span key={i} style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: C.redTint, border: `1px solid ${C.red}30`,
                  color: C.red, fontSize: 12, fontWeight: 700,
                }}>
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── NEW: FrameworkCheck ──────────────────────────────────────────────────

const FrameworkCheck = ({ frameworkCheck, mounted, delay }) => {
  const detected = frameworkCheck?.detected;
  const followed = frameworkCheck?.followed;
  const missing  = safeArr(frameworkCheck?.missing);

  // Only render if a framework was actually detected
  if (!detected || detected === 'none') return null;

  const color    = frameworkColor(followed);
  const tint     = followed ? C.greenTint : C.amberTint;
  const border   = followed ? `${C.green}35` : `${C.amber}45`;

  return (
    <div
      style={{
        background: tint,
        border: `1.5px solid ${border}`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(8px)',
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, fontFamily: F.mono,
        }}>
          ⬡
        </div>
        <span style={{
          fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
          color, letterSpacing: '1.1px', textTransform: 'uppercase',
        }}>
          Framework check
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Framework name badge */}
        <span style={{
          padding: '5px 12px', borderRadius: 8,
          background: `${color}18`, border: `1.5px solid ${color}40`,
          fontFamily: F.mono, fontSize: 12, fontWeight: 800, color,
          letterSpacing: '1px',
        }}>
          {String(detected).toUpperCase()}
        </span>

        {/* Followed or not */}
        <span style={{
          padding: '5px 12px', borderRadius: 8,
          background: followed ? C.greenTint : C.amberTint,
          border: `1px solid ${followed ? C.green : C.amber}40`,
          fontSize: 12, fontWeight: 700,
          color: followed ? C.green : C.amber,
        }}>
          {followed ? '✓ Followed correctly' : '⚠ Not fully followed'}
        </span>
      </div>

      {/* Missing parts */}
      {missing.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 6, fontFamily: F.mono }}>
            Missing parts
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missing.map((part, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 999,
                background: C.amberTint, border: `1px solid ${C.amber}40`,
                color: C.amber, fontSize: 12, fontWeight: 700,
              }}>
                {part}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── NEW: ConfidenceBar ───────────────────────────────────────────────────

const ConfidenceBar = ({ confidenceScore, mounted, delay }) => {
  if (confidenceScore == null || confidenceScore === undefined) return null;
  const score = Math.max(0, Math.min(100, Number(confidenceScore) || 0));
  const { text, color } = confidenceLabel(score);

  return (
    <div
      style={{
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(8px)',
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800,
          }}>
            ◈
          </div>
          <span style={{
            fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
            color, letterSpacing: '1.1px', textTransform: 'uppercase',
          }}>
            Confidence level
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 999,
            background: `${color}15`, border: `1px solid ${color}35`,
            fontFamily: F.mono, fontSize: 11, fontWeight: 800, color,
          }}>
            {text}
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 800, color }}>
            {score}%
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: 'hidden', position: 'relative' }}>
        {/* Zone markers */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg,
            ${C.orange}22 0% 30%,
            ${C.amber}22 30% 50%,
            ${C.blue500}22 50% 75%,
            ${C.green}22 75% 100%)`,
        }} />
        <div style={{
          height: '100%', borderRadius: 999,
          width: `${score}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          transition: 'width 1.1s cubic-bezier(.16,1,.3,1)',
          position: 'relative', zIndex: 1,
        }} />
      </div>

      {/* Zone labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        {['Uncertain', 'Hesitant', 'Neutral', 'Confident'].map((z) => (
          <span key={z} style={{ fontFamily: F.mono, fontSize: 9, color: C.faint, letterSpacing: '0.3px' }}>
            {z}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── NEW: TimeEfficiency ──────────────────────────────────────────────────

const TimeEfficiency = ({ timeEfficiency, mounted, delay }) => {
  const rating  = timeEfficiency?.rating;
  const comment = timeEfficiency?.comment;
  const ideal   = timeEfficiency?.idealRange;
  if (!rating && !comment) return null;

  const { color, icon } = timeEfficiencyMeta(rating || '');
  const tint   = color === C.green ? C.greenTint : color === C.amber ? C.amberTint : C.redTint;
  const border = `${color}35`;

  return (
    <div
      style={{
        background: tint,
        border: `1.5px solid ${border}`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(8px)',
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800,
        }}>
          {icon}
        </div>
        <span style={{
          fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
          color, letterSpacing: '1.1px', textTransform: 'uppercase',
        }}>
          Time efficiency
        </span>
        {rating && (
          <span style={{
            marginLeft: 'auto',
            padding: '3px 10px', borderRadius: 999,
            background: `${color}18`, border: `1px solid ${color}35`,
            fontFamily: F.mono, fontSize: 11, fontWeight: 800, color,
            textTransform: 'capitalize',
          }}>
            {rating}
          </span>
        )}
      </div>

      {comment && (
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: C.text }}>
          {comment}
        </p>
      )}

      {ideal && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: C.muted, fontFamily: F.mono }}>
          Ideal range for this question: <strong style={{ color: C.sub }}>{ideal}</strong>
        </div>
      )}
    </div>
  );
};

// ─── NEW: ComplexityBadge (inline, sits in the hero area) ─────────────────

const ComplexityBadge = ({ complexityRating }) => {
  if (!complexityRating) return null;
  const { label, color, tint } = complexityMeta(complexityRating);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 8,
      background: tint, border: `1.5px solid ${color}40`,
      fontFamily: F.mono, fontSize: 10.5, fontWeight: 800,
      color, letterSpacing: '0.5px',
    }}>
      <span style={{ fontSize: 9 }}>◆</span>
      {label}
    </span>
  );
};

// ─── NEW: WeakPatternAlert ────────────────────────────────────────────────

const WeakPatternAlert = ({ weakPattern, mounted, delay }) => {
  if (!weakPattern?.detected) return null;
  const label      = weakPattern?.label;
  const suggestion = weakPattern?.suggestion;
  if (!label && !suggestion) return null;

  return (
    <div
      style={{
        background: C.amberTint,
        border: `1.5px solid ${C.amber}45`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(8px)',
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 1,
          background: C.amber, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800,
        }}>
          ⚠
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{
              fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
              color: C.amber, letterSpacing: '1.1px', textTransform: 'uppercase',
            }}>
              Weak pattern detected
            </span>
            {label && (
              <span style={{
                padding: '2px 9px', borderRadius: 999,
                background: `${C.amber}20`, border: `1px solid ${C.amber}45`,
                fontSize: 11.5, fontWeight: 700, color: C.amber,
              }}>
                {label}
              </span>
            )}
          </div>
          {suggestion && (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: C.text }}>
              {suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── NEW: FollowUpQuestions ───────────────────────────────────────────────

const FollowUpQuestions = ({ questions, mounted, delay }) => {
  const list = safeArr(questions);
  if (!list.length) return null;

  return (
    <div
      style={{
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(8px)',
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: '#6D5BEE', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, fontFamily: F.mono,
        }}>
          ?
        </div>
        <span style={{
          fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
          color: '#6D5BEE', letterSpacing: '1.1px', textTransform: 'uppercase',
        }}>
          Likely follow-up questions
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((q, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: '#6D5BEE18', border: '1px solid #6D5BEE30',
              color: '#6D5BEE', fontFamily: F.mono,
              fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              {i + 1}
            </span>
            <p style={{
              margin: 0, fontSize: 13.5, lineHeight: 1.65,
              color: C.text, flex: 1,
            }}>
              {q}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main FeedbackCard ────────────────────────────────────────────────────

const FeedbackCard = ({
  feedback,
  onNext,
  onRetry,
  isLast,
  isRetrying,
}) => {
  const aiAvailable = feedback?.aiAvailable !== false;
  const score       = typeof feedback?.score === 'number' ? feedback.score : 0;
  const verdict     = verdictCopy(score);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(false);
      requestAnimationFrame(() => setTimeout(() => setMounted(true), 30));
    }, 0);
    return () => clearTimeout(t);
  }, [feedback]);

  // Original 5 sections — unchanged
  const sections = useMemo(() => ([
    {
      key: 'good',
      icon: '✓',
      label: 'What you did well',
      tone: C.green,
      tint: C.greenTint,
      border: '#A7E4C9',
      accent: C.green,
      content: feedback?.good || 'No feedback available.',
    },
    {
      key: 'missing',
      icon: '!',
      label: 'What was missing',
      tone: C.red,
      tint: C.redTint,
      border: '#F3B7B7',
      accent: C.red,
      content: feedback?.missing || 'No feedback available.',
    },
    {
      key: 'idealHint',
      icon: '★',
      label: 'Ideal answer hint',
      tone: C.amber,
      tint: C.amberTint,
      border: '#F2D48A',
      accent: C.amber,
      content: feedback?.idealHint || 'No hint available.',
    },
    {
      key: 'sampleAnswer',
      icon: '»',
      label: 'Sample answer',
      tone: C.blue600,
      tint: C.blue50,
      border: C.borderMd,
      accent: C.blue600,
      content: feedback?.sampleAnswer || 'No sample answer available.',
    },
    {
      key: 'tip',
      icon: '⚡',
      label: 'Improvement tip',
      tone: C.cyan600,
      tint: C.cyanTint,
      border: '#A0E8FA',
      accent: C.cyan600,
      content: feedback?.tip || 'No improvement tip available.',
    },
  ]), [feedback]);

  // Base delay after original 5 sections (5 × 55ms = 275ms)
  const newBaseDelay = 275;

  return (
    <>
      <style>{`
        .fb-card {
          width: 100%;
          min-width: 0;
          overflow-wrap: anywhere;
          font-family: ${F.body};
        }
        .fb-next-btn {
          transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
        }
        .fb-next-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(26,110,255,0.34);
        }
        .fb-next-btn:active { transform: translateY(0); }
        .fb-retry-btn {
          transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
        }
        .fb-retry-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        @keyframes fbLiveDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(5,150,105,0.35); }
          50%       { opacity: 0.6; box-shadow: 0 0 0 5px rgba(5,150,105,0); }
        }
        @keyframes fbSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .fb-spin { animation: fbSpin 0.9s linear infinite; }
        @media (max-width: 600px) {
          .fb-card         { padding: 18px !important; }
          .fb-head         { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
          .fb-head-right   { width: 100%; }
          .fb-kw-cols      { flex-direction: column !important; }
        }
      `}</style>

      <div className="fb-card" style={{
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 22,
        boxShadow: C.shadowMd,
        padding: 26,
        marginTop: 20,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow — unchanged */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 220, height: 220,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${aiAvailable ? scoreTint(score) : C.amberTint} 0%, transparent 70%)`,
          opacity: 0.7, pointerEvents: 'none',
        }} />

        {/* Status bar — unchanged */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20, position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: aiAvailable ? C.green : C.amber,
              animation: 'fbLiveDot 2.2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '1px', color: C.muted, textTransform: 'uppercase' }}>
              {aiAvailable ? 'Answer evaluated' : 'Evaluation pending'}
            </span>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.4px', color: C.faint }}>
            MOCKMATE AI
          </span>
        </div>

        {aiAvailable ? (
          <>
            {/* Score hero — complexity badge added inline */}
            <div className="fb-head" style={{
              display: 'flex', alignItems: 'center', gap: 24,
              padding: '4px 4px 22px',
              borderBottom: `1.5px solid ${C.border}`,
              marginBottom: 22,
              position: 'relative',
            }}>
              <ScoreRing score={score} mounted={mounted} />
              <div className="fb-head-right" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: scoreTint(score), color: scoreColor(score),
                    border: `1px solid ${scoreColor(score)}44`,
                    borderRadius: 999, padding: '4px 12px',
                    fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px',
                  }}>
                    <span aria-hidden>{verdict.icon}</span> {verdict.label.toUpperCase()}
                  </div>
                  {/* NEW: complexity badge sits next to verdict */}
                  <ComplexityBadge complexityRating={feedback?.complexityRating} />
                </div>
                <h3 style={{
                  margin: 0, fontFamily: F.display, fontSize: 19, fontWeight: 800,
                  color: C.text, letterSpacing: '-0.3px',
                }}>
                  {verdict.label}
                </h3>
                <p style={{ margin: '5px 0 0', fontSize: 13, color: C.sub, lineHeight: 1.55 }}>
                  {verdict.sub}
                </p>
              </div>
            </div>

            {/* Original 5 sections — unchanged */}
            {sections.map((s, i) => (
              <ReadoutSection
                key={s.key}
                icon={s.icon}
                label={s.label}
                tone={s.tone}
                tint={s.tint}
                border={s.border}
                accent={s.accent}
                content={s.content}
                delay={i * 55}
                mounted={mounted}
              />
            ))}

            {/* ── NEW sections ── */}
            <KeywordCoverage
              keywords={feedback?.keywords}
              mounted={mounted}
              delay={newBaseDelay}
            />
            <FrameworkCheck
              frameworkCheck={feedback?.frameworkCheck}
              mounted={mounted}
              delay={newBaseDelay + 55}
            />
            <ConfidenceBar
              confidenceScore={feedback?.confidenceScore}
              mounted={mounted}
              delay={newBaseDelay + 110}
            />
            <TimeEfficiency
              timeEfficiency={feedback?.timeEfficiency}
              mounted={mounted}
              delay={newBaseDelay + 165}
            />
            <WeakPatternAlert
              weakPattern={feedback?.weakPattern}
              mounted={mounted}
              delay={newBaseDelay + 220}
            />
            <FollowUpQuestions
              questions={feedback?.followUpQuestions}
              mounted={mounted}
              delay={newBaseDelay + 275}
            />
          </>
        ) : (
          /* AI unavailable state — unchanged */
          <div style={{
            background: C.amberTint,
            border: `1.5px solid #F2D48A`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 22,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9, background: C.amber, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
              }}>
                ⚠
              </div>
              <span style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: '#92400E' }}>
                AI evaluation unavailable
              </span>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#92400E', lineHeight: 1.65 }}>
              Your answer was submitted and saved successfully. The AI evaluator is
              currently unavailable, so we couldn't generate feedback for this answer yet.
            </p>
            <button
              className="fb-retry-btn"
              onClick={onRetry}
              disabled={!onRetry || isRetrying}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: C.amber, color: '#fff', border: 'none',
                borderRadius: 12, padding: '13px', fontFamily: F.body,
                fontSize: 13.5, fontWeight: 700,
                cursor: (!onRetry || isRetrying) ? 'not-allowed' : 'pointer',
                opacity: (!onRetry || isRetrying) ? 0.55 : 1,
                boxShadow: '0 6px 18px rgba(217,119,6,0.28)',
              }}
            >
              {isRetrying ? (
                <>
                  <span className="fb-spin" style={{
                    width: 13, height: 13, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                    display: 'inline-block',
                  }} />
                  Retrying AI evaluation…
                </>
              ) : (
                <>↻ Retry AI evaluation</>
              )}
            </button>
          </div>
        )}

        {/* Next button — unchanged */}
        <button
          className="fb-next-btn"
          onClick={onNext}
          style={{
            width: '100%',
            border: 'none', borderRadius: 14,
            background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
            color: '#fff', fontFamily: F.body,
            fontSize: 14.5, fontWeight: 800, letterSpacing: '0.1px',
            padding: '15px', cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(26,110,255,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          {isLast ? 'See final result' : 'Next question'}
          <span aria-hidden>→</span>
        </button>
      </div>
    </>
  );
};

export default FeedbackCard;
import { useEffect, useMemo, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// FeedbackCard — Blueprint Blue diagnostic readout
// Tokens mirror Navbar / Dashboard / Analytics exactly, so a question's
// feedback reads as the same instrument, not a bolted-on component.
// Signature element: the score ring reuses the Navbar logomark's gauge
// language — same arc, same gradient, same "target" crosshair core — so the
// per-question verdict visually rhymes with the IRS gauge the rest of the
// product is built around.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg:        '#FFFFFF',
  bgSubtle:  '#F8FAFF',
  bgSection: '#F0F4FF',
  card:      '#FFFFFF',
  cardAlt:   '#F8FAFF',

  text:      '#0A1628',
  sub:       '#3D5280',
  muted:     '#7A8BAF',
  faint:     '#A8B8D4',

  border:    '#DDE5F7',
  borderMd:  '#B8CAF0',
  borderStr: '#7FA3E8',

  blue50:    '#EBF2FF',
  blue100:   '#C7DAFF',
  blue200:   '#9DBFFF',
  blue400:   '#4D8FFF',
  blue500:   '#1A6EFF',
  blue600:   '#0057E8',
  blue700:   '#0044C4',
  blue900:   '#001F6B',

  cyan400:   '#00C8F0',
  cyan500:   '#00ADE0',
  cyan600:   '#0093C4',
  cyanTint:  '#E6F9FF',

  green:     '#059669',
  greenTint: '#ECFDF5',
  greenGlow: 'rgba(5,150,105,0.18)',

  amber:     '#D97706',
  amberTint: '#FFFBEB',
  orange:    '#EA580C',
  orangeTint:'#FFF7ED',

  red:       '#DC2626',
  redTint:   '#FEF2F2',

  shadow:    '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd:  '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg:  '0 16px 56px rgba(0,31,107,0.18)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

const scoreTint = (s) =>
  s >= 80 ? C.greenTint : s >= 60 ? C.blue50 : s >= 40 ? C.amberTint : C.orangeTint;

const verdictCopy = (s) => {
  if (s >= 80) return { label: 'Strong answer', icon: '◎', sub: 'This would land well in a live round.' };
  if (s >= 60) return { label: 'Solid attempt', icon: '◐', sub: 'On the right track — a few gaps to close.' };
  if (s >= 40) return { label: 'Needs work', icon: '◔', sub: 'The core idea is there but under-developed.' };
  return { label: 'Off target', icon: '○', sub: "Let's rebuild this one from the sample answer." };
};

// ─── Score ring — same gauge language as the Navbar logomark ───────────────
const ScoreRing = ({ score = 0, size = 108, mounted }) => {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color = scoreColor(pct);
  const gradId = 'fb-ring-grad';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.blue500} />
            <stop offset="100%" stopColor={color} />
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

// ─── One diagnostic readout row ─────────────────────────────────────────────
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
    <p style={{
      margin: 0, fontFamily: F.body, fontSize: 13.5, lineHeight: 1.65,
      color: C.text,
    }}>
      {content}
    </p>
  </div>
);

const FeedbackCard = ({
  feedback,
  onNext,
  onRetry,
  isLast,
  isRetrying,
}) => {
  const aiAvailable = feedback?.aiAvailable !== false;
  const score = typeof feedback?.score === 'number' ? feedback.score : 0;
  const verdict = verdictCopy(score);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = requestAnimationFrame(() => setTimeout(() => setMounted(true), 30));
    return () => cancelAnimationFrame(t);
  }, [feedback]);

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

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
          50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(5,150,105,0); }
        }
        @keyframes fbSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .fb-spin { animation: fbSpin 0.9s linear infinite; }

        @media (max-width: 600px) {
          .fb-card { padding: 18px !important; }
          .fb-head { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
          .fb-head-right { width: 100%; }
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
        {/* ambient corner wash, echoes hero gradient without competing */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 220, height: 220,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${aiAvailable ? scoreTint(score) : C.amberTint} 0%, transparent 70%)`,
          opacity: 0.7, pointerEvents: 'none',
        }} />

        {/* ── Diagnostic strip ─────────────────────────────────────────── */}
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
            {/* ── Score header: ring + verdict ─────────────────────────── */}
            <div className="fb-head" style={{
              display: 'flex', alignItems: 'center', gap: 24,
              padding: '4px 4px 22px',
              borderBottom: `1.5px solid ${C.border}`,
              marginBottom: 22,
              position: 'relative',
            }}>
              <ScoreRing score={score} mounted={mounted} />
              <div className="fb-head-right" style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: scoreTint(score), color: scoreColor(score),
                  border: `1px solid ${scoreColor(score)}44`,
                  borderRadius: 999, padding: '4px 12px', marginBottom: 9,
                  fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px',
                }}>
                  <span aria-hidden>{verdict.icon}</span> {verdict.label.toUpperCase()}
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

            {/* ── Readout sections ─────────────────────────────────────── */}
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
          </>
        ) : (
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
              <span style={{
                fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: '#92400E',
              }}>
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
                fontSize: 13.5, fontWeight: 700, cursor: (!onRetry || isRetrying) ? 'not-allowed' : 'pointer',
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

        {/* ── Next button ───────────────────────────────────────────────── */}
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
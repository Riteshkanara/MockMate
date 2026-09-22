import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';

// ─── MockMate Design Tokens ──────────────────────────────────────────────────
// Extracted from the screenshot: deep navy base, electric blue accent, bold type
const T = {
  // Base surfaces — dark navy stack
  bg0:        '#060D1A',   // deepest: page canvas
  bg1:        '#0D1B35',   // card bg
  bg2:        '#162440',   // elevated card / inner panel
  bg3:        '#1E2F4D',   // hover / subtle highlight
  bg4:        '#243558',   // border-adjacent fill

  // Borders
  border:     '#1E3050',
  borderMid:  '#263D62',
  borderHi:   '#2E4D7A',

  // Text
  textPrimary:   '#F0F4FF',
  textSecondary: '#8B9DC3',
  textMuted:     '#4E6080',
  textFaint:     '#2D3F5C',

  // Brand — electric blue anchor (from the logo / CTA)
  blue:       '#2E86FF',
  blueDark:   '#1B5FCC',
  blueGlow:   'rgba(46,134,255,0.18)',
  blueDeep:   'rgba(46,134,255,0.08)',

  // Semantic
  green:      '#10B981',
  greenDim:   'rgba(16,185,129,0.12)',
  greenBorder:'rgba(16,185,129,0.25)',

  amber:      '#F59E0B',
  amberDim:   'rgba(245,158,11,0.12)',
  amberBorder:'rgba(245,158,11,0.25)',

  red:        '#EF4444',
  redDim:     'rgba(239,68,68,0.12)',
  redBorder:  'rgba(239,68,68,0.25)',

  cyan:       '#06B6D4',
  cyanDim:    'rgba(6,182,212,0.10)',
  cyanBorder: 'rgba(6,182,212,0.22)',

  violet:     '#8B5CF6',
  violetDim:  'rgba(139,92,246,0.12)',
  violetBorder:'rgba(139,92,246,0.25)',
};

// ─── Typography ───────────────────────────────────────────────────────────────
const F = {
  // Inter is what the app uses (matches screenshot)
  display: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
  body:    `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
  mono:    `'SF Mono','Fira Code','Cascadia Code',ui-monospace,monospace`,
};

// ─── Score helpers ────────────────────────────────────────────────────────────
const scoreColor = (s) =>
  s >= 80 ? T.green : s >= 60 ? T.blue : s >= 40 ? T.amber : T.red;

const scoreDim = (s) =>
  s >= 80 ? T.greenDim : s >= 60 ? T.blueDeep : s >= 40 ? T.amberDim : T.redDim;

const scoreBorder = (s) =>
  s >= 80 ? T.greenBorder : s >= 60 ? 'rgba(46,134,255,0.3)' : s >= 40 ? T.amberBorder : T.redBorder;

const verdict = (s) => {
  if (s >= 90) return { label: 'Outstanding',   band: 'Excellent',   sub: 'Interview-ready. This is the answer that gets the offer.'         };
  if (s >= 75) return { label: 'Strong answer',  band: 'Strong',      sub: 'Really solid — a bit more depth and this is fully polished.'     };
  if (s >= 60) return { label: 'Solid attempt',  band: 'Good',        sub: 'Good base. A few more specific points and you nail this.'        };
  if (s >= 40) return { label: 'Needs work',     band: 'Developing',  sub: "Right track. Several important points were missing."             };
  return             { label: 'Off target',      band: 'Needs Work',  sub: "Don't worry — this is exactly why you practice. Review it."     };
};

const scoreGradient = (s) => {
  if (s >= 80) return `linear-gradient(135deg, #059669, #10B981)`;
  if (s >= 60) return `linear-gradient(135deg, #1B5FCC, #2E86FF)`;
  if (s >= 40) return `linear-gradient(135deg, #B45309, #F59E0B)`;
  return `linear-gradient(135deg, #B91C1C, #EF4444)`;
};

const safeArr    = (v) => Array.isArray(v) && v.length > 0 ? v : [];
const splitParts = (text = '') => {
  if (!text) return [];
  const byNum = text.split(/(?<!\d)\d+\.\s+/).map(s => s.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  const bySentence = text.replace(/([.!?])\s+/g, '$1|||').split('|||').map(s => s.trim()).filter(Boolean);
  return bySentence.length <= 1 ? [text.trim()] : bySentence;
};

// ─── Primitive atoms ──────────────────────────────────────────────────────────

// Monospace label — replaces ALL CAPS eyebrow, used sparingly
const Tag = ({ children, color = T.textMuted, bg, border }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 8px', borderRadius: 6,
    background: bg || 'transparent',
    border: `1px solid ${border || color + '30'}`,
    fontFamily: F.mono, fontSize: 10, fontWeight: 700,
    letterSpacing: '0.04em', color,
  }}>{children}</span>
);

// Section label — minimal, left-aligned, not shouty
const SectionLabel = ({ children, color = T.textMuted }) => (
  <div style={{
    fontFamily: F.mono, fontSize: 10.5, fontWeight: 700,
    color, letterSpacing: '0.05em', marginBottom: 8,
  }}>{children}</div>
);

// Bullet list
const BulletList = ({ items, bullet = T.textMuted }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {items.map((pt, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          marginTop: 8, background: bullet,
        }} />
        <span style={{
          fontSize: 13.5, lineHeight: 1.65,
          color: T.textSecondary, flex: 1, fontFamily: F.body,
        }}>{pt}</span>
      </div>
    ))}
  </div>
);

// Score ring — clean arc on dark bg
const ScoreRing = ({ score, mounted, size = 120 }) => {
  const r     = (size / 2) - 10;
  const circ  = 2 * Math.PI * r;
  const pct   = Math.max(0, Math.min(100, score));
  const dash  = circ - (pct / 100) * circ;
  const color = scoreColor(pct);
  const gid   = `ring-${Math.round(score)}`;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={T.bg4} strokeWidth={10} />
        {/* Arc */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={10}
          strokeDasharray={circ}
          strokeDashoffset={mounted ? dash : circ}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: F.display, fontSize: 32, fontWeight: 800,
          color, lineHeight: 1, letterSpacing: '-1.5px',
          fontVariantNumeric: 'tabular-nums',
        }}>{score}</span>
        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: T.textMuted, marginTop: 2 }}>/100</span>
      </div>
    </div>
  );
};

// ─── Score Hero ───────────────────────────────────────────────────────────────
const ScoreHero = ({ score, mounted, timeTaken, complexityRating, questionIndex, totalQuestions }) => {
  const v     = verdict(score);
  const color = scoreColor(score);
  const pct   = Math.max(0, Math.min(100, score));

  const cxColor = (r = '') => {
    const v = String(r).toLowerCase();
    if (v === 'advanced') return T.red;
    if (v === 'intermediate') return T.amber;
    return T.green;
  };

  return (
    <div style={{
      background: T.bg2,
      border: `1px solid ${T.borderMid}`,
      borderRadius: 14,
      padding: '20px 22px',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 22,
      flexWrap: 'wrap',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow behind ring */}
      <div style={{
        position: 'absolute', top: -40, left: -20,
        width: 180, height: 180, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <ScoreRing score={score} mounted={mounted} />

      <div style={{ flex: 1, minWidth: 140 }}>
        {/* Verdict + tags row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          <Tag color={color} bg={scoreDim(score)} border={scoreBorder(score)}>
            {v.band}
          </Tag>
          {complexityRating && (
            <Tag color={cxColor(complexityRating)} bg={T.bg3}>
              {String(complexityRating).charAt(0).toUpperCase() + String(complexityRating).slice(1)}
            </Tag>
          )}
          {totalQuestions > 0 && (
            <Tag color={T.textMuted}>Q{(questionIndex||0)+1}/{totalQuestions}</Tag>
          )}
        </div>

        {/* Big verdict label */}
        <div style={{
          fontFamily: F.display, fontSize: 24, fontWeight: 800,
          color: T.textPrimary, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 5,
        }}>{v.label}</div>
        <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>{v.sub}</div>

        {/* Bar + time */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ height: 4, borderRadius: 999, background: T.bg4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${pct}%`,
              background: scoreGradient(score),
              transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
          {timeTaken > 0 && (
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textMuted }}>{timeTaken}s taken</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Dark section card ────────────────────────────────────────────────────────
const DarkCard = ({ labelText, labelColor, accentColor, bg, border, delay, mounted, children }) => (
  <div style={{
    background: bg || T.bg2,
    border: `1px solid ${border || T.borderMid}`,
    borderLeft: `2px solid ${accentColor}`,
    borderRadius: '0 12px 12px 0',
    padding: '14px 16px',
    marginBottom: 9,
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(6px)',
    transition: `opacity 0.32s ease ${delay}ms, transform 0.32s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }}>
    {labelText && <SectionLabel color={labelColor || accentColor}>{labelText}</SectionLabel>}
    {children}
  </div>
);

// ─── Feedback section ─────────────────────────────────────────────────────────
const FeedbackSection = ({ label, color, dim, bord, content, delay, mounted }) => (
  <DarkCard labelText={label} labelColor={color} accentColor={color} bg={dim} border={bord} delay={delay} mounted={mounted}>
    <BulletList items={splitParts(content)} bullet={color} />
  </DarkCard>
);

// ─── MCQ Explanation ──────────────────────────────────────────────────────────
function McqExplanation({ question, correct, userAnswerIndex, skipped }) {
  const correctIndex = question?.correctAnswerIndex;
  const correctText  = correctIndex != null ? question?.options?.[correctIndex] : null;
  const userIndex    = userAnswerIndex ?? null;
  const userText     = userIndex != null ? question?.options?.[userIndex] : null;
  const explanation  = question?.explanation || '';

  if (skipped) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {correctText && (
        <div style={{ padding: '14px 16px', borderRadius: '0 12px 12px 0', border: `1px solid ${T.amberBorder}`, borderLeft: `2px solid ${T.amber}`, background: T.amberDim }}>
          <SectionLabel color={T.amber}>Correct answer — not attempted</SectionLabel>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.amber, lineHeight: 1.5 }}>{correctText}</div>
        </div>
      )}
      {explanation && (
        <div style={{ padding: '14px 16px', borderRadius: '0 12px 12px 0', border: `1px solid ${T.cyanBorder}`, borderLeft: `2px solid ${T.cyan}`, background: T.cyanDim }}>
          <SectionLabel color={T.cyan}>Why this is the answer</SectionLabel>
          <BulletList items={splitParts(explanation)} bullet={T.cyan} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 4 }}>
      {/* User answer */}
      <div style={{
        padding: '14px 16px', borderRadius: '0 12px 12px 0',
        border: `1px solid ${correct ? T.greenBorder : T.redBorder}`,
        borderLeft: `2px solid ${correct ? T.green : T.red}`,
        background: correct ? T.greenDim : T.redDim,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel color={correct ? T.green : T.red}>{correct ? 'Correct' : 'Incorrect'}</SectionLabel>
          <Tag color={T.textMuted}>Your answer</Tag>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, lineHeight: 1.5 }}>
          {userText || 'No option selected'}
        </div>
      </div>

      {/* Correct answer when wrong */}
      {!correct && correctText && (
        <div style={{
          padding: '14px 16px', borderRadius: '0 12px 12px 0',
          border: `2px solid ${T.greenBorder}`,
          borderLeft: `3px solid ${T.green}`,
          background: T.greenDim,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionLabel color={T.green}>Correct answer</SectionLabel>
            <Tag color={T.green} bg={T.greenDim} border={T.greenBorder}>Remember this</Tag>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.green, lineHeight: 1.5 }}>{correctText}</div>
        </div>
      )}

      {/* Explanation */}
      {explanation ? (
        <div style={{ padding: '14px 16px', borderRadius: '0 12px 12px 0', border: `1px solid ${T.cyanBorder}`, borderLeft: `2px solid ${T.cyan}`, background: T.cyanDim }}>
          <SectionLabel color={T.cyan}>Why this is the answer</SectionLabel>
          <BulletList items={splitParts(explanation)} bullet={T.cyan} />
        </div>
      ) : (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMuted }}>
          {correct ? 'Great recall — on to the next one.' : 'Review this topic before your next session.'}
        </div>
      )}

      {/* All options */}
      {question?.options?.length > 0 && (
        <div style={{ borderRadius: 12, border: `1px solid ${T.borderMid}`, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', background: T.bg3, borderBottom: `1px solid ${T.borderMid}` }}>
            <SectionLabel>All options</SectionLabel>
          </div>
          {question.options.map((opt, i) => {
            const isC = i === correctIndex, isU = i === userIndex;
            const col = isC ? T.green : isU && !correct ? T.red : T.textMuted;
            const bg  = isC ? T.greenDim : isU && !correct ? T.redDim : T.bg2;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', background: bg,
                borderBottom: i < question.options.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  border: `1.5px solid ${col}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, fontFamily: F.mono, color: col,
                  background: isC || isU ? `${col}15` : 'transparent',
                }}>{String.fromCharCode(65 + i)}</span>
                <span style={{ fontSize: 13.5, flex: 1, lineHeight: 1.5, color: isC || isU ? T.textPrimary : T.textMuted, fontWeight: isC ? 600 : 400 }}>{opt}</span>
                {isC && !isU && <Tag color={T.green} bg={T.greenDim} border={T.greenBorder}>correct</Tag>}
                {isC && isU  && <Tag color={T.green} bg={T.greenDim} border={T.greenBorder}>your pick ✓</Tag>}
                {isU && !isC && <Tag color={T.red}   bg={T.redDim}   border={T.redBorder}>your pick</Tag>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Keyword coverage ─────────────────────────────────────────────────────────
const KeywordCoverage = ({ keywords, mounted, delay }) => {
  const hit    = safeArr(keywords?.hit);
  const missed = safeArr(keywords?.missed);
  if (!hit.length && !missed.length) return null;
  const total    = hit.length + missed.length;
  const pct      = total > 0 ? Math.round((hit.length / total) * 100) : 0;
  const barColor = pct >= 70 ? T.green : pct >= 40 ? T.amber : T.red;
  return (
    <DarkCard labelText={`Keywords — ${hit.length}/${total} covered`} labelColor={barColor} accentColor={barColor} delay={delay} mounted={mounted}>
      <div style={{ height: 4, borderRadius: 999, background: T.bg4, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: barColor, transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      {hit.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.green, marginBottom: 5, fontFamily: F.mono }}>Used</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {hit.map((kw, i) => <Tag key={i} color={T.green} bg={T.greenDim} border={T.greenBorder}>{kw}</Tag>)}
          </div>
        </div>
      )}
      {missed.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.red, marginBottom: 5, fontFamily: F.mono }}>Missing</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {missed.map((kw, i) => <Tag key={i} color={T.red} bg={T.redDim} border={T.redBorder}>{kw}</Tag>)}
          </div>
        </div>
      )}
    </DarkCard>
  );
};

// ─── Framework check ─────────────────────────────────────────────────────────
const FrameworkCheck = ({ frameworkCheck, mounted, delay }) => {
  const detected = frameworkCheck?.detected;
  const followed = frameworkCheck?.followed;
  const missing  = safeArr(frameworkCheck?.missing);
  if (!detected || detected === 'none') return null;
  const color = followed ? T.green : T.amber;
  return (
    <DarkCard labelText={`Framework — ${String(detected).toUpperCase()}`} labelColor={color} accentColor={color} bg={followed ? T.greenDim : T.amberDim} border={followed ? T.greenBorder : T.amberBorder} delay={delay} mounted={mounted}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: missing.length > 0 ? 10 : 0 }}>
        <Tag color={color} bg={T.bg2}>{followed ? 'Followed correctly' : 'Not fully followed'}</Tag>
      </div>
      {missing.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.amber, marginBottom: 5, fontFamily: F.mono }}>Missing parts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {missing.map((p, i) => <Tag key={i} color={T.amber} bg={T.amberDim} border={T.amberBorder}>{p}</Tag>)}
          </div>
        </>
      )}
    </DarkCard>
  );
};

// ─── Confidence bar ───────────────────────────────────────────────────────────
const ConfidenceBar = ({ confidenceScore, mounted, delay }) => {
  if (confidenceScore == null) return null;
  const score = Math.max(0, Math.min(100, Number(confidenceScore) || 0));
  const color = score >= 75 ? T.green : score >= 50 ? T.blue : score >= 30 ? T.amber : T.red;
  const label = score >= 75 ? 'Confident' : score >= 50 ? 'Neutral' : score >= 30 ? 'Hesitant' : 'Uncertain';
  return (
    <DarkCard labelText={`Confidence — ${label}`} labelColor={color} accentColor={color} delay={delay} mounted={mounted}>
      <div style={{ height: 6, borderRadius: 999, background: T.bg4, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${T.red}20 0% 30%, ${T.amber}20 30% 50%, ${T.blue}20 50% 75%, ${T.green}20 75% 100%)` }} />
        <div style={{ height: '100%', borderRadius: 999, width: `${score}%`, background: color, position: 'relative', zIndex: 1, transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        {['Uncertain','Hesitant','Neutral','Confident'].map(z => (
          <span key={z} style={{ fontFamily: F.mono, fontSize: 9, color: T.textFaint }}>{z}</span>
        ))}
      </div>
    </DarkCard>
  );
};

// ─── Time efficiency ──────────────────────────────────────────────────────────
const TimeEfficiency = ({ timeEfficiency, mounted, delay }) => {
  const { rating, comment, idealRange } = timeEfficiency || {};
  if (!rating && !comment) return null;
  const color = String(rating).toLowerCase() === 'efficient' ? T.green : String(rating).toLowerCase() === 'rushed' ? T.amber : T.red;
  const dim   = color === T.green ? T.greenDim : color === T.amber ? T.amberDim : T.redDim;
  const bord  = color === T.green ? T.greenBorder : color === T.amber ? T.amberBorder : T.redBorder;
  return (
    <DarkCard labelText={`Time efficiency — ${rating || '—'}`} labelColor={color} accentColor={color} bg={dim} border={bord} delay={delay} mounted={mounted}>
      {comment && <p style={{ margin: '0 0 6px', fontSize: 13.5, lineHeight: 1.65, color: T.textSecondary }}>{comment}</p>}
      {idealRange && <span style={{ fontFamily: F.mono, fontSize: 10.5, color: T.textMuted }}>Ideal range: <strong style={{ color: T.textSecondary }}>{idealRange}</strong></span>}
    </DarkCard>
  );
};

// ─── Weak pattern ─────────────────────────────────────────────────────────────
const WeakPatternAlert = ({ weakPattern, mounted, delay }) => {
  if (!weakPattern?.detected) return null;
  const { label, suggestion } = weakPattern;
  if (!label && !suggestion) return null;
  return (
    <DarkCard labelText={label ? `Pattern — ${label}` : 'Weak pattern detected'} labelColor={T.amber} accentColor={T.amber} bg={T.amberDim} border={T.amberBorder} delay={delay} mounted={mounted}>
      {suggestion && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.textSecondary }}>{suggestion}</p>}
    </DarkCard>
  );
};

// ─── Follow-up questions ──────────────────────────────────────────────────────
const FollowUpQuestions = ({ questions, mounted, delay }) => {
  const list = safeArr(questions);
  if (!list.length) return null;
  return (
    <DarkCard labelText="Likely follow-ups" labelColor={T.blue} accentColor={T.blue} delay={delay} mounted={mounted}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((q, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: T.blueDeep, border: `1px solid ${T.blue}25`, color: T.blue,
              fontFamily: F.mono, fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
            }}>{i + 1}</span>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.textSecondary, flex: 1 }}>{q}</p>
          </div>
        ))}
      </div>
    </DarkCard>
  );
};

// ─── Delivery card ────────────────────────────────────────────────────────────
function DeliveryCard({ voiceMetrics, deliveryTip, mounted, delay }) {
  if (!voiceMetrics) return null;
  const { fillerWords, wpm, answerLength } = voiceMetrics;
  const wc = (b) => ({ tooSlow: T.amber, ideal: T.green, tooFast: T.red }[b] || T.blue);
  const lc = (r)  => ({ tooShort: T.amber, ideal: T.green, tooLong: T.red }[r]  || T.blue);
  const ll = (r)  => ({ tooShort: 'Too short', ideal: 'Ideal', tooLong: 'Too long' }[r] || '—');
  return (
    <DarkCard labelText="Voice delivery" labelColor={T.violet} accentColor={T.violet} bg={T.violetDim} border={T.violetBorder} delay={delay} mounted={mounted}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Pace */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textMuted }}>Speaking pace</span>
            <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: wc(wpm.band) }}>
              {wpm.wpm > 0 ? `${wpm.wpm} wpm` : '—'} · {wpm.label}
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: T.bg4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${Math.min(100, Math.round((wpm.wpm/200)*100))}%`, background: wc(wpm.band), transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
          {wpm.hint && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>{wpm.hint}</div>}
        </div>

        {/* Filler words */}
        <div style={{ padding: '10px 12px', borderRadius: 9, background: T.bg3, border: `1px solid ${T.borderMid}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textMuted }}>Filler words</span>
            <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: fillerWords.total === 0 ? T.green : fillerWords.total <= 3 ? T.amber : T.red }}>
              {fillerWords.total === 0 ? 'None' : `${fillerWords.total} detected`}
            </span>
          </div>
          {fillerWords.breakdown?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {fillerWords.breakdown.map(({ word, count }) => (
                <Tag key={word} color={count >= 3 ? T.red : T.amber} bg={count >= 3 ? T.redDim : T.amberDim} border={count >= 3 ? T.redBorder : T.amberBorder}>
                  "{word}" ×{count}
                </Tag>
              ))}
            </div>
          )}
          {fillerWords.total === 0 && <div style={{ fontSize: 11.5, color: T.green, fontWeight: 600, marginTop: 3 }}>Clean delivery.</div>}
        </div>

        {/* Length */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textMuted, marginBottom: 2 }}>Length · {answerLength.category}</div>
            <div style={{ fontSize: 11.5, color: T.textMuted }}>Target {answerLength.min}–{answerLength.max} words · {answerLength.hint}</div>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: lc(answerLength.rating), flexShrink: 0 }}>
            {answerLength.wordCount}w · {ll(answerLength.rating)}
          </span>
        </div>

        {/* Delivery tip */}
        {deliveryTip && (
          <div style={{ padding: '11px 13px', borderRadius: 9, background: T.bg3, border: `1px solid ${T.violet}25` }}>
            <SectionLabel color={T.violet}>Delivery tip</SectionLabel>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: T.textSecondary }}>{deliveryTip}</div>
          </div>
        )}
      </div>
    </DarkCard>
  );
}

// ─── Model answer (collapsible) ───────────────────────────────────────────────
function ModelAnswer({ sampleAnswer }) {
  const [open, setOpen] = useState(false);
  if (!sampleAnswer) return null;
  const pts = splitParts(sampleAnswer);
  return (
    <div style={{ marginBottom: 9, borderRadius: 12, border: `1px solid ${T.borderMid}`, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 16px', background: T.bg3, border: 'none', cursor: 'pointer',
          fontFamily: F.body, fontSize: 13, fontWeight: 600,
          color: T.textSecondary, textAlign: 'left',
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 18, height: 18, borderRadius: 4,
            background: open ? T.blue : T.bg4,
            border: `1px solid ${open ? T.blue : T.borderMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: open ? '#fff' : T.textMuted, fontWeight: 800,
            transition: 'all 0.15s ease',
          }}>{open ? '▾' : '▸'}</span>
          {open ? 'Hide model answer' : 'See a model answer'}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: T.textFaint, letterSpacing: '0.04em' }}>
          HOW A TOP ANSWER READS
        </span>
      </button>
      {open && (
        <div style={{ padding: '16px', background: T.bg2, borderTop: `1px solid ${T.borderMid}`, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {pts.map((pt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
                background: T.blueDeep, color: T.blue, fontSize: 10, fontWeight: 800, fontFamily: F.mono,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${T.blue}25`,
              }}>{i + 1}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.7, color: T.textSecondary }}>{pt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Next button ──────────────────────────────────────────────────────────────
const NextBtn = ({ onNext, isLoading, isLast }) => (
  <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
    <button type="button" onClick={onNext} disabled={isLoading}
      style={{
        width: '100%', border: 'none', borderRadius: 11,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: '#fff', fontFamily: F.display, fontSize: 14.5, fontWeight: 700,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        background: isLoading ? T.bg4 : `linear-gradient(135deg, #2563EB, #2E86FF)`,
        boxShadow: isLoading ? 'none' : '0 6px 24px rgba(46,134,255,0.30)',
        opacity: isLoading ? 0.6 : 1,
        letterSpacing: '-0.1px',
        transition: 'box-shadow 0.18s ease, opacity 0.15s ease',
      }}>
      {isLoading
        ? <><span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'mmSpin 0.7s linear infinite', display: 'inline-block' }} />
            {isLast ? 'Preparing report…' : 'Loading…'}</>
        : <>{isLast ? 'View my results' : 'Next question'} <span style={{ opacity: 0.6 }}>→</span></>
      }
    </button>
    <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: T.textFaint, fontFamily: F.mono }}>
      Press <kbd style={{
        display: 'inline-block', padding: '1px 6px', borderRadius: 4,
        border: `1px solid ${T.borderMid}`, borderBottomWidth: 2,
        background: T.bg3, color: T.textSecondary,
        fontFamily: F.mono, fontSize: 10, fontWeight: 700, lineHeight: 1.4,
      }}>Enter</kbd> to continue
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FEEDBACKPANEL ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function FeedbackPanel({
  question, feedback, onNext, isLoading, isLast, accent,
  userAnswerIndex, skipped, questionIndex, totalQuestions, voiceMetrics,
}) {
  const score     = Number(feedback?.score) || 0;
  const objective = ['mcq','aptitude'].includes(question?.questionType);
  const correct   = feedback?.correct === true;
  const color     = objective ? (correct ? T.green : T.red) : scoreColor(score);
  const v         = verdict(score);

  if (skipped) {
    const hint   = feedback?.idealHint   || '';
    const sample = feedback?.sampleAnswer || '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: F.body }}>
        <style>{`@keyframes mmSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ padding: '13px 16px', borderRadius: 10, border: `1px solid ${T.borderMid}`, background: T.bg3, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.textMuted, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: T.textMuted, marginBottom: 2 }}>QUESTION SKIPPED</div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>No answer scored — here's what a strong one looks like.</div>
          </div>
        </div>
        {objective
          ? <McqExplanation question={question} correct={false} userAnswerIndex={null} skipped />
          : (hint || sample) ? (
              <div style={{ borderRadius: 12, border: `1px solid ${T.borderMid}`, overflow: 'hidden' }}>
                {hint && (
                  <div style={{ padding: '14px 16px', background: T.cyanDim, borderBottom: `1px solid ${T.cyanBorder}`, borderLeft: `2px solid ${T.cyan}` }}>
                    <SectionLabel color={T.cyan}>What this question tests</SectionLabel>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.textPrimary, lineHeight: 1.5 }}>{hint}</div>
                  </div>
                )}
                {sample && (
                  <div style={{ padding: '16px', background: T.bg2 }}>
                    <SectionLabel>Model answer</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {splitParts(sample).map((pt, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, background: T.blueDeep, color: T.blue, fontSize: 10, fontWeight: 800, fontFamily: F.mono, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.blue}25` }}>{i+1}</span>
                          <span style={{ fontSize: 13.5, lineHeight: 1.7, color: T.textSecondary }}>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '12px', borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMuted, textAlign: 'center' }}>No model answer available.</div>
            )
        }
        <NextBtn onNext={onNext} isLoading={isLoading} isLast={isLast} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: F.body }}>
      <style>{`@keyframes mmSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Score strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '14px 16px', borderRadius: 12,
        border: `1px solid ${scoreBorder(score)}`,
        background: scoreDim(score),
        borderLeft: `3px solid ${color}`,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color, marginBottom: 3 }}>
              {objective ? (correct ? 'CORRECT' : 'INCORRECT') : v.band.toUpperCase()}
            </div>
            <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.4 }}>
              {objective ? (correct ? 'Well done — onto the next.' : 'Check the correct answer below.') : v.sub}
            </div>
          </div>
        </div>
        {!objective && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
            <span style={{ fontFamily: F.display, fontSize: 44, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
            <span style={{ fontFamily: F.mono, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>/100</span>
          </div>
        )}
      </div>

      {/* Score bar */}
      {!objective && (
        <div style={{ marginBottom: 2 }}>
          <div style={{ height: 4, borderRadius: 999, background: T.bg4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${score}%`, background: scoreGradient(score), transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            {feedback?.timeTaken > 0 && (
              <span style={{ fontFamily: F.mono, fontSize: 9, color: T.textFaint }}>Q{(questionIndex||0)+1}/{totalQuestions} · {feedback.timeTaken}s</span>
            )}
          </div>
        </div>
      )}

      {/* Feedback sections */}
      {!objective ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feedback?.good && splitParts(feedback.good).length > 0 && (
            <div style={{ padding: '13px 16px', borderRadius: '0 12px 12px 0', border: `1px solid ${T.greenBorder}`, borderLeft: `2px solid ${T.green}`, background: T.greenDim }}>
              <SectionLabel color={T.green}>What worked</SectionLabel>
              <BulletList items={splitParts(feedback.good)} bullet={T.green} />
            </div>
          )}
          {splitParts(feedback?.missing).length > 0 && (
            <div style={{ padding: '13px 16px', borderRadius: '0 12px 12px 0', border: `1px solid ${T.redBorder}`, borderLeft: `2px solid ${T.red}`, background: T.redDim }}>
              <SectionLabel color={T.red}>What was missing</SectionLabel>
              <BulletList items={splitParts(feedback.missing)} bullet={T.red} />
            </div>
          )}
          {(feedback?.idealHint || feedback?.tip) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {feedback?.idealHint && (
                <div style={{ padding: '11px 13px', borderRadius: '0 10px 10px 0', border: `1px solid ${T.cyanBorder}`, borderLeft: `2px solid ${T.cyan}`, background: T.cyanDim }}>
                  <SectionLabel color={T.cyan}>Key idea</SectionLabel>
                  <BulletList items={splitParts(feedback.idealHint)} bullet={T.cyan} />
                </div>
              )}
              {feedback?.tip && (
                <div style={{ padding: '11px 13px', borderRadius: '0 10px 10px 0', border: `1px solid ${T.amberBorder}`, borderLeft: `2px solid ${T.amber}`, background: T.amberDim }}>
                  <SectionLabel color={T.amber}>Next move</SectionLabel>
                  <BulletList items={splitParts(feedback.tip)} bullet={T.amber} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <McqExplanation question={question} correct={correct} userAnswerIndex={userAnswerIndex} />
      )}

      {!objective && <ModelAnswer sampleAnswer={feedback?.sampleAnswer} />}
      {!objective && voiceMetrics && (
        <DeliveryCard voiceMetrics={voiceMetrics} deliveryTip={feedback?.deliveryTip} mounted={true} delay={0} />
      )}

      <NextBtn onNext={onNext} isLoading={isLoading} isLast={isLast} />
    </div>
  );
}

FeedbackPanel.propTypes = {
  question: PropTypes.object.isRequired, feedback: PropTypes.object,
  onNext: PropTypes.func.isRequired, isLoading: PropTypes.bool.isRequired,
  isLast: PropTypes.bool.isRequired, accent: PropTypes.string,
  userAnswerIndex: PropTypes.number, skipped: PropTypes.bool,
  questionIndex: PropTypes.number, totalQuestions: PropTypes.number,
  voiceMetrics: PropTypes.object,
};
FeedbackPanel.defaultProps = {
  feedback: null, userAnswerIndex: null, skipped: false,
  questionIndex: 0, totalQuestions: 1, voiceMetrics: null, accent: T.blue,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FEEDBACKCARD (full analytics view) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const FeedbackCard = ({ feedback, onNext, onRetry, isLast, isRetrying, voiceMetrics }) => {
  const aiAvailable = feedback?.aiAvailable !== false;
  const score       = typeof feedback?.score === 'number' ? feedback.score : 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(false);
      requestAnimationFrame(() => setTimeout(() => setMounted(true), 30));
    }, 0);
    return () => clearTimeout(t);
  }, [feedback]);

  const sections = useMemo(() => ([
    { key: 'good',         label: 'What you did well',   color: T.green,  dim: T.greenDim,   bord: T.greenBorder,   content: feedback?.good         || 'No feedback available.' },
    { key: 'missing',      label: 'What was missing',    color: T.red,    dim: T.redDim,     bord: T.redBorder,     content: feedback?.missing      || 'No feedback available.' },
    { key: 'idealHint',    label: 'Key idea to include', color: T.amber,  dim: T.amberDim,   bord: T.amberBorder,   content: feedback?.idealHint    || 'No hint available.'     },
    { key: 'sampleAnswer', label: 'Sample answer',       color: T.cyan,   dim: T.cyanDim,    bord: T.cyanBorder,    content: feedback?.sampleAnswer || 'No sample answer.'      },
    { key: 'tip',          label: 'Improvement tip',     color: T.blue,   dim: T.blueDeep,   bord: 'rgba(46,134,255,0.25)', content: feedback?.tip   || 'No improvement tip.'    },
  ]), [feedback]);

  const BASE = 260;
  const vm          = voiceMetrics || feedback?.voiceMetrics || null;
  const deliveryTip = feedback?.deliveryTip || null;

  return (
    <>
      <style>{`
        @keyframes mmSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes mmPulse{0%,100%{opacity:1}50%{opacity:0.35}}
        .mm-next:hover:not(:disabled){box-shadow:0 10px 32px rgba(46,134,255,0.42)!important;transform:translateY(-1px)}
        .mm-next:active:not(:disabled){transform:translateY(0)}
        .mm-retry:hover:not(:disabled){opacity:0.88}
      `}</style>

      <div style={{
        background: T.bg1,
        border: `1px solid ${T.borderMid}`,
        borderRadius: 18,
        padding: 22,
        marginTop: 20,
        fontFamily: F.body,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle top glow line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${T.blue}50, transparent)`,
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: aiAvailable ? T.green : T.amber,
              animation: 'mmPulse 2.2s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textMuted, letterSpacing: '0.05em' }}>
              {aiAvailable ? 'ANSWER EVALUATED' : 'EVALUATION PENDING'}
            </span>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textFaint, letterSpacing: '0.04em' }}>
            MOCKMATE AI
          </span>
        </div>

        {aiAvailable ? (
          <>
            <ScoreHero
              score={score}
              mounted={mounted}
              questionIndex={feedback?.questionIndex}
              totalQuestions={feedback?.totalQuestions}
              timeTaken={feedback?.timeTaken}
              complexityRating={feedback?.complexityRating}
            />

            {sections.map((s, i) => (
              <FeedbackSection key={s.key} label={s.label} color={s.color} dim={s.dim} bord={s.bord} content={s.content} delay={i * 45} mounted={mounted} />
            ))}

            <KeywordCoverage   keywords={feedback?.keywords}              mounted={mounted} delay={BASE}       />
            <FrameworkCheck    frameworkCheck={feedback?.frameworkCheck}   mounted={mounted} delay={BASE + 50}  />
            <ConfidenceBar     confidenceScore={feedback?.confidenceScore} mounted={mounted} delay={BASE + 100} />
            <TimeEfficiency    timeEfficiency={feedback?.timeEfficiency}   mounted={mounted} delay={BASE + 150} />
            <WeakPatternAlert  weakPattern={feedback?.weakPattern}         mounted={mounted} delay={BASE + 200} />
            <FollowUpQuestions questions={feedback?.followUpQuestions}     mounted={mounted} delay={BASE + 250} />
            <DeliveryCard      voiceMetrics={vm} deliveryTip={deliveryTip} mounted={mounted} delay={BASE + 300} />
          </>
        ) : (
          <div style={{ padding: '18px 20px', borderRadius: 12, marginBottom: 18, border: `1px solid ${T.amberBorder}`, background: T.amberDim, borderLeft: `3px solid ${T.amber}` }}>
            <SectionLabel color={T.amber}>AI evaluation unavailable</SectionLabel>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: T.textSecondary, lineHeight: 1.65 }}>
              Your answer was saved. Feedback will appear once the evaluator is back online.
            </p>
            <button className="mm-retry" onClick={onRetry} disabled={!onRetry || isRetrying}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, background: T.amber, color: '#fff', border: 'none', borderRadius: 9,
                padding: '11px 16px', fontFamily: F.body, fontSize: 13, fontWeight: 700,
                cursor: (!onRetry || isRetrying) ? 'not-allowed' : 'pointer',
                opacity: (!onRetry || isRetrying) ? 0.55 : 1,
                transition: 'opacity 0.15s ease',
              }}>
              {isRetrying
                ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', animation: 'mmSpin 0.9s linear infinite', display: 'inline-block' }} /> Retrying…</>
                : 'Retry evaluation'
              }
            </button>
          </div>
        )}

        <button className="mm-next" onClick={onNext}
          style={{
            width: '100%', border: 'none', borderRadius: 11, marginTop: 4,
            background: `linear-gradient(135deg, #2563EB, #2E86FF)`,
            color: '#fff', fontFamily: F.display, fontSize: 14.5, fontWeight: 700,
            letterSpacing: '-0.1px', padding: '14px 16px', cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(46,134,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'transform 0.14s ease, box-shadow 0.14s ease',
          }}>
          {isLast ? 'See final result' : 'Next question'} <span style={{ opacity: 0.6 }}>→</span>
        </button>
      </div>
    </>
  );
};

FeedbackCard.propTypes = {
  feedback: PropTypes.object, onNext: PropTypes.func.isRequired,
  onRetry: PropTypes.func, isLast: PropTypes.bool,
  isRetrying: PropTypes.bool, voiceMetrics: PropTypes.object,
};
FeedbackCard.defaultProps = {
  feedback: null, onRetry: null, isLast: false, isRetrying: false, voiceMetrics: null,
};

export { FeedbackPanel, FeedbackCard };
export default FeedbackCard;
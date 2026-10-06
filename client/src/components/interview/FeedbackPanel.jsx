/**
 * MockMate — FeedbackPanel.jsx  (v6)
 * ─────────────────────────────────────────────────────────────────────────────
 * Reading order, top to bottom:
 *   1. Result        score, one-line verdict, how it compares to earlier answers
 *   2. Fix this first the single most useful change
 *   3. What worked / What to add
 *   4. Compare       your answer vs a strong answer (one switcher)
 *   5. Likely follow-ups
 *   6. Detailed analysis (collapsed): keywords, STAR, confidence, delivery
 *
 * What changed from v5
 *   - Removed invented numbers: the "+XP" figure (the server never sends XP) and
 *     the Rookie/Grinder/Pro/Legend ranks. Everything shown is real data.
 *   - Removed panels that could never render (framework check, habit to break,
 *     time efficiency): the server never returns those fields. Time used is
 *     now shown from the real timer instead.
 *   - One "Next" button, pinned to the bottom, instead of three.
 *   - The question is no longer repeated (it is on the left).
 *   - Evaluation-unavailable and skipped-while-generating states are handled.
 *   - Emoji replaced with the shared icon set; colour carries meaning only.
 *
 * Exports: FeedbackPanel (named + default)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import PropTypes from 'prop-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { C as CT, F } from '../../styles/token';
import Icon from './icons';
import LockedInsights from '../pro/LockedInsights';

const C = { ...CT, violet: '#6D5BEE', violetTint: '#F0EEFF' };

const HERO_BG = `linear-gradient(140deg, ${C.blue700} 0%, ${C.blue600} 55%, ${C.cyan600} 100%)`;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const safeArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

// Turns "1. foo 2. bar" or "Sentence one. Sentence two." into separate points.
const splitParts = (text = '') => {
  if (!text) return [];
  const byNum = text.split(/(?<!\d)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  const bySentence = text.replace(/([.!?])\s+/g, '$1|||').split('|||').map((s) => s.trim()).filter(Boolean);
  return bySentence.length <= 1 ? [text.trim()] : bySentence;
};

const fmtTime = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const num = (v) => (v == null ? null : Math.round(Number(typeof v === 'object' ? v.score : v) || 0));

const verdict = (s) => {
  if (s >= 90) return { label: 'Outstanding',   sub: 'Interview-ready. This is the kind of answer that gets offers.' };
  if (s >= 75) return { label: 'Strong answer', sub: 'Solid and well reasoned. A little more depth and it is polished.' };
  if (s >= 60) return { label: 'Good base',     sub: 'You have the core. More specific points would lift it.' };
  if (s >= 40) return { label: 'Getting there', sub: 'The direction is right but important points are missing.' };
  return             { label: 'Needs work',     sub: 'Use the model answer below, then try this topic again.' };
};

const scoreColor = (s) => (s >= 70 ? '#6EE7B7' : s >= 40 ? '#FCD34D' : '#FCA5A5');

// ═══════════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════════
const PANEL_CSS = `
@keyframes fbBar  { from { width:0 } }
@keyframes fbIn   { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
@keyframes fbSpin { to { transform:rotate(360deg) } }
@keyframes fbShimmer { from { background-position:200% 0 } to { background-position:-100% 0 } }
.fb-in    { animation:fbIn .38s cubic-bezier(.16,1,.3,1) both; }
.fb-bar   { animation:fbBar .9s cubic-bezier(.16,1,.3,1) both; }
.fb-tab   { transition:background .15s ease, color .15s ease, box-shadow .15s ease; }
.fb-tab:focus-visible, .fb-acc:focus-visible, .fb-next:focus-visible { outline:2.5px solid ${C.blue500}; outline-offset:2px; }
.fb-acc:hover { background:${C.cardAlt} !important; }
.fb-next:hover:not(:disabled) { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 12px 28px rgba(26,110,255,.34) !important; }
.fb-next:active:not(:disabled) { transform:scale(.99); }
.fb-scroll { scroll-margin-top:96px; }
@media (prefers-reduced-motion:reduce) {
  .fb-in, .fb-bar { animation:none !important; }
  .fb-tab, .fb-acc, .fb-next { transition:none !important; }
  .fb-shimmer { animation:none !important; }
}
@media (max-width:480px) {
  .fb-twocol { grid-template-columns:1fr !important; }
  .fb-hero-top { flex-direction:column !important; align-items:flex-start !important; }
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════════════════
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: '0 1px 12px rgba(26,110,255,0.06)' };

const Heading = ({ children, right }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
    <h3 style={{ margin: 0, fontFamily: F.display, fontSize: 15.5, fontWeight: 800, color: C.text, letterSpacing: '-0.2px' }}>{children}</h3>
    {right && <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{right}</span>}
  </div>
);
Heading.propTypes = { children: PropTypes.node.isRequired, right: PropTypes.node };

const Points = ({ items, color }) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
    {items.map((pt, i) => (
      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 9 }} />
        <span style={{ fontSize: 14.5, lineHeight: 1.65, color: C.text, flex: 1 }}>{pt}</span>
      </li>
    ))}
  </ul>
);
Points.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired, color: PropTypes.string.isRequired };

const Bar = ({ pct, color, height = 7, delay = 0 }) => (
  <div style={{ height, borderRadius: 99, background: C.blue50, overflow: 'hidden' }}>
    <div className="fb-bar" style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: 99, background: color, animationDelay: `${delay}ms` }} />
  </div>
);
Bar.propTypes = { pct: PropTypes.number.isRequired, color: PropTypes.string.isRequired, height: PropTypes.number, delay: PropTypes.number };

const Pill = ({ children, color = C.sub, bg, border }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, color, background: bg || `${color}14`, border: `1px solid ${border || `${color}30`}`, whiteSpace: 'nowrap' }}>
    {children}
  </span>
);
Pill.propTypes = { children: PropTypes.node.isRequired, color: PropTypes.string, bg: PropTypes.string, border: PropTypes.string };

const Notice = ({ tone = 'info', icon = 'info', title, children }) => {
  const t = {
    info: { c: C.blue700, bg: C.blue50,    b: C.blue100 },
    warn: { c: C.amber,   bg: C.amberTint, b: `${C.amber}40` },
    good: { c: C.green,   bg: C.greenTint, b: `${C.green}30` },
  }[tone];
  return (
    <div role="status" style={{ display: 'flex', gap: 11, padding: '13px 15px', borderRadius: 14, background: t.bg, border: `1px solid ${t.b}` }}>
      <Icon name={icon} size={18} style={{ color: t.c, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 2 }}>{title}</div>}
        <div style={{ fontSize: 14, lineHeight: 1.6, color: C.sub }}>{children}</div>
      </div>
    </div>
  );
};
Notice.propTypes = { tone: PropTypes.string, icon: PropTypes.string, title: PropTypes.string, children: PropTypes.node };

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setValue(target); return undefined; }
    let raf; let start = null;
    const tick = (now) => {
      if (start == null) start = now;
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - t, 4)) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RESULT — open answers
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreHero({ score, timeTaken = 0, timeLimit = 0, previousScores = [], feedback = null }) {
  const v      = verdict(score);
  const shown  = useCountUp(score);
  const accent = scoreColor(score);
  const SIZE = 108, R = 44, CIRC = 2 * Math.PI * R;
  const [go, setGo] = useState(false);
  useEffect(() => { const id = setTimeout(() => setGo(true), 40); return () => clearTimeout(id); }, []);

  // How this answer compares with the user's earlier written answers this session.
  let compare = null;
  if (previousScores.length > 0) {
    const avg  = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
    const diff = Math.round(score - avg);
    const best = score > Math.max(...previousScores);
    compare = best
      ? { text: 'Your best answer this session', up: true }
      : diff >= 3 ? { text: `${diff} above your average so far`, up: true }
      : diff <= -3 ? { text: `${Math.abs(diff)} below your average so far`, up: false }
      : { text: 'In line with your average so far', up: null };
  }

  const kw    = feedback?.keywordCoverage;
  const hit   = safeArr(kw?.hit).length;
  const total = hit + safeArr(kw?.missed).length;
  const conf  = num(feedback?.confidenceScore);

  // Free tier: keywords and confidence come from the locked deep analysis, so show a lock, not a gap.
  const basic = feedback?.tier === 'basic';
  const stats = [
    timeTaken > 0 ? { k: 'Time used', v: timeLimit ? `${fmtTime(timeTaken)} of ${fmtTime(timeLimit)}` : fmtTime(timeTaken) } : null,
    basic         ? { k: 'Keywords covered', locked: true } : (total > 0 ? { k: 'Keywords covered', v: `${hit} of ${total}` } : null),
    basic         ? { k: 'Confidence', locked: true }       : (conf != null ? { k: 'Confidence', v: `${conf}%` } : null),
  ].filter(Boolean);

  return (
    <div style={{ background: HERO_BG, borderRadius: 18, padding: '20px 20px 18px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 14px 40px rgba(0,31,107,0.22)' }}>
      <div className="fb-hero-top" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }} role="img" aria-label={`Score ${score} out of 100`}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={8} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={go ? CIRC * (1 - Math.max(0, Math.min(100, score)) / 100) : CIRC}
              style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>out of 100</span>
          </div>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1.2 }}>{v.label}</div>
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.86)' }}>{v.sub}</p>
          {compare && (
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 99, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', fontSize: 13, fontWeight: 600 }}>
              {compare.up === true && <span aria-hidden="true">▲</span>}
              {compare.up === false && <span aria-hidden="true">▼</span>}
              {compare.text}
            </div>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, marginTop: 18, borderRadius: 13, overflow: 'hidden', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}>
          {stats.map((st, i) => (
            <div key={st.k} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: i ? '1px solid rgba(255,255,255,.16)' : 'none' }}>
              <div style={{ fontFamily: F.display, fontSize: 15.5, fontWeight: 800, minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {st.locked
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Locked, Pro"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                  : st.v}
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.68)', marginTop: 2 }}>{st.k}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
ScoreHero.propTypes = {
  score: PropTypes.number.isRequired, timeTaken: PropTypes.number, timeLimit: PropTypes.number,
  previousScores: PropTypes.arrayOf(PropTypes.number), feedback: PropTypes.object,
};
// ═══════════════════════════════════════════════════════════════════════════════
// 1b. RESULT — multiple choice
// ═══════════════════════════════════════════════════════════════════════════════
function McqHero({ correct = false, question = null, userAnswerIndex = null, timeTaken = 0, timeLimit = 0 }) {
  const options = question?.options || [];
  const ci = question?.correctAnswerIndex;
  const letter = (i) => (i != null ? String.fromCharCode(65 + i) : '');
  const accent = correct ? '#6EE7B7' : '#FCA5A5';

  return (
    <div style={{ background: HERO_BG, borderRadius: 18, padding: '20px', color: '#fff', boxShadow: '0 14px 40px rgba(0,31,107,0.22)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ width: 62, height: 62, borderRadius: 18, flexShrink: 0, background: 'rgba(255,255,255,.12)', border: `1.5px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
          <Icon name={correct ? 'check' : 'x'} size={32} stroke={3} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15 }}>{correct ? 'Correct' : 'Not this time'}</div>
          <p style={{ margin: '5px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.86)' }}>
            {correct ? 'That is the right answer.' : `The answer is option ${letter(ci)}. The explanation below shows why.`}
            {timeTaken > 0 && <span style={{ color: 'rgba(255,255,255,.65)' }}>{` Answered in ${fmtTime(timeTaken)}${timeLimit ? ` of ${fmtTime(timeLimit)}` : ''}.`}</span>}
          </p>
        </div>
      </div>
      {!correct && userAnswerIndex != null && options[userAnswerIndex] && (
        <div style={{ marginTop: 14, padding: '10px 13px', borderRadius: 12, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: 'rgba(255,255,255,.66)' }}>You chose {letter(userAnswerIndex)}: </span>{options[userAnswerIndex]}
        </div>
      )}
    </div>
  );
}
McqHero.propTypes = { correct: PropTypes.bool, question: PropTypes.object, userAnswerIndex: PropTypes.number, timeTaken: PropTypes.number, timeLimit: PropTypes.number };
// ═══════════════════════════════════════════════════════════════════════════════
// 2 + 3. FIX FIRST, WORKED / ADD
// ═══════════════════════════════════════════════════════════════════════════════
// A tip is one recommendation, so it reads as a paragraph. Only a genuinely
// numbered list ("1. ... 2. ...") is split into points.
const splitNumbered = (text = '') => text.split(/(?<!\d)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);

function FixFirst({ tip }) {
  if (!tip || !tip.trim()) return null;
  const numbered = splitNumbered(tip);
  return (
    <section style={{ ...card, padding: '16px 18px', borderLeft: `4px solid ${C.blue500}` }}>
      <Heading>Fix this first</Heading>
      {numbered.length > 1
        ? <Points items={numbered} color={C.blue500} />
        : <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: C.text }}>{tip.trim()}</p>}
    </section>
  );
}
FixFirst.propTypes = { tip: PropTypes.string };

function WorkedAndMissing({ good, missing }) {
  const goodParts = splitParts(good);
  const missParts = splitParts(missing);
  if (!goodParts.length && !missParts.length) return null;
  const both = goodParts.length && missParts.length;
  return (
    <div className="fb-twocol" style={{ display: 'grid', gridTemplateColumns: both ? '1fr 1fr' : '1fr', gap: 12 }}>
      {goodParts.length > 0 && (
        <section style={{ ...card, padding: '16px 18px', background: C.greenTint, borderColor: `${C.green}33` }}>
          <Heading>What worked</Heading>
          <Points items={goodParts} color={C.green} />
        </section>
      )}
      {missParts.length > 0 && (
        <section style={{ ...card, padding: '16px 18px', background: C.amberTint, borderColor: `${C.amber}38` }}>
          <Heading>What to add</Heading>
          <Points items={missParts} color={C.amber} />
        </section>
      )}
    </div>
  );
}
WorkedAndMissing.propTypes = { good: PropTypes.string, missing: PropTypes.string };

// ═══════════════════════════════════════════════════════════════════════════════
// 4. YOUR ANSWER vs A STRONG ANSWER
// ═══════════════════════════════════════════════════════════════════════════════
function AnswerCompare({ userAnswer = '', sampleAnswer = '', idealHint = '', defaultTab = 'yours' }) {
  const hasYours = Boolean(userAnswer && userAnswer.trim());
  const hasModel = Boolean(sampleAnswer);
  const [tab, setTab] = useState(defaultTab === 'model' && hasModel ? 'model' : hasYours ? 'yours' : 'model');
  if (!hasYours && !hasModel) return null;

  const tabs = [hasYours && { id: 'yours', label: 'Your answer' }, hasModel && { id: 'model', label: 'Model answer' }].filter(Boolean);
  const words = hasYours ? userAnswer.trim().split(/\s+/).length : 0;
  const modelWords = hasModel ? sampleAnswer.trim().split(/\s+/).length : 0;

  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 0' }}>
        <Heading right={tab === 'yours' ? `${words} words` : `${modelWords} words`}>Compare answers</Heading>
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Compare answers" style={{ display: 'inline-flex', padding: 3, borderRadius: 11, background: C.blue50, border: `1px solid ${C.blue100}`, marginBottom: 14 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className="fb-tab"
                onClick={() => setTab(t.id)}
                style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', minHeight: 38, borderRadius: 9, fontFamily: F.body, fontSize: 14, fontWeight: 700, background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? C.blue700 : C.sub, boxShadow: tab === t.id ? '0 1px 6px rgba(26,110,255,.16)' : 'none' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '0 18px 18px' }} role="tabpanel">
        {tab === 'yours' ? (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: C.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{userAnswer}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {idealHint && (
              <div style={{ padding: '11px 13px', borderRadius: 12, background: C.blue50, border: `1px solid ${C.blue100}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.blue700, marginBottom: 3 }}>The key idea</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text }}>{idealHint}</div>
              </div>
            )}
            <Points items={splitParts(sampleAnswer)} color={C.blue500} />
          </div>
        )}
      </div>
    </section>
  );
}
AnswerCompare.propTypes = { userAnswer: PropTypes.string, sampleAnswer: PropTypes.string, idealHint: PropTypes.string, defaultTab: PropTypes.string };
// ═══════════════════════════════════════════════════════════════════════════════
// 5. FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════
function FollowUps({ questions }) {
  const list = safeArr(questions);
  if (!list.length) return null;
  return (
    <section style={{ ...card, padding: '16px 18px' }}>
      <Heading>Likely follow-ups</Heading>
      <p style={{ margin: '-4px 0 12px', fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>An interviewer could ask these next. Think through your answer to each.</p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((q, i) => (
          <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: C.blue50, color: C.blue700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text }}>{q}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
FollowUps.propTypes = { questions: PropTypes.array };

// ═══════════════════════════════════════════════════════════════════════════════
// 6. DETAILED ANALYSIS (collapsed)
// ═══════════════════════════════════════════════════════════════════════════════
function Keywords({ keywords }) {
  const hit = safeArr(keywords?.hit);
  const missed = safeArr(keywords?.missed);
  if (!hit.length && !missed.length) return null;
  const total = hit.length + missed.length;
  const pct = Math.round((hit.length / total) * 100);
  return (
    <div>
      <Heading right={`${hit.length} of ${total}`}>Keywords you covered</Heading>
      <Bar pct={pct} color={pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red} height={8} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
        {hit.map((k) => <Pill key={`h-${k}`} color={C.green}><Icon name="check" size={12} stroke={3} />{k}</Pill>)}
        {missed.map((k) => <Pill key={`m-${k}`} color={C.red}><Icon name="x" size={12} stroke={3} />{k}</Pill>)}
      </div>
      {missed.length > 0 && <p style={{ margin: '10px 0 0', fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>Red keywords were not in your answer. Work them in where they fit naturally.</p>}
    </div>
  );
}
Keywords.propTypes = { keywords: PropTypes.object };

const starIsEmpty = (sb) => !sb || [sb.S, sb.T, sb.A, sb.R].every((p) => !p || Number(p.score) === 0);

function Star({ starBreakdown }) {
  if (starIsEmpty(starBreakdown)) return null;
  const { S, T, A, R, overall } = starBreakdown;
  const pillars = [
    { label: 'Situation', data: S, color: C.cyan500 },
    { label: 'Task',      data: T, color: C.blue500 },
    { label: 'Action',    data: A, color: C.violet },
    { label: 'Result',    data: R, color: C.green },
  ];
  return (
    <div>
      <Heading>How well it followed STAR</Heading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {pillars.map(({ label, data, color }) => {
          if (!data) return null;
          const s = Math.max(0, Math.min(100, Number(data.score) || 0));
          return (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 14, fontWeight: 700, color: C.text }}>
                <span>{label}</span><span style={{ color, fontFamily: F.mono }}>{s}/100</span>
              </div>
              <Bar pct={s} color={color} height={6} />
              {data.note && <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>{data.note}</div>}
            </div>
          );
        })}
        {overall && !/not applicable/i.test(overall) && (
          <div style={{ padding: '11px 13px', borderRadius: 12, background: C.blue50, border: `1px solid ${C.blue100}`, fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{overall}</div>
        )}
      </div>
    </div>
  );
}
Star.propTypes = { starBreakdown: PropTypes.object };

function Confidence({ confidenceScore }) {
  if (confidenceScore == null) return null;
  const obj   = typeof confidenceScore === 'object';
  const score = Math.max(0, Math.min(100, num(confidenceScore) || 0));
  const label = obj && confidenceScore.label ? confidenceScore.label : score >= 75 ? 'Confident' : score >= 50 ? 'Neutral' : score >= 30 ? 'Hesitant' : 'Uncertain';
  const note  = obj ? confidenceScore.note : null;
  return (
    <div>
      <Heading right={`${score}%`}>How confident you sounded</Heading>
      <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.violet, marginBottom: 8 }}>{label}</div>
      <Bar pct={score} color={C.violet} height={8} />
      {obj && (confidenceScore.formalPct != null || confidenceScore.hedgingPct != null) && (
        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
          {confidenceScore.formalPct != null && <Pill color={C.cyan600}>Formal wording {confidenceScore.formalPct}%</Pill>}
          {confidenceScore.hedgingPct != null && <Pill color={C.amber}>Hedging words {confidenceScore.hedgingPct}%</Pill>}
        </div>
      )}
      {note && <p style={{ margin: '10px 0 0', fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{note}</p>}
    </div>
  );
}
Confidence.propTypes = { confidenceScore: PropTypes.oneOfType([PropTypes.object, PropTypes.number]) };

function Delivery({ vm, feedback }) {
  if (!vm) return null;
  const { wpm, fillerWords, answerLength } = vm;
  const tone = feedback?.toneAnalysis, vocab = feedback?.vocabularyRichness, hes = feedback?.hesitationPattern;
  const wpmColor = { tooSlow: C.amber, ideal: C.green, tooFast: C.red }[wpm?.band] || C.blue500;
  const fillers = fillerWords?.total ?? 0;
  const fillerColor = fillers === 0 ? C.green : fillers <= 3 ? C.amber : C.red;
  const scores = [
    tone && { k: 'Tone', v: tone.score, sub: tone.label },
    vocab && { k: 'Vocabulary', v: vocab.score, sub: vocab.label },
    hes && { k: 'Fluency', v: hes.score, sub: hes.pattern },
  ].filter(Boolean);

  return (
    <div>
      <Heading>How you delivered it</Heading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="fb-twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.muted }}>Speaking pace</div>
            <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: wpmColor, margin: '2px 0 6px' }}>{wpm?.wpm > 0 ? `${wpm.wpm} wpm` : 'Not measured'}</div>
            <Bar pct={Math.min(100, ((wpm?.wpm || 0) / 200) * 100)} color={wpmColor} height={5} />
            {wpm?.label && <div style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>{wpm.label}{wpm.hint ? `. ${wpm.hint}` : ''}</div>}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.muted }}>Filler words</div>
            <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: fillerColor, margin: '2px 0 6px' }}>{fillers === 0 ? 'None' : fillers}</div>
            {fillers > 0 && safeArr(fillerWords?.breakdown).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {fillerWords.breakdown.map(({ word, count }) => <Pill key={word} color={count >= 3 ? C.red : C.amber}>&quot;{word}&quot; x{count}</Pill>)}
              </div>
            ) : <div style={{ fontSize: 13, color: C.sub }}>{fillers === 0 ? 'Clean delivery.' : ''}</div>}
          </div>
        </div>

        {answerLength && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              <span>Length</span>
              <span style={{ color: C.sub, fontWeight: 600 }}>{answerLength.wordCount} words, target {answerLength.min}–{answerLength.max}</span>
            </div>
            <div style={{ position: 'relative', height: 7, borderRadius: 99, background: C.blue50, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: `${(answerLength.min / 350) * 100}%`, width: `${((answerLength.max - answerLength.min) / 350) * 100}%`, height: '100%', background: `${C.green}30` }} />
              <div style={{ position: 'relative', height: '100%', width: `${Math.min(100, (answerLength.wordCount / 350) * 100)}%`, borderRadius: 99, background: answerLength.rating === 'ideal' ? C.green : C.amber }} />
            </div>
            {answerLength.hint && <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>{answerLength.hint}</div>}
          </div>
        )}

        {scores.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scores.length}, 1fr)`, gap: 10 }}>
            {scores.map((s) => (
              <div key={s.k} style={{ padding: '11px 8px', textAlign: 'center', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 800, color: C.text }}>{s.v}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>{s.k}</div>
                <div style={{ fontSize: 12.5, color: C.muted }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {[tone?.note, vocab?.note, hes?.note].filter(Boolean).map((n, i) => (
          <p key={i} style={{ margin: 0, fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{n}</p>
        ))}

        {feedback?.deliveryTip && (
          <div style={{ padding: '12px 14px', borderRadius: 12, background: C.violetTint, border: `1px solid ${C.violet}30` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.violet, marginBottom: 3 }}>Delivery tip</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text }}>{feedback.deliveryTip}</div>
          </div>
        )}
      </div>
    </div>
  );
}
Delivery.propTypes = { vm: PropTypes.object, feedback: PropTypes.object };

// Shown where a section WILL appear once the background analysis (model answer,
// keywords, STAR, confidence, follow-ups) has been generated. The score and core
// feedback above are already final; only these extras are still loading.
function PendingBlock({ label, lines = 3 }) {
  return (
    <section role="status" aria-live="polite" aria-label={label} style={{ ...card, padding: '14px 18px' }}>
      <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: C.muted, marginBottom: 11 }}>{label}</div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="fb-shimmer"
          style={{
            height: 10, borderRadius: 6, marginTop: i ? 9 : 0,
            width: i === lines - 1 ? '62%' : '100%',
            backgroundImage: `linear-gradient(90deg, ${C.border}, ${C.cardAlt}, ${C.border})`,
            backgroundSize: '300% 100%',
            animation: 'fbShimmer 1.4s linear infinite',
          }}
        />
      ))}
    </section>
  );
}
PendingBlock.propTypes = { label: PropTypes.string.isRequired, lines: PropTypes.number };
function DetailedAnalysis({ feedback, vm }) {
  const [open, setOpen] = useState(false);
  const kw = feedback?.keywordCoverage || feedback?.keywords;
  const sections = [
    (safeArr(kw?.hit).length || safeArr(kw?.missed).length) && 'Keywords',
    !starIsEmpty(feedback?.starBreakdown) && 'STAR',
    feedback?.confidenceScore != null && 'Confidence',
    vm && 'Delivery',
  ].filter(Boolean);
  if (!sections.length) return null;

  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <button
        type="button"
        className="fb-acc"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '15px 18px', minHeight: 58, background: C.surface, border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span>
          <span style={{ display: 'block', fontFamily: F.display, fontSize: 15.5, fontWeight: 800, color: C.text }}>Detailed analysis</span>
          <span style={{ display: 'block', fontSize: 13.5, color: C.muted, marginTop: 2 }}>{sections.join(', ')}</span>
        </span>
        <Icon name={open ? 'chevUp' : 'chevDown'} size={20} style={{ color: C.blue600 }} />
      </button>
      {open && (
        <div className="fb-in" style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 24, borderTop: `1px solid ${C.border}` }}>
          <Keywords keywords={kw} />
          <Star starBreakdown={feedback?.starBreakdown} />
          <Confidence confidenceScore={feedback?.confidenceScore} />
          <Delivery vm={vm} feedback={feedback} />
        </div>
      )}
    </section>
  );
}
DetailedAnalysis.propTypes = { feedback: PropTypes.object, vm: PropTypes.object };

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIPLE CHOICE REVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function McqReview({ question, correct, userAnswerIndex, skipped }) {
  const ci = question?.correctAnswerIndex;
  const options = safeArr(question?.options);
  const explanation = question?.explanation || '';
  return (
    <>
      {explanation && (
        <section style={{ ...card, padding: '16px 18px', borderLeft: `4px solid ${C.blue500}` }}>
          <Heading>Why this is the answer</Heading>
          <Points items={splitParts(explanation)} color={C.blue500} />
        </section>
      )}
      {options.length > 0 && (
        <section style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 10px' }}><Heading>All options</Heading></div>
          {options.map((opt, i) => {
            const isC = i === ci;
            const isU = i === userAnswerIndex;
            const wrong = isU && !correct;
            const bg = isC ? C.greenTint : wrong ? C.redTint : C.surface;
            const col = isC ? C.green : wrong ? C.red : C.muted;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: bg, borderTop: `1px solid ${C.border}`, minHeight: 50 }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, border: `1.5px solid ${isC || wrong ? col : C.border}`, color: col, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 800 }}>
                  {isC ? <Icon name="check" size={15} stroke={3} /> : wrong ? <Icon name="x" size={15} stroke={3} /> : String.fromCharCode(65 + i)}
                </span>
                <span style={{ flex: 1, fontSize: 14.5, lineHeight: 1.5, color: C.text, fontWeight: isC ? 700 : 500 }}>{opt}</span>
                {isC && <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{skipped ? 'Correct answer' : 'Correct'}</span>}
                {wrong && <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>Your answer</span>}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
McqReview.propTypes = { question: PropTypes.object, correct: PropTypes.bool, userAnswerIndex: PropTypes.number, skipped: PropTypes.bool };

// ═══════════════════════════════════════════════════════════════════════════════
// NEXT BAR — one primary action, pinned to the bottom of the column
// ═══════════════════════════════════════════════════════════════════════════════
function NextBar({ onNext, isLoading, isLast, showKeys }) {
  return (
    <div style={{ position: 'sticky', bottom: 12, zIndex: 4, marginTop: 4 }}>
      <button
        type="button"
        className="fb-next"
        onClick={onNext}
        disabled={isLoading}
        style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', borderRadius: 15, padding: '0 20px', background: isLoading ? C.blue200 : `linear-gradient(135deg, ${C.blue800}, ${C.blue600} 55%, ${C.blue500})`, color: '#fff', fontFamily: F.display, fontSize: 16, fontWeight: 800, cursor: isLoading ? 'wait' : 'pointer', boxShadow: '0 8px 24px rgba(26,110,255,.32), 0 2px 6px rgba(0,31,107,.2)', transition: 'transform .14s ease, filter .14s ease, box-shadow .14s ease' }}
      >
        {isLoading ? (
          <><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', animation: 'fbSpin .8s linear infinite' }} />{isLast ? 'Preparing your report…' : 'Loading…'}</>
        ) : (
          <>{isLast ? 'See my results' : 'Next question'}<Icon name="arrow" size={19} stroke={2.4} /></>
        )}
        {!isLoading && showKeys && (
          <span aria-hidden="true" style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.26)', fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>Enter</span>
        )}
      </button>
    </div>
  );
}
NextBar.propTypes = { onNext: PropTypes.func.isRequired, isLoading: PropTypes.bool, isLast: PropTypes.bool, showKeys: PropTypes.bool };

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function FeedbackPanel({
  question, feedback = null, onNext, isLoading, isLast, userAnswerIndex = null, skipped = false,
  timeLimit = 0, previousScores = [], voiceMetrics = null, userAnswer = '', onRetry = null, isRetrying = false, showKeys = true, timeTaken: timeTakenProp = 0,
}) {
  const rootRef   = useRef(null);
  const objective = ['mcq', 'aptitude'].includes(question?.questionType);
  const score     = Number(feedback?.score) || 0;
  const correct   = feedback?.correct === true;
  const aiOk      = feedback?.aiAvailable !== false;
  const vm        = voiceMetrics || feedback?.voiceMetrics || null;
  const basic     = feedback?.tier === 'basic';
  const timeTaken = Number(timeTakenProp) || Number(feedback?.timeTaken) || 0;

  // On a single-column layout the feedback sits below the question, so bring it
  // into view. On desktop it is already beside the question, so leave the page still.
  useEffect(() => {
    if (window.innerWidth <= 1020) {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const body = useMemo(() => {
    // ── Skipped ──
    if (skipped) {
      if (objective) return <McqReview question={question} correct={false} userAnswerIndex={null} skipped />;
      const pending = feedback?.skippedPending && !feedback?.sampleAnswer;
      if (basic) {
        return (
          <>
            <Notice tone="warn" icon="skip" title="You skipped this question">It scored 0.</Notice>
            <LockedInsights locked={{ modelAnswer: true }} />
          </>
        );
      }
      return (
        <>
          <Notice tone="warn" icon="skip" title="You skipped this question">
            It scored 0. {pending ? 'The model answer is still being prepared and will be in your final report.' : 'Here is what a strong answer covers.'}
          </Notice>
          {!pending && <AnswerCompare userAnswer="" sampleAnswer={feedback?.sampleAnswer} idealHint={feedback?.idealHint} defaultTab="model" />}
        </>
      );
    }

    // ── Multiple choice / aptitude ──
    if (objective) return <McqReview question={question} correct={correct} userAnswerIndex={userAnswerIndex} />;

    // ── Evaluator was unavailable ──
    if (!aiOk) {
      return (
        <Notice tone="warn" icon="alert" title="We couldn't evaluate this answer">
          Your answer was saved. Try again now, or continue to the next question.
          {onRetry && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', border: 'none', borderRadius: 11, background: C.amber, color: '#fff', fontFamily: F.body, fontSize: 14, fontWeight: 700, cursor: isRetrying ? 'wait' : 'pointer', opacity: isRetrying ? 0.7 : 1 }}
              >
                {isRetrying
                  ? <><span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', animation: 'fbSpin .8s linear infinite' }} />Trying again…</>
                  : <><Icon name="retry" size={16} />Try again</>}
              </button>
            </div>
          )}
        </Notice>
      );
    }

    // ── Normal evaluated open answer ──
    // ── Free tier: the server sends only score + worked/missing; the rest is locked ──
    if (basic) {
      return (
        <>
          <WorkedAndMissing good={feedback?.good} missing={feedback?.missing} />
          <LockedInsights locked={feedback?.locked} usedVoice={Boolean(vm)} />
        </>
      );
    }

    const enrichPending = feedback?.enrichPending === true;
    return (
      <>
        <FixFirst tip={feedback?.tip} />
        <WorkedAndMissing good={feedback?.good} missing={feedback?.missing} />
        <AnswerCompare userAnswer={userAnswer} sampleAnswer={feedback?.sampleAnswer} idealHint={feedback?.idealHint} />
        {enrichPending && !feedback?.sampleAnswer && <PendingBlock label="Writing your model answer…" lines={2} />}
        {enrichPending && <PendingBlock label="Analysing keywords, structure and confidence…" lines={3} />}
        {feedback?.enrichFailed && !enrichPending && !feedback?.sampleAnswer && (
          <Notice tone="info" icon="info" title="Detailed breakdown unavailable">
            It couldn&apos;t be generated for this answer. Your score and feedback above are unaffected.
          </Notice>
        )}
        <FollowUps questions={feedback?.followUpQuestions} />
        <DetailedAnalysis feedback={feedback} vm={vm} />
      </>
    );
  }, [skipped, objective, question, correct, userAnswerIndex, feedback, aiOk, basic, onRetry, isRetrying, userAnswer, vm]);

  return (
    <div ref={rootRef} className="fb-scroll fb-in" style={{ fontFamily: F.body, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{PANEL_CSS}</style>

      {!skipped && (objective
        ? <McqHero correct={correct} question={question} userAnswerIndex={userAnswerIndex} timeTaken={timeTaken} timeLimit={timeLimit} />
        : aiOk && <ScoreHero score={score} timeTaken={timeTaken} timeLimit={timeLimit} previousScores={previousScores} feedback={feedback} />)}

      {body}

      <NextBar onNext={onNext} isLoading={isLoading} isLast={isLast} showKeys={showKeys} />
    </div>
  );
}

FeedbackPanel.propTypes = {
  question:        PropTypes.object.isRequired,
  feedback:        PropTypes.object,
  onNext:          PropTypes.func.isRequired,
  isLoading:       PropTypes.bool.isRequired,
  isLast:          PropTypes.bool.isRequired,
  userAnswerIndex: PropTypes.number,
  skipped:         PropTypes.bool,
  timeLimit:       PropTypes.number,
  timeTaken:       PropTypes.number,
  previousScores:  PropTypes.arrayOf(PropTypes.number),
  voiceMetrics:    PropTypes.object,
  userAnswer:      PropTypes.string,
  onRetry:         PropTypes.func,
  isRetrying:      PropTypes.bool,
  showKeys:        PropTypes.bool,
  // Accepted for backward compatibility with older call sites; no longer used.
  questionIndex:   PropTypes.number,
  totalQuestions:  PropTypes.number,
};
export { FeedbackPanel };
export default FeedbackPanel;

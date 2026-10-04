/**
 * MockMate — FeedbackPanel.jsx  (v8 · "Scoreboard + Showcase")
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in replacement for client/src/components/interview/FeedbackPanel.jsx.
 * Same props, same exports as v6/v7. Only REAL data is shown for Pro/full
 * feedback: nothing is invented (no fake XP, no ranks) — every number comes
 * from the evaluation, the voice metrics or the real timer.
 *
 * What changed from v7
 *   - LockedInsights (free-tier teaser) is now a full showcase, not a thin
 *     strip: real section chrome + one real line per feature + a blurred
 *     preview of the actual shape (ring, STAR grid, delivery tiles) behind
 *     frosted glass, themed with the same hero gradient as the score card.
 *     See components/pro/LockedInsights.jsx.
 *   - The skipped+basic path now passes the server's real `feedback.locked`
 *     instead of a hardcoded `{ modelAnswer: true }` — the server already
 *     computes this correctly (server/utils/feedbackTier.js), so skipped
 *     questions under Pro's one-time trial or a partially-locked state are
 *     represented honestly instead of always showing exactly one row.
 *
 * Reading order
 *   1. Hero          score ring + count-up, tier emoji, vs-average, stat tiles,
 *                    earlier-answers trend
 *   2. Fix this first / The key idea
 *   3. What worked / What to add
 *   4. Compare       your answer vs model answer (long text folds with "Show more")
 *   5. Insight cards keywords · confidence · STAR · delivery (voice answers)
 *   6. Likely follow-ups
 *   7. Next button   pinned to the bottom
 *
 * Free ("basic") tier: "What worked"/"What to add" stay fully visible (the
 * real hook that proves the AI works), then LockedInsights shows the rest.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import PropTypes from 'prop-types';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { C as CT, F } from '../../styles/token';
import Icon from './icons';
import LockedInsights from '../pro/LockedInsights';

const C = { ...CT, violet: CT.violet ?? '#6D5BEE', violetTint: CT.violetTint ?? '#F0EEFF' };

const HERO_BG = `linear-gradient(145deg, ${C.blue900} 0%, ${C.blue700} 42%, ${C.blue600} 72%, ${C.cyan600} 100%)`;

// Section palettes. `a` is the readable accent, `bg` a soft tint, `line` a border.
const TONES = {
  blue:   { a: C.blue600,  bg: C.blue50,      line: C.blue100 },
  green:  { a: C.green,    bg: C.greenTint,   line: '#BFE9D6' },
  amber:  { a: '#B45309',  bg: C.amberTint,   line: '#F5D9A8' },
  violet: { a: C.violet,   bg: C.violetTint,  line: '#D9D3FA' },
  cyan:   { a: C.cyan600,  bg: C.cyanTint,    line: '#BDEBF7' },
  rose:   { a: C.red,      bg: C.redTint,     line: '#F8CACA' },
  indigo: { a: C.indigo,   bg: C.indigoTint,  line: '#D3D9F7' },
  teal:   { a: C.teal,     bg: C.tealTint,    line: '#B9E9E3' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const safeArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// Turns "1. foo 2. bar" or "Sentence one. Sentence two." into separate points.
const splitParts = (text = '') => {
  if (!text) return [];
  const byNum = text.split(/(?<!\d)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  const bySentence = text.replace(/([.!?])\s+/g, '$1|||').split('|||').map((s) => s.trim()).filter(Boolean);
  return bySentence.length <= 1 ? [text.trim()] : bySentence;
};
const splitNumbered = (text = '') => text.split(/(?<!\d)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);

const fmtTime = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const num = (v) => (v == null ? null : Math.round(Number(typeof v === 'object' ? v.score : v) || 0));
const countWords = (t = '') => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Tier = how the hero feels. Colours are soft (not neon) so they sit well on the blue.
const tierOf = (s) => {
  if (s >= 90) return { label: 'Outstanding',   em: '🏆', sub: 'Interview-ready. This is the kind of answer that gets offers.',       a: '#FCD34D', soft: 'rgba(252,211,77,.16)',  line: 'rgba(252,211,77,.42)',  party: true };
  if (s >= 75) return { label: 'Strong answer', em: '🚀', sub: 'Solid and well reasoned. A little more depth and it is polished.',     a: '#6EE7B7', soft: 'rgba(110,231,183,.16)', line: 'rgba(110,231,183,.42)', party: true };
  if (s >= 60) return { label: 'Good base',     em: '👍', sub: 'You have the core. More specific points would lift it.',               a: '#7DD3FC', soft: 'rgba(125,211,252,.16)', line: 'rgba(125,211,252,.42)', party: false };
  if (s >= 40) return { label: 'Getting there', em: '🌱', sub: 'The direction is right but important points are missing.',            a: '#FDBA74', soft: 'rgba(253,186,116,.16)', line: 'rgba(253,186,116,.42)', party: false };
  return             { label: 'Needs work',     em: '💪', sub: 'Use the model answer below, then try this topic again.',               a: '#FDA4AF', soft: 'rgba(253,164,175,.16)', line: 'rgba(253,164,175,.42)', party: false };
};

const lightScore = (s) => (s >= 70 ? C.green : s >= 40 ? '#D97706' : C.red);
const confEmoji = (s) => (s >= 75 ? '😎' : s >= 50 ? '🙂' : s >= 30 ? '😬' : '😟');

// ═══════════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════════
const PANEL_CSS = `
@keyframes fbBar     { from { width:0 } }
@keyframes fbIn      { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
@keyframes fbSpin    { to { transform:rotate(360deg) } }
@keyframes fbShimmer { from { background-position:200% 0 } to { background-position:-100% 0 } }
@keyframes fbPop     { 0% { opacity:0; transform:scale(.2) rotate(-24deg) } 55% { opacity:1; transform:scale(1.28) rotate(9deg) } 78% { transform:scale(.94) rotate(-3deg) } 100% { opacity:1; transform:scale(1) rotate(0) } }
@keyframes fbHop     { 0%,100% { transform:translateY(0) } 40% { transform:translateY(-6px) } 70% { transform:translateY(0) } 85% { transform:translateY(-2px) } }
@keyframes fbSpark   { 0% { opacity:0; transform:translate(0,0) scale(.3) rotate(0) } 25% { opacity:1 } 100% { opacity:0; transform:translate(var(--dx),var(--dy)) scale(1) rotate(50deg) } }
@keyframes fbRise    { from { transform:scaleY(0) } to { transform:scaleY(1) } }
.fb-in    { animation:fbIn .38s cubic-bezier(.16,1,.3,1) both; }
.fb-bar   { animation:fbBar .9s cubic-bezier(.16,1,.3,1) both; }
.fb-pop   { animation:fbPop .75s cubic-bezier(.34,1.4,.64,1) .55s both; }
.fb-emo   { animation:fbPop .6s cubic-bezier(.34,1.4,.64,1) both; }
.fb-hop   { animation:fbHop .9s ease-in-out 1.5s 1; }
.fb-spark { position:absolute; left:50%; top:50%; line-height:1; pointer-events:none; animation:fbSpark 1.3s ease-out both; }
.fb-rise  { transform-origin:bottom; animation:fbRise .7s cubic-bezier(.16,1,.3,1) both; }
.fb-tab   { transition:background .15s ease, color .15s ease, box-shadow .15s ease; }
.fb-more  { transition:background .15s ease, border-color .15s ease; }
.fb-more:hover { background:${C.blue50} !important; border-color:${C.blue200} !important; }
.fb-tab:focus-visible, .fb-more:focus-visible, .fb-next:focus-visible { outline:2.5px solid ${C.blue500}; outline-offset:2px; }
.fb-next:hover:not(:disabled) { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 12px 28px rgba(26,110,255,.34) !important; }
.fb-next:active:not(:disabled) { transform:scale(.99); }
.fb-scroll { scroll-margin-top:96px; }
.fb-clip  { transition:max-height .38s cubic-bezier(.16,1,.3,1); }
@media (prefers-reduced-motion:reduce) {
  .fb-in, .fb-bar, .fb-pop, .fb-emo, .fb-hop, .fb-rise { animation:none !important; }
  .fb-spark { display:none !important; }
  .fb-tab, .fb-more, .fb-next, .fb-clip { transition:none !important; }
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
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: '0 1px 12px rgba(26,110,255,0.06)' };

function useCountUp(target, duration = 1100) {
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

/** Card shell: tinted header with a bouncing emoji tile, then the body. */
const Section = ({ tone = 'blue', emoji, title, sub, right, index = 0, children }) => {
  const t = TONES[tone] || TONES.blue;
  return (
    <section style={{ ...card, borderColor: t.line, overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', background: `linear-gradient(100deg, ${t.bg} 0%, #fff 90%)`, borderBottom: `1px solid ${t.line}` }}>
        <span
          className="fb-emo"
          aria-hidden="true"
          style={{ animationDelay: `${180 + index * 90}ms`, width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: '#fff', border: `1px solid ${t.line}`, boxShadow: `0 2px 8px ${t.a}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, lineHeight: 1 }}
        >
          {emoji}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: F.display, fontSize: 15.5, fontWeight: 800, color: C.text, letterSpacing: '-0.2px' }}>{title}</h3>
          {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 1, lineHeight: 1.4 }}>{sub}</div>}
        </div>
        {right != null && (
          <span style={{ flexShrink: 0, padding: '4px 11px', borderRadius: 99, background: '#fff', border: `1px solid ${t.line}`, color: t.a, fontFamily: F.display, fontSize: 13, fontWeight: 800 }}>{right}</span>
        )}
      </header>
      <div style={{ padding: '14px 16px 16px' }}>{children}</div>
    </section>
  );
};
Section.propTypes = {
  tone: PropTypes.string, emoji: PropTypes.string.isRequired, title: PropTypes.string.isRequired,
  sub: PropTypes.string, right: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), index: PropTypes.number, children: PropTypes.node,
};

const Points = ({ items, color }) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
    {items.map((pt, i) => (
      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 9 }} />
        <span style={{ fontSize: 14.5, lineHeight: 1.65, color: C.text, flex: 1, overflowWrap: 'anywhere' }}>{pt}</span>
      </li>
    ))}
  </ul>
);
Points.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired, color: PropTypes.string.isRequired };

const Bar = ({ pct, color, height = 7, delay = 0, track = C.blue50 }) => (
  <div style={{ height, borderRadius: 99, background: track, overflow: 'hidden' }}>
    <div className="fb-bar" style={{ height: '100%', width: `${clamp(pct)}%`, borderRadius: 99, background: color, animationDelay: `${delay}ms` }} />
  </div>
);
Bar.propTypes = { pct: PropTypes.number.isRequired, color: PropTypes.string.isRequired, height: PropTypes.number, delay: PropTypes.number, track: PropTypes.string };

const Pill = ({ children, color = C.sub, bg, border }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, fontSize: 13, fontWeight: 700, color, background: bg || `${color}14`, border: `1px solid ${border || `${color}30`}`, maxWidth: '100%', overflowWrap: 'anywhere' }}>
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

/**
 * Folds tall content to `collapsedHeight` with a fade and a "Show more" button.
 * Short content renders untouched (no button). Re-measures if the content resizes.
 */
function Collapsible({ children, collapsedHeight = 150, fade = '#fff' }) {
  const innerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(0);
  const needs = full > collapsedHeight + 36;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return undefined;
    const measure = () => setFull(el.scrollHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div>
      <div className="fb-clip" style={{ position: 'relative', overflow: 'hidden', maxHeight: needs ? (open ? full : collapsedHeight) : 'none' }}>
        <div ref={innerRef}>{children}</div>
        {needs && !open && (
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, background: `linear-gradient(to bottom, transparent, ${fade})`, pointerEvents: 'none' }} />
        )}
      </div>
      {needs && (
        <button
          type="button"
          className="fb-more"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px', minHeight: 36, borderRadius: 99, border: `1px solid ${C.blue100}`, background: '#fff', color: C.blue700, fontFamily: F.body, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
        >
          {open ? 'Show less' : 'Show more'}
          <Icon name={open ? 'chevUp' : 'chevDown'} size={15} stroke={2.4} />
        </button>
      )}
    </div>
  );
}
Collapsible.propTypes = { children: PropTypes.node, collapsedHeight: PropTypes.number, fade: PropTypes.string };

const Note = ({ children, color = C.sub, fade = '#fff', height = 92 }) => (
  <Collapsible collapsedHeight={height} fade={fade}>
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color, overflowWrap: 'anywhere' }}>{children}</p>
  </Collapsible>
);
Note.propTypes = { children: PropTypes.node, color: PropTypes.string, fade: PropTypes.string, height: PropTypes.number };

const MiniRing = ({ value, color, size = 64, label }) => {
  const stroke = 6; const r = (size - stroke) / 2; const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} role="img" aria-label={`${label} ${value} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - clamp(value) / 100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: size * 0.3, fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  );
};
MiniRing.propTypes = { value: PropTypes.number.isRequired, color: PropTypes.string.isRequired, size: PropTypes.number, label: PropTypes.string.isRequired };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HERO — open answers
// ═══════════════════════════════════════════════════════════════════════════════
// Sparks burst once from behind the ring on strong scores.
const SPARKS = [
  { ch: '✨', dx: -62, dy: -58, d: 700, s: 16 }, { ch: '✦', dx: 66, dy: -52, d: 820, s: 13 },
  { ch: '⭐', dx: 74, dy: 22, d: 940, s: 14 },   { ch: '✨', dx: -70, dy: 30, d: 760, s: 13 },
  { ch: '✦', dx: -8, dy: -82, d: 880, s: 12 },   { ch: '🎉', dx: 34, dy: 70, d: 1000, s: 15 },
  { ch: '✦', dx: -40, dy: 68, d: 1060, s: 11 },
];

const Sparks = () => (
  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {SPARKS.map((p, i) => (
      <span key={i} className="fb-spark" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${p.d}ms`, fontSize: p.s }}>{p.ch}</span>
    ))}
  </div>
);

function ScoreHero({ score, timeTaken = 0, timeLimit = 0, previousScores = [], feedback = null, answerWords = 0 }) {
  const t      = tierOf(score);
  const shown  = useCountUp(score);
  const SIZE = 120, R = 50, CIRC = 2 * Math.PI * R;
  const [go, setGo] = useState(false);
  useEffect(() => { const id = setTimeout(() => setGo(true), 60); return () => clearTimeout(id); }, []);

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
  const basic = feedback?.tier === 'basic';

  // Free tier: keywords and confidence live in the locked deep analysis, so show a lock, not a gap.
  const stats = [
    timeTaken > 0 ? { em: '⏱️', k: 'Time used', v: timeLimit ? `${fmtTime(timeTaken)} / ${fmtTime(timeLimit)}` : fmtTime(timeTaken), bar: timeLimit ? (timeTaken / timeLimit) * 100 : null } : null,
    basic ? { em: '🔑', k: 'Keywords', locked: true } : (total > 0 ? { em: '🔑', k: 'Keywords', v: `${hit} of ${total}`, bar: (hit / total) * 100 } : null),
    basic ? { em: '💪', k: 'Confidence', locked: true } : (conf != null ? { em: confEmoji(conf), k: 'Confidence', v: `${conf}%`, bar: conf } : null),
    answerWords > 0 ? { em: '✍️', k: 'Words', v: String(answerWords) } : null,
  ].filter(Boolean);

  const trend = [...previousScores, score];

  return (
    <div style={{ background: HERO_BG, borderRadius: 22, padding: '22px 20px 18px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 18px 46px rgba(0,31,107,0.26)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -120, right: -90, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${t.soft} 0%, transparent 66%)`, pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: -140, left: -90, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(95,224,255,.16) 0%, transparent 66%)', pointerEvents: 'none' }} />

      <div className="fb-hero-top" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }} role="img" aria-label={`Score ${score} out of 100`}>
          {t.party && <Sparks />}
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', display: 'block', filter: `drop-shadow(0 0 10px ${t.soft})` }} aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={9} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={t.a} strokeWidth={9} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={go ? CIRC * (1 - clamp(score) / 100) : CIRC}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.8px', fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>out of 100</span>
          </div>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span className="fb-pop" aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, lineHeight: 1, background: t.soft, border: `1px solid ${t.line}`, boxShadow: `0 6px 18px ${t.soft}` }}>
              <span className="fb-hop" style={{ display: 'block' }}>{t.em}</span>
            </span>
            <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15 }}>{t.label}</div>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,.88)' }}>{t.sub}</p>
          {compare && (
            <div style={{ marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.24)', fontSize: 13, fontWeight: 600 }}>
              {compare.up === true && <span aria-hidden="true">📈</span>}
              {compare.up === false && <span aria-hidden="true">📉</span>}
              {compare.up === null && <span aria-hidden="true">〰️</span>}
              {compare.text}
            </div>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8, marginTop: 20 }}>
          {stats.map((st) => (
            <div key={st.k} style={{ padding: '10px 12px 11px', borderRadius: 14, background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{st.em}</span>
                <span style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, minHeight: 20, display: 'inline-flex', alignItems: 'center' }}>
                  {st.locked
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Locked, Pro"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                    : st.v}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>{st.k}</div>
              {st.bar != null && (
                <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,.16)', marginTop: 7, overflow: 'hidden' }}>
                  <div className="fb-bar" style={{ height: '100%', width: `${clamp(st.bar)}%`, borderRadius: 99, background: t.a, animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previousScores.length > 0 && (
        <div style={{ position: 'relative', marginTop: 14, padding: '11px 13px 10px', borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', marginBottom: 8 }}>Your written answers this session</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 56 }} role="img" aria-label={`Scores so far: ${trend.join(', ')}`}>
            {trend.map((v, i) => {
              const last = i === trend.length - 1;
              return (
                <div key={i} style={{ flex: 1, maxWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: last ? t.a : 'rgba(255,255,255,.7)', marginBottom: 3 }}>{Math.round(v)}</span>
                  <div className="fb-rise" style={{ width: '100%', height: `${Math.max(6, clamp(v) * 0.34)}px`, borderRadius: 6, background: last ? t.a : 'rgba(255,255,255,.34)', animationDelay: `${400 + i * 70}ms` }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
ScoreHero.propTypes = {
  score: PropTypes.number.isRequired, timeTaken: PropTypes.number, timeLimit: PropTypes.number,
  previousScores: PropTypes.arrayOf(PropTypes.number), feedback: PropTypes.object, answerWords: PropTypes.number,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1b. HERO — multiple choice
// ═══════════════════════════════════════════════════════════════════════════════
function McqHero({ correct = false, question = null, userAnswerIndex = null, timeTaken = 0, timeLimit = 0 }) {
  const options = question?.options || [];
  const ci = question?.correctAnswerIndex;
  const letter = (i) => (i != null ? String.fromCharCode(65 + i) : '');
  const a    = correct ? '#6EE7B7' : '#FDA4AF';
  const soft = correct ? 'rgba(110,231,183,.16)' : 'rgba(253,164,175,.16)';
  const line = correct ? 'rgba(110,231,183,.42)' : 'rgba(253,164,175,.42)';

  return (
    <div style={{ background: HERO_BG, borderRadius: 22, padding: '22px 20px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 18px 46px rgba(0,31,107,0.26)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -110, right: -80, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${soft} 0%, transparent 66%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          {correct && <Sparks />}
          <div className="fb-pop" aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 22, background: soft, border: `1.5px solid ${line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, lineHeight: 1 }}>
            <span className="fb-hop" style={{ display: 'block' }}>{correct ? '🎉' : '🤔'}</span>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 25, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15 }}>{correct ? 'Correct!' : 'Not this time'}</div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'rgba(255,255,255,.88)' }}>
            {correct ? 'That is the right answer.' : `The answer is option ${letter(ci)}. The explanation below shows why.`}
          </p>
          {timeTaken > 0 && (
            <div style={{ marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 99, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)', fontSize: 13, fontWeight: 600 }}>
              <span aria-hidden="true">⏱️</span>{`Answered in ${fmtTime(timeTaken)}${timeLimit ? ` of ${fmtTime(timeLimit)}` : ''}`}
            </div>
          )}
        </div>
      </div>
      {!correct && userAnswerIndex != null && options[userAnswerIndex] && (
        <div style={{ position: 'relative', marginTop: 14, padding: '10px 13px', borderRadius: 13, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: 'rgba(255,255,255,.68)' }}>You chose {letter(userAnswerIndex)}: </span>{options[userAnswerIndex]}
        </div>
      )}
    </div>
  );
}
McqHero.propTypes = { correct: PropTypes.bool, question: PropTypes.object, userAnswerIndex: PropTypes.number, timeTaken: PropTypes.number, timeLimit: PropTypes.number };

function SkippedHero({ pending = false }) {
  return (
    <div style={{ background: HERO_BG, borderRadius: 22, padding: '20px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 18px 46px rgba(0,31,107,0.22)' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 15 }}>
        <span className="fb-pop" aria-hidden="true" style={{ width: 60, height: 60, borderRadius: 19, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, background: 'rgba(253,186,116,.16)', border: '1.5px solid rgba(253,186,116,.42)' }}>⏭️</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 23, fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1.15 }}>Question skipped</div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'rgba(255,255,255,.88)' }}>
            It scored 0. {pending ? 'The model answer is still being prepared and will be in your final report.' : 'Here is what a strong answer covers.'}
          </p>
        </div>
      </div>
    </div>
  );
}
SkippedHero.propTypes = { pending: PropTypes.bool };

// ═══════════════════════════════════════════════════════════════════════════════
// 2 + 3. FIX FIRST, KEY IDEA, WORKED / ADD
// ═══════════════════════════════════════════════════════════════════════════════
function FixFirst({ tip }) {
  if (!tip || !tip.trim()) return null;
  const numbered = splitNumbered(tip);
  return (
    <Section tone="blue" emoji="🎯" title="Fix this first" sub="The single most useful change" index={0}>
      {numbered.length > 1
        ? <Points items={numbered} color={C.blue500} />
        : <Note color={C.text} height={120}>{tip.trim()}</Note>}
    </Section>
  );
}
FixFirst.propTypes = { tip: PropTypes.string };

function KeyIdea({ idealHint }) {
  if (!idealHint || !idealHint.trim()) return null;
  return (
    <Section tone="violet" emoji="💡" title="The key idea" sub="What a top answer is built around" index={1}>
      <Note color={C.text} height={110}>{idealHint.trim()}</Note>
    </Section>
  );
}
KeyIdea.propTypes = { idealHint: PropTypes.string };

function WorkedAndMissing({ good, missing }) {
  const goodParts = splitParts(good);
  const missParts = splitParts(missing);
  if (!goodParts.length && !missParts.length) return null;
  const both = goodParts.length && missParts.length;
  return (
    <div className="fb-twocol" style={{ display: 'grid', gridTemplateColumns: both ? '1fr 1fr' : '1fr', gap: 12 }}>
      {goodParts.length > 0 && (
        <Section tone="green" emoji="✅" title="What worked" index={2}>
          <Collapsible collapsedHeight={190} fade={C.surface}><Points items={goodParts} color={C.green} /></Collapsible>
        </Section>
      )}
      {missParts.length > 0 && (
        <Section tone="amber" emoji="🧩" title="What to add" index={3}>
          <Collapsible collapsedHeight={190} fade={C.surface}><Points items={missParts} color={C.amber} /></Collapsible>
        </Section>
      )}
    </div>
  );
}
WorkedAndMissing.propTypes = { good: PropTypes.string, missing: PropTypes.string };

// ═══════════════════════════════════════════════════════════════════════════════
// 4. YOUR ANSWER vs MODEL ANSWER
// ═══════════════════════════════════════════════════════════════════════════════
function AnswerCompare({ userAnswer = '', sampleAnswer = '', defaultTab = 'yours' }) {
  const hasYours = Boolean(userAnswer && userAnswer.trim());
  const hasModel = Boolean(sampleAnswer);
  const [tab, setTab] = useState(defaultTab === 'model' && hasModel ? 'model' : hasYours ? 'yours' : 'model');
  if (!hasYours && !hasModel) return null;

  const tabs = [hasYours && { id: 'yours', label: 'Your answer', em: '✍️' }, hasModel && { id: 'model', label: 'Model answer', em: '🏆' }].filter(Boolean);
  const words = countWords(userAnswer);
  const modelWords = countWords(sampleAnswer);

  return (
    <Section tone="indigo" emoji="📚" title="Compare answers" sub="Yours next to a strong one" right={`${tab === 'yours' ? words : modelWords} words`} index={4}>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Compare answers" style={{ display: 'inline-flex', padding: 3, borderRadius: 12, background: C.blue50, border: `1px solid ${C.blue100}`, marginBottom: 14 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="fb-tab"
              onClick={() => setTab(t.id)}
              style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 15px', minHeight: 38, borderRadius: 10, fontFamily: F.body, fontSize: 14, fontWeight: 700, background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? C.blue700 : C.sub, boxShadow: tab === t.id ? '0 1px 6px rgba(26,110,255,.16)' : 'none' }}
            >
              <span aria-hidden="true">{t.em}</span>{t.label}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" key={tab} className="fb-in">
        {tab === 'yours' ? (
          <Collapsible collapsedHeight={170}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: C.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{userAnswer}</p>
          </Collapsible>
        ) : (
          <Collapsible collapsedHeight={210}>
            <Points items={splitParts(sampleAnswer)} color={C.indigo} />
          </Collapsible>
        )}
      </div>
    </Section>
  );
}
AnswerCompare.propTypes = { userAnswer: PropTypes.string, sampleAnswer: PropTypes.string, defaultTab: PropTypes.string };

// ═══════════════════════════════════════════════════════════════════════════════
// 5. INSIGHT CARDS
// ═══════════════════════════════════════════════════════════════════════════════
function Keywords({ keywords }) {
  const hit = safeArr(keywords?.hit);
  const missed = safeArr(keywords?.missed);
  if (!hit.length && !missed.length) return null;
  const total = hit.length + missed.length;
  const pct = Math.round((hit.length / total) * 100);
  const col = lightScore(pct);
  return (
    <Section tone="cyan" emoji="🔑" title="Keywords" sub="Terms an interviewer listens for" right={`${hit.length} of ${total}`} index={5}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <MiniRing value={pct} color={col} size={58} label="Keyword coverage" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>
            {pct >= 70 ? 'Great coverage' : pct >= 40 ? 'Partly covered' : 'Most were missing'}
          </div>
          <Bar pct={pct} color={col} height={8} track={C.cyanTint} />
        </div>
      </div>
      <Collapsible collapsedHeight={150}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {hit.map((k) => <Pill key={`h-${k}`} color={C.green}><Icon name="check" size={12} stroke={3} />{k}</Pill>)}
          {missed.map((k) => <Pill key={`m-${k}`} color={C.red}><Icon name="x" size={12} stroke={3} />{k}</Pill>)}
        </div>
      </Collapsible>
      {missed.length > 0 && <p style={{ margin: '10px 0 0', fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>Red keywords were not in your answer. Work them in where they fit naturally.</p>}
    </Section>
  );
}
Keywords.propTypes = { keywords: PropTypes.object };

function Confidence({ confidenceScore }) {
  if (confidenceScore == null) return null;
  const obj   = typeof confidenceScore === 'object';
  const score = clamp(num(confidenceScore) || 0);
  const label = obj && confidenceScore.label ? confidenceScore.label : score >= 75 ? 'Confident' : score >= 50 ? 'Neutral' : score >= 30 ? 'Hesitant' : 'Uncertain';
  const note  = obj ? confidenceScore.note : null;
  return (
    <Section tone="violet" emoji={confEmoji(score)} title="How confident you sounded" sub="From your wording" right={`${score}%`} index={6}>
      <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.violet, marginBottom: 9, letterSpacing: '-0.3px' }}>{label}</div>
      <Bar pct={score} color={`linear-gradient(90deg, ${C.violet}, #9B8CF5)`} height={9} track={C.violetTint} />
      {obj && (confidenceScore.formalPct != null || confidenceScore.hedgingPct != null) && (
        <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
          {confidenceScore.formalPct != null && <Pill color={C.cyan600}>🎩 Formal wording {confidenceScore.formalPct}%</Pill>}
          {confidenceScore.hedgingPct != null && <Pill color="#B45309">🤷 Hedging words {confidenceScore.hedgingPct}%</Pill>}
        </div>
      )}
      {note && <div style={{ marginTop: 12 }}><Note>{note}</Note></div>}
    </Section>
  );
}
Confidence.propTypes = { confidenceScore: PropTypes.oneOfType([PropTypes.object, PropTypes.number]) };

const starIsEmpty = (sb) => !sb || [sb.S, sb.T, sb.A, sb.R].every((p) => !p || Number(p.score) === 0);

function Star({ starBreakdown }) {
  if (starIsEmpty(starBreakdown)) return null;
  const { S, T, A, R, overall } = starBreakdown;
  const pillars = [
    { key: 'S', label: 'Situation', em: '🎬', data: S, color: C.cyan600 },
    { key: 'T', label: 'Task',      em: '🎯', data: T, color: C.blue600 },
    { key: 'A', label: 'Action',    em: '⚙️', data: A, color: C.violet },
    { key: 'R', label: 'Result',    em: '🏁', data: R, color: C.green },
  ].filter((p) => p.data);
  const avg = Math.round(pillars.reduce((a, p) => a + clamp(Number(p.data.score) || 0), 0) / Math.max(1, pillars.length));
  return (
    <Section tone="indigo" emoji="⭐" title="STAR structure" sub="Situation, Task, Action, Result" right={`avg ${avg}`} index={7}>
      <div className="fb-twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {pillars.map(({ key, label, em, data, color }) => {
          const s = clamp(Number(data.score) || 0);
          return (
            <div key={key} style={{ padding: '12px 13px', borderRadius: 14, background: `${color}0D`, border: `1px solid ${color}30`, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, background: '#fff', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{em}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 800, fontFamily: F.display, color: C.text }}>{label}</span>
                <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color }}>{s}</span>
              </div>
              <Bar pct={s} color={color} height={6} track="#fff" />
              {data.note && <div style={{ marginTop: 8 }}><Note color={C.sub} height={66} fade="#F6F8FF">{data.note}</Note></div>}
            </div>
          );
        })}
      </div>
      {overall && !/not applicable/i.test(overall) && (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 13, background: C.indigoTint, border: `1px solid ${TONES.indigo.line}` }}>
          <Note color={C.sub} fade={C.indigoTint}>{overall}</Note>
        </div>
      )}
    </Section>
  );
}
Star.propTypes = { starBreakdown: PropTypes.object };

// ── Delivery (voice answers) ────────────────────────────────────────────────
const Tile = ({ em, label, value, valueColor = C.text, children }) => (
  <div style={{ padding: '12px 13px', borderRadius: 14, background: C.cardAlt, border: `1px solid ${C.border}`, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.muted, fontWeight: 600 }}>
      <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>{em}</span>{label}
    </div>
    <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 800, color: valueColor, margin: '3px 0 7px', letterSpacing: '-0.3px' }}>{value}</div>
    {children}
  </div>
);
Tile.propTypes = { em: PropTypes.string.isRequired, label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, valueColor: PropTypes.string, children: PropTypes.node };

const AiRow = ({ em, name, score, label, note, color }) => (
  <div style={{ padding: '12px 14px', borderRadius: 14, background: `${color}0D`, border: `1px solid ${color}2B` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: '#fff', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{em}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text }}>{name}</div>
        {label && <div style={{ fontSize: 13, color, fontWeight: 700 }}>{label}</div>}
      </div>
      <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color }}>{score}</span>
    </div>
    <Bar pct={score} color={color} height={6} track="#fff" />
    {note && <div style={{ marginTop: 9 }}><Note fade="#F7F9FF" height={72}>{note}</Note></div>}
  </div>
);
AiRow.propTypes = { em: PropTypes.string.isRequired, name: PropTypes.string.isRequired, score: PropTypes.number.isRequired, label: PropTypes.string, note: PropTypes.string, color: PropTypes.string.isRequired };

const PAUSE_META = {
  'smooth':          { em: '😌', label: 'Smooth',            color: C.green },
  'some-hesitation': { em: '🤔', label: 'Some hesitation',   color: '#D97706' },
  'frequent-gaps':   { em: '😶', label: 'Frequent gaps',     color: C.red },
};

function Delivery({ vm, feedback }) {
  if (!vm) return null;
  const { wpm, fillerWords, answerLength, pauses, deliveryScore, deliveryBreakdown, sentenceClarity } = vm;
  const tone = feedback?.toneAnalysis;
  const vocab = feedback?.vocabularyRichness;
  const hes = feedback?.hesitationPattern;
  const wpmColor = { tooSlow: '#D97706', ideal: C.green, tooFast: C.red }[wpm?.band] || C.blue500;
  const fillers = fillerWords?.total ?? 0;
  const fillerColor = fillers === 0 ? C.green : fillers <= 3 ? '#D97706' : C.red;
  const pm = pauses ? (PAUSE_META[pauses.rating] || PAUSE_META.smooth) : null;
  const dScore = deliveryScore != null ? clamp(Math.round(Number(deliveryScore) || 0)) : null;
  const breakdown = deliveryBreakdown ? [
    { k: 'Pace', v: deliveryBreakdown.pace, em: '🏃' }, { k: 'Fillers', v: deliveryBreakdown.fillers, em: '🗣️' },
    { k: 'Pauses', v: deliveryBreakdown.pauses, em: '⏸️' }, { k: 'Length', v: deliveryBreakdown.length, em: '📏' },
  ].filter((b) => b.v != null) : [];
  const vTone = vocab || (vm.vocabularyDiversity?.totalWords ? { score: vm.vocabularyDiversity.score, label: vm.vocabularyDiversity.label, note: null } : null);
  const aiRows = [
    tone && { em: '🎭', name: 'Tone', score: num(tone.score), label: tone.label, note: tone.note, color: C.blue600 },
    vTone && { em: '📚', name: 'Vocabulary', score: num(vTone.score), label: vTone.label, note: vTone.note, color: C.violet },
    hes && { em: '🌊', name: 'Fluency', score: num(hes.score), label: hes.pattern, note: [hes.where, hes.note].filter(Boolean).join(' '), color: C.teal },
  ].filter(Boolean);

  return (
    <Section tone="teal" emoji="🎙️" title="How you delivered it" sub="Measured from your voice answer" right={dScore != null ? `${dScore}/100` : undefined} index={8}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {dScore != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14, background: C.tealTint, border: `1px solid ${TONES.teal.line}` }}>
            <MiniRing value={dScore} color={lightScore(dScore)} size={66} label="Delivery score" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text }}>Delivery score</div>
              {breakdown.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '6px 12px', marginTop: 8 }}>
                  {breakdown.map((b) => (
                    <div key={b.k}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.sub, fontWeight: 600, marginBottom: 3 }}>
                        <span><span aria-hidden="true">{b.em} </span>{b.k}</span><span>{Math.round(b.v)}</span>
                      </div>
                      <Bar pct={b.v} color={lightScore(b.v)} height={4} track="#fff" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="fb-twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Tile em="🏃" label="Speaking pace" value={wpm?.wpm > 0 ? `${wpm.wpm} wpm` : 'Not measured'} valueColor={wpmColor}>
            <Bar pct={Math.min(100, ((wpm?.wpm || 0) / 200) * 100)} color={wpmColor} height={5} track="#fff" />
            {wpm?.label && <div style={{ fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.45 }}>{wpm.label}{wpm.hint ? `. ${wpm.hint}` : ''}</div>}
            {wpm?.consistency?.firstHalfWpm != null && wpm?.consistency?.secondHalfWpm != null && (
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }}>First half {wpm.consistency.firstHalfWpm} wpm, second half {wpm.consistency.secondHalfWpm} wpm</div>
            )}
          </Tile>
          <Tile em="🗣️" label="Filler words" value={fillers === 0 ? 'None' : fillers} valueColor={fillerColor}>
            {fillers > 0 && safeArr(fillerWords?.breakdown).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {fillerWords.breakdown.map(({ word, count }) => <Pill key={word} color={count >= 3 ? C.red : '#B45309'}>&quot;{word}&quot; x{count}</Pill>)}
              </div>
            ) : <div style={{ fontSize: 13, color: C.sub }}>{fillers === 0 ? 'Clean delivery.' : ''}</div>}
          </Tile>
          {pm && (
            <Tile em="⏸️" label="Pauses" value={pm.label} valueColor={pm.color}>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
                <span aria-hidden="true">{pm.em} </span>{pauses.totalPauses} pause{pauses.totalPauses === 1 ? '' : 's'}, longest {pauses.longestPauseSeconds}s
                {pauses.deadAirCount > 0 ? `, ${pauses.deadAirCount} long gap${pauses.deadAirCount === 1 ? '' : 's'}` : ''}
              </div>
            </Tile>
          )}
          {answerLength && (
            <Tile em="📏" label="Length" value={`${answerLength.wordCount} words`} valueColor={answerLength.rating === 'ideal' ? C.green : '#D97706'}>
              <div style={{ position: 'relative', height: 6, borderRadius: 99, background: '#fff', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: `${(answerLength.min / 350) * 100}%`, width: `${((answerLength.max - answerLength.min) / 350) * 100}%`, height: '100%', background: `${C.green}38` }} />
                <div style={{ position: 'relative', height: '100%', width: `${Math.min(100, (answerLength.wordCount / 350) * 100)}%`, borderRadius: 99, background: answerLength.rating === 'ideal' ? C.green : '#D97706' }} />
              </div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.45 }}>Target {answerLength.min}–{answerLength.max}.{answerLength.hint ? ` ${answerLength.hint}` : ''}</div>
            </Tile>
          )}
          {sentenceClarity?.sentenceCount > 0 && (
            <Tile em="🧩" label="Sentence clarity" value={sentenceClarity.label} valueColor={sentenceClarity.label === 'Clear' ? C.green : '#D97706'}>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.45 }}>About {sentenceClarity.avgWordsPerSentence} words per sentence. {sentenceClarity.hint}</div>
            </Tile>
          )}
        </div>

        {aiRows.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{aiRows.map((r) => <AiRow key={r.name} {...r} />)}</div>}

        {feedback?.deliveryTip && (
          <div style={{ display: 'flex', gap: 11, padding: '13px 14px', borderRadius: 14, background: C.violetTint, border: `1px solid ${TONES.violet.line}` }}>
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1.2 }}>🎧</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.violet, marginBottom: 3, fontFamily: F.display }}>Delivery tip</div>
              <Note color={C.text} fade={C.violetTint}>{feedback.deliveryTip}</Note>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
Delivery.propTypes = { vm: PropTypes.object, feedback: PropTypes.object };

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════
const FU_COLORS = [C.blue600, C.violet, C.teal, '#D97706', C.cyan600];

function FollowUps({ questions }) {
  const list = safeArr(questions);
  if (!list.length) return null;
  return (
    <Section tone="blue" emoji="🎤" title="Likely follow-ups" sub="An interviewer could ask these next" right={list.length} index={9}>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((q, i) => {
          const col = FU_COLORS[i % FU_COLORS.length];
          return (
            <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 14, background: `${col}0D`, border: `1px solid ${col}2B` }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: col, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: 12.5, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text, overflowWrap: 'anywhere' }}>{q}</span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
FollowUps.propTypes = { questions: PropTypes.array };

// Shown where a section WILL appear once the background analysis has been
// generated. The score and core feedback above are already final.
function PendingBlock({ label, lines = 3 }) {
  return (
    <section role="status" aria-live="polite" aria-label={label} style={{ ...card, padding: '14px 18px' }}>
      <div style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 800, color: C.muted, marginBottom: 11 }}>
        <span aria-hidden="true">⏳ </span>{label}
      </div>
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
        <Section tone="blue" emoji="💡" title="Why this is the answer" index={0}>
          <Collapsible collapsedHeight={200}><Points items={splitParts(explanation)} color={C.blue500} /></Collapsible>
        </Section>
      )}
      {options.length > 0 && (
        <section style={{ ...card, overflow: 'hidden', borderColor: TONES.indigo.line }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', background: `linear-gradient(100deg, ${C.indigoTint} 0%, #fff 90%)` }}>
            <span className="fb-emo" aria-hidden="true" style={{ animationDelay: '270ms', width: 36, height: 36, borderRadius: 12, background: '#fff', border: `1px solid ${TONES.indigo.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>🔤</span>
            <h3 style={{ margin: 0, fontFamily: F.display, fontSize: 15.5, fontWeight: 800, color: C.text }}>All options</h3>
          </header>
          {options.map((opt, i) => {
            const isC = i === ci;
            const isU = i === userAnswerIndex;
            const wrong = isU && !correct;
            const bg = isC ? C.greenTint : wrong ? C.redTint : C.surface;
            const col = isC ? C.green : wrong ? C.red : C.muted;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: bg, borderTop: `1px solid ${C.border}`, minHeight: 50 }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, border: `1.5px solid ${isC || wrong ? col : C.border}`, color: col, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 800 }}>
                  {isC ? <Icon name="check" size={15} stroke={3} /> : wrong ? <Icon name="x" size={15} stroke={3} /> : String.fromCharCode(65 + i)}
                </span>
                <span style={{ flex: 1, fontSize: 14.5, lineHeight: 1.5, color: C.text, fontWeight: isC ? 700 : 500, overflowWrap: 'anywhere' }}>{opt}</span>
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
        style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', borderRadius: 16, padding: '0 20px', background: isLoading ? C.blue200 : `linear-gradient(135deg, ${C.blue800}, ${C.blue600} 55%, ${C.blue500})`, color: '#fff', fontFamily: F.display, fontSize: 16, fontWeight: 800, cursor: isLoading ? 'wait' : 'pointer', boxShadow: '0 8px 24px rgba(26,110,255,.32), 0 2px 6px rgba(0,31,107,.2)', transition: 'transform .14s ease, filter .14s ease, box-shadow .14s ease' }}
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
  const answerWords = countWords(userAnswer) || Number(vm?.answerLength?.wordCount) || 0;

  // On a single-column layout the feedback sits below the question, so bring it
  // into view. On desktop it is already beside the question, so leave the page still.
  useEffect(() => {
    if (window.innerWidth <= 1020) {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const renderBody = () => {
    // ── Skipped ──
    if (skipped) {
      if (objective) return <McqReview question={question} correct={false} userAnswerIndex={null} skipped />;
      // Server already computes feedback.locked correctly for a skipped question
      // under basic tier (server/utils/feedbackTier.js: modelAnswer is always true
      // when skipped). Pass the real value through instead of hardcoding it, so a
      // partially-unlocked trial state is represented honestly if that ever exists.
      if (basic) return <LockedInsights locked={feedback?.locked} usedVoice={false} />;
      const pending = feedback?.skippedPending && !feedback?.sampleAnswer;
      return pending ? null : <AnswerCompare userAnswer="" sampleAnswer={feedback?.sampleAnswer} defaultTab="model" />;
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

    // ── Free tier: the server sends only score + worked/missing; the rest is locked ──
    if (basic) {
      return (
        <>
          <WorkedAndMissing good={feedback?.good} missing={feedback?.missing} />
          <LockedInsights locked={feedback?.locked} usedVoice={Boolean(vm)} />
        </>
      );
    }

    // ── Full evaluated open answer ──
    const enrichPending = feedback?.enrichPending === true;
    const kw = feedback?.keywordCoverage || feedback?.keywords;
    return (
      <>
        <FixFirst tip={feedback?.tip} />
        <KeyIdea idealHint={feedback?.idealHint} />
        <WorkedAndMissing good={feedback?.good} missing={feedback?.missing} />
        <AnswerCompare userAnswer={userAnswer} sampleAnswer={feedback?.sampleAnswer} />
        {enrichPending && !feedback?.sampleAnswer && <PendingBlock label="Writing your model answer…" lines={2} />}
        {enrichPending && <PendingBlock label="Analysing keywords, structure and confidence…" lines={3} />}
        {feedback?.enrichFailed && !enrichPending && !feedback?.sampleAnswer && (
          <Notice tone="info" icon="info" title="Detailed breakdown unavailable">
            It couldn&apos;t be generated for this answer. Your score and feedback above are unaffected.
          </Notice>
        )}
        <Keywords keywords={kw} />
        <Confidence confidenceScore={feedback?.confidenceScore} />
        <Star starBreakdown={feedback?.starBreakdown} />
        <Delivery vm={vm} feedback={feedback} />
        <FollowUps questions={feedback?.followUpQuestions} />
      </>
    );
  };

  const skippedPending = skipped && !objective && !basic && feedback?.skippedPending && !feedback?.sampleAnswer;

  let hero = null;
  if (skipped) hero = <SkippedHero pending={Boolean(skippedPending)} />;
  else if (objective) hero = <McqHero correct={correct} question={question} userAnswerIndex={userAnswerIndex} timeTaken={timeTaken} timeLimit={timeLimit} />;
  else if (aiOk) hero = <ScoreHero score={score} timeTaken={timeTaken} timeLimit={timeLimit} previousScores={previousScores} feedback={feedback} answerWords={answerWords} />;

  return (
    <div ref={rootRef} className="fb-scroll fb-in" style={{ fontFamily: F.body, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{PANEL_CSS}</style>
      {hero}
      {renderBody()}
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
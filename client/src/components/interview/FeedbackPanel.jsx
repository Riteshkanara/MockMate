/**
 * MockMate — FeedbackPanel.jsx  (v5 · "Calm Blue Hero")
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from v4:
 *
 *  1. One hero design for every score
 *       - Same light-blue background at every score (HERO_BG)
 *       - Only small accents (ring, chips, XP bar) shift by score band
 *       - Set ACCENT_BY_SCORE = false to keep everything blue
 *       - No floating emoji, confetti, or orbs
 *
 *  2. MCQ hero matches the open-ended hero
 *       - Same background, binary accent (mint = correct, coral = wrong)
 *       - Shows the user's pick and, when wrong, the correct answer
 *
 *  3. Cleanup
 *       - Removed unused heroes (gradient, minimal), confetti, floating emoji,
 *         quick-next button, and the heroVariant prop
 *       - Voice word-count bar now uses real data instead of a fixed 79%
 *       - XP prefers feedback.xpEarned when the backend provides it
 *
 * Exports: FeedbackPanel, FeedbackCard (default)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import PropTypes from 'prop-types';
import { useEffect, useRef, useState, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
const C = {
  bg:         '#F0F4FF',
  bgDeep:     '#E8EEFF',
  surface:    '#FFFFFF',
  surfaceAlt: '#F8FAFF',

  text:      '#0A1628',
  textSub:   '#3D5280',
  textMuted: '#6B7DA3',
  textFaint: '#97A8C9',

  border:    '#DDE5F7',
  borderMd:  '#B8CAF0',

  b50:  '#EBF2FF', b100: '#C7DAFF', b200: '#9DBFFF', b300: '#6FA5FF',
  b500: '#1A6EFF', b600: '#0057E8',
  b700: '#0044C4', b800: '#002E96', b900: '#001F6B',

  c500: '#00ADE0', c600: '#0093C4',

  ok:       '#059669', okTint:  '#ECFDF5', okGlow: 'rgba(5,150,105,0.18)',
  warn:     '#D97706', warnTint:'#FFFBEB',
  caution:  '#EA580C', cautTint:'#FFF7ED',
  danger:   '#DC2626', danTint: '#FEF2F2',
  teal:     '#0D9488', tealTint:'#F0FDFA',
  violet:   '#6D5BEE', violTint:'#F0EEFF',
  indigo:   '#4338CA', indiTint:'#EEF2FF',

  gold:     '#F5B301', goldTint: '#FFF8DC', goldDeep: '#B45309',
  mint:     '#34D399',
};

const F = {
  display: `'Plus Jakarta Sans','Lexend',sans-serif`,
  body:    `'Inter',-apple-system,BlinkMacSystemFont,sans-serif`,
  mono:    `'JetBrains Mono','Fira Code','SF Mono',monospace`,
};

const BTN_GRAD = 'linear-gradient(135deg,#002E96 0%,#0057E8 50%,#1A6EFF 100%)';
const SH_MD    = '0 6px 28px rgba(26,110,255,0.12)';

// ═══════════════════════════════════════════════════════════════════════════════
// HERO THEME — one fixed light-blue background at every score
// ═══════════════════════════════════════════════════════════════════════════════

// Set to false if you want the hero to be 100% the same blue at every score
const ACCENT_BY_SCORE = false;

const HERO_BG = 'linear-gradient(140deg,#0044C4 0%,#0057E8 55%,#0093C4 100%)';

const heroAccent = (s) => {
  const blue = { a: '#BFDBFE', soft: 'rgba(191,219,254,.18)', line: 'rgba(191,219,254,.45)', txt: '#EAF2FF' };
  if (!ACCENT_BY_SCORE) return blue;
  if (s >= 80) return { a: '#6EE7B7', soft: 'rgba(110,231,183,.18)', line: 'rgba(110,231,183,.45)', txt: '#D1FAE5' };
  if (s >= 60) return blue;
  if (s >= 30) return { a: '#FCD34D', soft: 'rgba(252,211,77,.18)',  line: 'rgba(252,211,77,.45)',  txt: '#FEF3C7' };
  return             { a: '#FCA5A5', soft: 'rgba(252,165,165,.18)', line: 'rgba(252,165,165,.45)', txt: '#FEE2E2' };
};

const mcqAccent = (correct) => correct
  ? { a: '#6EE7B7', soft: 'rgba(110,231,183,.18)', line: 'rgba(110,231,183,.45)', txt: '#D1FAE5' }
  : { a: '#FCA5A5', soft: 'rgba(252,165,165,.18)', line: 'rgba(252,165,165,.45)', txt: '#FEE2E2' };

// ═══════════════════════════════════════════════════════════════════════════════
// RANK / XP / VERDICT
// ═══════════════════════════════════════════════════════════════════════════════
const rankOf = (s) => {
  if (s >= 90) return { name: 'Legend',  next: null,      need: 0      };
  if (s >= 75) return { name: 'Pro',     next: 'Legend',  need: 90 - s };
  if (s >= 60) return { name: 'Rising',  next: 'Pro',     need: 75 - s };
  if (s >= 40) return { name: 'Grinder', next: 'Rising',  need: 60 - s };
  return             { name: 'Rookie',   next: 'Grinder', need: 40 - s };
};

// Prefers the backend's real XP when provided, otherwise falls back to the formula
const xpFor = (s, skipped, backendXp) => {
  if (skipped) return 0;
  if (typeof backendXp === 'number') return backendXp;
  return Math.max(10, Math.round(s * 1.5));
};

const verdict = (s) => {
  if (s >= 90) return { label: 'Outstanding',   em: '🏆', sub: 'Interview-ready. This is the answer that gets the offer.'   };
  if (s >= 75) return { label: 'Strong answer', em: '💎', sub: 'Really solid — a bit more depth and this is fully polished.' };
  if (s >= 60) return { label: 'Solid attempt', em: '🚀', sub: 'Good base. A few more specific points and you nail this.'   };
  if (s >= 40) return { label: 'Getting there', em: '🔥', sub: 'Right track. Several important points were missing.'        };
  return             { label: 'Level-up time',  em: '🌱', sub: 'This is exactly why you practice. Review it and go again.'  };
};

const safeArr = (v) => (Array.isArray(v) && v.length > 0 ? v : []);

const splitParts = (text = '') => {
  if (!text) return [];
  const byNum = text.split(/(?<!\d)\d+\.\s+/).map(s => s.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  const bySentence = text.replace(/([.!?])\s+/g, '$1|||').split('|||').map(s => s.trim()).filter(Boolean);
  return bySentence.length <= 1 ? [text.trim()] : bySentence;
};

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
@keyframes mmSpin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes mmPulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.75)} }
@keyframes mmBar     { from{width:0} }
@keyframes mmShimmer { 0%{background-position:-300% center} 100%{background-position:300% center} }
@keyframes mmPop     { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.12);opacity:1} 100%{transform:scale(1);opacity:1} }
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
}
.mm-btn:hover:not(:disabled){ transform:translateY(-2px); box-shadow:0 10px 32px rgba(26,110,255,.45),0 14px 44px rgba(0,31,107,.25)!important; }
.mm-btn:active:not(:disabled){ transform:translateY(0) scale(.985); }
.mm-btn{ transition:transform .14s ease, box-shadow .14s ease; }
.mm-acc-btn:hover{ opacity:.92; }
.mm-qa-btn:hover{ background:${C.surfaceAlt}!important; }
.mm-card{ transition:transform .16s ease, box-shadow .16s ease; }
.mm-card:hover{ transform:translateY(-1px); box-shadow:0 6px 20px rgba(26,110,255,.10); }
.mm-qnext:hover{ opacity:.92; transform:translateY(-1px) scale(1.02); }
.mm-qnext:active{ transform:scale(.97); }
.mm-qnext{ transition:transform .12s ease,opacity .12s ease; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE ATOMS
// ═══════════════════════════════════════════════════════════════════════════════
const SecLabel = ({ children, color = C.textMuted }) => (
  <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color, letterSpacing: '0.05em', marginBottom: 8 }}>
    {children}
  </div>
);

const Tag = ({ children, color = C.textMuted, bg, border }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 9px', borderRadius: 7,
    background: bg || `${color}18`,
    border: `1px solid ${border || color + '30'}`,
    fontFamily: F.mono, fontSize: 11, fontWeight: 700,
    letterSpacing: '0.03em', color, whiteSpace: 'nowrap',
  }}>{children}</span>
);

const BulletList = ({ items, bullet = C.textMuted }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {items.map((pt, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 8, background: bullet }} />
        <span style={{ fontSize: 13.5, lineHeight: 1.65, color: C.textSub, flex: 1, fontFamily: F.body }}>{pt}</span>
      </div>
    ))}
  </div>
);

const SectionHeader = ({ ico, icoColor = 'blue', em, title, hint }) => {
  const icoStyles = {
    blue:    { bg: `linear-gradient(135deg,${C.b50},${C.b100})`,       color: C.b600,    ring: C.b200 },
    green:   { bg: `linear-gradient(135deg,${C.okTint},#C9F5DE)`,      color: C.ok,      ring: 'rgba(5,150,105,.35)' },
    teal:    { bg: `linear-gradient(135deg,${C.tealTint},#C7F3EE)`,    color: C.teal,    ring: 'rgba(13,148,136,.35)' },
    violet:  { bg: `linear-gradient(135deg,${C.violTint},#DDD6FE)`,    color: C.violet,  ring: 'rgba(109,91,238,.35)' },
    navy:    { bg: `linear-gradient(135deg,${C.goldTint},#FDE9A6)`,    color: C.goldDeep,ring: 'rgba(245,179,1,.45)' },
    indigo:  { bg: `linear-gradient(135deg,${C.indiTint},#D7DCFB)`,    color: C.indigo,  ring: 'rgba(67,56,202,.35)' },
    caution: { bg: `linear-gradient(135deg,${C.cautTint},#FFD9BD)`,    color: C.caution, ring: 'rgba(234,88,12,.35)' },
  };
  const ic = icoStyles[icoColor] || icoStyles.blue;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 9, borderBottom: `1px solid ${C.border}`, marginBottom: 11 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: ic.bg, border: `1px solid ${ic.ring}`, color: ic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: '0 2px 6px rgba(10,22,40,.06)' }}>
        {em ? <span style={{ lineHeight: 1 }}>{em}</span> : <i className={ico} />}
      </div>
      <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-.25px' }}>{title}</span>
      {hint && (
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: ic.color, background: `${ic.color}12`, border: `1px solid ${ic.color}25`, textTransform: 'uppercase', letterSpacing: '.8px', marginLeft: 'auto', whiteSpace: 'nowrap', padding: '3px 9px', borderRadius: 99 }}>{hint}</span>
      )}
    </div>
  );
};

const Bar = ({ pct, color, delayMs = 0, height = 6 }) => (
  <div style={{ height, borderRadius: 99, background: C.b50, overflow: 'hidden' }}>
    <div style={{
      height: '100%', borderRadius: 99, width: `${Math.min(100, pct)}%`,
      background: color,
      animation: `mmBar .9s cubic-bezier(.16,1,.3,1) ${delayMs}ms both`,
    }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT-UP HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useCountUp(target, duration = 950, delay = 0) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    setValue(0);
    const tid = setTimeout(() => {
      let start = null;
      const tick = (now) => {
        if (!start) start = now;
        const t    = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        setValue(Math.round(ease * target));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(tid); cancelAnimationFrame(rafRef.current); };
  }, [target, duration, delay]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE STATS HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useHeroStats(feedback, score) {
  return useMemo(() => {
    const kw    = feedback?.keywords || feedback?.keywordCoverage;
    const hit   = safeArr(kw?.hit).length;
    const total = hit + safeArr(kw?.missed).length;

    const cs   = feedback?.confidenceScore;
    const conf = cs == null ? null : Math.round(Number(typeof cs === 'object' ? cs.score : cs) || 0);

    const fw     = feedback?.frameworkCheck;
    const fwName = fw?.detected && fw.detected !== 'none' ? String(fw.detected).toUpperCase() : null;

    return [
      { v: conf != null ? `${conf}%` : '—',   k: 'Confidence', hot: conf != null && conf >= 75 },
      { v: fwName || 'Free-form',              k: 'Framework',  hot: fw?.followed === true },
      { v: total > 0 ? `${hit}/${total}` : '—', k: 'Keywords',  hot: total > 0 && hit / total >= 0.7 },
    ];
  }, [feedback, score]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO — open-ended answers (light blue, calm, one emoji)
// ═══════════════════════════════════════════════════════════════════════════════
function FeedbackHero({ score, mounted, questionIndex, totalQuestions, timeTaken, complexityRating, feedback, skipped, onNext, isLoading, isLast }) {
  const x            = heroAccent(score);
  const v            = verdict(score);
  const rank         = rankOf(score);
  const stats        = useHeroStats(feedback, score);
  const displayScore = useCountUp(score, 950, 0);
  const displayXp    = useCountUp(xpFor(score, skipped, feedback?.xpEarned), 1000, 300);
  const pct          = Math.max(0, Math.min(100, score));

  const SIZE = 112, R = 46, CIRC = 2 * Math.PI * R;
  const offset = mounted ? CIRC * (1 - pct / 100) : CIRC;

  const metaParts = [
    totalQuestions > 0 ? `Q${(questionIndex || 0) + 1} OF ${totalQuestions}` : null,
    complexityRating ? String(complexityRating).toUpperCase() : null,
    timeTaken > 0 ? `${timeTaken}s` : null,
  ].filter(Boolean);

  return (
    <div style={{ background: HERO_BG, padding: '20px 18px 16px', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -120, right: -100, width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle,${x.soft} 0%,transparent 70%)`, pointerEvents: 'none' }} />

      {/* top row: context + rank */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '.6px' }}>
          {metaParts.join(' · ')}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, color: x.txt, background: x.soft, border: `1px solid ${x.line}`, padding: '4px 11px', borderRadius: 99, letterSpacing: '.5px', animation: 'mmPop .5s cubic-bezier(.16,1,.3,1) .3s both' }}>
          {rank.name.toUpperCase()}
        </span>
      </div>

      {/* dial + verdict */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={7} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={x.a} strokeWidth={7} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-1.5px', fontVariantNumeric: 'tabular-nums' }}>{displayScore}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>OUT OF 100</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: F.display, fontSize: 13, fontWeight: 800, color: x.txt, background: x.soft, border: `1px solid ${x.line}`, padding: '5px 12px 5px 9px', borderRadius: 99, marginBottom: 9 }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>{v.em}</span>
            {v.label}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,.85)', fontFamily: F.body }}>{v.sub}</div>
        </div>
      </div>

      {/* xp + progress */}
      <div style={{ position: 'relative', marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, fontFamily: F.mono, fontSize: 10.5, fontWeight: 700 }}>
          <span style={{ color: '#fff' }}>+{displayXp} XP</span>
          <span style={{ color: 'rgba(255,255,255,.65)' }}>{rank.next ? `${rank.need} pts to ${rank.next}` : 'Top rank'}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,.16)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: x.a, width: mounted ? `${pct}%` : '0%', transition: 'width .95s cubic-bezier(.16,1,.3,1)' }} />
        </div>
      </div>

      {/* stat strip */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', marginTop: 14, border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,.08)' }}>
        {stats.map((st, i) => (
          <div key={i} style={{ padding: '10px 6px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,.14)' : 'none', background: st.hot ? x.soft : 'transparent' }}>
            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 900, color: st.hot ? x.txt : '#fff' }}>{st.v}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 3 }}>{st.k}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onNext}
        disabled={isLoading}
        className="mm-qnext"
        style={{ position: 'relative', marginTop: 12, width: '100%', padding: '11px 16px', borderRadius: 12, border: 'none', background: '#fff', color: C.b800, fontFamily: F.display, fontSize: 13.5, fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
      >
        {isLast ? 'See my results' : 'Next question'} →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO — MCQ / aptitude (same background, binary accent)
// ═══════════════════════════════════════════════════════════════════════════════
function McqHero({ correct, skipped, question, feedback, userAnswerIndex, questionIndex, totalQuestions, onNext, isLoading, isLast }) {
  const x         = mcqAccent(correct);
  const xp        = typeof feedback?.xpEarned === 'number' ? feedback.xpEarned : (correct ? 15 : 5);
  const displayXp = useCountUp(xp, 800, 300);

  if (skipped) return null;

  const options      = question?.options || [];
  const correctIndex = question?.correctAnswerIndex;
  const userText     = userAnswerIndex != null ? options[userAnswerIndex] : null;
  const correctText  = correctIndex != null ? options[correctIndex] : null;
  const letter       = (i) => (i != null ? String.fromCharCode(65 + i) : '');

  const headline = correct ? 'Correct' : 'Not this time';
  const sub      = correct
    ? 'That’s the right answer. Keep the streak going.'
    : 'Every miss is a rep. Check the explanation below and it’ll stick.';

  return (
    <div style={{ background: HERO_BG, padding: '20px 18px 16px', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -120, right: -100, width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle,${x.soft} 0%,transparent 70%)`, pointerEvents: 'none' }} />

      {/* top row */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '.6px' }}>
          {totalQuestions > 0 ? `Q${(questionIndex || 0) + 1} OF ${totalQuestions} · ` : ''}MULTIPLE CHOICE
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, color: x.txt, background: x.soft, border: `1px solid ${x.line}`, padding: '4px 11px', borderRadius: 99, letterSpacing: '.5px', animation: 'mmPop .5s cubic-bezier(.16,1,.3,1) .3s both' }}>
          {correct ? 'CORRECT' : 'INCORRECT'}
        </span>
      </div>

      {/* icon tile + headline */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ width: 68, height: 68, borderRadius: 20, flexShrink: 0, background: x.soft, border: `1.5px solid ${x.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'mmPop .55s cubic-bezier(.16,1,.3,1) .1s both' }}>
          <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={x.a} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            {correct
              ? <polyline points="4 12.5 9.5 18 20 6.5" />
              : <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>}
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-.6px', lineHeight: 1.1 }}>{headline}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,.85)', marginTop: 5, fontFamily: F.body }}>{sub}</div>
        </div>
      </div>

      {/* your answer vs correct answer */}
      {(userText || (!correct && correctText)) && (
        <div style={{ position: 'relative', marginTop: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}>
          {userText && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderBottom: !correct && correctText ? '1px solid rgba(255,255,255,.14)' : 'none' }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: x.soft, border: `1px solid ${x.line}`, color: x.txt, fontFamily: F.mono, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{letter(userAnswerIndex)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 2 }}>Your answer</div>
                <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.45 }}>{userText}</div>
              </div>
            </div>
          )}
          {!correct && correctText && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(110,231,183,.12)' }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: 'rgba(110,231,183,.2)', border: '1px solid rgba(110,231,183,.45)', color: '#D1FAE5', fontFamily: F.mono, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{letter(correctIndex)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: 'rgba(209,250,229,.75)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 2 }}>Correct answer</div>
                <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.45 }}>{correctText}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* xp */}
      <div style={{ position: 'relative', marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: F.mono, fontSize: 10.5, fontWeight: 700 }}>
        <span style={{ color: '#fff' }}>+{displayXp} XP</span>
        <span style={{ color: 'rgba(255,255,255,.65)' }}>{correct ? 'Full marks' : 'Partial XP for trying'}</span>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onNext}
        disabled={isLoading}
        className="mm-qnext"
        style={{ position: 'relative', marginTop: 12, width: '100%', padding: '11px 16px', borderRadius: 12, border: 'none', background: '#fff', color: C.b800, fontFamily: F.display, fontSize: 13.5, fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
      >
        {isLast ? 'See my results' : 'Next question'} →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION + YOUR ANSWER
// ═══════════════════════════════════════════════════════════════════════════════
function QuestionAnswerBlock({ question, userAnswer }) {
  const [open, setOpen] = useState(true);
  const questionText = question?.questionText || question?.question || '';
  if (!questionText && !userAnswer) return null;
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.borderMd}`, boxShadow: '0 2px 10px rgba(26,110,255,.06)' }}>
      {questionText && (
        <div style={{ padding: '14px 16px', background: `linear-gradient(135deg,${C.b50},#F3F0FF)`, borderBottom: `1px solid ${C.b100}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.b600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 7 }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>🎯</span>Interview question
          </div>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.b900, lineHeight: 1.55 }}>{questionText}</div>
        </div>
      )}
      {userAnswer && (
        <>
          <button
            className="mm-qa-btn"
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.surface, border: 'none', cursor: 'pointer', fontFamily: F.body, fontSize: 13.5, fontWeight: 600, color: C.textSub, minHeight: 46, transition: 'background .12s' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: C.b50, border: `1px solid ${C.b100}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.b600, transition: 'transform .24s cubic-bezier(.16,1,.3,1)', transform: open ? 'rotate(180deg)' : 'none' }}>
                <i className="ti ti-chevron-up" />
              </span>
              <span style={{ fontSize: 14, lineHeight: 1 }}>🗣️</span>
              {open ? 'Hide your answer' : 'Show your answer'}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '.9px' }}>transcript</span>
          </button>
          <div style={{ overflow: 'hidden', maxHeight: open ? 600 : 0, transition: 'max-height .32s cubic-bezier(.16,1,.3,1)', background: C.surface, borderTop: open ? `1px solid ${C.border}` : 'none', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 6, right: 12, fontSize: 52, fontFamily: 'Georgia,serif', color: C.b500, opacity: .07, lineHeight: 1, pointerEvents: 'none', userSelect: 'none', fontWeight: 900 }}>"</div>
            <p style={{ margin: 0, padding: '14px 16px', fontFamily: F.body, fontSize: 14, fontWeight: 400, color: C.text, lineHeight: 1.75, paddingRight: 30 }}>{userAnswer}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVAL GRID
// ═══════════════════════════════════════════════════════════════════════════════
function EvalGrid({ good, missing }) {
  if (!good && !missing) return null;
  const goodParts = splitParts(good);
  const missParts = splitParts(missing);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: good && missing ? '1fr 1fr' : '1fr', gap: 9 }}>
      {good && (
        <div className="mm-card" style={{ borderRadius: 14, padding: '13px 14px 13px 18px', position: 'relative', overflow: 'hidden', background: `linear-gradient(160deg,${C.okTint},#E2FBEF)`, border: `1px solid rgba(5,150,105,.28)` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'linear-gradient(180deg,#34d399,#059669)' }} />
          <div style={{ position: 'absolute', bottom: -6, right: 7, fontSize: 42, opacity: .12, userSelect: 'none', pointerEvents: 'none', lineHeight: 1 }}>✅</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>💪</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 9px', borderRadius: 99, background: C.okGlow, color: C.ok }}>What worked</span>
            <span style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.ok }}>+{goodParts.length}</span>
          </div>
          <BulletList items={goodParts} bullet={C.ok} />
        </div>
      )}
      {missing && (
        <div className="mm-card" style={{ borderRadius: 14, padding: '13px 14px 13px 18px', position: 'relative', overflow: 'hidden', background: `linear-gradient(160deg,${C.warnTint},#FFF3D1)`, border: `1px solid rgba(217,119,6,.30)` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'linear-gradient(180deg,#fbbf24,#D97706)' }} />
          <div style={{ position: 'absolute', bottom: -6, right: 7, fontSize: 42, opacity: .12, userSelect: 'none', pointerEvents: 'none', lineHeight: 1 }}>⚠️</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>🎯</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 9px', borderRadius: 99, background: 'rgba(217,119,6,.16)', color: C.warn }}>Level-up gaps</span>
            <span style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.warn }}>{missParts.length}</span>
          </div>
          <BulletList items={missParts} bullet={C.warn} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COACHING GRID
// ═══════════════════════════════════════════════════════════════════════════════
function CoachingGrid({ idealHint, tip }) {
  if (!idealHint && !tip) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: idealHint && tip ? '1fr 1fr' : '1fr', gap: 9 }}>
      {idealHint && (
        <div className="mm-card" style={{ borderRadius: 14, padding: '14px', background: C.surface, border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', bottom: -6, right: 7, fontSize: 42, opacity: .08, userSelect: 'none', pointerEvents: 'none', lineHeight: 1 }}>💡</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg,${C.okTint},#C9F5DE)`, border: '1px solid rgba(5,150,105,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>💡</div>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: C.ok }}>Key idea</span>
          </div>
          <BulletList items={splitParts(idealHint)} bullet={C.ok} />
        </div>
      )}
      {tip && (
        <div className="mm-card" style={{ borderRadius: 14, padding: '14px', background: `linear-gradient(160deg,${C.surface},${C.goldTint})`, border: `1px solid rgba(245,179,1,.35)`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', bottom: -6, right: 7, fontSize: 42, opacity: .10, userSelect: 'none', pointerEvents: 'none', lineHeight: 1 }}>🎯</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg,${C.goldTint},#FDE9A6)`, border: '1px solid rgba(245,179,1,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚡</div>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: C.goldDeep }}>Next move</span>
            <span style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, color: C.goldDeep, background: 'rgba(245,179,1,.18)', padding: '2px 7px', borderRadius: 99 }}>+XP</span>
          </div>
          <BulletList items={splitParts(tip)} bullet={C.gold} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL ANSWER
// ═══════════════════════════════════════════════════════════════════════════════
function ModelAnswer({ sampleAnswer }) {
  const [open, setOpen] = useState(false);
  if (!sampleAnswer) return null;
  const pts = splitParts(sampleAnswer);
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.borderMd}`, boxShadow: '0 4px 16px rgba(0,31,107,.10)' }}>
      <button
        className="mm-acc-btn"
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', background: `linear-gradient(135deg,${C.b900},${C.b700} 60%,${C.c600})`, border: 'none', cursor: 'pointer', fontFamily: F.display, fontSize: 14, fontWeight: 800, color: '#fff', minHeight: 50, transition: 'opacity .12s' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, transition: 'transform .26s cubic-bezier(.16,1,.3,1)', transform: open ? 'rotate(180deg)' : 'none' }}>
            <i className="ti ti-chevron-up" />
          </span>
          <span style={{ fontSize: 16, lineHeight: 1 }}>🏆</span>
          {open ? 'Hide model answer' : 'Unlock model answer'}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.9px' }}>how a top answer reads</span>
      </button>
      <div style={{ overflow: 'hidden', maxHeight: open ? 600 : 0, transition: 'max-height .32s cubic-bezier(.16,1,.3,1)', background: C.surface, borderTop: open ? `1px solid ${C.border}` : 'none' }}>
        <div style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {pts.map((pt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, marginTop: 1, background: `linear-gradient(135deg,${C.b50},${C.b100})`, color: C.b700, border: `1px solid ${C.b200}`, fontSize: 11, fontWeight: 800, fontFamily: F.mono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.7, color: C.text, fontFamily: F.body }}>{pt}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCQ EXPLANATION
// ═══════════════════════════════════════════════════════════════════════════════
function McqExplanation({ question, correct, userAnswerIndex, skipped }) {
  const correctIndex = question?.correctAnswerIndex;
  const correctText  = correctIndex != null ? question?.options?.[correctIndex] : null;
  const userIndex    = userAnswerIndex ?? null;
  const userText     = userIndex != null ? question?.options?.[userIndex] : null;
  const explanation  = question?.explanation || '';

  if (skipped) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {correctText && (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid rgba(217,119,6,.30)`, borderLeft: `4px solid ${C.warn}`, background: C.warnTint }}>
          <SecLabel color={C.warn}>🔓 Correct answer — not attempted</SecLabel>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.warn }}>{correctText}</div>
        </div>
      )}
      {explanation && (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${C.borderMd}`, borderLeft: `4px solid ${C.b500}`, background: C.b50 }}>
          <SecLabel color={C.b600}>💡 Why this is the answer</SecLabel>
          <BulletList items={splitParts(explanation)} bullet={C.b500} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {!correct && correctText && (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid rgba(5,150,105,.30)`, borderLeft: `4px solid ${C.ok}`, background: C.okTint }}>
          <SecLabel color={C.ok}>✅ Correct answer</SecLabel>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: C.ok }}>{correctText}</div>
        </div>
      )}
      {correct && (
        <div style={{ padding: '13px 16px', borderRadius: 14, border: `1px solid rgba(5,150,105,.30)`, background: C.okTint }}>
          <div style={{ fontSize: 13.5, color: C.ok, fontWeight: 700, fontFamily: F.body }}>✨ You chose the right answer: {userText}</div>
        </div>
      )}

      {explanation && (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${C.borderMd}`, borderLeft: `4px solid ${C.b500}`, background: C.b50 }}>
          <SecLabel color={C.b600}>💡 Why this is the answer</SecLabel>
          <BulletList items={splitParts(explanation)} bullet={C.b500} />
        </div>
      )}

      {question?.options?.length > 0 && (
        <div style={{ borderRadius: 14, border: `1px solid ${C.borderMd}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: '.05em', textTransform: 'uppercase' }}>All options</span>
          </div>
          {question.options.map((opt, i) => {
            const isC = i === correctIndex, isU = i === userIndex;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: isC ? C.okTint : isU && !correct ? C.danTint : C.surface, borderBottom: i < question.options.length - 1 ? `1px solid ${C.border}` : 'none', minHeight: 46 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${isC ? C.ok : isU ? C.danger : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, fontFamily: F.mono, color: isC ? C.ok : isU ? C.danger : C.textMuted, background: isC ? C.okTint : isU && !correct ? C.danTint : C.surface }}>
                  {isC ? '✓' : isU && !correct ? '✕' : String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontSize: 14, fontWeight: isC ? 700 : 500, flex: 1, lineHeight: 1.5, color: C.text }}>{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYWORD COVERAGE
// ═══════════════════════════════════════════════════════════════════════════════
function KeywordCoverage({ keywords }) {
  const hit    = safeArr(keywords?.hit);
  const missed = safeArr(keywords?.missed);
  if (!hit.length && !missed.length) return null;
  const total = hit.length + missed.length;
  const pct   = total > 0 ? Math.round((hit.length / total) * 100) : 0;
  const barGrad = pct >= 70 ? `linear-gradient(90deg,${C.ok},${C.mint})` : pct >= 40 ? `linear-gradient(90deg,${C.warn},#FBBF24)` : `linear-gradient(90deg,${C.danger},#F87171)`;
  return (
    <div>
      <SectionHeader ico="ti ti-tag" em="🔑" title="Keyword coverage" hint={`${pct}% hit rate`} icoColor="blue" />
      <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.borderMd}`, background: C.surface }}>
        <div style={{ padding: '11px 14px', background: `linear-gradient(135deg,${C.b50},#F3F0FF)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.b100}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>🎯</span>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, color: C.b700, textTransform: 'uppercase', letterSpacing: '1px' }}>Coverage</span>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: C.b600, background: C.surface, border: `1px solid ${C.b100}`, padding: '3px 10px', borderRadius: 99 }}>{hit.length} / {total} keywords</span>
        </div>
        <div style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}` }}>
          <Bar pct={pct} color={barGrad} delayMs={300} height={8} />
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {hit.map((kw, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: F.mono, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: C.okTint, color: C.ok, border: `1px solid rgba(5,150,105,.28)` }}>
              <i className="ti ti-check" style={{ fontSize: 11 }} />{kw}
            </span>
          ))}
          {missed.map((kw, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: F.mono, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: C.danTint, color: C.danger, border: `1px solid rgba(220,38,38,.25)` }}>
              <i className="ti ti-x" style={{ fontSize: 11 }} />{kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAMEWORK CHECK
// ═══════════════════════════════════════════════════════════════════════════════
function FrameworkCheck({ frameworkCheck }) {
  const detected = frameworkCheck?.detected;
  const followed = frameworkCheck?.followed;
  const missing  = safeArr(frameworkCheck?.missing);
  if (!detected || detected === 'none') return null;
  const color = followed ? C.ok : C.warn;
  return (
    <div>
      <SectionHeader ico="ti ti-layout-grid" em="📐" title="Framework check" hint="Structure" icoColor="green" />
      <div style={{ borderRadius: 14, padding: '14px 15px', background: followed ? `linear-gradient(135deg,${C.okTint},#E2FBEF)` : `linear-gradient(135deg,${C.warnTint},#FFF3D1)`, border: `1px solid ${followed ? 'rgba(5,150,105,.28)' : 'rgba(217,119,6,.30)'}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 12, bottom: -4, fontSize: 46, opacity: .10, pointerEvents: 'none', userSelect: 'none' }}>📐</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, flexShrink: 0, background: followed ? C.okGlow : 'rgba(217,119,6,.15)', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            {followed ? '🏅' : '🧩'}
          </div>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Framework detected</div>
            <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 900, color: followed ? '#064e3b' : '#451a03', letterSpacing: '-.3px' }}>{String(detected).toUpperCase()}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 7, fontFamily: F.mono, fontSize: 11, fontWeight: 800, background: followed ? C.okGlow : 'rgba(217,119,6,.15)', color, border: `1px solid ${color}44`, padding: '4px 11px', borderRadius: 99 }}>
              <i className={`ti ti-${followed ? 'check' : 'alert-triangle'}`} style={{ fontSize: 11 }} />
              {followed ? 'Followed correctly' : 'Not fully followed'}
            </div>
          </div>
        </div>
        {missing.length > 0 && (
          <div style={{ marginTop: 11, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missing.map((p, i) => <Tag key={i} color={C.warn}>{p}</Tag>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE CARD
// ═══════════════════════════════════════════════════════════════════════════════
function ConfidenceCard({ confidenceScore }) {
  if (confidenceScore == null) return null;
  const isObj  = typeof confidenceScore === 'object';
  const score  = Math.max(0, Math.min(100, Number(isObj ? confidenceScore.score : confidenceScore) || 0));
  const label  = isObj && confidenceScore.label ? confidenceScore.label : (score >= 75 ? 'Confident' : score >= 50 ? 'Neutral' : score >= 30 ? 'Hesitant' : 'Uncertain');
  const note   = isObj ? confidenceScore.note : null;
  const fPct   = isObj ? confidenceScore.formalPct  : null;
  const hPct   = isObj ? confidenceScore.hedgingPct : null;
  return (
    <div>
      <SectionHeader ico="ti ti-brain" em="🧠" title="Confidence analysis" hint="From voice" icoColor="violet" />
      <div style={{ borderRadius: 14, padding: '14px 16px', background: `linear-gradient(135deg,${C.violTint},#E6E0FF)`, border: `1px solid rgba(109,91,238,.30)`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'absolute', right: 10, bottom: -6, fontSize: 46, opacity: .10, pointerEvents: 'none', userSelect: 'none' }}>🧠</div>
        <div style={{ width: 48, height: 48, borderRadius: 13, flexShrink: 0, background: 'rgba(109,91,238,.16)', border: '1px solid rgba(109,91,238,.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {score >= 75 ? '😎' : score >= 50 ? '🙂' : score >= 30 ? '😅' : '😬'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.violet, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Confidence score</div>
          <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 900, color: '#2d1b8a', letterSpacing: '-.3px', marginBottom: 8 }}>{label} — {score}%</div>
          <div style={{ height: 8, background: 'rgba(109,91,238,.16)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,${C.danger}25 0% 30%,${C.warn}25 30% 50%,${C.b500}25 50% 75%,${C.ok}25 75% 100%)` }} />
            <div style={{ height: '100%', borderRadius: 99, width: `${score}%`, background: `linear-gradient(90deg,${C.violet},#a78bfa)`, position: 'relative', zIndex: 1, animation: 'mmBar .9s cubic-bezier(.16,1,.3,1) .35s both' }} />
          </div>
          {(fPct != null || hPct != null) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
              {fPct != null && <Tag color={C.c500}>Formal {fPct}%</Tag>}
              {hPct != null && <Tag color={C.warn}>Hedging {hPct}%</Tag>}
            </div>
          )}
          {note && <p style={{ margin: '9px 0 0', fontSize: 12.5, color: 'rgba(45,27,138,.75)', lineHeight: 1.55, fontFamily: F.body }}>{note}</p>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAR BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════════
function StarBreakdown({ starBreakdown }) {
  if (!starBreakdown) return null;
  const { S, T: task, A, R, overall } = starBreakdown;
  if (S?.score === 0 && task?.score === 0 && A?.score === 0 && R?.score === 0) return null;
  const pillars = [
    { key: 'S', label: 'Situation', em: '🎬', data: S,    color: C.c500   },
    { key: 'T', label: 'Task',      em: '🎯', data: task, color: C.b500   },
    { key: 'A', label: 'Action',    em: '⚡', data: A,    color: C.violet },
    { key: 'R', label: 'Result',    em: '🏁', data: R,    color: C.ok     },
  ];
  return (
    <div>
      <SectionHeader ico="ti ti-chart-radar" em="⭐" title="STAR breakdown" hint="Framework depth" icoColor="indigo" />
      <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.borderMd}`, background: C.surface }}>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {pillars.map(({ key, label, em, data, color }) => {
            if (!data) return null;
            const s = Math.max(0, Math.min(100, Number(data.score) || 0));
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{em}</span>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: C.text }}>{label}</span>
                  </div>
                  <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 800, color }}>{s}/100</span>
                </div>
                <Bar pct={s} color={`linear-gradient(90deg,${color},${color}bb)`} height={6} />
                {data.note && <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.45, marginTop: 4, fontFamily: F.body }}>{data.note}</div>}
              </div>
            );
          })}
          {overall && !overall.toLowerCase().includes('not applicable') && (
            <div style={{ padding: '11px 13px', borderRadius: 10, background: C.b50, border: `1px solid ${C.b100}`, fontSize: 13, color: C.textSub, lineHeight: 1.55 }}>{overall}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME EFFICIENCY
// ═══════════════════════════════════════════════════════════════════════════════
function TimeEfficiency({ timeEfficiency }) {
  const { rating, comment, idealRange } = timeEfficiency || {};
  if (!rating && !comment) return null;
  const rLow  = String(rating).toLowerCase();
  const color = rLow === 'efficient' ? C.ok : rLow === 'rushed' ? C.warn : C.danger;
  const bg    = rLow === 'efficient' ? C.okTint : rLow === 'rushed' ? C.warnTint : C.danTint;
  return (
    <div style={{ borderRadius: 14, padding: '14px 15px', background: bg, border: `1px solid ${color}33`, borderLeft: `4px solid ${color}` }}>
      <SecLabel color={color}>⏱️ Time efficiency — {rating || '—'}</SecLabel>
      {comment && <p style={{ margin: '0 0 6px', fontSize: 13.5, lineHeight: 1.65, color: C.textSub, fontFamily: F.body }}>{comment}</p>}
      {idealRange && <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.textMuted }}>Ideal range: <strong style={{ color: C.textSub }}>{idealRange}</strong></span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEAK PATTERN
// ═══════════════════════════════════════════════════════════════════════════════
function WeakPattern({ weakPattern }) {
  if (!weakPattern?.detected) return null;
  const { label, suggestion } = weakPattern;
  if (!label && !suggestion) return null;
  return (
    <div style={{ borderRadius: 14, padding: '14px 15px', background: `linear-gradient(135deg,${C.cautTint},#FFEBD9)`, border: `1px solid rgba(234,88,12,.30)`, display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }} role="alert">
      <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 44, opacity: .10, pointerEvents: 'none', userSelect: 'none' }}>😬</div>
      <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'rgba(234,88,12,.14)', border: '1px solid rgba(234,88,12,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginTop: 1 }}>🚨</div>
      <div style={{ paddingRight: 38 }}>
        <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, color: C.caution, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>Habit to break — {label}</div>
        {suggestion && <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.6, color: '#431407', fontFamily: F.body }}>{suggestion}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE — DELIVERY SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════════
function DeliverySnapshot({ vm, feedback }) {
  const wpm     = vm?.wpm;
  const fwTotal = vm?.fillerWords?.total ?? 0;
  const cs      = feedback?.confidenceScore;
  const conf    = cs == null ? null : Math.round(Number(typeof cs === 'object' ? cs.score : cs) || 0);

  const paceOk = wpm?.band === 'ideal';
  const fillOk = fwTotal === 0;
  const confOk = conf == null || conf >= 60;

  const cells = [
    {
      em: '🎙️', label: 'Pace',
      value: wpm?.wpm > 0 ? `${wpm.wpm} wpm` : '—',
      status: paceOk ? 'ok' : 'warn',
      hint: paceOk ? 'On target' : wpm?.label || 'Check pace',
    },
    {
      em: '🤫', label: 'Fillers',
      value: fwTotal === 0 ? 'None' : `${fwTotal} used`,
      status: fillOk ? 'ok' : fwTotal <= 3 ? 'warn' : 'danger',
      hint: fillOk ? 'Clean delivery' : 'Reduce filler words',
    },
    {
      em: '🧠', label: 'Fluency',
      value: conf != null ? `${conf}%` : '—',
      status: confOk ? 'ok' : 'warn',
      hint: confOk ? 'Confident' : 'Work on tone',
    },
  ];

  const statusColor = (s) => s === 'ok' ? C.ok : s === 'warn' ? C.warn : C.danger;
  const statusBg    = (s) => s === 'ok' ? C.okTint : s === 'warn' ? C.warnTint : C.danTint;
  const statusIcon  = (s) => s === 'ok' ? '✓' : s === 'warn' ? '~' : '!';
  const tip = feedback?.deliveryTip || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 2 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.borderMd}`, background: C.surface }}>
        {cells.map((cell, i) => (
          <div key={i} style={{ padding: '14px 10px 12px', textAlign: 'center', borderRight: i < 2 ? `1px solid ${C.border}` : 'none', background: statusBg(cell.status) + '55', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: '50%', background: statusColor(cell.status), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', fontFamily: F.mono }}>
              {statusIcon(cell.status)}
            </div>
            <div style={{ fontSize: 22, marginBottom: 6, lineHeight: 1 }}>{cell.em}</div>
            <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: statusColor(cell.status), letterSpacing: '-.3px', lineHeight: 1 }}>{cell.value}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 5 }}>{cell.label}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, color: statusColor(cell.status), marginTop: 4, opacity: .85 }}>{cell.hint}</div>
          </div>
        ))}
      </div>

      {tip && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: `linear-gradient(135deg,${C.violTint},#E6E0FF)`, border: `1px solid rgba(109,91,238,.28)`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>💡</span>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, color: C.violet, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Delivery tip</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.textSub, fontFamily: F.body }}>{tip}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE — FULL PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function VoiceEvaluationPanel({ voiceMetrics, feedback }) {
  const [open, setOpen] = useState(true);
  const vm = voiceMetrics;
  if (!vm) return null;

  const { fillerWords, wpm, answerLength } = vm;
  const tone       = feedback?.toneAnalysis       || null;
  const vocab      = feedback?.vocabularyRichness || null;
  const hesitation = feedback?.hesitationPattern  || null;
  const hasAiVoice = tone || vocab || hesitation;

  const wpmColor    = (b) => ({ tooSlow: C.warn, ideal: C.ok, tooFast: C.danger }[b] || C.b500);
  const wpmPct      = (w) => Math.min(100, Math.round((w / 200) * 100));
  const lenColor    = (r) => ({ tooShort: C.warn, ideal: C.ok, tooLong: C.danger }[r] || C.b500);
  const lenLabel    = (r) => ({ tooShort: 'Too short', ideal: 'Ideal', tooLong: 'Too long' }[r] || '—');
  const hesColor    = (p) => ({ Confident: C.ok, Moderate: C.warn, Hesitant: C.danger }[p] || C.b500);
  const vocabColor  = (l) => ({ Rich: C.ok, Average: C.warn, Basic: C.danger }[l] || C.b500);
  const toneColorFn = (l) => ({ Professional: C.ok, Conversational: C.b500, Casual: C.warn }[l] || C.b500);
  const fillerColor = fillerWords.total === 0 ? C.ok : fillerWords.total <= 3 ? C.warn : C.danger;
  const fillerLabel = fillerWords.total === 0 ? 'Clean 🎯' : fillerWords.total <= 3 ? `${fillerWords.total} (minor)` : `${fillerWords.total} (heavy)`;

  return (
    <div>
      <SectionHeader ico="ti ti-microphone" em="🎙️" title="Voice analysis" hint="Full breakdown" icoColor="violet" />
      <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.borderMd}`, background: C.surface }}>

        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: `linear-gradient(135deg,${C.violTint},${C.b50})`, border: 'none', cursor: 'pointer', borderBottom: open ? `1px solid ${C.borderMd}` : 'none', minHeight: 46 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎤</span>
            <span style={{ fontFamily: F.mono, fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', color: C.violet }}>VOICE EVALUATION</span>
            {hasAiVoice && <Tag color={C.violet}>AI-scored</Tag>}
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted }}>{open ? '▾' : '▸'}</span>
        </button>

        {open && (
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            <DeliverySnapshot vm={vm} feedback={feedback} />

            {hasAiVoice && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 12, borderRadius: 12, background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
                {[
                  tone       && { score: tone.score,       label: `Tone · ${tone.label}`,            color: toneColorFn(tone.label)      },
                  vocab      && { score: vocab.score,      label: `Vocab · ${vocab.label}`,           color: vocabColor(vocab.label)      },
                  hesitation && { score: hesitation.score, label: `Fluency · ${hesitation.pattern}`,  color: hesColor(hesitation.pattern) },
                ].filter(Boolean).map((b, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '11px 15px', borderRadius: 12, background: `${b.color}14`, border: `1px solid ${b.color}38`, minWidth: 76, flexShrink: 0 }}>
                    <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: b.color, lineHeight: 1 }}>{b.score}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, color: C.textMuted, textAlign: 'center' }}>{b.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pace */}
            <div style={{ padding: '12px 14px', background: C.surfaceAlt, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>⚡</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, color: C.textMuted }}>Speaking pace</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: wpmColor(wpm?.band) }}>{wpm?.wpm > 0 ? `${wpm.wpm} wpm` : '—'}</span>
                  <Tag color={wpmColor(wpm?.band)}>{wpm?.label}</Tag>
                </div>
              </div>
              <Bar pct={wpmPct(wpm?.wpm || 0)} color={wpmColor(wpm?.band)} height={6} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {['0','50','100','150','200+'].map(v => (
                  <span key={v} style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint }}>{v}</span>
                ))}
              </div>
              {wpm?.hint && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 6, fontFamily: F.body }}>{wpm.hint}</div>}
            </div>

            {/* Fillers */}
            <div style={{ padding: '13px 14px', borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: fillerWords?.breakdown?.length > 0 ? 9 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🔤</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, color: C.textMuted }}>Filler words</span>
                </div>
                <Tag color={fillerColor}>{fillerLabel}</Tag>
              </div>
              {fillerWords?.breakdown?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {fillerWords.breakdown.map(({ word, count }) => (
                    <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 99, background: count >= 3 ? C.danTint : C.warnTint, border: `1px solid ${count >= 3 ? 'rgba(220,38,38,.28)' : 'rgba(217,119,6,.28)'}`, fontSize: 12, fontWeight: 700, fontFamily: F.mono, color: count >= 3 ? C.danger : C.warn }}>
                      "{word}" <span style={{ opacity: .8 }}>×{count}</span>
                    </span>
                  ))}
                </div>
              )}
              {fillerWords?.total === 0 && <div style={{ fontSize: 12.5, color: C.ok, fontWeight: 700, marginTop: 3, fontFamily: F.body }}>✨ Clean delivery — no filler words detected.</div>}
            </div>

            {/* Answer length (real data, replaces the old fixed 79% bar) */}
            {answerLength && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>📏</span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, color: C.textMuted }}>Length · {answerLength.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 800, color: lenColor(answerLength.rating) }}>{answerLength.wordCount} words</span>
                    <Tag color={lenColor(answerLength.rating)}>{lenLabel(answerLength.rating)}</Tag>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: C.b50, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: `${Math.round((answerLength.min / 350) * 100)}%`, width: `${Math.round(((answerLength.max - answerLength.min) / 350) * 100)}%`, height: '100%', background: `${C.ok}30` }} />
                  <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, Math.round((answerLength.wordCount / 350) * 100))}%`, background: lenColor(answerLength.rating), position: 'relative', zIndex: 1, animation: 'mmBar .9s cubic-bezier(.16,1,.3,1) .5s both' }} />
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 5, fontFamily: F.body }}>Target {answerLength.min}–{answerLength.max} words · {answerLength.hint}</div>
              </div>
            )}

            {tone && (
              <div style={{ borderRadius: 12, border: `1px solid ${toneColorFn(tone.label)}30`, overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', background: `${toneColorFn(tone.label)}10`, borderBottom: `1px solid ${toneColorFn(tone.label)}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 14 }}>🎭</span><span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, color: C.textMuted }}>Tone</span></div>
                  <Tag color={toneColorFn(tone.label)}>{tone.label}</Tag>
                </div>
                <div style={{ padding: '11px 14px', background: C.surfaceAlt, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Bar pct={tone.score} color={toneColorFn(tone.label)} height={6} />
                  {(tone.formalPct != null || tone.casualPct != null) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {tone.formalPct != null && <Tag color={C.c500}>Formal {tone.formalPct}%</Tag>}
                      {tone.casualPct != null && <Tag color={C.warn}>Casual {tone.casualPct}%</Tag>}
                    </div>
                  )}
                  {tone.note && <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.55, fontFamily: F.body }}>{tone.note}</div>}
                </div>
              </div>
            )}

            {vocab && (
              <div style={{ borderRadius: 12, border: `1px solid ${vocabColor(vocab.label)}30`, overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', background: `${vocabColor(vocab.label)}10`, borderBottom: `1px solid ${vocabColor(vocab.label)}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 14 }}>📖</span><span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, color: C.textMuted }}>Vocabulary</span></div>
                  <Tag color={vocabColor(vocab.label)}>{vocab.label}</Tag>
                </div>
                <div style={{ padding: '11px 14px', background: C.surfaceAlt, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Bar pct={vocab.score} color={vocabColor(vocab.label)} height={6} />
                  {vocab.uniqueRatio != null && <Tag color={vocabColor(vocab.label)}>{Math.round(vocab.uniqueRatio * 100)}% unique words</Tag>}
                  {vocab.note && <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.55, fontFamily: F.body }}>{vocab.note}</div>}
                </div>
              </div>
            )}

            {hesitation && (
              <div style={{ borderRadius: 12, border: `1px solid ${hesColor(hesitation.pattern)}30`, overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', background: `${hesColor(hesitation.pattern)}10`, borderBottom: `1px solid ${hesColor(hesitation.pattern)}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 14 }}>🌊</span><span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, color: C.textMuted }}>Fluency pattern</span></div>
                  <Tag color={hesColor(hesitation.pattern)}>{hesitation.pattern}</Tag>
                </div>
                <div style={{ padding: '11px 14px', background: C.surfaceAlt, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ height: 6, borderRadius: 99, background: C.b50, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,${C.danger}25 0% 30%,${C.warn}25 30% 60%,${C.ok}25 60% 100%)` }} />
                    <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, hesitation.score)}%`, background: hesColor(hesitation.pattern), position: 'relative', zIndex: 1, animation: 'mmBar .9s cubic-bezier(.16,1,.3,1) .4s both' }} />
                  </div>
                  {hesitation.where && hesitation.where !== 'null' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted }}>Concentration:</span>
                      <Tag color={C.warn}>{hesitation.where.replace('-', ' ')}</Tag>
                    </div>
                  )}
                  {hesitation.note && <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.55, fontFamily: F.body }}>{hesitation.note}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function FollowUpQuestions({ questions }) {
  const list = safeArr(questions);
  if (!list.length) return null;
  return (
    <div>
      <SectionHeader ico="ti ti-messages" em="💬" title="Likely follow-ups" hint="Prepare these" icoColor="teal" />
      <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid rgba(13,148,136,.28)`, background: C.surface }}>
        {list.map((q, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch', borderBottom: i < list.length - 1 ? `1px solid rgba(13,148,136,.12)` : 'none' }}>
            <div style={{ width: 46, flexShrink: 0, background: `linear-gradient(180deg,${C.tealTint},#D5F5F0)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, borderRight: `1px solid rgba(13,148,136,.18)`, fontFamily: F.mono, fontSize: 12, fontWeight: 800, color: C.teal }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>❓</span>
              <span>{i + 1}</span>
            </div>
            <p style={{ margin: 0, padding: '13px 14px', fontFamily: F.body, fontSize: 13.5, fontWeight: 500, lineHeight: 1.65, color: C.text, flex: 1 }}>{q}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEXT BTN — full-width main CTA at bottom
// ═══════════════════════════════════════════════════════════════════════════════
function NextBtn({ onNext, isLoading, isLast }) {
  return (
    <div style={{ marginTop: 6 }}>
      <button
        className="mm-btn"
        type="button"
        onClick={onNext}
        disabled={isLoading}
        style={{
          width: '100%', border: 'none', borderRadius: 16,
          background: isLoading ? C.b200 : BTN_GRAD,
          color: '#fff', fontFamily: F.display, fontSize: 16, fontWeight: 900,
          padding: '15px 18px', cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          letterSpacing: '-.2px', minHeight: 58,
          boxShadow: isLoading ? 'none' : '0 5px 18px rgba(26,110,255,.34),0 10px 36px rgba(0,31,107,.20), inset 0 1px 0 rgba(255,255,255,.22)',
          opacity: isLoading ? 0.6 : 1,
          position: 'relative', overflow: 'hidden',
        }}
      >
        {!isLoading && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,.18) 50%,transparent 65%)', backgroundSize: '300% 100%', animation: 'mmShimmer 3.2s linear infinite', pointerEvents: 'none' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative', zIndex: 1, gap: 3 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {isLoading ? (
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'mmSpin .9s linear infinite', display: 'inline-block' }} />
            ) : (isLast ? '🏁' : '🚀')}
            {isLoading ? (isLast ? 'Preparing report…' : 'Loading…') : (isLast ? 'View my results' : 'Next question')}
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.60)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {isLast ? 'See your full report' : 'Keep the streak alive'}
          </span>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, position: 'relative', zIndex: 1 }}>
          <i className="ti ti-arrow-right" />
        </div>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK BODY
// ═══════════════════════════════════════════════════════════════════════════════
function FeedbackBody({ feedback, question, userAnswer, voiceMetrics, onNext, isLoading, isLast, userAnswerIndex, skipped }) {
  const objective = ['mcq', 'aptitude'].includes(question?.questionType);
  const correct   = feedback?.correct === true;
  const vm        = voiceMetrics || feedback?.voiceMetrics || null;

  if (skipped) {
    const hint   = feedback?.idealHint    || '';
    const sample = feedback?.sampleAnswer || '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${C.border}`, background: C.surfaceAlt, display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⏭️</span>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: C.textMuted, marginBottom: 2 }}>QUESTION SKIPPED</div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.body }}>No XP this round — here's what a strong answer looks like.</div>
          </div>
        </div>
        {objective
          ? <McqExplanation question={question} correct={false} userAnswerIndex={null} skipped />
          : (
            <>
              {hint && (
                <div style={{ padding: '14px 16px', borderRadius: 14, borderLeft: `4px solid ${C.b500}`, background: C.b50, border: `1px solid ${C.borderMd}` }}>
                  <SecLabel color={C.b600}>🎯 What this question tests</SecLabel>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: C.b900, lineHeight: 1.5 }}>{hint}</div>
                </div>
              )}
              <ModelAnswer sampleAnswer={sample} />
            </>
          )
        }
        <NextBtn onNext={onNext} isLoading={isLoading} isLast={isLast} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <QuestionAnswerBlock question={question} userAnswer={userAnswer} />

      {objective ? (
        <McqExplanation question={question} correct={correct} userAnswerIndex={userAnswerIndex} />
      ) : (
        <>
          <div>
            <SectionHeader ico="ti ti-message-report" em="📋" title="Content evaluation" hint="AI scored" icoColor="blue" />
            <EvalGrid good={feedback?.good} missing={feedback?.missing} />
          </div>

          <div>
            <SectionHeader ico="ti ti-trophy" em="🏆" title="Model answer" hint="Top-tier structure" icoColor="navy" />
            <ModelAnswer sampleAnswer={feedback?.sampleAnswer} />
          </div>

          <div>
            <SectionHeader ico="ti ti-sparkles" em="✨" title="Coaching" hint="Improve next time" icoColor="green" />
            <CoachingGrid idealHint={feedback?.idealHint} tip={feedback?.tip} />
          </div>

          <WeakPattern weakPattern={feedback?.weakPattern} />
          <KeywordCoverage keywords={feedback?.keywords || feedback?.keywordCoverage} />
          <FrameworkCheck frameworkCheck={feedback?.frameworkCheck} />
          <StarBreakdown starBreakdown={feedback?.starBreakdown} />
          <ConfidenceCard confidenceScore={feedback?.confidenceScore} />
          {feedback?.timeEfficiency && <TimeEfficiency timeEfficiency={feedback.timeEfficiency} />}
          {vm && <VoiceEvaluationPanel voiceMetrics={vm} feedback={feedback} />}
          <FollowUpQuestions questions={feedback?.followUpQuestions} />
        </>
      )}

      <NextBtn onNext={onNext} isLoading={isLoading} isLast={isLast} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACKPANEL
// ═══════════════════════════════════════════════════════════════════════════════
function FeedbackPanel({
  question, feedback, onNext, isLoading, isLast,
  userAnswerIndex, skipped, questionIndex, totalQuestions, voiceMetrics,
  userAnswer,
}) {
  const score     = Number(feedback?.score) || 0;
  const objective = ['mcq', 'aptitude'].includes(question?.questionType);
  const correct   = feedback?.correct === true;
  const [mounted, setMounted] = useState(false);
  const vm        = voiceMetrics || feedback?.voiceMetrics || null;

  useEffect(() => {
    setMounted(false);
    const id = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(id);
  }, [feedback]);

  return (
    <div style={{ fontFamily: F.body, borderRadius: 22, overflow: 'hidden', boxShadow: SH_MD, background: C.surface, border: `1px solid ${C.border}` }}>
      <style>{GLOBAL_CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.okGlow, border: '1px solid rgba(5,150,105,.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.ok, animation: 'mmPulse 2.4s ease-in-out infinite' }} />
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: C.textSub, letterSpacing: '1px', textTransform: 'uppercase' }}>Answer evaluated</span>
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.b600, background: C.b50, border: `1px solid ${C.b100}`, padding: '4px 12px', borderRadius: 99, letterSpacing: '.5px', textTransform: 'uppercase' }}>MockMate AI</span>
      </div>

      {objective ? (
        <McqHero
          correct={correct}
          skipped={skipped}
          question={question}
          feedback={feedback}
          userAnswerIndex={userAnswerIndex}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          onNext={onNext}
          isLoading={isLoading}
          isLast={isLast}
        />
      ) : (
        <FeedbackHero
          score={score}
          mounted={mounted}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          timeTaken={feedback?.timeTaken}
          complexityRating={feedback?.complexityRating}
          feedback={feedback}
          skipped={skipped}
          onNext={onNext}
          isLoading={isLoading}
          isLast={isLast}
        />
      )}

      <div style={{ padding: 14, background: C.bg, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <FeedbackBody
          feedback={feedback}
          question={question}
          userAnswer={userAnswer}
          voiceMetrics={vm}
          onNext={onNext}
          isLoading={isLoading}
          isLast={isLast}
          userAnswerIndex={userAnswerIndex}
          skipped={skipped}
        />
      </div>
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
  questionIndex:   PropTypes.number,
  totalQuestions:  PropTypes.number,
  voiceMetrics:    PropTypes.object,
  userAnswer:      PropTypes.string,
};
FeedbackPanel.defaultProps = {
  feedback: null, userAnswerIndex: null, skipped: false,
  questionIndex: 0, totalQuestions: 1, voiceMetrics: null,
  userAnswer: '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACKCARD
// ═══════════════════════════════════════════════════════════════════════════════
function FeedbackCard({ feedback, onNext, onRetry, isLast, isRetrying, voiceMetrics, question, userAnswer, userAnswerIndex }) {
  const aiAvailable = feedback?.aiAvailable !== false;
  const score       = typeof feedback?.score === 'number' ? feedback.score : 0;
  const objective   = ['mcq', 'aptitude'].includes(question?.questionType);
  const correct     = feedback?.correct === true;
  const [mounted, setMounted] = useState(false);
  const vm          = voiceMetrics || feedback?.voiceMetrics || null;

  useEffect(() => {
    setMounted(false);
    const id = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(id);
  }, [feedback]);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 22, overflow: 'hidden', boxShadow: SH_MD, fontFamily: F.body }}>
      <style>{GLOBAL_CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: aiAvailable ? C.okGlow : 'rgba(217,119,6,.18)', border: `1px solid ${aiAvailable ? 'rgba(5,150,105,.32)' : 'rgba(217,119,6,.32)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: aiAvailable ? C.ok : C.warn, animation: 'mmPulse 2.4s ease-in-out infinite' }} />
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: C.textSub, letterSpacing: '1px', textTransform: 'uppercase' }}>
            {aiAvailable ? 'Answer evaluated' : 'Evaluation pending'}
          </span>
          {vm && <Tag color={C.violet}>🎤 Voice</Tag>}
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.b600, background: C.b50, border: `1px solid ${C.b100}`, padding: '4px 12px', borderRadius: 99, letterSpacing: '.5px', textTransform: 'uppercase' }}>MockMate AI</span>
      </div>

      {objective ? (
        <McqHero
          correct={correct}
          skipped={false}
          question={question}
          feedback={feedback}
          userAnswerIndex={userAnswerIndex}
          questionIndex={feedback?.questionIndex}
          totalQuestions={feedback?.totalQuestions}
          onNext={onNext}
          isLoading={false}
          isLast={isLast}
        />
      ) : (
        <FeedbackHero
          score={score}
          mounted={mounted}
          questionIndex={feedback?.questionIndex}
          totalQuestions={feedback?.totalQuestions}
          timeTaken={feedback?.timeTaken}
          complexityRating={feedback?.complexityRating}
          feedback={feedback}
          skipped={false}
          onNext={onNext}
          isLoading={false}
          isLast={isLast}
        />
      )}

      <div style={{ padding: 14, background: C.bg }}>
        {aiAvailable ? (
          <FeedbackBody
            feedback={feedback}
            question={question || { questionText: '' }}
            userAnswer={userAnswer}
            voiceMetrics={vm}
            onNext={onNext}
            isLoading={false}
            isLast={isLast}
            userAnswerIndex={userAnswerIndex}
            skipped={false}
          />
        ) : (
          <>
            <div style={{ padding: '16px', borderRadius: 14, marginBottom: 14, border: `1px solid rgba(217,119,6,.28)`, borderLeft: `4px solid ${C.warn}`, background: C.warnTint }}>
              <SecLabel color={C.warn}>⚠️ AI evaluation unavailable</SecLabel>
              <p style={{ margin: '0 0 12px', fontSize: 13.5, color: C.textSub, lineHeight: 1.65, fontFamily: F.body }}>
                Your answer was saved. Feedback will appear once the evaluator is back online.
              </p>
              <button
                type="button"
                onClick={onRetry}
                disabled={!onRetry || isRetrying}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: C.warn, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontFamily: F.body, fontSize: 14, fontWeight: 700, cursor: (!onRetry || isRetrying) ? 'not-allowed' : 'pointer', opacity: (!onRetry || isRetrying) ? 0.55 : 1 }}
              >
                {isRetrying ? (
                  <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', animation: 'mmSpin .9s linear infinite', display: 'inline-block' }} />Retrying…</>
                ) : '🔄 Retry evaluation'}
              </button>
            </div>
            <NextBtn onNext={onNext} isLoading={false} isLast={isLast} />
          </>
        )}
      </div>
    </div>
  );
}

FeedbackCard.propTypes = {
  feedback:        PropTypes.object,
  onNext:          PropTypes.func.isRequired,
  onRetry:         PropTypes.func,
  isLast:          PropTypes.bool,
  isRetrying:      PropTypes.bool,
  voiceMetrics:    PropTypes.object,
  question:        PropTypes.object,
  userAnswer:      PropTypes.string,
  userAnswerIndex: PropTypes.number,
};
FeedbackCard.defaultProps = {
  feedback: null, onRetry: null, isLast: false,
  isRetrying: false, voiceMetrics: null,
  question: null, userAnswer: '', userAnswerIndex: null,
};

export { FeedbackPanel, FeedbackCard };
export default FeedbackCard;
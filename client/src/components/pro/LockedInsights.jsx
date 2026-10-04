import PropTypes from 'prop-types';
import { useId } from 'react';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProIcon from './ProIcon';

/**
 * LockedInsights — what a free user sees where the Pro parts of an evaluation would be.
 *
 * Honest by design: the server never sends the locked content (see
 * server/utils/feedbackTier.js), so nothing here is a blurred copy of the
 * user's real answer. What's real is: which sections exist, their real
 * visual shape (a ring, a bar, a pill row), and the live count.
 *
 * The teaser pattern: each row shows its true chrome (icon, title, one
 * plain-English line of what it tells you) in full clarity — that's the
 * "first line visible" hook — then the content itself sits under a frosted
 * blur with a lock. The shapes underneath are real (a confidence dial, a
 * STAR grid, a keyword pill row) so a free user can see exactly how much
 * detail is on the other side, not just a generic "upgrade" card.
 *
 *   variant="panel"   → full teaser stack, used in the live feedback panel
 *   variant="compact" → one slim row, used inside Result/History lists
 */

const ROWS = [
  {
    key: 'analysis',
    icon: 'radar',
    title: 'Keywords & confidence',
    line: 'See exactly which terms an interviewer listens for — and which ones you missed.',
    shape: 'keywords',
  },
  {
    key: 'analysis',
    icon: 'target',
    title: 'STAR structure score',
    line: 'Situation, Task, Action and Result, scored separately.',
    shape: 'star',
  },
  {
    key: 'coaching',
    icon: 'bulb',
    title: 'Fix this first',
    line: 'The one change that would have raised your score the most.',
    shape: 'lines',
  },
  {
    key: 'modelAnswer',
    icon: 'trophy',
    title: 'Model answer',
    line: 'A top-scoring answer to this exact question, point by point.',
    shape: 'lines',
  },
  {
    key: 'delivery',
    icon: 'mic',
    title: 'Delivery analysis',
    line: 'Pace, filler words, pauses, tone and hesitation from how you spoke.',
    shape: 'delivery',
  },
];

const VOICE_LINE = 'Your pace, filler words and pauses are already measured — unlock to see them.';

// ── Tiny inline glyphs (kept local — this file owns its own lock/bolt art) ──
const LockGlyph = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
LockGlyph.propTypes = { size: PropTypes.number };

const Bolt = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);
Bolt.propTypes = { size: PropTypes.number };

// ── Placeholder content shapes — real geometry, fake numbers, always blurred ──
// These exist so the blur has something with real visual weight under it:
// a flat grey card reads as "nothing here"; a blurred ring/bars/pills reads
// as "there is a whole feature here".
function GhostRing({ size = 56 }) {
  const r = (size - 7) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.brand100} strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.brand400} strokeWidth={7} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * 0.28} />
    </svg>
  );
}
GhostRing.propTypes = { size: PropTypes.number };

const GhostBar = ({ pct, color = C.brand400 }) => (
  <div style={{ height: 6, borderRadius: 99, background: C.brand50, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color }} />
  </div>
);
GhostBar.propTypes = { pct: PropTypes.number.isRequired, color: PropTypes.string };

const GhostPill = ({ w, tone = 'brand' }) => {
  const bg = tone === 'red' ? C.dangerTint : C.brand50;
  const border = tone === 'red' ? '#F1C4C9' : C.brand100;
  return <span style={{ display: 'inline-block', height: 20, width: w, borderRadius: 99, background: bg, border: `1px solid ${border}` }} />;
};
GhostPill.propTypes = { w: PropTypes.number.isRequired, tone: PropTypes.string };

function TeaserShape({ shape }) {
  if (shape === 'keywords') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <GhostRing size={52} />
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <GhostPill w={58} /><GhostPill w={74} tone="red" /><GhostPill w={46} /><GhostPill w={64} tone="red" /><GhostPill w={40} />
        </div>
      </div>
    );
  }
  if (shape === 'star') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {['S', 'T', 'A', 'R'].map((l) => (
          <div key={l} style={{ padding: '9px 11px', borderRadius: 10, background: C.brand50, border: `1px solid ${C.brand100}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: F.display, fontSize: 11, fontWeight: 800, color: C.brand700 }}>{l}</span>
              <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.brand500 }}>••</span>
            </div>
            <GhostBar pct={[72, 58, 84, 40][['S', 'T', 'A', 'R'].indexOf(l)]} />
          </div>
        ))}
      </div>
    );
  }
  if (shape === 'delivery') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[62, 88, 45].map((pct, i) => (
          <div key={i} style={{ padding: '10px 10px 9px', borderRadius: 10, background: C.brand50, border: `1px solid ${C.brand100}`, textAlign: 'center' }}>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.brand600, marginBottom: 6 }}>••</div>
            <GhostBar pct={pct} />
          </div>
        ))}
      </div>
    );
  }
  // 'lines' — paragraph-shaped placeholder for model answer / coaching tip
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <GhostBar pct={100} /><GhostBar pct={92} /><GhostBar pct={64} />
    </div>
  );
}
TeaserShape.propTypes = { shape: PropTypes.string.isRequired };

// ═══════════════════════════════════════════════════════════════════════════
// COMPACT — one slim row (Result / History list)
// ═══════════════════════════════════════════════════════════════════════════
function CompactLocked({ locked, usedVoice, cta, count }) {
  const headline = usedVoice && locked.delivery
    ? 'Your voice delivery report is ready'
    : `${count} more insight${count > 1 ? 's' : ''} on this answer`;
  return (
    <button
      type="button"
      onClick={cta}
      aria-label={`${headline}. Open upgrade options.`}
      style={{
        fontFamily: F.body, width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
        padding: '11px 13px', borderRadius: 11, cursor: 'pointer', position: 'relative', overflow: 'hidden',
        border: `1px solid ${C.brand100}`, background: `linear-gradient(120deg, ${C.brand50} 0%, #fff 70%)`,
      }}
      className="li-compact"
    >
      <span style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', boxShadow: `0 3px 10px ${C.brand500}40`,
      }}>
        <LockGlyph size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.text }}>{headline}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: C.textSub, marginTop: 1 }}>Tap to unlock with Pro</span>
      </span>
      <span style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 9px', borderRadius: 99,
        background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff',
        fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em',
      }}>
        <Bolt size={10} />PRO
      </span>
    </button>
  );
}
CompactLocked.propTypes = { locked: PropTypes.object.isRequired, usedVoice: PropTypes.bool, cta: PropTypes.func.isRequired, count: PropTypes.number.isRequired };

// ═══════════════════════════════════════════════════════════════════════════
// PANEL — the full teaser stack
// ═══════════════════════════════════════════════════════════════════════════
function TeaserRow({ row, hot, index }) {
  const gradId = useId();
  return (
    <li
      style={{
        listStyle: 'none', padding: '16px 18px', borderTop: index === 0 ? 'none' : `1px solid ${C.border}`,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* chrome: icon + title + ONE real, un-blurred line — this is the hook */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hot ? `linear-gradient(135deg, ${C.brand500}, ${C.brand700})` : C.brand50,
          color: hot ? '#fff' : C.brand600, border: hot ? 'none' : `1px solid ${C.brand100}`,
          boxShadow: hot ? `0 4px 12px ${C.brand500}40` : 'none',
        }}>
          <ProIcon name={row.icon} size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text }}>
            {row.title}
            <span style={{ color: C.textFaint, display: 'inline-flex' }}><LockGlyph size={11} /></span>
          </div>
          <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.55, marginTop: 3 }}>
            {hot ? VOICE_LINE : row.line}
          </div>
        </div>
      </div>

      {/* the locked content itself: real shape, hard blur, glass pane on top */}
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ filter: 'blur(5px)', opacity: 0.85, pointerEvents: 'none', userSelect: 'none', padding: '2px' }}>
          <TeaserShape shape={row.shape} />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.72) 55%, rgba(255,255,255,0.88) 100%)',
            backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99,
            background: '#fff', border: `1px solid ${C.brand100}`, boxShadow: '0 2px 8px rgba(26,110,255,.14)',
            fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '.07em', color: C.brand600,
          }}>
            <LockGlyph size={11} />LOCKED
          </span>
        </div>
      </div>
      <svg width="0" height="0" style={{ position: 'absolute' }}><defs><linearGradient id={gradId} /></defs></svg>
    </li>
  );
}
TeaserRow.propTypes = { row: PropTypes.object.isRequired, hot: PropTypes.bool, index: PropTypes.number.isRequired };

function PanelLocked({ rows, voiceHot, cta, count }) {
  return (
    <section
      aria-label="Pro insights for this answer"
      style={{
        fontFamily: F.body, borderRadius: 18, overflow: 'hidden', position: 'relative',
        border: `1px solid ${C.brand200}`, background: C.surface,
        boxShadow: '0 4px 24px rgba(26,110,255,.08), 0 1px 2px rgba(15,23,42,.04)',
      }}
    >
      {/* header — mirrors the feedback hero's blue gradient so this reads as one family, not a bolted-on upsell */}
      <header style={{
        position: 'relative', overflow: 'hidden', padding: '18px 18px 16px',
        background: `linear-gradient(135deg, ${C.brand900} 0%, ${C.brand700} 48%, ${C.brand600} 78%, ${C.accent600} 100%)`,
      }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -80, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)',
          }}>
            <LockGlyph size={19} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: 'rgba(255,255,255,.72)', marginBottom: 3 }}>
              {count} MORE INSIGHT{count > 1 ? 'S' : ''} ON THIS ANSWER
            </div>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
              {voiceHot ? 'Your voice report is ready' : 'See exactly how to score higher'}
            </div>
          </div>
          <span style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 25, padding: '0 11px', borderRadius: 99,
            background: '#fff', color: C.brand700, fontFamily: F.mono, fontSize: 11, fontWeight: 800, letterSpacing: '.08em',
            boxShadow: '0 2px 8px rgba(0,0,0,.14)',
          }}>
            <Bolt size={11} />PRO
          </span>
        </div>
      </header>

      <ul style={{ margin: 0, padding: 0 }}>
        {rows.map((row, i) => (
          <TeaserRow key={`${row.key}-${row.shape}`} row={row} hot={voiceHot && row.key === 'delivery'} index={i} />
        ))}
      </ul>

      <div style={{ padding: '6px 18px 18px' }}>
        <button
          type="button"
          onClick={cta}
          className="li-cta"
          style={{
            width: '100%', height: 48, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff',
            fontFamily: F.display, fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.1px',
            boxShadow: '0 8px 22px rgba(26,110,255,.32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {voiceHot ? 'Unlock my voice report' : 'Unlock with Pro'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
        <div style={{ textAlign: 'center', marginTop: 9, fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>
          Your answer is saved. Everything above appears the moment you upgrade — including every past session.
        </div>
      </div>
    </section>
  );
}
PanelLocked.propTypes = { rows: PropTypes.array.isRequired, voiceHot: PropTypes.bool, cta: PropTypes.func.isRequired, count: PropTypes.number.isRequired };

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default function LockedInsights({ locked, usedVoice = false, variant = 'panel' }) {
  const { openUpgrade } = useUpgrade();
  if (!locked) return null;

  const activeKeys = ['modelAnswer', 'coaching', 'delivery', 'analysis'].filter((k) => locked[k]);
  if (activeKeys.length === 0) return null;

  const voiceHot = usedVoice && locked.delivery;
  const feature = voiceHot ? 'voiceEvaluation' : 'detailedFeedback';
  const cta = () => openUpgrade(feature);
  // Real count from the server (locked.count), falling back to the key tally.
  const count = typeof locked.count === 'number' ? locked.count : activeKeys.length;

  if (variant === 'compact') {
    return <CompactLocked locked={locked} usedVoice={usedVoice} cta={cta} count={count} />;
  }

  const rows = ROWS.filter((r) => locked[r.key]);
  return (
    <>
      <style>{`
        .li-cta:hover { filter:brightness(1.07); transform:translateY(-1px); box-shadow:0 12px 28px rgba(26,110,255,.4) !important; }
        .li-cta:active { transform:scale(.99); }
        .li-compact:hover { border-color:${C.brand200} !important; box-shadow:0 2px 10px rgba(26,110,255,.12); }
        .li-cta, .li-compact { transition:transform .14s ease, box-shadow .14s ease, filter .14s ease, border-color .14s ease; }
      `}</style>
      <PanelLocked rows={rows} voiceHot={voiceHot} cta={cta} count={count} />
    </>
  );
}

LockedInsights.propTypes = {
  locked:    PropTypes.shape({ modelAnswer: PropTypes.bool, coaching: PropTypes.bool, delivery: PropTypes.bool, analysis: PropTypes.bool, count: PropTypes.number }),
  usedVoice: PropTypes.bool,
  variant:   PropTypes.oneOf(['panel', 'compact']),
};
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from './ProBadge';
import ProIcon from './ProIcon';

/**
 * LockedInsights — what a free user sees where the Pro parts of an evaluation would be.
 *
 * Honest by design: the server never sends the locked content, so these rows show
 * generic placeholder bars, never a blurred copy of the real answer. What IS real
 * and personal is the count ("4 insights on this answer") and which sections exist.
 *
 *   variant="panel"   → full card in the interview room (feedback panel)
 *   variant="compact" → one slim row inside a Result-page question card
 */

const ROWS = {
  modelAnswer: { icon: 'trophy',        title: 'Model answer',       desc: 'A top-scoring answer to this exact question' },
  coaching:    { icon: 'bulb',          title: 'Coaching',           desc: 'The key idea you missed and what to say next time' },
  delivery:    { icon: 'mic',  title: 'Delivery analysis',  desc: 'Tone, hesitation and vocabulary in how you answered' },
  analysis:    { icon: 'radar',   title: 'Deep analysis',      desc: 'Keywords, structure, confidence and follow-up questions' },
};
const VOICE_ROW = { icon: 'mic', title: 'Your voice delivery report', desc: 'Pace, filler words and pauses from your spoken answer' };

const LockGlyph = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
LockGlyph.propTypes = { size: PropTypes.number };

const Skeleton = ({ w }) => (
  <span aria-hidden="true" style={{ display: 'block', height: 7, width: w, borderRadius: 99, background: `linear-gradient(90deg, ${C.border}, ${C.surfaceAlt}, ${C.border})` }} />
);
Skeleton.propTypes = { w: PropTypes.string.isRequired };

export default function LockedInsights({ locked, usedVoice = false, variant = 'panel' }) {
  const { openUpgrade } = useUpgrade();
  if (!locked) return null;

  const keys = ['modelAnswer', 'coaching', 'delivery', 'analysis'].filter((k) => locked[k]);
  // A voice answer's delivery row becomes the headline: it's the thing they just did.
  const voiceHot = usedVoice && locked.delivery;
  const feature = voiceHot ? 'voiceEvaluation' : 'detailedFeedback';
  if (keys.length === 0) return null;

  const count = keys.length;
  const cta = () => openUpgrade(feature);

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={cta}
        aria-label={`${count} Pro insights locked on this answer. Open upgrade options.`}
        style={{
          fontFamily: F.body, width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
          padding: '11px 13px', borderRadius: 11, cursor: 'pointer',
          border: `1px dashed ${C.brand100}`, background: `linear-gradient(135deg, ${C.brand50}, #fff)`,
        }}
      >
        <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.brand500, color: '#fff' }}>
          <LockGlyph size={13} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.text }}>
            {count} more insight{count > 1 ? 's' : ''} on this answer
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: C.textSub, marginTop: 1 }}>
            {keys.map((k) => (k === 'delivery' && usedVoice ? 'Voice report' : ROWS[k].title)).join(' · ')}
          </span>
        </span>
        <ProBadge variant="pro" />
      </button>
    );
  }

  return (
    <section
      aria-label="Pro insights for this answer"
      style={{ fontFamily: F.body, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.brand100}`, background: C.surface, boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', background: `linear-gradient(135deg, ${C.brand50}, #fff)`, borderBottom: `1px solid ${C.brand100}` }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: C.brand600, marginBottom: 2 }}>
            {count} MORE INSIGHT{count > 1 ? 'S' : ''} ON THIS ANSWER
          </div>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text }}>
            {voiceHot ? 'Your voice report is ready' : 'See exactly how to score higher'}
          </div>
        </div>
        <ProBadge variant="pro" size="md" />
      </header>

      <ul style={{ listStyle: 'none', margin: 0, padding: '6px 16px' }}>
        {keys.map((k, i) => {
          const row = k === 'delivery' && usedVoice ? VOICE_ROW : ROWS[k];
          const hot = k === 'delivery' && usedVoice;
          return (
            <li key={k} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: hot ? C.brand500 : C.brand50, color: hot ? '#fff' : C.brand600, border: `1px solid ${hot ? 'transparent' : C.brand100}` }}>
                <ProIcon name={row.icon} size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.display, fontSize: 13.5, fontWeight: 700, color: C.text }}>
                  {row.title}
                  <span style={{ color: C.textMuted, display: 'inline-flex' }}><LockGlyph size={11} /></span>
                </div>
                <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.45, marginTop: 2 }}>{row.desc}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 9 }}>
                  <Skeleton w="92%" /><Skeleton w="64%" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ padding: '4px 16px 16px' }}>
        <button
          type="button"
          onClick={cta}
          style={{
            width: '100%', height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff',
            fontFamily: F.display, fontSize: 14, fontWeight: 700, boxShadow: '0 6px 18px rgba(26,110,255,.26)',
          }}
        >
          {voiceHot ? 'Unlock my voice report' : 'Unlock with Pro'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11.5, color: C.textMuted }}>
          Your answer is saved. Everything here appears the moment you upgrade, including past sessions.
        </div>
      </div>
    </section>
  );
}

LockedInsights.propTypes = {
  locked:    PropTypes.shape({ modelAnswer: PropTypes.bool, coaching: PropTypes.bool, delivery: PropTypes.bool, analysis: PropTypes.bool }),
  usedVoice: PropTypes.bool,
  variant:   PropTypes.oneOf(['panel', 'compact']),
};

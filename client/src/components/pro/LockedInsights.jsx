import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from './ProBadge';
import ProTease from './ProTease';
import { SAMPLE_INSIGHTS } from './previewData';

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

export default function LockedInsights({ locked, usedVoice = false, variant = 'panel', teasers = null }) {
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

  if (variant === 'preview') {
    // One slim blurred card for list views (Result page): real first line, blurred rest, one CTA.
    const lead = teasers?.modelAnswer || teasers?.coaching || SAMPLE_INSIGHTS[keys[0] === 'delivery' && usedVoice ? 'voice' : keys[0]].lead;
    return (
      <div style={{ marginTop: 10 }}>
        <ProTease
          feature={feature}
          eyebrow={`${count} more insight${count > 1 ? 's' : ''} on this answer`}
          title={keys.map((k) => (k === 'delivery' && usedVoice ? 'Voice report' : ROWS[k].title)).join(' · ')}
          lead={lead}
          tag={teasers?.modelAnswer || teasers?.coaching ? 'YOUR ANSWER' : 'EXAMPLE'}
          cta={count > 1 ? `Unlock all ${count} insights` : 'Unlock this insight'}
          blurHeight={86}
          blurPx={3}
          showBadge
        >
          {keys.flatMap((k) => SAMPLE_INSIGHTS[k === 'delivery' && usedVoice ? 'voice' : k].rest.slice(0, 1)).map((line) => (
            <p key={line} style={{ margin: '0 0 6px' }}>{line}</p>
          ))}
        </ProTease>
      </div>
    );
  }

  return (
    <section aria-label="Pro insights for this answer" style={{ fontFamily: F.body, display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '2px 4px' }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: C.brand600, marginBottom: 2 }}>
            {count} MORE INSIGHT{count > 1 ? 'S' : ''} ON THIS ANSWER
          </div>
          <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.text }}>
            {voiceHot ? 'Your voice report is ready' : 'See exactly how to score higher'}
          </div>
        </div>
        <ProBadge variant="pro" size="md" />
      </header>

      {keys.map((k) => {
        const s = k === 'delivery' && usedVoice ? SAMPLE_INSIGHTS.voice : SAMPLE_INSIGHTS[k];
        const row = k === 'delivery' && usedVoice ? VOICE_ROW : ROWS[k];
        return (
          <ProTease
            key={k}
            feature={k === 'delivery' && usedVoice ? 'voiceEvaluation' : 'detailedFeedback'}
            eyebrow={row.desc}
            title={s.title}
            lead={teasers?.[k] || s.lead}
            tag={teasers?.[k] ? 'YOUR ANSWER' : 'EXAMPLE'}
            cta={k === 'delivery' && usedVoice ? 'Unlock my voice report' : `Unlock ${s.title.toLowerCase()}`}
            blurHeight={118}
            showBadge={false}
          >
            {s.rest.map((line) => <p key={line} style={{ margin: '0 0 6px' }}>{line}</p>)}
          </ProTease>
        );
      })}

      <div style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, padding: '0 8px' }}>
        The blurred text is an example. Your answer is saved, and your own version appears the moment you upgrade, including past sessions.
      </div>
    </section>
  );
}

LockedInsights.propTypes = {
  locked:    PropTypes.shape({ modelAnswer: PropTypes.bool, coaching: PropTypes.bool, delivery: PropTypes.bool, analysis: PropTypes.bool }),
  usedVoice: PropTypes.bool,
  variant:   PropTypes.oneOf(['panel', 'compact', 'preview']),
  teasers:   PropTypes.shape({ modelAnswer: PropTypes.string, coaching: PropTypes.string }),
};

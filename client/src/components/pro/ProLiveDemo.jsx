/**
 * ProLiveDemo: shows the REAL Pro page to a free user, fully visible and interactive.
 *
 * Nothing on the page is blurred. Charts hover, toggles switch, panels open, every card
 * is exactly what a paying user sees, filled with clearly-labelled example data. The only
 * locked thing is the RESPONSE of a button that would spend AI quota: that response is an
 * example, blurred after its first lines (see ProResponseLock), right where the button was
 * pressed. No server call is ever made from inside the demo.
 *
 * A slim bar stays at the top while the reader scrolls so it is always obvious this is
 * example data, with one unlock action.
 */
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from './ProBadge';
import Icon from '../interview/icons';
import { PreviewContext } from './PreviewContext';

export default function ProLiveDemo({ feature, name, cta, hint, showBar = true, children }) {
  const { openUpgrade } = useUpgrade();
  return (
    <section aria-label={`${name}: live demo with example data`}>
      <style>{`
        .pld-bar { position: sticky; top: 72px; z-index: 40; }
        .pld-cta { transition: transform .15s ease, filter .15s ease; }
        .pld-cta:hover { filter: brightness(1.07); transform: translateY(-1px); }
        .pld-cta:active { transform: scale(.985); }
        .pld-cta:focus-visible { outline: 2.5px solid ${C.brand500}; outline-offset: 3px; }
        .pld-dot { animation: pldPulse 2s ease-in-out infinite; }
        @keyframes pldPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        /* the Pro page brings its own page padding and background; inside the demo it sits flush */
        .pld-body > div { min-height: 0 !important; padding: 18px 0 8px !important; background: transparent !important; background-image: none !important; }
        @media (max-width: 640px) { .pld-bar { top: 64px; } .pld-hint { display: none; } }
        @media (prefers-reduced-motion: reduce) { .pld-dot, .pld-cta { animation: none !important; transition: none !important; } }
      `}</style>

      {showBar && (
      <div className="pld-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 10px 9px 16px', borderRadius: 16,
        background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${C.brand100}`, boxShadow: '0 10px 28px rgba(15,35,95,.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="pld-dot" aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: C.brand500, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: F.display, fontSize: 13.5, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>
              Live demo · example data <ProBadge variant="pro" />
            </div>
            <div className="pld-hint" style={{ fontSize: 12, color: C.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</div>
          </div>
        </div>
        <button type="button" className="pld-cta" onClick={() => openUpgrade(feature)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 16px', border: 'none', borderRadius: 11, cursor: 'pointer', flexShrink: 0,
            background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 13.5, fontWeight: 800, boxShadow: '0 6px 16px rgba(26,110,255,.30)' }}>
          <Icon name="bolt" size={14} stroke={2.4} /><span>{cta}</span>
        </button>
      </div>
      )}

      <div className="pld-body">
        <PreviewContext.Provider value>{children}</PreviewContext.Provider>
      </div>
    </section>
  );
}

ProLiveDemo.propTypes = {
  feature: PropTypes.string.isRequired, name: PropTypes.string.isRequired, cta: PropTypes.string.isRequired,
  hint: PropTypes.string, showBar: PropTypes.bool, children: PropTypes.node.isRequired,
};

/**
 * ProPagePreview: shows the REAL Pro page to a free user, locked.
 *
 * The children are the actual Pro page component rendered inside PreviewContext, so the
 * layout, colours, charts and spacing are identical to what a paying user sees. The page
 * is fed example data (components/pro/previewData.js), never the user's own Pro data, and
 * never calls the server.
 *
 * The preview is lightly blurred (structure stays readable, numbers do not), inert (no
 * focus, no clicks, hidden from screen readers) and labelled EXAMPLE. A floating card
 * follows the reader down the page with one clear upgrade button; the whole surface also
 * opens the upgrade dialog.
 */
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from './ProBadge';
import Icon from '../interview/icons';
import { PreviewContext } from './PreviewContext';

export default function ProPagePreview({ feature, name, cta, bullets = [], maxHeight = 1500, blur = 3.5, children }) {
  const { openUpgrade } = useUpgrade();
  const open = () => openUpgrade(feature);

  return (
    <section aria-label={`${name}: Pro preview with example data`} style={{ position: 'relative', borderRadius: 22, border: `1px solid ${C.border}`, background: C.surface, boxShadow: '0 14px 40px rgba(15,35,95,.10)', overflow: 'clip' }}>
      <style>{`
        .pp-cta:hover { filter: brightness(1.07); transform: translateY(-1px); }
        .pp-cta:active { transform: scale(.985); }
        .pp-cta:focus-visible, .pp-surface:focus-visible, .pp-link:focus-visible { outline: 2.5px solid ${C.brand500}; outline-offset: 3px; }
        .pp-link:hover { background: ${C.brand50} !important; }
        @media (max-width: 560px) { .pp-card { flex-direction: column !important; align-items: stretch !important; text-align: center; } .pp-card-copy { text-align: center !important; } }
        @media (prefers-reduced-motion: reduce) { .pp-cta { transition: none !important; } }
      `}</style>

      {/* Top ribbon: says exactly what this is */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '12px 18px', background: `linear-gradient(90deg, ${C.brand50}, #fff)`, borderBottom: `1px solid ${C.brand100}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', flexShrink: 0 }}>
            <Icon name="lock" size={15} stroke={2.4} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text, lineHeight: 1.25 }}>This is the real {name} page</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Example data shown. Yours is built from your own sessions.</div>
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 7px', background: '#fff' }}>EXAMPLE</span>
          <ProBadge variant="pro" />
        </div>
      </div>

      {/* The real page, locked */}
      <div style={{ position: 'relative', maxHeight, overflow: 'clip' }}>
        <div aria-hidden="true" inert style={{ filter: `blur(${blur}px) saturate(.96)`, WebkitFilter: `blur(${blur}px) saturate(.96)`, pointerEvents: 'none', userSelect: 'none', transform: 'translateZ(0)' }}>
          <PreviewContext.Provider value>{children}</PreviewContext.Provider>
        </div>

        {/* whole surface opens the upgrade dialog */}
        <button type="button" className="pp-surface" onClick={open} aria-label={`${cta}. This is a Pro feature. Opens upgrade options.`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'linear-gradient(180deg, rgba(255,255,255,0) 55%, rgba(255,255,255,.55) 80%, #fff 100%)' }} />

        {/* floating card that follows the reader */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'sticky', top: 'calc(100svh - 168px)', padding: '0 14px', display: 'flex', justifyContent: 'center' }}>
            <div className="pp-card" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, width: '100%', padding: '14px 16px 14px 20px', borderRadius: 18, background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${C.brand100}`, boxShadow: '0 18px 44px rgba(15,35,95,.22), 0 2px 6px rgba(15,35,95,.08)' }}>
              <div className="pp-card-copy" style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.2px' }}>Unlock your own {name}</div>
                {bullets.length > 0
                  ? <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginTop: 2 }}>{bullets.join('  ·  ')}</div>
                  : <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>Built from every session you have practised.</div>}
              </div>
              <button type="button" className="pp-cta" onClick={open}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, padding: '0 22px', border: 'none', borderRadius: 13, cursor: 'pointer', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 14.5, fontWeight: 800, boxShadow: '0 8px 20px rgba(26,110,255,.32)', transition: 'transform .15s ease, filter .15s ease', whiteSpace: 'nowrap' }}>
                <Icon name="bolt" size={16} stroke={2.4} />{cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

ProPagePreview.propTypes = {
  feature: PropTypes.string.isRequired, name: PropTypes.string.isRequired, cta: PropTypes.string.isRequired,
  bullets: PropTypes.arrayOf(PropTypes.string), maxHeight: PropTypes.number, blur: PropTypes.number, children: PropTypes.node.isRequired,
};

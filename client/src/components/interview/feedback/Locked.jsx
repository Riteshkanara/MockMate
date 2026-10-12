/**
 * Locked Pro previews that look exactly like the real thing.
 *
 *  LockedBlock   blurred EXAMPLE content + one calm call to action on top.
 *  LockedSection a full section card (same header as the real one) around a LockedBlock.
 *
 * The children are the REAL section components rendered with SAMPLE_FEEDBACK, so the
 * free layout is the Pro layout. The sample is blurred, inert (not focusable, not read
 * by screen readers, not selectable) and labelled EXAMPLE. Real Pro data is never sent
 * to a free user, so nothing personal sits behind the blur.
 */
import PropTypes from 'prop-types';
import { C, F } from '../../../styles/token';
import useUpgrade from '../../../hooks/useUpgrade';
import ProBadge from '../../pro/ProBadge';
import Icon from '../icons';
import { SectionHead, card } from './ui';

export function LockedBlock({ feature, cta, hint, height = 170, blur = 3.5, children }) {
  const { openUpgrade } = useUpgrade();
  return (
    <div className="fb-peek" style={{ position: 'relative', maxHeight: height, minHeight: 84, overflow: 'hidden', borderRadius: 14, border: `1px solid ${C.brand100}`, background: `linear-gradient(180deg, ${C.brand50}, #fff)` }}>
      <div aria-hidden="true" inert style={{ filter: `blur(${blur}px) saturate(1.15)`, WebkitFilter: `blur(${blur}px) saturate(1.15)`, userSelect: 'none', pointerEvents: 'none', transform: 'scale(1.02)', padding: 2 }}>
        {children}
      </div>
      <span aria-hidden="true" className="fb-peek-sheen" />
      <button
        type="button"
        className="fb-lock"
        onClick={() => openUpgrade(feature)}
        aria-label={`${cta}. This is a Pro feature. Opens upgrade options.`}
        style={{ position: 'absolute', inset: 0, width: '100%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 10px 10px', background: `linear-gradient(180deg, rgba(235,242,255,0) 0%, rgba(255,255,255,.72) 42%, rgba(255,255,255,.96) 100%)`, fontFamily: F.body, textAlign: 'left' }}
      >
        <span className="fb-lock-cta" style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', maxWidth: 420, padding: '9px 10px 9px 9px', borderRadius: 16, background: 'rgba(255,255,255,.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${C.brand100}`, boxShadow: '0 12px 28px -12px rgba(26,110,255,.45), inset 0 1px 0 #fff', transition: 'transform .15s ease, box-shadow .15s ease' }}>
          <span className="fb-lock-orb" style={{ position: 'relative', flexShrink: 0, width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700} 70%, ${C.accent600})` }}>
            <Icon name="lock" size={17} stroke={2.4} />
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.1px' }}>{cta}</span>
            <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 600, lineHeight: 1.35 }}>{hint || 'Preview shown with example data'}</span>
          </span>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.brand50, color: C.brand600 }}>
            <Icon name="arrow" size={16} stroke={2.6} />
          </span>
        </span>
      </button>
    </div>
  );
}
LockedBlock.propTypes = { feature: PropTypes.string.isRequired, cta: PropTypes.string.isRequired, hint: PropTypes.string, height: PropTypes.number, blur: PropTypes.number, children: PropTypes.node.isRequired };

export function LockedSection({ id, feature, icon, hue, title, sub, teaser, cta, hint, height, children }) {
  return (
    <section id={id} className="fb-scroll" style={{ ...card, padding: '16px 18px' }}>
      <SectionHead icon={icon} hue={hue} title={title} sub={sub} right={<><span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 6px' }}>EXAMPLE</span><ProBadge variant="pro" /></>} />
      {teaser && (
        <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.65, color: C.text, fontWeight: 600 }}>
          {teaser}
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.brand600, marginTop: 3, fontFamily: F.mono, letterSpacing: '.06em' }}>FIRST LINE OF YOUR OWN ANSWER</span>
        </p>
      )}
      <LockedBlock feature={feature} cta={cta} hint={hint} height={height}>{children}</LockedBlock>
    </section>
  );
}
LockedSection.propTypes = { id: PropTypes.string, feature: PropTypes.string.isRequired, icon: PropTypes.string.isRequired, hue: PropTypes.string.isRequired, title: PropTypes.string.isRequired, sub: PropTypes.string, teaser: PropTypes.string, cta: PropTypes.string.isRequired, hint: PropTypes.string, height: PropTypes.number, children: PropTypes.node.isRequired };

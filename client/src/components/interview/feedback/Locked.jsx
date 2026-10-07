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

export function LockedBlock({ feature, cta, hint, height = 170, blur = 5, children }) {
  const { openUpgrade } = useUpgrade();
  return (
    <div style={{ position: 'relative', maxHeight: height, overflow: 'hidden', borderRadius: 12 }}>
      <div aria-hidden="true" inert style={{ filter: `blur(${blur}px)`, WebkitFilter: `blur(${blur}px)`, userSelect: 'none', pointerEvents: 'none', transform: 'scale(1.01)' }}>
        {children}
      </div>
      <button
        type="button"
        className="fb-lock"
        onClick={() => openUpgrade(feature)}
        aria-label={`${cta}. This is a Pro feature. Opens upgrade options.`}
        style={{ position: 'absolute', inset: 0, width: '100%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 6px', background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.82) 45%, ${C.surface} 92%)`, fontFamily: F.body }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span className="fb-lock-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 20px', borderRadius: 12, background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 13.5, fontWeight: 800, boxShadow: '0 8px 20px rgba(26,110,255,.32)', transition: 'transform .15s ease, filter .15s ease' }}>
            <Icon name="lock" size={15} stroke={2.4} />{cta}
          </span>
          {hint && <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>{hint}</span>}
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

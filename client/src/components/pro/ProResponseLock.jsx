/**
 * ProResponseLock: the ONLY place a free user meets a lock inside the Pro demo pages.
 *
 * Everything on the demo page (charts, cards, buttons) is fully visible. When the user
 * presses a button that would call the AI (Get Today's Plan, Generate Plan, a company
 * pill, a chat prompt, War Room...), the response that comes back is an EXAMPLE rendered
 * through this wrapper: only the first 1–2 lines stay readable (enough to see the tone and
 * the shape of the answer), then it is blurred hard with one clear upgrade action.
 * clearHeight is measured from the top of the block INCLUDING the 22px 'EXAMPLE RESPONSE' strip.
 *
 * Outside the demo (a real Pro user) this component renders its children untouched.
 *
 *   variant="card"    big blocks (plans, debriefs, verdicts): readable top, blurred rest,
 *                     and a card that follows the reader down the response.
 *   variant="inline"  chat bubbles: first lines readable, small "Unlock full reply" pill.
 */
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import Icon from '../interview/icons';
import { useIsPreview } from './PreviewContext';

export default function ProResponseLock({
  feature, cta = 'Unlock my AI Coach', note = 'Example response. Yours is written from your own sessions.',
  dark = false, variant = 'card', clearHeight = 100, children,
}) {
  const preview = useIsPreview();
  const { openUpgrade } = useUpgrade();
  if (!preview) return children;

  const open = () => openUpgrade(feature);
  const veil = dark
    ? 'linear-gradient(180deg, rgba(8,15,30,.18) 0%, rgba(8,15,30,.42) 45%, rgba(8,15,30,.72) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.42) 45%, rgba(255,255,255,.86) 100%)';
  const mask = 'linear-gradient(180deg, transparent 0, #000 28px)'; // short ramp: 1–2 lines stay crisp, the 3rd is already unreadable
  const label = `${cta}. This is an example response. Opens upgrade options.`;

  const veilButton = (
    <button type="button" className="prl-veil" onClick={open} aria-label={label}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: clearHeight, border: 'none', padding: 0, cursor: 'pointer', background: veil,
        backdropFilter: 'blur(3.5px) saturate(.95)', WebkitBackdropFilter: 'blur(3.5px) saturate(.95)', WebkitMaskImage: mask, maskImage: mask }} />
  );

  const styles = (
    <style>{`
      .prl-veil:focus-visible, .prl-pill:focus-visible, .prl-cta:focus-visible { outline: 2.5px solid ${C.brand500}; outline-offset: 3px; }
      .prl-cta { transition: transform .15s ease, filter .15s ease; }
      .prl-cta:hover { filter: brightness(1.07); transform: translateY(-1px); }
      .prl-cta:active { transform: scale(.985); }
      .prl-pill:hover { filter: brightness(1.08); }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .prl-veil { background: ${dark ? 'rgba(8,15,30,.88)' : 'rgba(255,255,255,.94)'} !important; }
      }
      @media (max-width: 560px) { .prl-card { flex-direction: column !important; align-items: stretch !important; text-align: center; gap: 10px !important; } .prl-card > div { flex: 0 0 auto !important; text-align: center !important; } .prl-cta { width: 100%; } }
      @media (prefers-reduced-motion: reduce) { .prl-cta { transition: none !important; } }
    `}</style>
  );

  if (variant === 'inline') {
    return (
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', minHeight: clearHeight + 36 }}>
        {styles}
        <div aria-hidden="true" style={{ userSelect: 'none' }}>{children}</div>
        {veilButton}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <span className="prl-pill" style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 99, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 11.5, fontWeight: 800, boxShadow: '0 6px 16px rgba(26,110,255,.35)' }}
            onClick={open} role="presentation">
            <Icon name="lock" size={12} stroke={2.6} /> Unlock full reply
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', minHeight: clearHeight + 120 }}>
      {styles}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em',
        color: dark ? 'rgba(255,255,255,.55)' : C.textMuted }}>
        <Icon name="lock" size={11} stroke={2.6} /> EXAMPLE RESPONSE
      </div>
      <div aria-hidden="true" style={{ userSelect: 'none' }}>{children}</div>
      {veilButton}

      {/* the card follows the reader down long responses, but never covers the readable top */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'sticky', top: 'calc(100svh - 150px)', marginTop: clearHeight + 14, padding: '0 12px 12px', display: 'flex', justifyContent: 'center' }}>
          <div className="prl-card" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640, width: '100%',
            padding: '12px 14px 12px 18px', borderRadius: 16, background: 'rgba(255,255,255,.97)', border: `1px solid ${C.brand100}`, boxShadow: '0 16px 40px rgba(15,35,95,.28), 0 2px 6px rgba(15,35,95,.10)' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text, letterSpacing: '-.2px' }}>This is what you would get</div>
              <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.45, marginTop: 2 }}>{note}</div>
            </div>
            <button type="button" className="prl-cta" onClick={open}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 20px', border: 'none', borderRadius: 12, cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 14, fontWeight: 800, boxShadow: '0 8px 18px rgba(26,110,255,.32)', whiteSpace: 'nowrap' }}>
              <Icon name="bolt" size={15} stroke={2.4} />{cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

ProResponseLock.propTypes = {
  feature: PropTypes.string.isRequired, cta: PropTypes.string, note: PropTypes.string,
  dark: PropTypes.bool, variant: PropTypes.oneOf(['card', 'inline']), clearHeight: PropTypes.number, children: PropTypes.node,
};

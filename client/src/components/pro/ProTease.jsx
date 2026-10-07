import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from './ProBadge';

/**
 * ProTease: the one "locked preview" pattern used across the app.
 *
 *   [ eyebrow + title ]              always readable
 *   [ lead (first line) ]            always readable, this is the hook
 *   [ blurred rest ................ ]  the sample content, blurred and fading out
 *   [   (lock) Unlock ...  button  ]  sits on top of the blur
 *
 * IMPORTANT: everything inside `children` is SAMPLE content written in the client.
 * Real Pro data never reaches a free user (the server strips it), so the blur is
 * decoration over an example, not a thin curtain over real answers.
 *
 * `tone="dark"` is for dark/blue cards, `tone="light"` for white cards.
 */
const STYLE = `
.pt-btn{transition:transform .15s ease, box-shadow .15s ease, filter .15s ease}
.pt-btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
.pt-btn:active{transform:translateY(0)}
.pt-btn:focus-visible{outline:3px solid rgba(26,110,255,.45);outline-offset:2px}
@media (prefers-reduced-motion: reduce){.pt-btn{transition:none}}
`;

const LockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
LockIcon.propTypes = { size: PropTypes.number };

export default function ProTease({
  feature,
  eyebrow,
  title,
  lead,
  children,
  cta = 'Unlock with Pro',
  hint,
  tone = 'light',
  blurHeight = 150,
  blurPx = 3.2,
  tag = 'EXAMPLE',
  showBadge = true,
  style,
  openOptions,
}) {
  const { openUpgrade } = useUpgrade();
  const dark = tone === 'dark';
  const ink = dark ? '#fff' : C.text;
  const soft = dark ? 'rgba(255,255,255,.72)' : C.textMuted;
  const edge = dark ? 'rgba(255,255,255,.16)' : C.border;
  const fadeTo = dark ? 'rgba(10,38,120,.92)' : 'rgba(255,255,255,.96)';

  return (
    <section
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18, padding: 'clamp(16px, 2.4vw, 22px)',
        background: dark ? 'linear-gradient(135deg, #0A3FCC 0%, #1A6EFF 60%, #0891B2 120%)' : '#fff',
        border: `1px solid ${edge}`,
        boxShadow: dark ? '0 14px 34px rgba(10,63,204,.22)' : '0 1px 2px rgba(15,35,95,.04), 0 10px 26px rgba(15,35,95,.06)',
        color: ink, fontFamily: F.body, ...style,
      }}
    >
      <style>{STYLE}</style>

      {(eyebrow || title || showBadge) && (
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', color: dark ? 'rgba(255,255,255,.7)' : C.brand600, textTransform: 'uppercase', marginBottom: 4 }}>
                {eyebrow}
              </div>
            )}
            {title && (
              <h3 style={{ margin: 0, fontFamily: F.display, fontSize: 'clamp(16px, 2vw, 19px)', fontWeight: 800, letterSpacing: '-0.2px', color: ink, lineHeight: 1.25 }}>
                {title}
              </h3>
            )}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {tag && (
              <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: soft, border: `1px solid ${edge}`, borderRadius: 6, padding: '3px 6px' }}>
                {tag}
              </span>
            )}
            {showBadge && <ProBadge variant="pro" />}
          </span>
        </header>
      )}

      {lead && (
        <div style={{ fontSize: 14.5, lineHeight: 1.65, color: ink, fontWeight: 600 }}>
          {lead}
        </div>
      )}

      <div style={{ position: 'relative', marginTop: lead ? 8 : 0, maxHeight: blurHeight, overflow: 'hidden' }}>
        {/* The blurred sample. Not focusable, not read out, not selectable. */}
        <div
          aria-hidden="true"
          style={{
            filter: `blur(${blurPx}px)`, WebkitFilter: `blur(${blurPx}px)`, userSelect: 'none',
            pointerEvents: 'none', color: soft, fontSize: 14, lineHeight: 1.7, transform: 'scale(1.01)',
          }}
        >
          {children}
        </div>

        {/* Fade + call to action on top of the blur */}
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 4,
            background: `linear-gradient(180deg, transparent 0%, ${fadeTo} 85%)`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', maxWidth: '100%' }}>
            <button
              type="button"
              className="pt-btn"
              onClick={() => openUpgrade(feature, openOptions)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', borderRadius: 12,
                border: dark ? '1px solid rgba(255,255,255,.35)' : 'none', cursor: 'pointer',
                background: dark ? '#fff' : `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`,
                color: dark ? C.brand700 : '#fff', fontFamily: F.display, fontSize: 13.5, fontWeight: 800, letterSpacing: '0.1px',
                boxShadow: dark ? '0 6px 18px rgba(0,0,0,.18)' : '0 8px 20px rgba(26,110,255,.32)',
              }}
            >
              <LockIcon size={15} />
              {cta}
            </button>
            {hint && <span style={{ fontSize: 11.5, color: dark ? 'rgba(255,255,255,.8)' : C.textMuted, fontWeight: 600 }}>{hint}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

ProTease.propTypes = {
  feature: PropTypes.string.isRequired,
  eyebrow: PropTypes.node,
  title: PropTypes.node,
  lead: PropTypes.node,
  children: PropTypes.node,
  cta: PropTypes.string,
  hint: PropTypes.node,
  tone: PropTypes.oneOf(['light', 'dark']),
  blurHeight: PropTypes.number,
  blurPx: PropTypes.number,
  tag: PropTypes.string,
  showBadge: PropTypes.bool,
  style: PropTypes.object,
  openOptions: PropTypes.object,
};

import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from './ProBadge';
import ProIcon from './ProIcon';

/**
 * LockedFeatureCard — one Pro feature a free user can see exists but not use.
 * Whole card is a single button (one clear tap target, keyboard friendly).
 * `hook` is an optional line built from the user's OWN free data, e.g.
 * "Your lowest topic right now: DBMS (52%)" — the honest version of "your data is waiting".
 * The bars are generic placeholders, never a blurred copy of real Pro output.
 */
export default function LockedFeatureCard({ icon, title, desc, feature, hook }) {
  const { openUpgrade } = useUpgrade();
  return (
    <button
      type="button"
      onClick={() => openUpgrade(feature)}
      aria-label={`${title}. Pro feature. Open upgrade options.`}
      className="mm-lock-card"
      style={{
        textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 168,
        padding: '16px 16px 14px', borderRadius: 16, cursor: 'pointer',
        border: `1px solid ${C.border}`, background: C.surface,
        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
        transition: 'transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s ease, border-color .18s ease',
        fontFamily: F.body,
      }}
    >
      <style>{`
        .mm-lock-card:hover { transform: translateY(-2px); border-color: ${C.brand100}; box-shadow: 0 10px 28px rgba(26,110,255,.10); }
        .mm-lock-card:focus-visible { outline: 2px solid ${C.brand500}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .mm-lock-card { transition: none; } .mm-lock-card:hover { transform: none; } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, background: C.brand50, color: C.brand600, border: `1px solid ${C.brand100}` }}>
          <ProIcon name={icon} size={17} />
        </span>
        <ProBadge variant="pro" />
      </div>
      <div>
        <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.textSub }}>{desc}</div>
      </div>
      {hook && (
        <div style={{ fontSize: 12, lineHeight: 1.45, color: C.brand600, fontWeight: 600 }}>{hook}</div>
      )}
      <div aria-hidden="true" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ display: 'block', height: 6, width: '88%', borderRadius: 99, background: `linear-gradient(90deg, ${C.border}, ${C.surfaceAlt}, ${C.border})` }} />
        <span style={{ display: 'block', height: 6, width: '58%', borderRadius: 99, background: `linear-gradient(90deg, ${C.border}, ${C.surfaceAlt}, ${C.border})` }} />
      </div>
    </button>
  );
}

LockedFeatureCard.propTypes = {
  icon:    PropTypes.string.isRequired,
  title:   PropTypes.string.isRequired,
  desc:    PropTypes.string.isRequired,
  feature: PropTypes.string.isRequired,
  hook:    PropTypes.string,
};

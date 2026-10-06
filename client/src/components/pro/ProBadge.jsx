import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';

/**
 * ProBadge — the one small visual that says "this is Pro" everywhere.
 *   variant="pro"   → solid gradient pill with bolt   (feature is Pro-only)
 *   variant="trial" → soft cyan pill                  (you can try it once, free)
 *   variant="lock"  → quiet lock chip                 (dense spaces)
 * Consistency matters more than cleverness: same shape, same casing, same colour
 * on every page, so users learn the signal after seeing it twice.
 */
const Bolt = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);
const Lock = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
Bolt.propTypes = { s: PropTypes.number };
Lock.propTypes = { s: PropTypes.number };

const VARIANTS = {
  pro: {
    background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`,
    color: '#fff', border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 2px 8px rgba(26,110,255,0.28)',
  },
  trial: {
    background: C.accentTint, color: C.accent600, border: `1px solid ${C.accent300}`, boxShadow: 'none',
  },
  lock: {
    background: C.surfaceAlt, color: C.textMuted, border: `1px solid ${C.border}`, boxShadow: 'none',
  },
};

export default function ProBadge({ variant = 'pro', label, size = 'sm', style }) {
  const v = VARIANTS[variant] || VARIANTS.pro;
  const text = label ?? (variant === 'trial' ? 'Try free' : variant === 'lock' ? '' : 'PRO');
  const icon = size === 'md' ? 12 : 10;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        height: size === 'md' ? 22 : 18, padding: text ? (size === 'md' ? '0 9px' : '0 7px') : '0 5px',
        borderRadius: 99, fontFamily: F.mono, fontSize: size === 'md' ? 10.5 : 9.5,
        fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        lineHeight: 1, ...v, ...style,
      }}
    >
      {variant === 'lock' ? <Lock s={icon} /> : variant === 'trial' ? null : <Bolt s={icon} />}
      {text}
    </span>
  );
}

ProBadge.propTypes = {
  variant: PropTypes.oneOf(['pro', 'trial', 'lock']),
  label:   PropTypes.string,
  size:    PropTypes.oneOf(['sm', 'md']),
  style:   PropTypes.object,
};

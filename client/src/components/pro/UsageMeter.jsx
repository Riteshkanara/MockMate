import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import { timeUntil } from '../../utils/planHelpers';

/**
 * UsageMeter — "how many free interviews do I have left today?"
 * Pips instead of a bar: three discrete interviews read faster as three dots.
 * Colour is honest, not manipulative — neutral → amber on the last one → red only
 * when blocked. tone="dark" is for the navy preview panel on the setup page.
 */
export default function UsageMeter({ daily, tone = 'light' }) {
  if (!daily) return null;
  const dark = tone === 'dark';
  const { used, limit, resetsAt } = daily;

  // Pro: no limit → a calm confirmation, not a meter.
  if (limit === null || limit === undefined) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: dark ? 'rgba(255,255,255,0.75)' : C.textSub }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>∞</span> Unlimited interviews · Pro
      </div>
    );
  }

  const remaining = Math.max(0, limit - used);
  const blocked = remaining === 0;
  const last = remaining === 1;
  const accent = blocked ? (dark ? '#FCA5A5' : C.danger) : last ? (dark ? '#FCD34D' : C.warning) : (dark ? C.accent300 : C.brand500);
  const empty = dark ? 'rgba(255,255,255,0.2)' : C.border;
  const text = dark ? 'rgba(255,255,255,0.85)' : C.textSub;

  const label = blocked
    ? `Daily limit reached · resets in ${timeUntil(resetsAt)}`
    : last ? 'Last free interview today'
    : `${remaining} of ${limit} free interviews left today`;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} role="group" aria-label={label}>
      <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
        {Array.from({ length: limit }).map((_, i) => (
          <span key={i} style={{
            width: 22, height: 6, borderRadius: 99,
            background: i < used ? empty : accent,
            transition: 'background 0.3s ease',
          }} />
        ))}
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: blocked || last ? accent : text }}>
        {label}
      </span>
    </div>
  );
}

UsageMeter.propTypes = {
  daily: PropTypes.shape({ used: PropTypes.number, limit: PropTypes.number, resetsAt: PropTypes.string }),
  tone:  PropTypes.oneOf(['light', 'dark']),
};

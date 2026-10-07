import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import { timeUntil } from '../../utils/planHelpers';

/**
 * UsageMeter — "how many free interviews do I have left today?"
 *
 * Reads in one glance: a big number (2/3), three pips, one plain sentence, and when the
 * count comes back. Colour is honest, not manipulative: brand blue → amber on the last
 * one → red only when blocked. tone="dark" is for the navy hero on the setup page.
 * Wraps cleanly on narrow screens (the sentence drops under the pips, never clips).
 */
export default function UsageMeter({ daily, tone = 'light' }) {
  if (!daily) return null;
  const dark = tone === 'dark';
  const { used, limit, resetsAt } = daily;

  // Pro: no limit → a calm confirmation, not a meter.
  if (limit === null || limit === undefined) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: F.display, fontSize: 13, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.85)' : C.textSub }}>
        <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1, background: dark ? 'rgba(255,255,255,.16)' : C.brand50, color: dark ? '#fff' : C.brand600 }}>∞</span>
        Unlimited interviews · Pro
      </div>
    );
  }

  const remaining = Math.max(0, limit - used);
  const blocked = remaining === 0;
  const last = remaining === 1;
  const accent = blocked ? (dark ? '#FCA5A5' : C.danger) : last ? (dark ? '#FCD34D' : C.warning) : (dark ? C.accent300 : C.brand500);
  const spent = dark ? 'rgba(255,255,255,0.22)' : C.border;
  const text = dark ? 'rgba(255,255,255,0.88)' : C.text;
  const subText = dark ? 'rgba(255,255,255,0.68)' : C.textMuted;

  const headline = blocked ? 'Daily limit reached'
    : last ? 'Last free interview today'
    : `${remaining} free interviews left today`;
  const sub = resetsAt && (used > 0 || blocked) ? `Resets in ${timeUntil(resetsAt)}` : 'Resets every 24 hours';
  const label = `${headline}. ${sub}.`;

  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div aria-hidden="true" style={{ display: 'flex', alignItems: 'baseline', gap: 2, fontFamily: F.display, minWidth: 40 }}>
          <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: accent, letterSpacing: '-0.5px' }}>{remaining}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: subText }}>/{limit}</span>
        </div>
        <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: limit }).map((_, i) => {
            const on = i >= used;
            return (
              <span key={i} style={{
                width: 22, height: 8, borderRadius: 99,
                background: on ? accent : spent,
                boxShadow: on ? `0 0 0 3px ${accent}22` : 'none',
                transition: 'background .3s ease, box-shadow .3s ease',
              }} />
            );
          })}
        </div>
      </div>
      <div style={{ minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: blocked || last ? accent : text }}>{headline}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: subText }}>{sub}</div>
      </div>
    </div>
  );
}

UsageMeter.propTypes = {
  daily: PropTypes.shape({ used: PropTypes.number, limit: PropTypes.number, resetsAt: PropTypes.string }),
  tone:  PropTypes.oneOf(['light', 'dark']),
};

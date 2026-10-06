import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { C, F } from '../../styles/token';
import { timeUntil } from '../../utils/planHelpers';

/**
 * DailyLimitCard — shown on the setup page when today's free interviews are used.
 * Tone: a finished workout, not a paywall. It tells you what you did, when you
 * get more for free, and what you can still do right now — THEN offers Pro.
 */
export default function DailyLimitCard({ daily, onUpgrade }) {
  const navigate = useNavigate();
  const [, tick] = useState(0);

  // Keep the "resets in" text fresh without hammering renders.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (!daily) return null;

  const action = (label, to) => (
    <button
      type="button"
      onClick={() => navigate(to)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px',
        borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface,
        color: C.textSub, fontFamily: F.body, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      role="status"
      style={{
        fontFamily: F.body, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        padding: '16px 18px', borderRadius: 16, marginBottom: 14,
        border: `1px solid ${C.brand100}`,
        background: `linear-gradient(135deg, ${C.brand50}, #fff 70%)`,
      }}
    >
      <div style={{ minWidth: 220, flex: '1 1 320px' }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: C.brand600, marginBottom: 6 }}>
          TODAY&apos;S PRACTICE COMPLETE · {daily.used}/{daily.limit}
        </div>
        <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          Nice work. Your free interviews reset in {timeUntil(daily.resetsAt)}.
        </div>
        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5, marginBottom: 10 }}>
          Use the gap to review what you just practised — or keep going right now with Pro.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {action('Review past results', '/history')}
          {action('See your progress', '/analytics')}
        </div>
      </div>

      <button
        type="button"
        onClick={onUpgrade}
        style={{
          height: 44, padding: '0 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff',
          fontFamily: F.display, fontSize: 14, fontWeight: 700,
          boxShadow: '0 6px 20px rgba(26,110,255,0.28)',
        }}
      >
        Go unlimited with Pro
      </button>
    </div>
  );
}

DailyLimitCard.propTypes = {
  daily:     PropTypes.shape({ used: PropTypes.number, limit: PropTypes.number, resetsAt: PropTypes.string }),
  onUpgrade: PropTypes.func.isRequired,
};

import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import { MODE_LABELS } from '../../utils/planHelpers';

/**
 * ProUnlockBanner — one calm strip on the Result page, right after the score.
 * Shown to free users only, and only when it has something TRUE to say:
 *   • they just finished a one-time trial of a Pro mode, or
 *   • some of this session's insights are locked (real count from the server).
 * It is dismissible and never appears for Pro users.
 */
export default function ProUnlockBanner({ isTrial, mode, lockedCount, onDismiss }) {
  const { openUpgrade } = useUpgrade();
  if (!isTrial && !lockedCount) return null;

  const modeName = MODE_LABELS[mode] || 'this mode';
  const title = isTrial
    ? `That was your free trial of ${modeName}`
    : `${lockedCount} insight${lockedCount > 1 ? 's' : ''} from this session ${lockedCount > 1 ? 'are' : 'is'} locked`;
  const body = isTrial
    ? 'You saw the full feedback for this one session. Pro keeps every mode, and every insight, open.'
    : 'Model answers, coaching and delivery analysis are ready and waiting. They unlock the moment you upgrade, including for sessions you have already finished.';

  return (
    <div
      role="region"
      aria-label="Upgrade to Pro"
      style={{
        fontFamily: F.body, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 14,
        padding: '14px 16px', borderRadius: 14, border: `1px solid ${C.brand100}`,
        background: `linear-gradient(135deg, ${C.brand50}, #fff 65%)`,
      }}
    >
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
      </span>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.5, marginTop: 2 }}>{body}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => openUpgrade(isTrial ? `mode_${mode}` : 'detailedFeedback', { trialUsed: isTrial })}
          style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: C.brand500, color: '#fff', fontFamily: F.display, fontSize: 13, fontWeight: 700 }}
        >
          See what Pro adds
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

ProUnlockBanner.propTypes = {
  isTrial:     PropTypes.bool,
  mode:        PropTypes.string,
  lockedCount: PropTypes.number,
  onDismiss:   PropTypes.func,
};

import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from './ProBadge';

/**
 * HistoryLockedStrip — sits under a free user's history list.
 * The count comes from the server (sessions older than the free window that are saved
 * but not listed), so "N older interviews are saved" is literally true.
 */
export default function HistoryLockedStrip({ olderCount, windowDays }) {
  const { openUpgrade } = useUpgrade();
  if (!olderCount || olderCount < 1) return null;

  return (
    <button
      type="button"
      onClick={() => openUpgrade('fullHistory')}
      aria-label={`${olderCount} older interviews are saved. Open upgrade options.`}
      style={{
        fontFamily: F.body, width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
        padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
        border: `1px dashed ${C.brand100}`, background: `linear-gradient(135deg, ${C.brand50}, #fff 70%)`,
      }}
    >
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.brand500, color: '#fff' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text }}>
          {olderCount} older interview{olderCount === 1 ? ' is' : 's are'} saved
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: C.textSub, marginTop: 2, lineHeight: 1.5 }}>
          Free shows your last {windowDays || 7} days. Nothing is deleted; your full history appears the moment you upgrade.
        </span>
      </span>
      <ProBadge variant="pro" size="md" />
    </button>
  );
}

HistoryLockedStrip.propTypes = {
  olderCount: PropTypes.number,
  windowDays: PropTypes.number,
};

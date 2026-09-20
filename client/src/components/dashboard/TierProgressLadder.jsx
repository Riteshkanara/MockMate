import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { F } from '../../styles/token';

const ALL_TIERS = [
  { label: '₹3–6 LPA',   minIRS: 0,  color: '#6B7280', fill: '#E5E7EB', text: '#374151' },
  { label: '₹6–12 LPA',  minIRS: 35, color: '#D97706', fill: '#FEF3C7', text: '#92400E' },
  { label: '₹12–20 LPA', minIRS: 60, color: '#2563EB', fill: '#DBEAFE', text: '#1E3A8A' },
  { label: '₹20 LPA+',   minIRS: 80, color: '#0E9F8E', fill: '#CCFBF1', text: '#065F46' },
];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));

const tierRungProgress = (irs, prevMinIRS, minIRS) => {
  const range = minIRS - (prevMinIRS ?? 0);
  if (range <= 0) return 100;
  return clamp(((irs - (prevMinIRS ?? 0)) / range) * 100);
};

const TierProgressLadder = ({ irs, hasData, apiTiers, currentTierLabel, nextTier, irsGap, isGated, gatedRaw, sessionsNeeded }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  const tiers = ALL_TIERS.map(t => {
    const api = apiTiers?.find(a => a.label === t.label);
    return { ...t, minIRS: api?.minIRS ?? t.minIRS, isUnlocked: api?.isUnlocked ?? (irs >= t.minIRS) };
  });
  const currentIdx = tiers.findIndex(t => t.label === currentTierLabel);

  return (
    <div style={{ padding: '20px 22px', borderRadius: 16, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)' }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, letterSpacing: '1px', color: 'rgba(255,255,255,0.65)', marginBottom: 8, textTransform: 'lowercase' }}>interview readiness score</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
        <span style={{ fontFamily: F.display, fontSize: hasData ? 52 : 36, fontWeight: 900, color: hasData ? '#fff' : 'rgba(255,255,255,0.4)', letterSpacing: '-2px', lineHeight: 1 }} className="mm-irs-num">
          {hasData ? irs : '—'}
        </span>
        {hasData && <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.55)', fontFamily: F.body }}>/100</span>}
      </div>
      {!hasData ? (
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>Run your first session to unlock the tier ladder.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 7 }}>
          {tiers.map((t, i) => {
            const isCurrent   = t.label === currentTierLabel;
            const isCompleted = i < currentIdx;
            const isNext      = nextTier && t.label === nextTier.label;
            const isLocked    = !isCurrent && !isCompleted && !isNext;
            const fillPct     = isCompleted || isCurrent ? 100 : isNext ? tierRungProgress(irs, tiers[i - 1]?.minIRS ?? 0, t.minIRS) : 0;
            return (
              <div key={t.label} style={{ opacity: isLocked ? 0.35 : 1, transition: 'opacity 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 9, background: isCurrent ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isCurrent ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: isCompleted || isCurrent ? t.color : 'rgba(255,255,255,0.25)', flexShrink: 0, boxShadow: isCurrent ? `0 0 0 3px ${t.color}44` : 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? '#fff' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{t.label}</div>
                    <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.12)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: isCompleted ? t.color : isCurrent ? '#fff' : isNext ? t.color : 'rgba(255,255,255,0.2)', width: `${mounted ? fillPct : 0}%`, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' }} />
                    </div>
                  </div>
                  {isCompleted && <span style={{ fontSize: 11, color: t.color, fontWeight: 800, flexShrink: 0 }}>✓</span>}
                  {isCurrent  && <span style={{ fontSize: 9, fontFamily: F.mono, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.22)', color: '#fff', flexShrink: 0 }}>you</span>}
                  {isNext     && <span style={{ fontSize: 9, fontFamily: F.mono, color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}>+{irsGap} pts</span>}
                  {isLocked   && <span style={{ fontSize: 9, fontFamily: F.mono, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>need {t.minIRS}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isGated && hasData && (
        <div style={{ marginTop: 12, fontSize: 10.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
          Tracking toward {gatedRaw} — {sessionsNeeded} more session{sessionsNeeded === 1 ? '' : 's'} to confirm.
        </div>
      )}
    </div>
  );
};

TierProgressLadder.propTypes = {
  irs:              PropTypes.number.isRequired,
  hasData:          PropTypes.bool.isRequired,
  apiTiers:         PropTypes.array,
  currentTierLabel: PropTypes.string.isRequired,
  nextTier:         PropTypes.object,
  irsGap:           PropTypes.number.isRequired,
  isGated:          PropTypes.bool,
  gatedRaw:         PropTypes.string,
  sessionsNeeded:   PropTypes.number,
};

export default TierProgressLadder;
import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { F } from '../leaderboard/tokens';

let rankRingIdSeq = 0;

const RankRing = ({ rank, pct, mounted, size = 122, stroke = 7 }) => {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const clampedPct = Math.max(0, Math.min(100, pct ?? 0));
  const offset = mounted ? circumference * (1 - clampedPct / 100) : circumference;
  const gradId = useMemo(() => `rankRingGrad${rankRingIdSeq++}`, []);
  const glowId = useMemo(() => `rankRingGlow${rankRingIdSeq++}`, []);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#DCEBFF" />
            <stop offset="100%" stopColor="#AFD3FF" />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`rotate(-90 ${c} ${c})`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={stroke} />
          <circle
            cx={c} cy={c} r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter={`url(#${glowId})`}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1) 0.25s' }}
          />
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 800, letterSpacing: '1.9px', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', marginBottom: 3 }}>rank</div>
        <div style={{ fontFamily: F.display, fontSize: 37, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-1.5px' }}>
          {rank != null ? `#${rank}` : '—'}
        </div>
      </div>
    </div>
  );
};

RankRing.propTypes = {
  rank: PropTypes.number,
  pct: PropTypes.number,
  mounted: PropTypes.bool,
  size: PropTypes.number,
  stroke: PropTypes.number,
};

export default RankRing;
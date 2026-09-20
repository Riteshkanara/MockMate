import { memo, useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';

const C = {
  ...CT,
  violet:      CT.blue500,
  violetLight: CT.blue300,
  violetTint:  CT.blue50,
  violetMid:   CT.blue600,
  violetDeep:  CT.blue700,
  dimColors: {
    technical:      CT.blue500,
    problemSolving: CT.blue500,
    communication:  CT.green,
    behavioral:     CT.amber,
    design:         CT.cyan600,
    fundamentals:   CT.red,
  },
};

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

// — PropTypes
LivingAura.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    key:                PropTypes.string,
    label:              PropTypes.string,
    icon:               PropTypes.string,
    score:              PropTypes.number,
    contributingTopics: PropTypes.arrayOf(PropTypes.string),
  })).isRequired,
  irs:              PropTypes.number.isRequired,
  scoreTrend:       PropTypes.array,
  onDrillDimension: PropTypes.func,
  companyOverlay:   PropTypes.object,
};

// — Component
function LivingAura({ data: radarData, irs, scoreTrend = [], onDrillDimension, companyOverlay = null }) {
  const [pulse, setPulse]       = useState(0);
  const [hoveredDim, setHoveredDim] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let t = 0;
    const tick = () => {
      t += 0.016;
      setPulse(Math.sin(t));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const nowRef = useRef(Date.now());

  useEffect(() => { nowRef.current = Date.now(); }, [scoreTrend]);

  const ghostScores = useMemo(() => {
    const now   = Date.now();
    const msDay = 86400000;
    const recent = scoreTrend.filter(s => { const age = now - new Date(s.date).getTime(); return age >= 0 && age <= 7 * msDay; });
    const old    = scoreTrend.filter(s => { const age = now - new Date(s.date).getTime(); return age > 14 * msDay && age <= 28 * msDay; });
    if (!old.length || !recent.length) return null;
    const recentAvg = recent.reduce((a, s) => a + (s.score || 0), 0) / recent.length;
    const oldAvg    = old.reduce((a, s) => a + (s.score || 0), 0) / old.length;
    const delta     = recentAvg - oldAvg;
    return radarData.map(d => Math.max(0, Math.min(100, (d.score || 0) - delta)));
  }, [scoreTrend, radarData]);

  const hasGhost = ghostScores !== null;
  const N = radarData.length;
  const cx = 200, cy = 200, maxR = 142;

  const ptsForData = (dataArr, scale) =>
    dataArr.map((score, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const r = (score / 100) * maxR * scale;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });

  const ptsForScale = (scale) =>
    radarData.map((d, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const r = (d.score / 100) * maxR * scale;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });

  const companyPts = companyOverlay
    ? ptsForData(radarData.map(d => companyOverlay.scores[d.key] ?? 50), 1)
    : null;

  const toPath = (pts) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z';

  const outerPts = ptsForScale(1);
  const midPts   = ptsForScale(0.70 + pulse * 0.022);
  const innerPts = ptsForScale(0.42 + pulse * 0.016);
  const corePts  = ptsForScale(0.22);
  const ghostPts = hasGhost ? ptsForData(ghostScores, 1) : null;

  const labelPts = radarData.map((d, i) => {
    const angle = (2 * Math.PI * i) / N - Math.PI / 2;
    const r = maxR + 28;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), ...d };
  });

  const gridRings   = [0.25, 0.5, 0.75, 1.0];
  const gridPolygon = (scale) =>
    Array.from({ length: N }, (_, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const r     = maxR * scale;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 18, height: 3, borderRadius: 2, background: C.violet }} />
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.sub }}>NOW</span>
        </div>
        {hasGhost && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 18, height: 2, borderRadius: 2, background: C.amber, borderTop: `2px dashed ${C.amber}` }} />
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.sub }}>14 DAYS AGO</span>
          </div>
        )}
        {companyOverlay && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 18, height: 2, borderRadius: 2, background: C.green, borderTop: `2px dotted ${C.green}` }} />
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green }}>{companyOverlay.icon} TARGET</span>
          </div>
        )}
        {onDrillDimension && <div style={{ fontSize: 9, color: C.muted, fontFamily: F.mono }}>· Click label to drill</div>}
      </div>

      <svg viewBox="0 0 400 400" width="100%" style={{ maxWidth: 420, overflow: 'visible' }}>
        <defs>
          <linearGradient id="auraRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.violet} stopOpacity="0.7" />
            <stop offset="100%" stopColor={C.blue400} />
          </linearGradient>
          <radialGradient id="auraCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.violet} stopOpacity="0.4" />
            <stop offset="100%" stopColor={C.violetMid} stopOpacity="0.04" />
          </radialGradient>
          <radialGradient id="auraMid" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.violetLight} stopOpacity="0.2" />
            <stop offset="100%" stopColor={C.blue400} stopOpacity="0.02" />
          </radialGradient>
          <radialGradient id="auraOuter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.blue300} stopOpacity="0.1" />
            <stop offset="100%" stopColor={C.blue200} stopOpacity="0.01" />
          </radialGradient>
          <filter id="auraGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {gridRings.map((s, i) => (
          <polygon key={i} points={gridPolygon(s)} fill="none" stroke={C.border}
            strokeWidth={i === gridRings.length - 1 ? 1.5 : 0.8} strokeOpacity={0.8} />
        ))}
        {gridRings.map((s, i) => {
          const angle = -Math.PI / 2;
          return (
            <text key={i} x={cx + maxR * s * Math.cos(angle) + 4} y={cy + maxR * s * Math.sin(angle)}
              fill={C.faint} fontSize={7} fontFamily={F.mono}>{s * 100}</text>
          );
        })}
        {radarData.map((_, i) => {
          const angle = (2 * Math.PI * i) / N - Math.PI / 2;
          return (
            <line key={i} x1={cx} y1={cy}
              x2={cx + maxR * Math.cos(angle)} y2={cy + maxR * Math.sin(angle)}
              stroke={C.border} strokeWidth={0.8} strokeOpacity={0.7} />
          );
        })}

        {hasGhost && ghostPts && (
          <path d={toPath(ghostPts)} fill={C.amber} fillOpacity={0.06}
            stroke={C.amber} strokeWidth={1.5} strokeOpacity={0.55} strokeDasharray="5 3" />
        )}
        {companyPts && (
          <path d={toPath(companyPts)} fill={C.green} fillOpacity={0.05}
            stroke={C.green} strokeWidth={2} strokeOpacity={0.75} strokeDasharray="3 4" />
        )}

        <path d={toPath(outerPts)} fill="url(#auraOuter)" stroke={C.blue300} strokeWidth={1} strokeOpacity={0.25 + pulse * 0.05} />
        <path d={toPath(midPts)}   fill="url(#auraMid)"   stroke={C.violetLight} strokeWidth={1.5} strokeOpacity={0.4 + pulse * 0.1}  filter="url(#softGlow)" />
        <path d={toPath(innerPts)} fill="url(#auraCore)"  stroke={C.violet}      strokeWidth={2}   strokeOpacity={0.65 + pulse * 0.15} filter="url(#auraGlow)" />
        <path d={toPath(corePts)}  fill={C.violet} fillOpacity={0.18} stroke={C.violetMid} strokeWidth={1.5} />
        <path d={toPath(outerPts)} fill="none" stroke="url(#auraRingGrad)" strokeWidth={2.5} strokeOpacity={0.95} filter="url(#softGlow)" />

        {outerPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4.5}
            fill={C.dimColors[radarData[i]?.key] || scoreColor(radarData[i]?.score || 0)}
            stroke="#fff" strokeWidth={1.5} filter="url(#softGlow)" />
        ))}

        {labelPts.map(({ x, y, label, score, icon, key, contributingTopics }, i) => {
          const isHovered = hoveredDim === key;
          const canDrill  = onDrillDimension && (contributingTopics?.length > 0);
          const dimColor  = C.dimColors[key] || scoreColor(score);
          return (
            <g key={i} style={{ cursor: canDrill ? 'pointer' : 'default' }}
              onClick={() => canDrill && onDrillDimension(radarData[i])}
              onMouseEnter={() => setHoveredDim(key)}
              onMouseLeave={() => setHoveredDim(null)}>
              {canDrill && (
                <ellipse cx={x} cy={y} rx={34} ry={14}
                  fill={isHovered ? `${dimColor}18` : 'transparent'}
                  stroke={isHovered ? `${dimColor}60` : 'transparent'} strokeWidth={1} />
              )}
              <text x={x} y={y - 8} textAnchor="middle" dominantBaseline="middle"
                fill={isHovered ? dimColor : C.text}
                fontSize={10} fontWeight={800} fontFamily={F.body}>
                {icon} {label}{canDrill && isHovered ? ' ↗' : ''}
              </text>
              <text x={x} y={y + 8} textAnchor="middle" dominantBaseline="middle"
                fill={dimColor} fontSize={11} fontWeight={700} fontFamily={F.display}>{score}</text>
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r={38} fill="white" fillOpacity={0.96}
          stroke={C.borderStr} strokeWidth={1.5}
          style={{ filter: 'drop-shadow(0 4px 16px rgba(59,130,246,0.18))' }} />
        <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
          fill={C.violet} fontSize={22} fontWeight={900} fontFamily={F.display}>{irs}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
          fill={C.muted} fontSize={7} fontWeight={800} letterSpacing="1.4" fontFamily={F.mono}>IRS</text>
      </svg>
    </div>
  );
}

export default memo(LivingAura);
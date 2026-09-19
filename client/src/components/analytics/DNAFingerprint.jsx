import React from 'react';
import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';

// — Analytics palette (local copy)
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
DNAFingerprint.propTypes = {
  profile: PropTypes.arrayOf(PropTypes.shape({
    key:   PropTypes.string,
    label: PropTypes.string,
    icon:  PropTypes.string,
    score: PropTypes.number,
  })).isRequired,
};

// — Component
function DNAFingerprint({ profile }) {
  const seed  = profile.reduce((acc, d) => acc + d.score, 0);
  const paths = profile.map((d, i) => {
    const freq  = 0.038 + (d.score / 100) * 0.07;
    const amp   = 16   + (d.score / 100) * 30;
    const yBase = 22   + i * 30;
    const color = C.dimColors[d.key] || scoreColor(d.score);
    const pts   = Array.from({ length: 80 }, (_, j) => {
      const x = (j / 79) * 340 + 10;
      const y = yBase + Math.sin(j * freq + (seed % 7)) * amp * (d.score / 100);
      return `${j === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return { pts, color, label: d.label, score: d.score, icon: d.icon };
  });

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox="0 0 360 212" width="100%" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="dnaGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {paths.map(({ pts, color, label, score: s, icon }, i) => (
          <g key={i}>
            <path d={pts} fill="none" stroke={color} strokeWidth={1.8} strokeOpacity={0.7} filter="url(#dnaGlow)" />
            <text x={352} y={22 + i * 30} textAnchor="end"
              fill={C.muted} fontSize={8} fontWeight={600} fontFamily={F.body} dominantBaseline="middle">
              {icon} {label} <tspan fill={color} fontWeight={800}>{s}</tspan>
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default React.memo(DNAFingerprint);
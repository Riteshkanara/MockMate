import PropTypes from 'prop-types';

const HeroSparkline = ({ scoreTrend }) => {
  const pts = scoreTrend.slice(-8).map(s => s.score || 0);
  if (pts.length < 2) return null;
  const W = 120, H = 34;
  const step = W / (pts.length - 1);
  const toY  = v => H - (v / 100) * H;
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const lastX = (pts.length - 1) * step;
  const lastY = toY(pts.at(-1));
  return (
    <svg width={W} height={H + 6} viewBox={`0 0 ${W} ${H + 6}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <path d={path} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#fff" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#fff" opacity="0.4">
        <animate attributeName="r"       values="3.5;8;3.5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
};

HeroSparkline.propTypes = { scoreTrend: PropTypes.array.isRequired };

export default HeroSparkline;
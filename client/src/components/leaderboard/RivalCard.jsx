import PropTypes from 'prop-types';
import { F, C } from '../leaderboard/tokens';
import S from '../leaderboard/styles';

const DIMENSION_TO_TOPIC = {
  technical: 'DSA',
  problemSolving: 'DSA',
  communication: 'HR',
  behavioral: 'HR',
  design: 'System Design',
  fundamentals: 'OS',
};

const RivalCard = ({
  rival,
  gapToNext,
  userRank,
  navigate,
  weakestDim,
  weakestPracticeTopic,
  mounted,
}) => {
  if (!rival || gapToNext == null) return null;

  const rivalScore = Number(rival.avgScore) || 0;

  const urgency =
    gapToNext <= 2 ? 'critical' :
    gapToNext <= 5 ? 'close' :
    'chase';

  const urgencyMeta = {
    critical: {
      label: 'SO CLOSE',
      color: C.red,
      tint: C.redTint,
      msg: `Just ${gapToNext} pt${gapToNext !== 1 ? 's' : ''} — one good session could move you ahead.`,
    },
    close: {
      label: 'WITHIN REACH',
      color: C.amber,
      tint: C.amberTint,
      msg: `${gapToNext} points separate you. A focused practice session can close the gap.`,
    },
    chase: {
      label: 'THE HUNT',
      color: C.signal,
      tint: C.signalTint,
      msg: `${gapToNext} points back. Strengthen ${weakestDim?.label || 'your weakest skill'} first.`,
    },
  }[urgency];

  return (
    <div
      style={{
        ...S.rivalCard,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
      }}
      className="rival-card-hover"
    >
      <div
        style={{
          ...S.rivalAccentBar,
          background: `linear-gradient(180deg, ${urgencyMeta.color} 0%, ${C.signal} 48%, ${C.pulse} 100%)`,
        }}
      />

      <div style={S.rivalInner}>
        {/* LEFT */}
        <div style={S.rivalLeft}>
          <div style={S.rivalEyebrowRow}>
            <span style={{ ...S.rivalEyebrowDot, background: urgencyMeta.color }} />
            <span style={{ ...S.rivalEyebrow, color: urgencyMeta.color }}>{urgencyMeta.label}</span>
            <span style={S.rivalEyebrowDivider}>·</span>
            <span style={S.rivalEyebrowContext}>#{userRank - 1} is the next rank</span>
          </div>

          <div style={S.rivalName}>
            <div
              style={{
                ...S.rivalAvatar,
                background: `linear-gradient(135deg, ${C.signalTint} 0%, ${C.pulseTint} 100%)`,
                border: `1px solid ${C.lineMd}`,
                color: C.signalDeep,
              }}
            >
              {rival.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={S.rivalNameText}>{rival.name || `Rank #${userRank - 1}`}</div>
              <div style={S.rivalNameSub}>{rival.college || 'Ranked just above you'}</div>
            </div>
          </div>

          <p style={S.rivalMsg}>{urgencyMeta.msg}</p>
        </div>

        {/* RIGHT */}
        <div style={S.rivalRight}>
          <div style={S.rivalMetrics}>
            <div style={S.rivalMetric}>
              <div style={S.rivalScoreLabel}>THEIR SCORE</div>
              <div style={S.rivalScoreVal}>
                {rivalScore}
                <span style={S.rivalScoreUnit}>/100</span>
              </div>
            </div>
            <div style={S.rivalMetricDivider} />
            <div style={S.rivalMetric}>
              <div style={S.rivalScoreLabel}>GAP</div>
              <div style={{ ...S.rivalScoreVal, color: urgencyMeta.color }}>
                −{gapToNext}
                <span style={S.rivalScoreUnit}> pts</span>
              </div>
            </div>
          </div>

          <button
            style={{
              ...S.rivalCta,
              color: C.signalDeep,
              borderColor: C.lineMd,
              background: '#FFFFFF',
            }}
            onClick={() =>
              weakestPracticeTopic
                ? navigate('/interview', { state: { mode: 'topic', topic: weakestPracticeTopic } })
                : navigate('/interview')
            }
          >
            <span>🎯</span>
            <span>Close the gap</span>
            <span style={S.rivalCtaArrow}>→</span>
          </button>
        </div>
      </div>

      {/* Bottom progress line */}
      <div style={S.rivalBottomLine}>
        <div style={S.rivalBottomTrack}>
          <div
            style={{
              ...S.rivalBottomFill,
              width: `${Math.min(100, Math.max(8, 100 - gapToNext * 10))}%`,
              background: `linear-gradient(90deg, ${C.signal}, ${C.pulse})`,
            }}
          />
        </div>
        <span style={S.rivalBottomText}>
          {weakestDim ? `Focus: ${weakestDim.label}` : 'One focused session could change your rank'}
        </span>
      </div>
    </div>
  );
};

RivalCard.propTypes = {
  rival: PropTypes.shape({
    name: PropTypes.string,
    college: PropTypes.string,
    avgScore: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  gapToNext: PropTypes.number,
  userRank: PropTypes.number,
  navigate: PropTypes.func.isRequired,
  weakestDim: PropTypes.shape({
    label: PropTypes.string,
    key: PropTypes.string,
    score: PropTypes.number,
    hasData: PropTypes.bool,
  }),
  weakestPracticeTopic: PropTypes.string,
  mounted: PropTypes.bool,
};

export default RivalCard;
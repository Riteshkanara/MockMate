import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { F, C } from '../leaderboard/tokens';



const PODIUM_METALS = {
  1: { medal: '🥇', color: '#8C640C', bright: '#F0B93D', tint: '#FBF3DE', glow: 'rgba(140,100,12,0.38)', label: '1st', laurel: '❧' },
  2: { medal: '🥈', color: '#5F6C89', bright: '#A7B3CE', tint: '#EFF2F8', glow: 'rgba(95,108,137,0.30)', label: '2nd', laurel: '' },
  3: { medal: '🥉', color: '#8C5F37', bright: '#C88E5C', tint: '#F7EEE3', glow: 'rgba(140,95,55,0.30)', label: '3rd', laurel: '' },
};

// ─── Avatar (real image with graceful initial-letter fallback) ──────────────
const Avatar = ({ src, name, children, style }) => {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', ...style }}>
      {showImage ? (
        <img
          src={src}
          alt={name || 'Student avatar'}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : children}
    </div>
  );
};

Avatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  children: PropTypes.node,
  style: PropTypes.object,
};

// ─── CountUp ────────────────────────────────────────────────────────────────
const CountUp = ({ target = 0, duration = 1100, suffix = '' }) => {
  const safeTarget = Number(target) || 0;
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * safeTarget));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safeTarget, duration]);
  return <span>{val}{suffix}</span>;
};

// ─── StreakBadge ─────────────────────────────────────────────────────────────
const StreakBadge = ({ streak, size = 'sm' }) => {
  const n = Number(streak) || 0;
  if (n < 2) return null;
  const big = size === 'lg';
  return (
    <span title={`${n}-day streak`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: F.mono, fontSize: big ? 10 : 9, fontWeight: 800, color: C.orange, background: C.orangeTint, border: `1px solid ${C.orange}40`, padding: big ? '3px 8px' : '1px 7px', borderRadius: 99, flexShrink: 0 }}>
      🔥{n}
    </span>
  );
};

const PodiumBlock = ({ entry, place, delay, isPlatinum, mounted }) => {
  const heights = { 1: 168, 2: 124, 3: 98 };
  const meta = PODIUM_METALS[place];
  const h = heights[place];
  const avatarSize = place === 1 ? 76 : place === 2 ? 60 : 54;
  const platinumHere = isPlatinum && place === 1;

  const avgScore = Number(entry?.avgScore) || 0;
  const sessionCount = Number(entry?.sessionCount) || 0;
  const ringColor = platinumHere ? C.platinum : meta.color;

  const efficiency = (score, sessions) => {
    const numericScore = Number(score) || 0;
    const numericSessions = Number(sessions) || 0;
    return numericSessions > 0
      ? Math.round((numericScore / numericSessions) * 10) / 10
      : 0;
  };

  return (
    <div
      className={`lb-podium-col${place === 1 ? ' lb-podium-lead' : ''}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
        flex: place === 1 ? 1.28 : 1,
        opacity: mounted ? 1 : 0,
        animation: mounted ? `lbPodiumRise 0.82s cubic-bezier(.22,1.4,.44,1) ${delay}ms both` : 'none',
        position: 'relative',
      }}
    >
      {/* Rank chip floating above avatar */}
      <div
        style={{
          position: 'relative',
          width: place === 1 ? 34 : 28,
          height: place === 1 ? 34 : 28,
          borderRadius: '50%',
          marginBottom: -14,
          zIndex: 3,
          background: `linear-gradient(135deg, ${meta.bright}, ${meta.color})`,
          border: '2.5px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: F.mono, fontSize: place === 1 ? 13 : 11, fontWeight: 800, color: '#fff',
          boxShadow: `0 4px 14px ${meta.glow}`,
        }}
      >
        {place}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16, padding: '0 4px', position: 'relative', zIndex: 2 }}>
        {platinumHere && (
          <div
            title="Top 1% — Platinum band"
            style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              fontFamily: F.mono, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.5px',
              color: '#fff', background: `linear-gradient(135deg, ${C.platinum}, #7B84E8)`,
              padding: '3px 10px', borderRadius: 99, whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(76,87,199,0.4)',
            }}
          >
            ♛ PLATINUM
          </div>
        )}

        <div
          className={place === 1 ? 'lb-avatar-float' : undefined}
          style={{
            position: 'relative',
            width: avatarSize, height: avatarSize, borderRadius: '50%',
            margin: platinumHere ? '18px auto 8px' : '0 auto 8px',
          }}
        >
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            background: `conic-gradient(from 0deg, ${ringColor}, ${meta.bright}, ${ringColor})`,
            opacity: place === 1 ? 0.9 : 0.55,
            filter: 'blur(0.5px)',
          }} />
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            boxShadow: `0 0 0 4px #fff, 0 10px 28px ${meta.glow}`,
          }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}>
            <Avatar src={entry?.avatar} name={entry?.name}>
              <div style={{
                width: '100%', height: '100%',
                background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}CC)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.serif, fontSize: place === 1 ? 28 : place === 2 ? 21 : 18, fontWeight: 600, color: '#fff',
              }}>
                {entry?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
            </Avatar>
          </div>
        </div>

        <div style={{ fontSize: place === 1 ? 22 : 16, marginBottom: 6 }}>{meta.medal}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <div style={{ fontFamily: F.body, fontSize: place === 1 ? 14.5 : 12, fontWeight: 700, color: C.ink, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry?.name ?? '—'}
          </div>
          {entry && <StreakBadge streak={entry.streak} />}
        </div>

        <div style={{ fontFamily: F.display, fontSize: place === 1 ? 28 : 20, fontWeight: 800, color: meta.color, marginTop: 5, lineHeight: 1 }}>
          {entry ? <CountUp target={avgScore} duration={950 + delay} /> : '—'}
          <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, color: C.muted }}>/100</span>
        </div>

        {entry && (
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 5, maxWidth: 116, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '5px auto 0' }}>
            {entry.college || '—'}
          </div>
        )}

        {entry && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '3px 9px', borderRadius: 99, background: C.signalTint, border: `1px solid ${C.lineMd}` }}>
            <span style={{ fontFamily: F.mono, fontSize: 8, color: C.signalDeep, fontWeight: 700 }}>
              ⚡{efficiency(avgScore, sessionCount)}/session
            </span>
          </div>
        )}
      </div>

      {/* Platform */}
      <div
        className="lb-podium-plinth"
        style={{
          width: '100%', height: h, borderRadius: '16px 16px 0 0',
          background: `linear-gradient(180deg, ${meta.tint} 0%, ${meta.color}22 100%)`,
          border: `2px solid ${meta.color}4A`, borderBottom: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 -10px 32px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,0.6)`,
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div className={place === 1 ? 'lb-plinth-sweep' : undefined} style={{
          position: 'absolute', top: 0, left: '-40%', width: '55%', height: '100%',
          background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent)',
          pointerEvents: 'none', transform: 'skewX(-18deg)',
        }} />
        <div style={{
          position: 'absolute', top: 0, left: '30%', width: '40%', height: '100%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
        <span style={{ fontFamily: F.serif, fontSize: 36, fontWeight: 600, color: `${meta.color}66`, userSelect: 'none', position: 'relative', zIndex: 1 }}>
          {meta.label}
        </span>
      </div>
    </div>
  );
};

PodiumBlock.propTypes = {
  entry: PropTypes.shape({
    name: PropTypes.string,
    college: PropTypes.string,
    avatar: PropTypes.string,
    avgScore: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    sessionCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    streak: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  place: PropTypes.oneOf([1, 2, 3]).isRequired,
  delay: PropTypes.number.isRequired,
  isPlatinum: PropTypes.bool,
  mounted: PropTypes.bool,
};

export default PodiumBlock;
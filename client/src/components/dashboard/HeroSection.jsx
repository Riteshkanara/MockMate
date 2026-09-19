import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import Button from '../../components/Button';


const slope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
  const den = values.reduce((a, _, i) => a + Math.pow(i - xm, 2), 0);
  return den ? num / den : 0;
}; 

const HERO_DECOR = [
  { emoji: '⚡', top: '8%',    left: '4%',   size: 24, rotate: -12 },
  { emoji: '🎯', top: '14%',   right: '7%',  size: 28, rotate:  10 },
  { emoji: '💻', top: '48%',   right: '18%', size: 23, rotate:  -8 },
  { emoji: '🚀', bottom: '10%',right: '5%',  size: 29, rotate:   8 },
  { emoji: '🔥', bottom: '9%', left: '34%',  size: 22, rotate:  -8 },
  { emoji: '🏆', top: '26%',   left: '41%',  size: 19, rotate:  12 },
  { emoji: '✦',  bottom: '22%',left: '8%',   size: 20, rotate:  18 },
];

const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 5)  return 'Still up,';
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  if (h < 21) return 'Good evening,';
  return 'Late night grind,';
};


HeroSection.propTypes = {
  user:             PropTypes.object,
  hasData:          PropTypes.bool.isRequired,
  currentTier:      PropTypes.object.isRequired,
  totalInterviews:  PropTypes.number.isRequired,
  strongestDim:     PropTypes.object,
  weakestDim:       PropTypes.object,
  scoreTrend:       PropTypes.array.isRequired,
  starting:         PropTypes.bool.isRequired,
  startQuick:       PropTypes.func.isRequired,
  navigate:         PropTypes.func.isRequired,
  setCoachOpen:     PropTypes.func.isRequired,
  irs:              PropTypes.number.isRequired,
  apiTiers:         PropTypes.array,
  currentTierLabel: PropTypes.string.isRequired,
  nextTier:         PropTypes.object,
  irsGap:           PropTypes.number.isRequired,
  analytics:        PropTypes.object,
  averageScore:     PropTypes.number.isRequired,
  bestScore:        PropTypes.number.isRequired,
  streakDays:       PropTypes.number.isRequired,
  delta:            PropTypes.number.isRequired,
  archetype:        PropTypes.object,
  tierLadder: PropTypes.node.isRequired,  
  sparkline:  PropTypes.node.isRequired,
};

// Component 
const S_HERO = {
  hero:     { position: 'relative', overflow: 'hidden', padding: '32px 36px', marginBottom: 20, borderRadius: 22, background: `linear-gradient(135deg, ${C.blue500} 0%, ${C.blue600} 45%, ${C.cyan500} 100%)`, boxShadow: C.shadowLg },
  heroGrid: { position: 'relative', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 44, alignItems: 'center' },

  heroKicker:      { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '1.8px', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  heroH1:          { margin: '14px 0 0', fontFamily: F.display, fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1.22, letterSpacing: '-0.8px', maxWidth: 620 },
  heroSub:         { margin: '15px 0 0', fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.85)', maxWidth: 560, fontWeight: 400 },
  heroActions:     { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  heroTopLine:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  heroLivePill:    { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.74)', textTransform: 'uppercase' },
  heroLiveDot:     { width: 6, height: 6, borderRadius: '50%', background: '#79F2B2', boxShadow: '0 0 0 3px rgba(121,242,178,0.14)', animation: 'livePulse 2.2s ease-in-out infinite' },
  heroMetricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 18 },
  heroMetricCard:  { minWidth: 0, padding: '11px 12px', borderRadius: 12, background: 'rgba(2,20,55,0.19)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(5px)' },
  heroMetricTop:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', fontFamily: F.mono, fontSize: 8, letterSpacing: '0.7px' },
  heroMetricValue: { marginTop: 6, fontFamily: F.display, fontSize: 21, fontWeight: 900, color: '#fff', lineHeight: 1 },
  heroMetricFoot:  { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontFamily: F.mono, fontSize: 8.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  heroSignalRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' },
  heroSignalMain:  { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  heroSignalLabel: { fontFamily: F.mono, fontSize: 8, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.44)' },
  heroSignalValue: { marginTop: 3, fontSize: 11, fontWeight: 800, color: '#fff' },
  heroDeltaChip:   { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 9, background: 'rgba(255,255,255,0.08)', flexShrink: 0 },
  heroDeltaValue:  { fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: '#fff' },
  heroDeltaLabel:  { marginTop: 2, fontFamily: F.mono, fontSize: 7.5, color: 'rgba(255,255,255,0.44)' },
};

function HeroSection({
  user, hasData, currentTier, totalInterviews, strongestDim, weakestDim,
  scoreTrend, starting, startQuick, navigate, setCoachOpen,
  irs, apiTiers, currentTierLabel, nextTier, irsGap, analytics,
  averageScore, bestScore, streakDays, delta, archetype,tierLadder, sparkline
}) {
  const recentScores = scoreTrend.slice(-8).map(s => s.score || 0);
  const recentAvg    = recentScores.length ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : 0;
  const recentSlope  = slope(recentScores);
  const firstName    = user?.name?.split(' ')[0] || '';
  const nextGapLabel = nextTier ? `${irsGap} pts to ${nextTier.label}` : 'Top tier unlocked';

  const metricCards = [
    { label: 'IRS',     icon: '◉', value: irs,         small: '/100', foot: nextGapLabel },
    { label: 'AVERAGE', icon: '◌', value: averageScore, small: '/100', foot: 'all sessions' },
    { label: 'BEST',    icon: '★', value: bestScore,    small: '/100', foot: 'personal ceiling' },
    { label: 'STREAK',  icon: '🔥',value: streakDays,   small: 'd',    foot: archetype?.label ?? 'building pattern' },
  ];

  return (
    <section style={{ ...S_HERO.hero, position: 'relative' }} className="mm-hero">
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.38, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(to bottom, black, transparent 88%)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 88%)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: -130, right: -90, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,220,255,0.24), transparent 70%)', pointerEvents: 'none', animation: 'heroGlowFloat 9s ease-in-out infinite' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: -150, left: '28%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%)', pointerEvents: 'none', animation: 'heroGlowFloat 11s ease-in-out infinite reverse' }} />

      {HERO_DECOR.map((item, i) => (
        <span key={i} aria-hidden="true" style={{ position: 'absolute', top: item.top, right: item.right, bottom: item.bottom, left: item.left, fontSize: item.size, lineHeight: 1, opacity: 0.13, filter: 'saturate(0.9)', transform: `rotate(${item.rotate}deg)`, pointerEvents: 'none', animation: `heroEmojiFloat ${6 + i * 0.45}s ease-in-out ${i * 0.25}s infinite` }}>
          {item.emoji}
        </span>
      ))}

      <div style={{ ...S_HERO.heroGrid, gridTemplateColumns: '300px 1fr' }} className="mm-hero-grid">
        {tierLadder}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={S_HERO.heroTopLine}>
            <div style={S_HERO.heroKicker}>{timeGreeting()} your next interview rep</div>
            <div style={S_HERO.heroLivePill}><span style={S_HERO.heroLiveDot} /> live readiness</div>
          </div>

          <h1 style={S_HERO.heroH1}>
            {firstName ? `${firstName}, ` : ''}
            {!hasData ? "let's build your readiness profile." : `you're trending toward ${currentTier.label}.`}
          </h1>

          <p style={{ ...S_HERO.heroSub, maxWidth: 650 }}>
            {!hasData
              ? 'Your dashboard becomes a live preparation cockpit after the first mock. Scores, streaks, dimensions and tier movement all update from real interview sessions.'
              : `You have ${totalInterviews} session${totalInterviews !== 1 ? 's' : ''} logged, with ${strongestDim?.label ?? '—'} leading and ${weakestDim?.label ?? '—'} as the biggest improvement lever.`}
          </p>

          <div style={S_HERO.heroMetricsGrid} className="mm-hero-metrics">
            {metricCards.map(m => (
              <div key={m.label} style={S_HERO.heroMetricCard}>
                <div style={S_HERO.heroMetricTop}><span>{m.label}</span><span>{m.icon}</span></div>
                <div style={S_HERO.heroMetricValue}>{m.value}<small>{m.small}</small></div>
                <div style={S_HERO.heroMetricFoot}>{m.foot}</div>
              </div>
            ))}
          </div>

          <div style={S_HERO.heroSignalRow}>
            <div style={S_HERO.heroSignalMain}>
              {sparkline}
              <div>
                <div style={S_HERO.heroSignalLabel}>recent performance</div>
                <div style={S_HERO.heroSignalValue}>
                  {recentAvg || '—'} avg
                  <span style={{ color: recentSlope >= 0 ? C.green : C.orange, marginLeft: 7 }}>
                    {recentScores.length >= 2 ? `${recentSlope >= 0 ? '↗' : '↘'} ${Math.abs(recentSlope).toFixed(1)}/session` : '—'}
                  </span>
                </div>
              </div>
            </div>
            <div style={S_HERO.heroDeltaChip}>
              <span style={{ fontSize: 14 }}>{delta >= 0 ? '↗' : '↘'}</span>
              <div>
                <div style={S_HERO.heroDeltaValue}>{delta >= 0 ? '+' : ''}{delta} pts</div>
                <div style={S_HERO.heroDeltaLabel}>last session</div>
              </div>
            </div>
          </div>

          <div style={S_HERO.heroActions}>
            <button
              onClick={() => startQuick()}
              disabled={starting}
              style={{ padding: '12px 22px', borderRadius: 12, border: 'none', cursor: starting ? 'default' : 'pointer', background: '#fff', color: C.blue600, fontWeight: 800, fontSize: 13.5, fontFamily: F.body, boxShadow: '0 8px 20px rgba(0,0,0,0.18)', opacity: starting ? 0.7 : 1, transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 26px rgba(0,0,0,0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.18)'; }}
            >
              {starting ? 'Launching…' : hasData ? 'New mock interview' : 'Run first interview'}
            </button>
            {hasData && <Button surface="dark" variant="ghost" onClick={() => navigate('/analytics')}>Full analytics</Button>}
            {hasData && <Button surface="dark" variant="ghost" onClick={() => setCoachOpen(true)}>AI Coach</Button>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
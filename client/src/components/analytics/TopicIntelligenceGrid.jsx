import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';

// — Analytics palette (local copy)
const C = {
  ...CT,
  violet:      CT.blue500,
  violetLight: CT.blue300,
  violetTint:  CT.blue50,
  violetMid:   CT.blue600,
  dimColors: {
    technical:      CT.blue500,
    problemSolving: CT.blue500,
    communication:  CT.green,
    behavioral:     CT.amber,
    design:         CT.cyan600,
    fundamentals:   CT.red,
  },
};

// — Helpers (private to this file)
const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

const getTier = (s) => {
  const n = Number(s) || 0;
  if (n >= 80) return { label: 'Mastered', color: C.green,  glow: 'rgba(5,150,105,.30)',  bg: C.greenTint,  key: 'mastered' };
  if (n >= 60) return { label: 'Solid',    color: C.blue500, glow: 'rgba(26,110,255,.28)', bg: C.blue50,     key: 'solid'    };
  if (n >= 40) return { label: 'Building', color: C.amber,   glow: 'rgba(217,119,6,.28)', bg: C.amberTint,  key: 'building' };
  return         { label: 'Weak',    color: C.red,    glow: 'rgba(220,38,38,.30)',  bg: C.redTint,    key: 'weak'     };
};

const getTrendLabel = (t) => {
  if (!t || t === 0) return { icon: '→', color: C.muted, word: 'Stable' };
  if (t > 0)         return { icon: '↑', color: C.green, word: `+${t} pts` };
  return               { icon: '↓', color: C.red,   word: `${t} pts` };
};

const hexPath = (r) => {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i);
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
};

// — Dev seed fallback (remove in production)
const SEED_TOPICS = [
  { topic: 'Arrays & Hashing',    avgScore: 84, sessionCount: 12, trend:  6, lastScore: 88, sessions: [72,76,80,82,84,86,88] },
  { topic: 'Dynamic Programming', avgScore: 51, sessionCount:  9, trend: -3, lastScore: 48, sessions: [60,55,58,52,50,53,48] },
  { topic: 'Trees & Graphs',      avgScore: 73, sessionCount: 11, trend:  4, lastScore: 77, sessions: [62,66,70,71,74,75,77] },
  { topic: 'System Design',       avgScore: 38, sessionCount:  6, trend: -5, lastScore: 34, sessions: [45,42,40,38,36,35,34] },
  { topic: 'OOP Concepts',        avgScore: 91, sessionCount: 14, trend:  2, lastScore: 93, sessions: [85,87,88,90,91,92,93] },
  { topic: 'SQL & Databases',     avgScore: 67, sessionCount:  8, trend:  8, lastScore: 73, sessions: [52,55,60,63,67,70,73] },
  { topic: 'OS Fundamentals',     avgScore: 44, sessionCount:  7, trend:  1, lastScore: 45, sessions: [40,41,43,44,44,45,45] },
  { topic: 'Recursion',           avgScore: 78, sessionCount: 10, trend:  3, lastScore: 81, sessions: [68,70,73,76,77,79,81] },
  { topic: 'Bit Manipulation',    avgScore: 29, sessionCount:  4, trend: -8, lastScore: 22, sessions: [38,34,30,26,22] },
  { topic: 'Greedy Algorithms',   avgScore: 62, sessionCount:  7, trend:  5, lastScore: 67, sessions: [50,53,57,60,63,65,67] },
  { topic: 'Two Pointers',        avgScore: 88, sessionCount: 13, trend:  1, lastScore: 89, sessions: [80,83,84,86,87,88,89] },
  { topic: 'Backtracking',        avgScore: 55, sessionCount:  8, trend:  6, lastScore: 60, sessions: [42,45,48,52,55,57,60] },
];

// ─────────────────────────────────────────────
// Sparkline (private)
// ─────────────────────────────────────────────
const Sparkline = ({ values = [], color = C.blue500, width = 140, height = 38 }) => {
  if (!values.length) return null;
  const min   = Math.min(...values);
  const max   = Math.max(...values);
  const range = max - min || 1;
  const pad   = 3;
  const W     = width  - pad * 2;
  const H     = height - pad * 2;
  const pts   = values.map((v, i) => [
    pad + (i / (values.length - 1)) * W,
    pad + H - ((v - min) / range) * H,
  ]);
  const d      = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const fill   = [...pts, [pts[pts.length - 1][0], pad + H], [pts[0][0], pad + H]];
  const fillD  = fill.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
  const gradId = `spk-fill-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.5" fill={color} />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="6"   fill={color} fillOpacity="0.18" />
    </svg>
  );
};
Sparkline.propTypes = {
  values: PropTypes.arrayOf(PropTypes.number),
  color:  PropTypes.string,
  width:  PropTypes.number,
  height: PropTypes.number,
};

// ─────────────────────────────────────────────
// HexCell (private)
// ─────────────────────────────────────────────
const HexCell = ({ data, index, isSelected, onClick, reducedMotion }) => {
  const tier = getTier(data.avgScore);
  const trnd = getTrendLabel(data.trend);
  const minR = 44, maxR = 62, minSess = 4, maxSess = 14;
  const r    = minR + ((Math.min(data.sessionCount, maxSess) - minSess) / (maxSess - minSess)) * (maxR - minR);
  const dim  = r * 2 + 8;
  const [mounted, setMounted] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (reducedMotion) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(true), index * 60);
    return () => clearTimeout(t);
  }, [index, reducedMotion]);

  useEffect(() => { setPulsing(isSelected); }, [isSelected]);

  const path      = hexPath(r);
  const arcR      = r - 7;
  const circ      = 2 * Math.PI * arcR;
  const pct       = Math.max(0, Math.min(100, data.avgScore));
  const arcOffset = circ - (pct / 100) * circ;

  return (
    <button onClick={onClick} aria-pressed={isSelected}
      aria-label={`${data.topic}: ${data.avgScore} score, ${tier.label}`}
      className="tig-hex-btn"
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: dim, height: dim, flexShrink: 0,
        opacity:   mounted ? 1 : 0,
        transform: mounted ? 'scale(1) translateY(0)' : 'scale(0.72) translateY(12px)',
        transition: reducedMotion ? 'none' : `opacity .4s ease ${index * 60}ms, transform .5s cubic-bezier(.22,1,.36,1) ${index * 60}ms`,
        outline: 'none', position: 'relative', zIndex: isSelected ? 2 : 1,
      }}>
      <svg width={dim} height={dim} viewBox={`${-dim/2} ${-dim/2} ${dim} ${dim}`}
        style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <radialGradient id={`hg-${index}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%"   stopColor={tier.color} stopOpacity={isSelected ? '0.28' : '0.12'} />
            <stop offset="100%" stopColor={tier.color} stopOpacity={isSelected ? '0.18' : '0.04'} />
          </radialGradient>
          <filter id={`hf-${index}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={isSelected ? '4' : '2'} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {isSelected && (
          <path d={hexPath(r + 5)} fill="none" stroke={tier.color}
            strokeWidth="2" strokeOpacity="0.35" style={{ filter: 'blur(4px)' }} />
        )}
        {pulsing && !reducedMotion && (
          <path d={hexPath(r + 10)} fill="none" stroke={tier.color}
            strokeWidth="1.5" strokeOpacity="0"
            style={{ animation: 'tig-pulse 1.8s ease-out forwards' }} />
        )}

        <path d={path} fill={`url(#hg-${index})`}
          stroke={isSelected ? tier.color : tier.color + '55'}
          strokeWidth={isSelected ? 2 : 1.5}
          style={{
            transition: reducedMotion ? 'none' : 'stroke .22s ease, stroke-width .22s ease',
            filter: isSelected ? `drop-shadow(0 0 8px ${tier.glow})` : 'none',
          }} />

        <circle cx="0" cy="0" r={arcR} fill="none" stroke={tier.color} strokeWidth="2.5" strokeOpacity="0.10" />
        <circle cx="0" cy="0" r={arcR} fill="none" stroke={tier.color} strokeWidth="2.5" strokeOpacity="0.75"
          strokeDasharray={circ} strokeDashoffset={arcOffset}
          strokeLinecap="round" transform="rotate(-90)"
          style={{ transition: reducedMotion ? 'none' : 'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)' }} />

        <text textAnchor="middle" dominantBaseline="middle" y="-4" fill={tier.color}
          style={{ fontFamily: F.display, fontSize: r > 54 ? '20px' : '17px', fontWeight: 900,
            letterSpacing: '-0.04em',
            filter: isSelected ? `drop-shadow(0 0 6px ${tier.glow})` : 'none' }}>
          {data.avgScore}
        </text>
        <text textAnchor="middle" dominantBaseline="middle" y="13" fill={trnd.color}
          style={{ fontFamily: F.mono, fontSize: '9px', fontWeight: 700 }}>
          {trnd.icon} {trnd.word}
        </text>
      </svg>

      <div style={{
        position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
        color: isSelected ? tier.color : C.sub,
        fontFamily: F.body, fontSize: '10.5px', fontWeight: isSelected ? 800 : 600,
        letterSpacing: '-0.01em',
        transition: reducedMotion ? 'none' : 'color .2s ease, font-weight .2s ease',
        pointerEvents: 'none',
      }}>
        {data.topic.length > 16 ? data.topic.slice(0, 15) + '…' : data.topic}
      </div>
    </button>
  );
};
HexCell.propTypes = {
  data: PropTypes.shape({
    topic:        PropTypes.string.isRequired,
    avgScore:     PropTypes.number.isRequired,
    sessionCount: PropTypes.number.isRequired,
    trend:        PropTypes.number,
    lastScore:    PropTypes.number,
    sessions:     PropTypes.arrayOf(PropTypes.number),
  }).isRequired,
  index:         PropTypes.number.isRequired,
  isSelected:    PropTypes.bool.isRequired,
  onClick:       PropTypes.func.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
};

// ─────────────────────────────────────────────
// DetailPanel (private)
// ─────────────────────────────────────────────
const DetailPanel = ({ data, onClose, onDrill, reducedMotion }) => {
  const tier = getTier(data.avgScore);
  const trnd = getTrendLabel(data.trend);

  const drillSuggestions = {
    mastered: ['Tackle hard LeetCode variants', 'Attempt timed mock without hints', 'Teach-back: explain in 90 sec'],
    solid:    ['Focus on edge cases', 'Try company-tagged variants', 'Work 2 unseen problems this week'],
    building: ['Redo the pattern from scratch', 'Slow down: write the invariant first', 'Watch one focused 20-min tutorial'],
    weak:     ['Start with concept recall — no code yet', 'Solve 3 easy variants back-to-back', 'Flag for SOS session with Coach'],
  };
  const drills = drillSuggestions[tier.key] || drillSuggestions.building;

  const statItems = [
    { label: 'Avg Score', value: data.avgScore,       color: tier.color },
    { label: 'Sessions',  value: data.sessionCount,   color: C.blue500 },
    { label: 'Last',      value: data.lastScore ?? '—', color: data.lastScore >= data.avgScore ? C.green : C.red },
  ];

  return (
    <div style={{
      width: '100%', padding: '20px', borderRadius: '20px',
      border: `1.5px solid ${tier.color}30`,
      background: `linear-gradient(150deg, ${tier.bg} 0%, #fff 55%)`,
      boxShadow: `0 16px 48px ${tier.glow}, 0 4px 14px rgba(0,31,107,.06), inset 0 1px 0 rgba(255,255,255,.9)`,
      animation: reducedMotion ? 'none' : 'tig-panel-in .28s cubic-bezier(.22,1,.36,1)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px',
        borderRadius: '0 0 4px 4px',
        background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
        opacity: 0.6 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: '15px', fontWeight: 900, color: C.text,
            letterSpacing: '-0.03em', lineHeight: 1.1 }}>{data.topic}</div>
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
              borderRadius: '999px', background: tier.color + '18', border: `1px solid ${tier.color}40`,
              color: tier.color, fontFamily: F.mono, fontSize: '9px', fontWeight: 800 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: tier.color,
                boxShadow: `0 0 6px ${tier.color}` }} />
              {tier.label}
            </span>
            <span style={{ color: trnd.color, fontFamily: F.mono, fontSize: '9px', fontWeight: 700 }}>
              {trnd.icon} {trnd.word}
            </span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="tig-close-btn"
          style={{ width: 28, height: 28, borderRadius: 9, border: `1px solid ${C.border}`,
            background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
            color: C.muted, flexShrink: 0, transition: 'all .16s ease',
            fontFamily: F.mono, fontSize: '12px' }}>✕</button>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 16 }}>
        {statItems.map(({ label, value, color }) => (
          <div key={label} style={{ padding: '9px 8px', borderRadius: 12, background: '#fff',
            border: `1px solid ${C.border}`, textAlign: 'center' }}>
            <div style={{ fontFamily: F.display, fontSize: '17px', fontWeight: 900, color,
              letterSpacing: '-0.04em' }}>{value}</div>
            <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: '7.5px', fontWeight: 700,
              color: C.muted, letterSpacing: '0.4px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      {data.sessions?.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: F.mono, fontSize: '8px', fontWeight: 700, color: C.muted,
            marginBottom: 6, letterSpacing: '0.6px' }}>SCORE TRAJECTORY</div>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: '#fff',
            border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Sparkline values={data.sessions} color={tier.color} width={140} height={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.mono, fontSize: '8px', color: C.muted, marginBottom: 3 }}>
                {data.sessions.length} sessions
              </div>
              <div style={{ fontFamily: F.display, fontSize: '12px', fontWeight: 700, color: C.sub }}>
                {data.sessions[data.sessions.length - 1] > data.sessions[0]
                  ? 'Improving over time'
                  : data.sessions[data.sessions.length - 1] === data.sessions[0]
                  ? 'Consistent performance'
                  : 'Needs attention'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next actions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: F.mono, fontSize: '8px', fontWeight: 700, color: C.muted,
          marginBottom: 6, letterSpacing: '0.6px' }}>NEXT ACTIONS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {drills.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${C.border}` }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, marginTop: 1,
                background: tier.color + '18', color: tier.color, display: 'grid', placeItems: 'center',
                fontFamily: F.mono, fontSize: '8px', fontWeight: 800 }}>{i + 1}</span>
              <span style={{ fontFamily: F.body, fontSize: '11.5px', fontWeight: 500,
                color: C.sub, lineHeight: 1.4 }}>{d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drill CTA */}
      <button onClick={() => onDrill(data.topic)} className="tig-drill-btn"
        style={{ width: '100%', height: 42, borderRadius: 12, border: 'none',
          background: `linear-gradient(150deg, ${tier.color}ee 0%, ${tier.color} 100%)`,
          color: '#fff', cursor: 'pointer', fontFamily: F.body, fontSize: '12.5px', fontWeight: 700,
          letterSpacing: '-0.01em',
          boxShadow: `0 8px 22px ${tier.glow}, inset 0 1px 0 rgba(255,255,255,.30)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: reducedMotion ? 'none' : 'transform .2s ease, box-shadow .2s ease',
          position: 'relative', overflow: 'hidden' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21M8.5 21h7" />
        </svg>
        Start Drill Session
      </button>
    </div>
  );
};
DetailPanel.propTypes = {
  data: PropTypes.shape({
    topic:        PropTypes.string.isRequired,
    avgScore:     PropTypes.number.isRequired,
    sessionCount: PropTypes.number.isRequired,
    lastScore:    PropTypes.number,
    trend:        PropTypes.number,
    sessions:     PropTypes.arrayOf(PropTypes.number),
  }).isRequired,
  onClose:       PropTypes.func.isRequired,
  onDrill:       PropTypes.func.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
};

// ─────────────────────────────────────────────
// TIGLegend (private)
// ─────────────────────────────────────────────
const TIGLegend = () => {
  const tiers = [
    { label: 'Mastered', color: C.green,  range: '80+' },
    { label: 'Solid',    color: C.blue500, range: '60–79' },
    { label: 'Building', color: C.amber,   range: '40–59' },
    { label: 'Weak',     color: C.red,     range: '< 40' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      {tiers.map(({ label, color, range }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 24, height: 24, display: 'inline-block',
            background: `${color}18`, border: `1.5px solid ${color}55`, borderRadius: 5 }} />
          <span style={{ fontFamily: F.body, fontSize: '11px', fontWeight: 600, color: C.sub }}>
            {label}
            <span style={{ marginLeft: 4, fontFamily: F.mono, fontSize: '9px', color: C.muted }}>({range})</span>
          </span>
        </div>
      ))}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted }}>Cell size</span>
        <span style={{ width: 14, height: 14, borderRadius: 3, background: C.border }} />
        <span style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted }}>= session count</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// TIGSummaryBar (private)
// ─────────────────────────────────────────────
const TIGSummaryBar = ({ topics }) => {
  const counts = { mastered: 0, solid: 0, building: 0, weak: 0 };
  topics.forEach(t => { counts[getTier(t.avgScore).key]++; });
  const total = topics.length;
  const bars  = [
    { key: 'mastered', color: C.green   },
    { key: 'solid',    color: C.blue500 },
    { key: 'building', color: C.amber   },
    { key: 'weak',     color: C.red     },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: C.border, overflow: 'hidden', display: 'flex' }}>
        {bars.map(({ key, color }) =>
          counts[key] > 0 ? (
            <div key={key} style={{ width: `${(counts[key] / total) * 100}%`, height: '100%',
              background: color, borderRadius: 999,
              transition: 'width .8s cubic-bezier(.22,1,.36,1)' }} />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: F.mono, fontSize: '9px', fontWeight: 700, color: C.green }}>{counts.mastered} mastered</span>
        <span style={{ fontFamily: F.mono, fontSize: '9px', fontWeight: 700, color: C.red }}>{counts.weak} weak</span>
      </div>
    </div>
  );
};
TIGSummaryBar.propTypes = {
  topics: PropTypes.arrayOf(PropTypes.shape({ avgScore: PropTypes.number })).isRequired,
};

// ─────────────────────────────────────────────
// TopicIntelligenceGrid (exported)
// ─────────────────────────────────────────────
TopicIntelligenceGrid.propTypes = {
  topicData: PropTypes.arrayOf(PropTypes.shape({
    topic:        PropTypes.string,
    avgScore:     PropTypes.number,
    sessionCount: PropTypes.number,
    trend:        PropTypes.number,
    lastScore:    PropTypes.number,
    sessions:     PropTypes.arrayOf(PropTypes.number),
  })),
  onDrill: PropTypes.func,
};

function TopicIntelligenceGrid({ topicData, onDrill }) {
  const topics = topicData?.length ? topicData : SEED_TOPICS;
  const [selected, setSelected]           = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const mq      = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleSelect = useCallback((topic) => {
    setSelected(prev => prev?.topic === topic.topic ? null : topic);
  }, []);

  const handleDrill = useCallback((topicName) => {
    if (onDrill) onDrill(topicName);
  }, [onDrill]);

  const tierOrder = { weak: 0, building: 1, solid: 2, mastered: 3 };
  const sorted    = [...topics].sort((a, b) =>
    tierOrder[getTier(a.avgScore).key] - tierOrder[getTier(b.avgScore).key]
  );

  return (
    <>
      <style>{`
        @keyframes tig-pulse {
          0%   { stroke-opacity: 0.6; stroke-dashoffset: 0; }
          100% { stroke-opacity: 0; stroke-dashoffset: -60; }
        }
        @keyframes tig-panel-in {
          from { opacity: 0; transform: translateX(14px) scale(.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        .tig-hex-btn:focus-visible  { outline: 2px solid #1A6EFF; outline-offset: 4px; border-radius: 6px; }
        .tig-drill-btn:hover        { transform: translateY(-2px); }
        .tig-drill-btn:active       { transform: scale(.97); }
        .tig-close-btn:hover        { background: #FEF2F2; border-color: #fca5a5; color: #DC2626; }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
        @media (max-width: 640px) {
          .tig-grid  { grid-template-columns: 1fr !important; }
          .tig-panel { position: static !important; top: auto !important; }
        }
      `}</style>

      <div style={{ padding: '24px', borderRadius: '24px', background: C.card,
        border: `1px solid ${C.border}`,
        boxShadow: '0 8px 32px rgba(0,31,107,.07), 0 2px 8px rgba(0,31,107,.04)',
        marginBottom: 18 }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: F.display, fontSize: '17px', fontWeight: 900,
                color: C.text, letterSpacing: '-0.04em' }}>Topic Intelligence</h2>
              <p style={{ margin: '4px 0 0', fontFamily: F.body, fontSize: '12px', color: C.muted, fontWeight: 500 }}>
                {topics.length} topics mapped · click any cell to drill down
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '6px 10px', borderRadius: 10, background: C.bgDeep, border: `1px solid ${C.border}` }}>
              {[18, 24, 30].map((r, i) => (
                <div key={i} style={{ width: r, height: r, borderRadius: '50%',
                  background: `${C.blue500}${['12','1a','24'][i]}`,
                  border: `1.5px solid ${C.blue500}${['30','44','66'][i]}` }} />
              ))}
              <span style={{ fontFamily: F.mono, fontSize: '8px', color: C.muted, fontWeight: 700 }}>sessions</span>
            </div>
          </div>
          <TIGSummaryBar topics={topics} />
        </div>

        {/* Grid + Panel */}
        <div className="tig-grid"
          style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 240px' : '1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '36px 18px',
              padding: '12px 8px 36px', justifyContent: 'flex-start' }}>
              {sorted.map((topic, i) => (
                <HexCell key={topic.topic} data={topic} index={i}
                  isSelected={selected?.topic === topic.topic}
                  onClick={() => handleSelect(topic)}
                  reducedMotion={reducedMotion} />
              ))}
            </div>
          </div>

          {selected && (
            <div ref={panelRef} className="tig-panel" style={{ position: 'sticky', top: 100 }}>
              <DetailPanel data={selected} onClose={() => setSelected(null)}
                onDrill={handleDrill} reducedMotion={reducedMotion} />
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 4, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <TIGLegend />
        </div>
      </div>
    </>
  );
}

export default TopicIntelligenceGrid;
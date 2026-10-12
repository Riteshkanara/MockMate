import PropTypes from 'prop-types';
import { useId } from 'react';
import { F, CARD_W, MIN_CANDIDATES_FOR_PERCENT, clamp, round } from './PlayerCard';

// "Arena" — the immersive dark-blue player card.
// Concept: your interview prep as a golf-style course. Sessions are holes along a winding
// fairway, skills are glowing tick meters, the readiness score is a speedometer dial.
// Export-safe like PlayerCard: inline styles, plain gradients and inline SVG only
// (no backdrop-filter, no blend modes, no external images/fonts).
export const ARENA_BG = '#050F2E';

const ARENA = {
  ROOKIE:     { a: '#FFB547', b: '#FF7A45' },
  CHALLENGER: { a: '#22D3EE', b: '#3B82F6' },
  ELITE:      { a: '#FFD60A', b: '#FF9F1C' },
  LEGEND:     { a: '#B28BFF', b: '#4DE3FF' },
};
const INK = '#FFFFFF';
const SUB = 'rgba(214,228,255,0.80)';
const MUTED = 'rgba(165,190,240,0.66)';
const LIME = '#B6FF3B';
const PINK = '#FF4D8D';
const AMBER = '#FFC53D';
const DEEP = '#04122E';
const COMPACT_MIN_H = 525;
const STORY_MIN_H = 746;

const glass = {
  borderRadius: 22,
  background: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
  border: '1px solid rgba(255,255,255,0.16)',
};

const zoneColor = (pct) => (pct < 45 ? PINK : pct < 70 ? AMBER : LIME);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerpHex = (a, b, t) => {
  const A = hex(a); const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};

const DIM_SHORT = {
  'Technical Depth': 'Technical', 'Problem Solving': 'Problem Solving', Communication: 'Communication',
  Behavioral: 'Behavioral', 'System Design': 'System Design', 'CS Fundamentals': 'CS Fundamentals',
};

// ─── Topographic course background (SVG) ────────────────────────────────────
const contour = (cx, cy, r, ph) => {
  const pts = [];
  for (let k = 0; k < 40; k += 1) {
    const a = (k / 40) * Math.PI * 2;
    const rad = r * (1 + 0.13 * Math.sin(3 * a + ph) + 0.07 * Math.sin(5 * a + ph * 1.7));
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad * 0.82).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

const CourseBackdrop = ({ a }) => {
  const rings = [];
  [[330, 150, 0.4], [70, 560, 1.9], [350, 820, 3.1]].forEach(([cx, cy, ph], g) => {
    for (let i = 1; i <= 7; i += 1) rings.push({ d: contour(cx, cy, 26 + i * 24, ph + i * 0.12), o: 0.2 - i * 0.02, k: `${g}-${i}` });
  });
  return (
    <svg width="100%" height="100%" viewBox="0 0 420 940" preserveAspectRatio="xMidYMin slice" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {rings.map((r) => <path key={r.k} d={r.d} fill="none" stroke="#7DD3FC" strokeWidth="1" opacity={r.o} />)}
      {/* winding fairway */}
      <path d="M340 -10 C400 120 120 170 175 310 S345 470 245 640 S95 790 200 960" fill="none" stroke="rgba(120,255,200,0.07)" strokeWidth="58" strokeLinecap="round" />
      <path d="M340 -10 C400 120 120 170 175 310 S345 470 245 640 S95 790 200 960" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.4" strokeDasharray="3 9" strokeLinecap="round" />
      {/* bunkers + greens */}
      <ellipse cx="78" cy="238" rx="34" ry="20" fill="rgba(255,200,120,0.10)" />
      <ellipse cx="352" cy="428" rx="30" ry="17" fill="rgba(255,200,120,0.09)" />
      <ellipse cx="60" cy="700" rx="38" ry="22" fill="rgba(255,200,120,0.08)" />
      <circle cx="340" cy="702" r="36" fill={`${a}14`} />
    </svg>
  );
};
CourseBackdrop.propTypes = { a: PropTypes.string.isRequired };

// ─── Speedometer dial made of glowing ticks ─────────────────────────────────
const Dial = ({ score, a, b }) => {
  const gid = `ar${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const size = 250; const cx = size / 2; const cy = size / 2;
  const N = 60; const lit = Math.round((clamp(score) / 100) * N);
  const ticks = Array.from({ length: N }, (_, i) => {
    const th = ((135 + (270 * i) / (N - 1)) * Math.PI) / 180;
    const major = i % 5 === 0;
    const r2 = 116; const r1 = major ? 94 : 100;
    const on = i < lit;
    const tip = on && i === lit - 1;
    return {
      i, on, tip, major,
      x1: cx + Math.cos(th) * r1, y1: cy + Math.sin(th) * r1,
      x2: cx + Math.cos(th) * (tip ? r2 + 4 : r2), y2: cy + Math.sin(th) * (tip ? r2 + 4 : r2),
      col: on ? lerpHex(a, b, i / (N - 1)) : 'rgba(255,255,255,0.16)',
    };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={a} stopOpacity="0.30" />
          <stop offset="60%" stopColor={b} stopOpacity="0.10" />
          <stop offset="100%" stopColor={b} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={size / 2} fill={`url(#${gid})`} />
      <circle cx={cx} cy={cy} r="82" fill="rgba(4,18,46,0.55)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="72" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 6" />
      {ticks.map((t) => (
        <line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.col} strokeWidth={t.tip ? 4.5 : 3.2} strokeLinecap="round" opacity={t.on ? 1 : t.major ? 0.9 : 0.7} />
      ))}
    </svg>
  );
};
Dial.propTypes = { score: PropTypes.number.isRequired, a: PropTypes.string.isRequired, b: PropTypes.string.isRequired };

// ─── Tick meter (like the "tee shot" bar in the reference) ──────────────────
const TickBar = ({ value, n = 46, h = 16, flat }) => {
  const step = 6;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${n * step - 3} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {Array.from({ length: n }, (_, i) => {
        const pct = ((i + 1) / n) * 100;
        const on = value != null && pct <= clamp(value) + 0.01;
        const col = flat || zoneColor(clamp(value));
        return <rect key={i} x={i * step} y={on ? 0 : h * 0.3} width="3" height={on ? h : h * 0.4} rx="1.5" fill={on ? col : 'rgba(255,255,255,0.16)'} />;
      })}
    </svg>
  );
};
TickBar.propTypes = { value: PropTypes.number, n: PropTypes.number, h: PropTypes.number, flat: PropTypes.string };

// ─── Score trend drawn as a fairway with a hole per session ─────────────────
const Fairway = ({ trend, a, b }) => {
  const gid = `af${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pts = (trend || []).slice(-10).map((s) => clamp(s.score));
  if (pts.length < 2) return null;
  const W = 372; const H = 104; const padX = 16;
  const min = Math.min(...pts); const max = Math.max(...pts, min + 1);
  const xy = pts.map((v, i) => [padX + (i / (pts.length - 1)) * (W - padX * 2), H - 20 - ((v - min) / (max - min)) * (H - 52)]);
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i += 1) {
    const [x0, y0] = xy[i - 1]; const [x1, y1] = xy[i]; const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  const last = xy[xy.length - 1];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a} stopOpacity="0.38" />
          <stop offset="100%" stopColor={b} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${last[0]},${H} L${xy[0][0]},${H}Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={a} strokeOpacity="0.28" strokeWidth="11" strokeLinecap="round" />
      <path d={d} fill="none" stroke={a} strokeWidth="3" strokeLinecap="round" />
      {xy.slice(0, -1).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={DEEP} stroke="#fff" strokeWidth="2" />)}
      {/* flag on the latest hole */}
      <line x1={last[0]} y1={last[1]} x2={last[0]} y2={last[1] - 24} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d={`M${last[0]},${last[1] - 24} L${last[0] + 15},${last[1] - 18} L${last[0]},${last[1] - 12}Z`} fill={LIME} />
      <circle cx={last[0]} cy={last[1]} r="5.5" fill={LIME} stroke={DEEP} strokeWidth="2" />
    </svg>
  );
};
Fairway.propTypes = { trend: PropTypes.array, a: PropTypes.string.isRequired, b: PropTypes.string.isRequired };

const Label = ({ children, color = MUTED, style }) => (
  <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.3px', whiteSpace: 'nowrap', color, ...style }}>{children}</span>
);
Label.propTypes = { children: PropTypes.node, color: PropTypes.string, style: PropTypes.object };

const StatTile = ({ glyph, value, label, tint }) => (
  <div style={{ ...glass, borderRadius: 18, padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 11 }}>
    <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: tint, background: 'rgba(255,255,255,0.08)', border: `1px solid ${tint}55` }}>{glyph}</span>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: F.display, fontSize: 23, fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-0.6px', whiteSpace: 'nowrap' }}>{value}</div>
      <Label style={{ display: 'block', marginTop: 4, fontSize: 9 }}>{label}</Label>
    </div>
  </div>
);
StatTile.propTypes = { glyph: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, label: PropTypes.string.isRequired, tint: PropTypes.string.isRequired };

const RANK_COL = { all: '#5EA8FF', col: '#B28BFF', st: '#34E0C4' };

export const ArenaCard = ({ profile, user, theme, story, compact, still, shareUrl }) => {
  const {
    name, college, totalInterviews, nextTier, dimensionProfile, scoreTrend, rank, totalCandidates, beatCount,
    collegeRank, collegeTotal, stateName, stateRank, stateTotal, streak, badgesUnlocked, badgesTotal, bestScore,
  } = profile;
  const { a, b } = ARENA[theme.level] || ARENA.CHALLENGER;
  const dims = dimensionProfile?.length ? dimensionProfile : [];
  const irs = round(profile.irs ?? profile.averageScore ?? 0);
  const displayName = name || user?.name || 'Candidate';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'M';
  const showPercent = profile.topPercent != null && totalCandidates >= MIN_CANDIDATES_FOR_PERCENT;
  const active = dims.filter((d) => d.hasData);
  const strongest = profile.strongestDim || [...active].sort((x, y) => y.score - x.score)[0] || null;
  const weakest = profile.weakestDim || [...active].sort((x, y) => x.score - y.score)[0] || null;
  const tiles = [
    rank != null && totalCandidates > 0 && { k: 'all', label: 'OVERALL', rank, total: totalCandidates },
    collegeRank != null && collegeTotal > 0 && { k: 'col', label: (college || 'COLLEGE').toUpperCase(), rank: collegeRank, total: collegeTotal },
    stateRank != null && stateTotal > 0 && { k: 'st', label: (stateName || 'STATE').toUpperCase(), rank: stateRank, total: stateTotal },
  ].filter(Boolean);
  const trendScores = (scoreTrend || []).map((t) => clamp(t.score));
  const delta = trendScores.length >= 2 ? Math.round(trendScores[trendScores.length - 1] - trendScores[trendScores.length - 2]) : null;
  const cleanUrl = (shareUrl || 'mockmate.app').replace(/^https?:\/\//, '');
  const showTrend = scoreTrend?.length >= 2;
  const pillText = showPercent ? `TOP ${profile.topPercent}%` : (rank != null ? `RANK #${rank}` : null);
  const gap = story ? 16 : compact ? 10 : 12;
  const stats = [
    streak?.current > 0 && { g: '🔥', v: `${streak.current}d`, l: 'DAY STREAK', t: '#FF9F5A' },
    { g: '★', v: round(bestScore), l: 'BEST SCORE', t: AMBER },
    { g: '◎', v: totalInterviews, l: 'SESSIONS', t: '#5EA8FF' },
    badgesTotal > 0 && { g: '🏅', v: `${badgesUnlocked}/${badgesTotal}`, l: 'BADGES', t: '#B28BFF' },
  ].filter(Boolean);

  return (
    <div
      className={still ? 'mm9-still' : ''}
      style={{
        position: 'relative', overflow: 'hidden', width: CARD_W, borderRadius: 28, display: 'flex', flexDirection: 'column',
        minHeight: story ? STORY_MIN_H : compact ? COMPACT_MIN_H : undefined,
        background: 'linear-gradient(180deg, #030B24 0%, #07204F 46%, #0A3A8F 100%)',
        border: '1px solid rgba(125,170,255,0.28)', boxShadow: `0 24px 64px ${a}40`, fontFamily: F.body, color: INK,
      }}
    >
      <CourseBackdrop a={a} />
      <div style={{ position: 'absolute', top: -130, right: -90, width: 360, height: 360, borderRadius: '50%', background: `radial-gradient(circle, ${a}55, ${a}00 66%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 480, left: -150, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,91,238,0.30), rgba(109,91,238,0) 66%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 60, right: -120, width: 340, height: 340, borderRadius: '50%', background: `radial-gradient(circle, ${b}38, ${b}00 66%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', padding: '18px 18px 0', display: 'flex', flexDirection: 'column', flex: 1, gap }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg, #0057E8, #22D3EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: 16, fontWeight: 900, color: '#fff', boxShadow: '0 6px 16px rgba(34,211,238,0.35)' }}>M</div>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.3px' }}>Mock<span style={{ color: '#5EC8FF' }}>Mate</span></div>
              <Label style={{ display: 'block', marginTop: 3, fontSize: 8 }}>PLAYER CARD</Label>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, background: `linear-gradient(90deg, ${a}, ${b})`, color: DEEP, fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', boxShadow: `0 6px 18px ${a}55` }}>
            <span style={{ fontSize: 12 }}>{theme.icon}</span> {theme.level}
          </div>
        </div>

        {/* identity */}
        <div style={{ ...glass, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${a}, ${b})`, color: DEEP, fontFamily: F.display, fontSize: 22, fontWeight: 900, boxShadow: `0 6px 16px ${a}55` }}>{initial}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
            <div style={{ marginTop: 3, fontSize: 11.5, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[college, stateName].filter(Boolean).join(' · ') || 'MockMate candidate'}</div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 999, background: 'rgba(182,255,59,0.12)', border: '1px solid rgba(182,255,59,0.4)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 6, background: LIME }} />
            <Label color={LIME} style={{ fontSize: 8.5 }}>VERIFIED</Label>
          </div>
        </div>

        {/* hero dial */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
          <div style={{ position: 'relative', width: 250, height: 250 }}>
            <Dial score={irs} a={a} b={b} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 14 }}>
              <Label color={a} style={{ fontSize: 9.5 }}>READINESS SCORE</Label>
              <div style={{ fontFamily: F.display, fontSize: 82, fontWeight: 900, lineHeight: 1, letterSpacing: '-4px', marginTop: 2, color: INK }}>{irs}</div>
              <Label style={{ fontSize: 9 }}>OUT OF 100</Label>
            </div>
            {pillText && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: '7px 18px', borderRadius: 999, background: `linear-gradient(90deg, ${a}, ${b})`, color: DEEP, fontFamily: F.display, fontSize: 18, fontWeight: 900, letterSpacing: '-0.2px', whiteSpace: 'nowrap', boxShadow: `0 10px 26px ${a}66` }}>{pillText}</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', fontSize: 12.5, color: SUB }}>
            {beatCount > 0
              ? <span>Outscored <strong style={{ color: INK }}>{beatCount}</strong> {beatCount === 1 ? 'candidate' : 'candidates'}{totalCandidates >= MIN_CANDIDATES_FOR_PERCENT || !pillText ? '' : ` of ${totalCandidates}`}</span>
              : <span>Just getting started — the climb begins.</span>}
            {delta ? <span style={{ padding: '3px 9px', borderRadius: 999, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: delta > 0 ? LIME : PINK, background: delta > 0 ? 'rgba(182,255,59,0.12)' : 'rgba(255,77,141,0.14)', border: `1px solid ${delta > 0 ? 'rgba(182,255,59,0.4)' : 'rgba(255,77,141,0.4)'}` }}>{delta > 0 ? '▲ +' : '▼ '}{delta} vs last</span> : null}
          </div>
        </div>

        {/* rank tiles (real data only) */}
        {tiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {tiles.map((t) => (
              <div key={t.k} style={{ ...glass, flex: 1, minWidth: 0, borderRadius: 18, padding: '10px 11px 11px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: RANK_COL[t.k] }} />
                <Label style={{ display: 'block', fontSize: 8.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</Label>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: F.display, fontSize: 25, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.8px', color: t.rank === 1 ? RANK_COL[t.k] : INK }}>#{t.rank}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, color: MUTED }}>of {t.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!compact && (
          <>
            {/* stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {stats.map((s) => <StatTile key={s.l} glyph={s.g} value={s.v} label={s.l} tint={s.t} />)}
            </div>

            {/* skill tick meters */}
            {dims.length > 0 && (
              <div style={{ ...glass, padding: '14px 15px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Label color={a}>SKILL METERS</Label>
                  <Label style={{ fontSize: 8.5 }}>{active.length}/{dims.length} MEASURED</Label>
                </div>
                {dims.map((d) => (
                  <div key={d.key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: SUB }}>{DIM_SHORT[d.label] || d.label}</span>
                      <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: d.hasData ? zoneColor(clamp(d.score)) : MUTED }}>{d.hasData ? round(d.score) : '–'}</span>
                    </div>
                    <TickBar value={d.hasData ? clamp(d.score) : null} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 12, paddingBottom: 6 }}>
                  {[[PINK, 'Needs work'], [AMBER, 'Solid'], [LIME, 'Strong']].map(([c, l]) => (
                    <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: MUTED }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: c }} />{l.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* fairway = score trend */}
            {showTrend && (
              <div style={{ ...glass, padding: '13px 14px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Label color={a}>THE FAIRWAY · LAST {Math.min(10, scoreTrend.length)} SESSIONS</Label>
                </div>
                <div style={{ margin: '8px 0 4px' }}><Fairway trend={scoreTrend} a={a} b={b} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Label style={{ fontSize: 8.5 }}>FIRST {Math.round(trendScores[Math.max(0, trendScores.length - 10)])}</Label>
                  <Label color={LIME} style={{ fontSize: 8.5 }}>LATEST {Math.round(trendScores[trendScores.length - 1])}</Label>
                </div>
              </div>
            )}
          </>
        )}

        {/* coach tip — built only from the real scores above */}
        {weakest && (
          <div style={{ ...glass, padding: '13px 15px', borderColor: `${a}66` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <span style={{ fontSize: 14, color: a }}>✦</span>
              <Label color={a}>COACH TIP</Label>
              <Label style={{ fontSize: 8.5 }}>· FROM YOUR SCORES</Label>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: SUB }}>
              Lowest area: <strong style={{ color: INK }}>{weakest.label}</strong> at <strong style={{ color: PINK }}>{round(weakest.score)}</strong>.
              {strongest && strongest.key !== weakest.key ? <> Superpower: <strong style={{ color: INK }}>{strongest.label}</strong> at <strong style={{ color: LIME }}>{round(strongest.score)}</strong>.</> : null}
              {' '}Run a {weakest.label} round next to lift your score.
            </div>
          </div>
        )}

        {!compact && (nextTier ? (
          <div style={{ ...glass, padding: '12px 15px 13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <Label>NEXT LEVEL · <span style={{ color: INK }}>{nextTier.label}</span></Label>
              <span style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: a }}>{clamp(nextTier.readinessPct)}%</span>
            </div>
            <TickBar value={clamp(nextTier.readinessPct)} n={46} h={14} flat={a} />
          </div>
        ) : (
          <div style={{ ...glass, textAlign: 'center', padding: '12px 14px', fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', color: a }}>★ MAX LEVEL REACHED ★</div>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* challenge footer */}
      <div style={{ position: 'relative', overflow: 'hidden', marginTop: compact ? 8 : 16, padding: '15px 18px 16px', background: 'linear-gradient(100deg, #0A3FD0 0%, #1A6EFF 58%, #22D3EE 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.14)' }} />
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, letterSpacing: '-0.3px' }}>Think you can beat {irs}?</div>
          <div style={{ marginTop: 6, display: 'inline-block', maxWidth: 232, padding: '4px 10px', borderRadius: 999, background: 'rgba(4,18,46,0.35)', border: '1px solid rgba(255,255,255,0.4)', fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' }}>{cleanUrl}</div>
        </div>
        <div style={{ position: 'relative', flexShrink: 0, padding: '9px 14px', borderRadius: 999, background: '#fff', color: '#0A3FD0', fontFamily: F.display, fontSize: 13, fontWeight: 900, boxShadow: '0 8px 20px rgba(4,18,46,0.35)' }}>Challenge →</div>
      </div>
    </div>
  );
};
ArenaCard.propTypes = {
  profile: PropTypes.object.isRequired, user: PropTypes.object, theme: PropTypes.object.isRequired,
  story: PropTypes.bool, compact: PropTypes.bool, still: PropTypes.bool, shareUrl: PropTypes.string,
};

export default ArenaCard;

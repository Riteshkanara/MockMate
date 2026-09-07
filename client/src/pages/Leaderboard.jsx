import { useEffect, useMemo, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE from '../config/api.js';
import { AuthContext, authFetch } from '../context/AuthContext.jsx';
import { getAnalytics, getPerformanceAnalytics } from '../Services/interviewService.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — LEADERBOARD v3 (Readiness Terminal v6 design language, premium pass)
// Hero rebuilt to share Coach's CommandHeader grammar exactly (dark panel,
// glow orbs, mono eyebrow, chip row, F.display headline) while keeping
// leaderboard-native content: rank, rival gap, and weakest-skill callout.
// ═══════════════════════════════════════════════════════════════════════════

// Best-effort bridge from the 6 scoring dimensions (server-side,
// scoringModel.js DIMENSIONS) to the 8 fixed topics Interview.jsx's
// topic-mode dropdown accepts (Interview.jsx TOPICS). These are NOT a 1:1
// mapping — only 'design' has an exact match — so this is a heuristic
// "closest available practice topic," not an authoritative one.
const DIMENSION_TO_TOPIC = {
  technical: 'DSA',
  problemSolving: 'DSA',
  communication: 'HR',
  behavioral: 'HR',
  design: 'System Design',
  fundamentals: 'OS',
};

const C = {
  paper:        '#F6F8FD',
  paperDeep:    '#EEF2FC',

  surface:      '#FFFFFF',
  surfaceSunk:  '#F3F6FD',

  ink:          '#0A1628',
  ink2:         '#111F38',
  sub:          '#41547B',
  // Darkened from #7C8CAD (3.4:1) to clear WCAG AA (4.5:1) for the small
  // body text this token is used on — same hue family, just deeper.
  muted:        '#5D6C89',
  faint:        '#AFBCDA',

  line:         '#DEE6F7',
  lineMd:       '#C4D2F0',
  lineStr:      '#8FAAE8',

  signal:       '#0057E8',
  signalDeep:   '#0041B8',
  signalTint:   '#EAF1FF',
  signalSoft:   '#4D8FFF',

  pulse:        '#00C2E8',
  // Darkened from #0093C4 (3.5:1) to clear AA — used for small text (YOU
  // badge, efficiency stat), not just the bright pulse accent.
  pulseDeep:    '#006B8C',
  pulseTint:    '#E6FAFF',

  // Darkened from #0E8F63 (4.1:1) — this is the "score ≥ 80" color used
  // everywhere a high score renders, so it needs to clear AA at normal text sizes.
  green:        '#0A6E4C',
  greenTint:    '#E9F9F1',
  // Darkened from #B4790A (3.7:1) — the "score 40-59" color, same reasoning.
  amber:        '#8C5F08',
  amberTint:    '#FFF6E5',
  orange:       '#C2530C',
  orangeTint:   '#FFF1E6',
  red:          '#C22626',
  redTint:      '#FDECEC',

  // Medal tones darkened from their originals to clear WCAG AA (4.5:1) on
  // both plain white and each color's own tint background — same hues,
  // deeper values. Originals: bronze #9C6A3E, silver #6E7B99, gold #AD7F10.
  bronze:       '#8C5F37',
  bronzeTint:   '#F7EEE3',
  silver:       '#5F6C89',
  silverTint:   '#EFF2F8',
  gold:         '#8C640C',
  goldTint:     '#FBF3DE',
  platinum:     '#4C57C7',
  platinumTint: '#EDEEFC',

  // Coach-style hero accents (brighter cyan/blue)
  heroDark0:    '#080F1E',
  heroDark1:    '#0A1628',
  heroDark2:    '#0D1F3C',
  heroBlue900:  '#001F6B',
  cyanBright:   '#00C8F0',
  blueBright:   '#1A6EFF',

  shadow:   '0 1px 2px rgba(10,22,40,0.04), 0 8px 24px rgba(15,45,120,0.06)',
  shadowMd: '0 4px 14px rgba(15,45,120,0.08), 0 1px 3px rgba(10,22,40,0.05)',
  shadowLg: '0 24px 64px rgba(6,16,50,0.28)',
};

const F = {
  serif:   "'Fraunces', 'Georgia', serif",
  // Matches Coach's CommandHeader (F.display in styles/tokens.js) — used only
  // in the Leaderboard hero so the two "welcome back" surfaces read as one family.
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const scoreColor = (score) => {
  const s = Number(score) || 0;
  return s >= 80 ? C.green : s >= 60 ? C.signal : s >= 40 ? C.amber : C.orange;
};

const efficiency = (score, sessions) => {
  const numericScore = Number(score) || 0;
  const numericSessions = Number(sessions) || 0;
  return numericSessions > 0
    ? Math.round((numericScore / numericSessions) * 10) / 10
    : 0;
};

const mockDelta = (rank, seed = 0) => {
  const safeRank = Number(rank) || 0;
  const safeSeed = Number(seed) || 0;
  return ((safeSeed * 7 + safeRank * 3) % 9) - 4;
};

const percentileOf = (rank, total) => {
  if (!rank || !total) return null;
  return Math.max(0, Math.min(100, Math.round(((total - rank) / total) * 100)));
};

const isPlatinumBand = (rank, total) => {
  const pct = percentileOf(rank, total);
  return pct !== null && pct >= 95;
};

// ─── Shared with Coach's CommandHeader — same markup, same values ───────────
// (Coach.jsx doesn't export these, so they're mirrored here exactly rather
// than cross-importing a component from another page module.)

const Eyebrow = ({ children, color = C.cyanBright }) => (
  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: '1.8px', color, marginBottom: 6, textTransform: 'uppercase' }}>{children}</div>
);

const HeroChip = ({ label, value, color }) => (
  <div style={S.heroChip}>
    <div style={S.heroChipLabel}>{label}</div>
    <div style={{ ...S.heroChipVal, color }}>{value}</div>
  </div>
);

// ─── Climb track — the hero's centerpiece ───────────────────────────────────
// A leaderboard's one honest question is "where do I stand, and against whom."
// Instead of a stat card, this renders an actual track: your position, your
// next rival, and the leader, placed by score along a line. Real data only —
// no decorative markers.

const ClimbTrack = ({ you, rival, leader, mounted, maxScore }) => {
  const scale = Math.max(maxScore, you?.score ?? 0, 1);
  const pos = (s) => Math.min(96, Math.max(4, (s / scale) * 100));

  // Adjacent leaderboard entries are often close in score (that's what makes
  // them adjacent), so raw positions collide constantly. Sort by position and
  // push overlapping labels apart while keeping their left-to-right order.
  const MIN_GAP = 13;
  const nodes = [
    you && { key: 'you', ...you, pos: pos(you.score) },
    rival && { key: 'rival', ...rival, pos: pos(rival.score) },
    leader && { key: 'leader', ...leader, pos: pos(leader.score) },
  ]
    .filter(Boolean)
    .sort((a, b) => a.pos - b.pos);

  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].pos - nodes[i - 1].pos < MIN_GAP) {
      nodes[i].pos = nodes[i - 1].pos + MIN_GAP;
    }
  }
  // If pushing right ran past the track edge, pull the whole cluster back.
  const overflow = nodes.length ? Math.max(0, nodes[nodes.length - 1].pos - 96) : 0;
  if (overflow > 0) nodes.forEach((n) => { n.pos -= overflow; });

  const youRawPos = pos(you?.score ?? 0);

  return (
    <div style={S.track}>
      <div style={S.trackLine}>
        <div style={{ ...S.trackFill, width: mounted ? `${youRawPos}%` : '0%' }} />
        {nodes.map((n) => (
          <div
            key={n.key}
            className={n.key === 'you' ? 'mm-track-you' : undefined}
            style={{
              ...S.trackNode,
              left: `${n.pos}%`,
              opacity: mounted ? 1 : 0,
              transform: `translate(-50%, -50%) scale(${mounted ? 1 : 0.4})`,
              transitionDelay: n.key === 'you' ? '0.5s' : n.key === 'rival' ? '0.62s' : '0.74s',
            }}
          >
            <div style={{ ...S.trackDot, ...(n.key === 'you' ? S.trackDotYou : n.key === 'leader' ? S.trackDotLeader : S.trackDotRival) }} />
            <div style={S.trackTag}>
              <div style={{ ...S.trackTagLabel, color: n.key === 'you' ? C.cyanBright : 'rgba(255,255,255,0.55)' }}>
                {n.key === 'you' ? 'you' : n.label}
              </div>
              <div style={S.trackTagScore}>{n.score}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Animated counter ───────────────────────────────────────────────────────

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

// ─── Delta badge ─────────────────────────────────────────────────────────────

const DeltaBadge = ({ delta, isNew = false, showDelta = true }) => {
  if (!showDelta || (delta === 0 && !isNew)) {
    return <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.faint }}>—</span>;
  }
  if (isNew) {
    return (
      <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: C.pulseTint, color: C.pulseDeep, letterSpacing: '0.3px' }}>
        NEW
      </span>
    );
  }
  const up = delta < 0;
  return (
    <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: up ? C.greenTint : C.redTint, color: up ? C.green : C.red }}>
      {up ? `↑${Math.abs(delta)}` : `↓${Math.abs(delta)}`}
    </span>
  );
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

// ─── Streak badge (only rendered when a real streak exists) ─────────────────

const StreakBadge = ({ streak, size = 'sm' }) => {
  const n = Number(streak) || 0;
  if (n < 2) return null; // a 0 or 1-day streak isn't meaningfully "on a streak"
  const big = size === 'lg';
  return (
    <span
      title={`${n}-day streak`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontFamily: F.mono, fontSize: big ? 10 : 9, fontWeight: 800,
        color: C.orange, background: C.orangeTint, border: `1px solid ${C.orange}40`,
        padding: big ? '3px 8px' : '1px 7px', borderRadius: 99, flexShrink: 0,
      }}
    >
      🔥{n}
    </span>
  );
};

// ─── Score bar ───────────────────────────────────────────────────────────────

const ScoreBar = ({ score, max }) => {
  const safeScore = Number(score) || 0;
  const safeMax = Number(max) || 0;
  const pct = safeMax > 0 ? Math.min((safeScore / safeMax) * 100, 100) : 0;
  const color = scoreColor(safeScore);
  return (
    <div style={{ width: 64, height: 4, borderRadius: 99, background: C.line, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 99, transition: 'width 0.9s cubic-bezier(.16,1,.3,1)' }} />
    </div>
  );
};

// ─── Mini sparkline (row expansion) ──────────────────────────────────────────

const MiniTrend = ({ points = [] }) => {
  if (!points.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: C.surface, border: `1.5px dashed ${C.lineMd}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        }}>
          📈
        </div>
        <div>
          <div style={{ fontFamily: F.body, fontSize: 11.5, fontWeight: 600, color: C.sub }}>
            Trend arrives after a few more sessions
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 2 }}>
            we'll chart the last 6 scores here once there's history to show
          </div>
        </div>
      </div>
    );
  }
  const max = Math.max(...points, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 46 }}>
      {points.map((p, i) => {
        const h = Math.max(6, Math.round((p / max) * 100));
        const col = scoreColor(p);
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 20 }}>
            <div style={{ width: '100%', height: 40, display: 'flex', alignItems: 'flex-end', borderRadius: 4, background: C.surfaceSunk, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
              <div style={{ width: '100%', height: `${h}%`, background: col, borderRadius: '4px 4px 0 0' }} />
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>{p}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Premium podium block ────────────────────────────────────────────────────

// Colors match the C.gold/C.silver/C.bronze tokens above (darkened for AA
// contrast) — kept as literals here since this map also carries bright/tint/
// glow variants that don't have C-object equivalents.
const PODIUM_METALS = {
  1: { medal: '🥇', color: '#8C640C', bright: '#F0B93D', tint: '#FBF3DE', glow: 'rgba(140,100,12,0.38)', label: '1st', laurel: '❧' },
  2: { medal: '🥈', color: '#5F6C89', bright: '#A7B3CE', tint: '#EFF2F8', glow: 'rgba(95,108,137,0.30)', label: '2nd', laurel: '' },
  3: { medal: '🥉', color: '#8C5F37', bright: '#C88E5C', tint: '#F7EEE3', glow: 'rgba(140,95,55,0.30)', label: '3rd', laurel: '' },
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

        {/* Avatar with glow ring + idle float on 1st */}
        <div
          className={place === 1 ? 'lb-avatar-float' : undefined}
          style={{
            position: 'relative',
            width: avatarSize, height: avatarSize, borderRadius: '50%', margin: platinumHere ? '18px auto 8px' : '0 auto 8px',
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
        {/* Diagonal shine sweep, looping only on 1st */}
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

// ─── Rival card — the one person between you and moving up ──────────────────
// Uses the same DarkCard grammar as Coach's section cards (dark panel,
// accent border-left, mono eyebrow). Data comes from aheadOfUser which the
// leaderboard API already returns — no extra fetch needed.

const RivalCard = ({ rival, gapToNext, userRank, navigate, weakestDim, weakestPracticeTopic, mounted }) => {
  if (!rival || gapToNext == null) return null;
  const rivalScore = Number(rival.avgScore) || 0;
  const urgency = gapToNext <= 2 ? 'critical' : gapToNext <= 5 ? 'close' : 'chase';
  const urgencyMeta = {
    critical: { label: '🔴 SO CLOSE',   color: C.red,       msg: `Just ${gapToNext} pt${gapToNext !== 1 ? 's' : ''} — one good session takes this.` },
    close:    { label: '🟠 WITHIN REACH', color: C.amber,    msg: `${gapToNext} points. A focused topic session will do it.` },
    chase:    { label: '🔵 THE HUNT',    color: C.blueBright, msg: `${gapToNext} points back. Fix ${weakestDim?.label || 'your weakest skill'} first.` },
  }[urgency];

  return (
    <div style={S.rivalCard}>
      <div style={{ ...S.rivalAccentBar, background: urgencyMeta.color }} />
      <div style={S.rivalInner}>
        <div style={S.rivalLeft}>
          <Eyebrow color={urgencyMeta.color}>{urgencyMeta.label}</Eyebrow>
          <div style={S.rivalName}>
            <div style={{ ...S.rivalAvatar, background: `linear-gradient(135deg, ${urgencyMeta.color}33, ${urgencyMeta.color}99)` }}>
              {rival.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <div style={S.rivalNameText}>{rival.name || `Rank #${userRank - 1}`}</div>
              <div style={S.rivalNameSub}>{rival.college || 'ranked just above you'}</div>
            </div>
          </div>
          <p style={S.rivalMsg}>{urgencyMeta.msg}</p>
        </div>
        <div style={S.rivalRight}>
          <div style={S.rivalScoreBlock}>
            <div style={S.rivalScoreLabel}>THEIR SCORE</div>
            <div style={{ ...S.rivalScoreVal, color: urgencyMeta.color }}>{rivalScore}/100</div>
          </div>
          <div style={S.rivalGapBlock}>
            <div style={S.rivalScoreLabel}>GAP</div>
            <div style={{ ...S.rivalScoreVal, color: '#fff', fontSize: 20 }}>−{gapToNext}</div>
          </div>
          <button
            style={{ ...S.btnPrimary, fontSize: 12, padding: '9px 16px', marginTop: 8, background: `linear-gradient(135deg, ${urgencyMeta.color}, ${urgencyMeta.color}CC)` }}
            onClick={() => weakestPracticeTopic
              ? navigate('/interview', { state: { mode: 'topic', topic: weakestPracticeTopic } })
              : navigate('/interview')}
          >
            🎯 Close the gap
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Dimension radar (SVG hexagon) ──────────────────────────────────────────
// The one visualisation Coach doesn't have. Shows all 6 scored dimensions as
// a filled polygon so you can see your shape at a glance — where you're
// round vs where you have a dent. Pure SVG, no library needed.

const RADAR_DIMS = [
  { key: 'technical',      label: 'Technical',    short: 'Tech'   },
  { key: 'problemSolving', label: 'Problem Solv.', short: 'PS'    },
  { key: 'communication',  label: 'Comm.',         short: 'Comm'  },
  { key: 'behavioral',     label: 'Behavioral',    short: 'Beh'   },
  { key: 'design',         label: 'System Design', short: 'Design'},
  { key: 'fundamentals',   label: 'Fundamentals',  short: 'Fund'  },
];

const DimensionRadar = ({ dimensionProfile, mounted }) => {
  if (!dimensionProfile || dimensionProfile.length === 0) return null;

  const cx = 130, cy = 130, r = 90;
  const n = RADAR_DIMS.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const getPoint = (i, pct) => {
    const angle = startAngle + i * angleStep;
    return {
      x: cx + pct * r * Math.cos(angle),
      y: cy + pct * r * Math.sin(angle),
    };
  };

  const getLabelPoint = (i) => {
    const angle = startAngle + i * angleStep;
    const dist = r + 22;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  // Map fetched profile onto our fixed dim order so missing dims default to 0
  const scores = RADAR_DIMS.map(d => {
    const found = dimensionProfile.find(p => p.key === d.key);
    return found?.hasData ? ((found.score || 0) / 100) : 0;
  });

  const polygon = scores
    .map((s, i) => {
      const pt = getPoint(i, mounted ? s : 0);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  // Grid rings at 25 / 50 / 75 / 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div style={S.radarCard}>
      <div style={S.radarHeader}>
        <div>
          <Eyebrow color={C.signal}>🕸 SKILL RADAR</Eyebrow>
          <h2 style={S.cardH2Light}>Your dimension shape</h2>
          <p style={S.radarSub}>Where you're round vs where you have a dent. Untested dimensions show as 0.</p>
        </div>
      </div>
      <div style={S.radarBody}>
        <svg width={260} height={260} viewBox="0 0 260 260" style={{ overflow: 'visible', flexShrink: 0 }}>
          {/* Grid rings */}
          {rings.map((ring, ri) => {
            const pts = RADAR_DIMS.map((_, i) => {
              const pt = getPoint(i, ring);
              return `${pt.x},${pt.y}`;
            }).join(' ');
            return (
              <polygon key={ri} points={pts}
                fill="none"
                stroke={ri === 3 ? 'rgba(0,87,232,0.25)' : 'rgba(0,87,232,0.1)'}
                strokeWidth={ri === 3 ? 1.5 : 1}
              />
            );
          })}

          {/* Spokes */}
          {RADAR_DIMS.map((_, i) => {
            const outer = getPoint(i, 1);
            return (
              <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
                stroke="rgba(0,87,232,0.12)" strokeWidth={1} />
            );
          })}

          {/* Filled polygon — animates in via CSS transition on the points */}
          <polygon
            points={polygon}
            fill="rgba(0,87,232,0.15)"
            stroke={C.signal}
            strokeWidth={2}
            strokeLinejoin="round"
            style={{ transition: 'all 1.1s cubic-bezier(.16,1,.3,1) 0.3s' }}
          />

          {/* Dots at each vertex */}
          {scores.map((s, i) => {
            const pt = getPoint(i, mounted ? s : 0);
            const col = scoreColor(s * 100);
            return (
              <circle key={i} cx={pt.x} cy={pt.y} r={4}
                fill={col} stroke="#fff" strokeWidth={1.5}
                style={{ transition: `cx 1.1s cubic-bezier(.16,1,.3,1) 0.3s, cy 1.1s cubic-bezier(.16,1,.3,1) 0.3s` }}
              />
            );
          })}

          {/* Labels */}
          {RADAR_DIMS.map((d, i) => {
            const lp = getLabelPoint(i);
            const score = dimensionProfile.find(p => p.key === d.key);
            const hasData = score?.hasData;
            return (
              <text key={i} x={lp.x} y={lp.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fontFamily="'JetBrains Mono', monospace"
                fontWeight={700}
                fill={hasData ? C.ink : C.muted}
              >
                {d.short}
              </text>
            );
          })}

          {/* Ring labels */}
          {[25, 50, 75].map(v => {
            const pt = getPoint(0, v / 100);
            return (
              <text key={v} x={pt.x + 4} y={pt.y}
                fontSize={7} fontFamily="'JetBrains Mono', monospace"
                fill="rgba(65,84,123,0.5)" dominantBaseline="middle">
                {v}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={S.radarLegend}>
          {RADAR_DIMS.map((d) => {
            const found = dimensionProfile.find(p => p.key === d.key);
            const s = found?.hasData ? (found.score || 0) : null;
            const col = s != null ? scoreColor(s) : C.muted;
            return (
              <div key={d.key} style={S.radarLegendRow}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.ink }}>{d.label}</div>
                <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: col }}>
                  {s != null ? `${s}/100` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Leaderboard = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { setUser } = useContext(AuthContext);

  const EMPTY_BOARD = useMemo(() => ({ global: [], college: [], globalTotal: 0, collegeTotal: 0 }), []);

  const [activePeriod, setActivePeriod] = useState('weekly');
  const [activeTab, setActiveTab] = useState('global');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showSticky, setShowSticky] = useState(false);

  const [leaderboardData, setLeaderboardData] = useState({
    weekly: { global: [], college: [], globalTotal: 0, collegeTotal: 0 },
    overall: { global: [], college: [], globalTotal: 0, collegeTotal: 0 },
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [podiumMounted, setPodiumMounted] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [weakestDim, setWeakestDim] = useState(null);
  const [dimensionProfile, setDimensionProfile] = useState([]);
  const [userIRS, setUserIRS] = useState(null);

  // ─── Load leaderboard ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const load = async () => {
      try {
        const res = await authFetch(
          `${API_BASE}/leaderboard`,
          {
            method: 'GET',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          },
          () => setUser(null) // access token + refresh both expired → treat as logged out
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || data?.error || `Leaderboard request failed with ${res.status}`);
        }
        if (cancelled) return;

        setLeaderboardData({
          weekly: { ...EMPTY_BOARD, ...(data.weekly || {}) },
          overall: { ...EMPTY_BOARD, ...(data.overall || {}) },
        });
        setCurrentUser(data.currentUser ?? null);
      } catch (error) {
        console.error('Leaderboard load error:', error);
        if (!cancelled) {
          setLoadError(error?.message || 'Failed to load leaderboard');
          toast.error(error?.message || 'Failed to load leaderboard');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          requestAnimationFrame(() => setTimeout(() => setMounted(true), 50));
          setTimeout(() => setPodiumMounted(true), 260);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [EMPTY_BOARD, retryToken]);

  // Replay podium entrance whenever period/scope changes
  useEffect(() => {
    setPodiumMounted(false);
    const t = setTimeout(() => setPodiumMounted(true), 60);
    return () => clearTimeout(t);
  }, [activePeriod, activeTab]);

  // ─── Weakest-dimension + IRS — parallel, non-blocking ──────────────────
  // Both fire at mount. Either can fail silently; neither blocks the board.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [analyticsResult, perfResult] = await Promise.allSettled([
        getAnalytics(),
        getPerformanceAnalytics(),
      ]);

      if (cancelled) return;

      if (analyticsResult.status === 'fulfilled') {
        const dims = analyticsResult.value?.dimensionProfile || [];
        setDimensionProfile(dims);
        const tested = dims.filter((d) => d.hasData);
        if (tested.length) {
          const weakest = [...tested].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
          if (weakest) setWeakestDim(weakest);
        }
      } else {
        console.error('Analytics fetch failed (non-blocking):', analyticsResult.reason);
      }

      if (perfResult.status === 'fulfilled') {
        const irs = perfResult.value?.irs ?? null;
        if (irs !== null) setUserIRS(Math.round(Number(irs)));
      } else {
        console.error('Performance fetch failed (non-blocking):', perfResult.reason);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Sticky rank bar on scroll ───────────────────────────────────────────

  useEffect(() => {
    const onScroll = () => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      setShowSticky(rect.bottom < 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const selectedBoard = leaderboardData?.[activePeriod] || EMPTY_BOARD;
  const rawData = activeTab === 'global' ? selectedBoard.global || [] : selectedBoard.college || [];

  const activeData = useMemo(() => {
    if (!query.trim()) return rawData;
    const q = query.trim().toLowerCase();
    return rawData.filter(e => (e.name || '').toLowerCase().includes(q));
  }, [rawData, query]);

  const top3 = rawData.slice(0, 3);

  const maxScore = rawData.length ? Math.max(...rawData.map(e => Number(e.avgScore) || 0)) : 100;

  const totalCount = activeTab === 'global'
    ? Number(selectedBoard.globalTotal) || rawData.length
    : Number(selectedBoard.collegeTotal) || rawData.length;

  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumPlace = [2, 1, 3];
  const podiumDelay = [260, 40, 460];
  const leaderIsPlatinum = isPlatinumBand(top3[0]?.rank ?? 1, totalCount);

  const selectedUserPeriod = currentUser?.[activePeriod] || null;

  const userRank = activeTab === 'global'
    ? selectedUserPeriod?.globalRank ?? null
    : selectedUserPeriod?.collegeRank ?? null;

  const aheadOfUser = activeTab === 'global'
    ? selectedUserPeriod?.globalAheadOfUser ?? null
    : selectedUserPeriod?.collegeAheadOfUser ?? null;

  const currentUserScore = selectedUserPeriod?.avgScore ?? null;
  const userPercentile = percentileOf(userRank, totalCount);
  const userIsPlatinum = isPlatinumBand(userRank, totalCount);

  const gapToNext = aheadOfUser && currentUserScore != null
    ? Math.round((Number(aheadOfUser.avgScore) - Number(currentUserScore)) * 10) / 10
    : null;

  // Streak lives on the ranked-list entry (rawData), not on the separate
  // currentUser summary object returned by the API — that object only
  // carries rank/score/aheadOfUser, no streak field.
  const currentUserRow = rawData.find((e) => e.isCurrentUser) || null;
  const currentUserStreak = Number(currentUserRow?.streak) || 0;

  const rankLabel = activeTab === 'global' ? 'global rank' : 'college rank';
  const periodLabel = activePeriod === 'weekly' ? 'this week' : 'overall';

  const heroVerdict = !currentUser
    ? "let's get you on the board."
    : userRank == null
      ? 'complete a session to get ranked.'
      : userIsPlatinum
        ? "you're in the platinum band — top 1%."
        : userRank === 1
          ? `you're #1 ${periodLabel} — defend it.`
          : `you're #${userRank} ${activeTab === 'global' ? 'globally' : 'in your college'} ${periodLabel}.`;

  // Priority for what the hero pushes: 1) fix the weakest tested skill,
  // 2) close the gap on the rival just ahead, 3) generic percentile line.
  // Only overrides the sub-line for ranked users with real rank-climbing
  // room — someone already #1 shouldn't be told to "fix" anything.
  const weakestPracticeTopic = weakestDim ? (DIMENSION_TO_TOPIC[weakestDim.key] || null) : null;

  // Progress toward catching the rival — shown as a narrow urgency bar
  // below the CTAs. Capped at 99% so it never falsely reads "done".
  // Uses the leader's score as the full-range ceiling so the bar is
  // calibrated against the real top, not just the next rank.
  const urgencyPct = (() => {
    if (currentUserScore == null || !top3[0]?.avgScore) return null;
    const leader = Number(top3[0].avgScore);
    if (leader <= 0) return null;
    return Math.min(99, Math.round((Number(currentUserScore) / leader) * 100));
  })();

  const heroSub = !currentUser
    ? 'Complete an interview and MockMate ranks you against every student practicing right now.'
    : userRank == null
      ? (activePeriod === 'weekly'
          ? 'Complete an interview this week to appear on the board.'
          : 'Complete an interview to appear on the overall leaderboard.')
      : weakestDim && userRank !== 1
        ? `${weakestDim.label} is your lowest score (${weakestDim.score}/100)${gapToNext && gapToNext > 0 ? ` — closing it is worth more than the ${gapToNext} pts separating you from #${userRank - 1}` : ' — sharpen it to protect your rank'}.`
        : gapToNext && gapToNext > 0
          ? `${gapToNext} points from #${userRank - 1}${aheadOfUser?.name ? ` (${aheadOfUser.name.split(' ')[0]})` : ''}.`
          : `Top ${100 - (userPercentile ?? 0)}% of ${totalCount} tracked students.`;

  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);
  const clockNow = new Date();

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={S.page}>
        <style>{`
          @keyframes lbShimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
          .lb-sk { background: linear-gradient(90deg, ${C.line} 25%, #fff 37%, ${C.line} 63%); background-size: 400px 100%; animation: lbShimmer 1.4s ease infinite; }
        `}</style>
        <div style={S.container}>
          <div className="lb-sk" style={{ width: 240, height: 34, borderRadius: 10, marginBottom: 20 }} />
          <div className="lb-sk" style={{ borderRadius: 22, height: 200, marginBottom: 16 }} />
          <div className="lb-sk" style={{ borderRadius: 18, height: 64, marginBottom: 16 }} />
          <div className="lb-sk" style={{ borderRadius: 20, height: 320, marginBottom: 16 }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="lb-sk" style={{ borderRadius: 14, height: 68, marginBottom: 10, opacity: 1 - i * 0.14 }} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Error state — a failed fetch must never look like "0 entries" ─────────
  if (loadError) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorCard}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <div style={S.emptyTitle}>Couldn't load the leaderboard</div>
            <div style={S.emptyDesc}>{loadError}</div>
            <button
              onClick={() => setRetryToken(t => t + 1)}
              style={S.btnBlue}
              className="mm-btn-blue lb-new-iv-btn"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <GlobalStyles />

      {/* ── Sticky condensed rank bar — follows you through the table ── */}
      {showSticky && currentUser && (
        <div style={S.stickyBar} className="lb-sticky">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <span style={S.liveDot} />
            <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.name?.split(' ')[0] || currentUser.name}
            </span>
            {userRank && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                <span style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: '#fff' }}>#{userRank}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.cyanBright }}>{currentUserScore}/100</span>
              </>
            )}
            {weakestDim && (
              <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.orange, background: 'rgba(194,83,12,0.18)', border: '1px solid rgba(194,83,12,0.3)', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }} className="mm-sticky-weak">
                ⚠ {weakestDim.label}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {userRank ? (
              <button
                style={{ border: 'none', borderRadius: 8, background: `linear-gradient(135deg, ${C.blueBright}, ${C.cyanBright})`, color: '#fff', padding: '7px 14px', fontSize: 11.5, fontWeight: 800, fontFamily: F.body, cursor: 'pointer' }}
                onClick={() => weakestPracticeTopic
                  ? navigate('/interview', { state: { mode: 'topic', topic: weakestPracticeTopic } })
                  : navigate('/interview')}
              >
                🎯 {weakestDim ? `Sharpen ${weakestDim.label}` : 'Practice'}
              </button>
            ) : (
              <span style={{ fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>unranked</span>
            )}
          </div>
        </div>
      )}

      <div style={S.page} className="mm-page">
        <div style={S.container}>

          {/* ── STATUS STRIP ──────────────────────────────────────────── */}
          <div style={S.strip} className="mm-strip">
            <div style={S.stripL}>
              <span style={S.liveDot} />
              <span style={S.mono}>mockmate leaderboard</span>
            </div>
            <div style={S.stripR} className="mm-strip-r">
              <span style={S.mono}>session {sessionId}</span>
              <span style={{ color: C.lineMd }}>·</span>
              <span style={S.mono}>
                {clockNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase()}
              </span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
               HERO — mirrors Coach's CommandHeader pixel-for-pixel
               (same gradient, glow orbs, border, chip row, F.display head,
               button styles) with leaderboard-native content.
               New: IRS chip from /performance, urgency bar, streak note.
          ════════════════════════════════════════════════════════════════ */}
          <section ref={heroRef} style={S.hero} className="mm-hero">
            {/* Glow orbs — exact positions from CommandHeader */}
            <div style={S.heroGlowTop} />
            <div style={S.heroGlowBottom} />

            {/* Top row: headline block + chip row */}
            <div style={S.heroTopRow} className="mm-hero-top">
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <Eyebrow>⚡ rank command center</Eyebrow>
                <h1 style={S.heroH1}>
                  {currentUser?.name?.split(' ')[0]
                    ? `${currentUser.name.split(' ')[0]}, ${heroVerdict}`
                    : heroVerdict}
                </h1>
                <p style={S.heroSub}>{heroSub}</p>
              </div>

              {/* Chip row — 5 chips matching Coach's IRS/Tier/Sessions/Last/Trend */}
              <div style={S.heroChipRow} className="mm-irs-num mm-hero-chips">
                {userRank != null ? (
                  <HeroChip label="RANK" value={`#${userRank}`} color="#fff" />
                ) : null}
                {currentUserScore != null ? (
                  <HeroChip label="AVG SCORE" value={`${currentUserScore}/100`} color={scoreColor(currentUserScore)} />
                ) : null}
                {userIRS != null ? (
                  <div className="mm-hero-chip-irs">
                    <HeroChip label="IRS" value={`${userIRS}/100`} color={scoreColor(userIRS)} />
                  </div>
                ) : null}
                {gapToNext != null && gapToNext > 0 ? (
                  <div className="mm-hero-chip-gap">
                    <HeroChip label="GAP TO #1" value={`${gapToNext} pts`} color={C.cyanBright} />
                  </div>
                ) : null}
                {weakestDim ? (
                  <div className="mm-hero-chip-weakest">
                    <HeroChip label="WEAKEST" value={`${weakestDim.icon || '⚠'} ${weakestDim.label}`} color={C.orange} />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Climb track — leaderboard-unique, sits between chips and CTAs */}
            {userRank != null && currentUserScore != null && (
              <div className="mm-track-wrap">
                <ClimbTrack
                  mounted={mounted}
                  maxScore={maxScore}
                  you={{ score: currentUserScore, label: currentUser?.name?.split(' ')[0] || 'You' }}
                  rival={aheadOfUser
                    ? { score: Number(aheadOfUser.avgScore), label: aheadOfUser.name?.split(' ')[0] || `#${userRank - 1}` }
                    : null}
                  leader={top3[0]?.avgScore != null
                    ? { score: Number(top3[0].avgScore), label: top3[0].name?.split(' ')[0] || '#1' }
                    : null}
                />
              </div>
            )}

            {/* Urgency bar — progress toward the leader's score */}
            {urgencyPct != null && (
              <div style={S.urgencyWrap}>
                <div style={S.urgencyTrack}>
                  <div style={{ ...S.urgencyFill, width: mounted ? `${urgencyPct}%` : '0%' }} />
                  <div style={{ ...S.urgencyThumb, left: mounted ? `${urgencyPct}%` : '0%' }} />
                </div>
                <div style={S.urgencyLabels}>
                  <span style={S.urgencyLabelL} className="mm-urgency-label">you · {currentUserScore}/100</span>
                  <span style={S.urgencyLabelR} className="mm-urgency-label">🥇 leader · {top3[0]?.avgScore}/100</span>
                </div>
              </div>
            )}

            {/* CTAs — exact Coach button styling */}
            <div style={S.heroActions} className="mm-hero-actions">
              <button
                style={S.btnPrimary}
                className="mm-btn-primary"
                onClick={() => weakestPracticeTopic
                  ? navigate('/interview', { state: { mode: 'topic', topic: weakestPracticeTopic } })
                  : navigate('/interview')}
              >
                🎯 {weakestDim ? `Sharpen ${weakestDim.label}` : 'Start Interview'}
              </button>
              <button
                style={S.btnGhost}
                className="mm-btn-ghost"
                onClick={() => navigate('/analytics')}
              >
                📊 Full Analytics
              </button>
              {currentUserStreak >= 2 && (
                <div style={S.heroStreakChip} className="mm-hero-streak">
                  🔥 {currentUserStreak}-day streak
                </div>
              )}
            </div>
          </section>

          {/* ── RIVAL CARD — the one person between you and moving up ─── */}
          {currentUser && aheadOfUser && userRank != null && userRank > 1 && (
            <RivalCard
              rival={aheadOfUser}
              gapToNext={gapToNext}
              userRank={userRank}
              navigate={navigate}
              weakestDim={weakestDim}
              weakestPracticeTopic={weakestPracticeTopic}
              mounted={mounted}
            />
          )}

          {/* ── DEDICATED TOGGLE SECTION ─────────────────────────────────── */}
          <section style={S.toggleCard} className="lb-toggle-card">
            <div style={S.toggleHeadRow}>
              <div style={S.eyebrow}>Board settings</div>
              <div style={S.mono}>viewing {activeData.length !== rawData.length ? `${activeData.length} of ` : ''}{rawData.length} {rawData.length === 1 ? 'entry' : 'entries'}</div>
            </div>

            <div style={S.toggleGrid} className="lb-toggle-grid">
              <ToggleGroup
                label="Time period"
                icon="◷"
                options={[
                  { id: 'weekly', label: 'This week', helper: 'Resets every Monday' },
                  { id: 'overall', label: 'Overall', helper: 'All-time record' },
                ]}
                value={activePeriod}
                onChange={setActivePeriod}
                accent={C.signal}
                accentTint={C.signalTint}
              />
              <ToggleGroup
                label="Scope"
                icon="◎"
                options={[
                  { id: 'global', label: 'Global', helper: `${selectedBoard.globalTotal || 0} students` },
                  { id: 'college', label: currentUser?.college?.split(' ')[0] || 'College', helper: `${selectedBoard.collegeTotal || 0} students` },
                ]}
                value={activeTab}
                onChange={setActiveTab}
                accent={C.pulseDeep}
                accentTint={C.pulseTint}
              />
            </div>
          </section>

          {/* ── DIMENSION RADAR — skill shape at a glance ─────────────── */}
          {dimensionProfile.length > 0 && (
            <DimensionRadar dimensionProfile={dimensionProfile} mounted={mounted} />
          )}

          {/* ── PREMIUM PODIUM ─────────────────────────────────────────── */}
          {top3.length >= 1 && (
            <div style={S.podiumCard} className="lb-podium-wrap">
              <div style={S.podiumGlowTop} />
              <div style={S.podiumHeader}>
                <div>
                  <div style={S.eyebrow}>Top performers</div>
                  <h2 style={S.cardH2}>{periodLabel === 'this week' ? 'This week\u2019s leaders' : 'All-time leaders'}</h2>
                </div>
                {leaderIsPlatinum && (
                  <div style={{ ...S.tierBadgeSm, color: '#fff', background: `linear-gradient(135deg, ${C.platinum}, #7B84E8)`, borderColor: 'transparent', boxShadow: '0 4px 14px rgba(76,87,199,0.35)' }}>
                    ♛ platinum leader
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 360, marginTop: 18, position: 'relative' }}>
                <div style={S.podiumFloorGlow} />
                {podiumOrder.map((entry, i) => (
                  <PodiumBlock
                    key={`podium-${podiumPlace[i]}-${activePeriod}-${activeTab}`}
                    entry={entry}
                    place={podiumPlace[i]}
                    delay={podiumDelay[i]}
                    isPlatinum={leaderIsPlatinum}
                    mounted={podiumMounted}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Search + table header row ── */}
          {rawData.length > 0 && (
            <div style={S.searchRow}>
              <div style={S.searchBox} className="lb-search-box">
                <span style={{ fontSize: 13, color: C.muted }}>🔍</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a name on this board…"
                  style={S.searchInput}
                />
                {query && (
                  <button onClick={() => setQuery('')} style={S.searchClear} aria-label="Clear search">✕</button>
                )}
              </div>
              <div style={S.mono}>{activeData.length} of {rawData.length} shown</div>
            </div>
          )}

          {/* ── Full table ── */}
          {rawData.length === 0 ? (
            <div style={S.emptyCard}>
              <div style={{ fontSize: 46, marginBottom: 12 }}>🏆</div>
              <div style={S.emptyTitle}>
                {activePeriod === 'weekly' ? 'No rankings this week' : 'No overall rankings yet'}
              </div>
              <div style={S.emptyDesc}>
                {activePeriod === 'weekly'
                  ? 'Complete an interview this week to appear here.'
                  : 'Complete an interview to appear on the overall leaderboard.'}
              </div>
              <button onClick={() => navigate('/interview')} style={S.btnBlue} className="mm-btn-blue lb-new-iv-btn">
                Start interview →
              </button>
            </div>
          ) : activeData.length === 0 ? (
            <div style={S.emptyCard}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔎</div>
              <div style={S.emptyTitle}>No matches for "{query}"</div>
              <div style={S.emptyDesc}>Try a different name, or clear the search to see everyone.</div>
              <button onClick={() => setQuery('')} style={S.btnGhostLight}>Clear search</button>
            </div>
          ) : (
            // Keyed on period+scope so switching tabs cleanly remounts the list —
            // real re-render with a fresh stagger-in, not a stale instant swap.
            <div style={S.tableCard} key={`${activePeriod}-${activeTab}`} className="lb-table-swap">
              <div style={S.tableHeadRow}>
                <div style={{ width: 46, ...S.colLabel }}>RANK</div>
                <div style={{ width: 44 }} />
                <div style={{ flex: 1, ...S.colLabel }}>NAME</div>
                <div style={{ width: 110, ...S.colLabel }} className="lb-college-col">COLLEGE</div>
                <div style={{ width: 68, textAlign: 'center', ...S.colLabel }} className="lb-efficiency-col">EFF.</div>
                <div style={{ width: 56, textAlign: 'center', ...S.colLabel }} className="lb-trend-col">TREND</div>
                <div style={{ width: 90, textAlign: 'right', ...S.colLabel }}>SCORE</div>
                <div style={{ width: 18 }} />
              </div>

              {activeData.map((entry, idx) => {
                const numericRank = Number(entry.rank) || idx + 1;
                const numericScore = Number(entry.avgScore) || 0;
                const sessionCount = Number(entry.sessionCount) || 0;
                const sColor = scoreColor(numericScore);
                const isYou = Boolean(entry.isCurrentUser);
                const rowId = entry._id || `${activePeriod}-${activeTab}-${idx}`;
                const isExpanded = expandedId === rowId;
                const platinumRow = isPlatinumBand(numericRank, totalCount);

                const delta = activePeriod === 'weekly'
                  ? mockDelta(numericRank, idx + String(entry._id || '').charCodeAt(0) || 0)
                  : 0;
                const isNew = activePeriod === 'weekly' && sessionCount === 1 && numericRank > 3;
                const eff = efficiency(numericScore, sessionCount);

                const trendPoints = Array.isArray(entry.recentScores) && entry.recentScores.length
                  ? entry.recentScores.slice(-6)
                  : null;

                const tierColor = numericRank <= 3
                  ? [C.gold, C.silver, C.bronze][numericRank - 1]
                  : platinumRow ? C.platinum : C.signal;

                return (
                  <div key={rowId}>
                    <div
                      className={`lb-row${isYou ? ' lb-row-you' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : rowId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 0, padding: '14px 20px',
                        borderBottom: (idx < activeData.length - 1 || isExpanded) ? `1px solid ${C.line}` : 'none',
                        background: isYou ? `linear-gradient(90deg, ${C.pulseTint} 0%, ${C.signalTint} 100%)` : (platinumRow ? C.platinumTint : C.surface),
                        animation: `lbSlideIn 0.34s ease ${Math.min(idx * 40, 560)}ms both`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 46, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: numericRank <= 3 ? tierColor : C.muted, letterSpacing: '-0.2px' }}>
                          #{numericRank}
                        </span>
                      </div>

                      <div style={{ width: 44, flexShrink: 0 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          border: `2px solid ${isYou ? C.pulse : (numericRank <= 3 || platinumRow) ? `${tierColor}66` : C.lineMd}`,
                          boxShadow: isYou ? '0 2px 10px rgba(0,194,232,0.30)' : 'none',
                        }}>
                          <Avatar src={entry.avatar} name={entry.name} style={{ borderRadius: 8 }}>
                            <div style={{
                              width: '100%', height: '100%',
                              background: isYou
                                ? `linear-gradient(135deg, ${C.signal}, ${C.pulse})`
                                : (numericRank <= 3 || platinumRow) ? `linear-gradient(135deg, ${tierColor}33, ${tierColor}99)` : C.signalTint,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: F.serif, fontSize: 14, fontWeight: 600,
                              color: isYou ? '#fff' : (numericRank <= 3 || platinumRow) ? tierColor : C.signalDeep,
                            }}>
                              {entry.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          </Avatar>
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                          <span style={{ fontFamily: F.body, fontSize: 13.5, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.name || 'Unknown'}
                          </span>
                          {isYou && (
                            <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.pulseDeep, background: C.pulseTint, border: `1px solid ${C.pulse}55`, padding: '1px 7px', borderRadius: 99, flexShrink: 0 }}>
                              YOU
                            </span>
                          )}
                          {platinumRow && !isYou && (
                            <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.platinum, background: C.platinumTint, border: `1px solid ${C.platinum}44`, padding: '1px 7px', borderRadius: 99, flexShrink: 0 }}>
                              ♛
                            </span>
                          )}
                          <StreakBadge streak={entry.streak} />
                          <DeltaBadge delta={delta} isNew={isNew} showDelta={activePeriod === 'weekly'} />
                        </div>
                        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>
                          {sessionCount} session{sessionCount !== 1 ? 's' : ''}{activePeriod === 'weekly' ? ' this week' : ' total'}
                        </div>
                      </div>

                      <div style={{ width: 110, fontFamily: F.body, fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }} className="lb-college-col">
                        {entry.college || '—'}
                      </div>

                      <div style={{ width: 68, textAlign: 'center', flexShrink: 0 }} className="lb-efficiency-col">
                        <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: eff >= 70 ? C.green : eff >= 50 ? C.signal : C.muted }}>
                          {eff}
                        </span>
                      </div>

                      {/* Inline sparkline — last 5 scores as tiny bars */}
                      <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="lb-trend-col">
                        {trendPoints && trendPoints.length > 1 ? (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
                            {trendPoints.slice(-5).map((p, i) => {
                              const h = Math.max(3, Math.round((p / 100) * 22));
                              return (
                                <div key={i} style={{ width: 5, height: h, borderRadius: 2, background: scoreColor(p), opacity: 0.7 + i * 0.06 }} />
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>—</span>
                        )}
                      </div>

                      <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: sColor, marginBottom: 5, letterSpacing: '-0.3px' }}>
                          {numericScore}
                          <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, color: C.muted }}>/100</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <ScoreBar score={numericScore} max={maxScore} />
                        </div>
                      </div>

                      <div style={{ width: 18, textAlign: 'right', flexShrink: 0, color: C.faint, fontSize: 10, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}>
                        ›
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{
                        padding: '16px 20px 18px 66px',
                        background: C.surfaceSunk,
                        borderBottom: idx < activeData.length - 1 ? `1px solid ${C.line}` : 'none',
                        animation: 'lbFadeUp 0.22s ease',
                      }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.5px', color: C.muted, marginBottom: 10, textTransform: 'lowercase' }}>
                          recent session trend
                        </div>
                        <MiniTrend points={trendPoints || []} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Stat summary strip ── */}
          {rawData.length >= 1 && (
            <section style={S.statRail} className="mm-stat-rail">
              <RailStat label="Top score" value={`${maxScore}/100`} color={C.gold} />
              <RailStat label="Field size" value={`${totalCount} ${totalCount === 1 ? 'student' : 'students'}`} color={C.signal} />
              <RailStat
                label="Field avg"
                value={`${rawData.length ? Math.round(rawData.reduce((sum, e) => sum + (Number(e.avgScore) || 0), 0) / rawData.length) : 0}/100`}
                color={C.pulseDeep}
              />
              <RailStat label="Platinum band" value={`Top 5% · 95th+`} color={C.platinum} sub={`${Math.max(1, Math.round(totalCount * 0.05))} students`} />
            </section>
          )}

          {/* ── CTA footer ── */}
          <div style={S.ctaBanner}>
            <div style={S.heroNoise} />
            <div style={{ position: 'relative' }}>
              <div style={S.heroKicker}>climb the ranks</div>
              <div style={S.ctaTitle}>
                {activePeriod === 'weekly'
                  ? 'Every interview moves you up this week.'
                  : 'Every interview contributes to your overall standing.'}
              </div>
              <div style={S.ctaSub}>
                {activePeriod === 'weekly'
                  ? 'Weekly rankings reset every Monday. Your overall record stays intact.'
                  : 'Overall rankings use all of your completed interviews and never reset.'}
              </div>
            </div>
            <button onClick={() => navigate('/interview')} style={S.btnBannerCta} className="mm-banner-cta">
              Practice now →
            </button>
          </div>

          <footer style={S.footerRow}>
            <span style={S.mono}>mockmate leaderboard v3 · aligned to readiness terminal v6</span>
            <span style={S.mono}>ranks recompute live · weekly resets monday</span>
          </footer>
        </div>
      </div>
    </>
  );
};

// ─── Dedicated toggle group ───────────────────────────────────────────────────

const ToggleGroup = ({ label, icon, options, value, onChange, accent, accentTint }) => {
  const activeIdx = options.findIndex(o => o.id === value);
  return (
    <div style={S.toggleGroupWrap}>
      <div style={S.toggleGroupLabel}>
        <span style={{ fontSize: 12, color: accent }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={S.toggleGroupTrack}>
        <div
          style={{
            ...S.toggleGroupThumb,
            width: `calc(${100 / options.length}% - 4px)`,
            transform: `translateX(${activeIdx * 100}%)`,
            background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
          }}
        />
        {options.map(opt => {
          const isActive = opt.id === value;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className="lb-toggle-opt"
              style={{
                ...S.toggleGroupBtn,
                color: isActive ? '#fff' : C.sub,
              }}
            >
              <span style={S.toggleOptLabel}>{opt.label}</span>
              <span style={{ ...S.toggleOptHelper, color: isActive ? 'rgba(255,255,255,0.75)' : C.muted }}>{opt.helper}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Rail stat ───────────────────────────────────────────────────────────────

const RailStat = ({ label, value, sub, color }) => (
  <div style={S.railCell} className="mm-rail-cell">
    <div style={S.railLabel}>{label}</div>
    <div style={S.railValRow}>
      <span style={{ ...S.railVal, color, fontSize: 22 }}>{value}</span>
    </div>
    {sub && <div style={S.railSub}>{sub}</div>}
  </div>
);

// ─── Global styles ─────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; }
    ::selection { background: rgba(0,87,232,0.16); color: ${C.ink}; }

    @keyframes lbPodiumRise { 0% { opacity: 0; transform: translateY(56px) scale(0.9); } 60% { opacity: 1; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes lbSlideIn    { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes lbFadeUp     { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes livePulse    { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes heroSweep    { 0% { transform:translateX(-30%); } 100% { transform:translateX(130%); } }
    @keyframes scaleIn      { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
    @keyframes trackPulse   { 0%, 100% { box-shadow: 0 0 0 4px rgba(0,200,240,0.18); } 50% { box-shadow: 0 0 0 7px rgba(0,200,240,0.08); } }
    .mm-track-you > div:first-child { animation: trackPulse 2.4s ease-in-out infinite 1.4s; }
    @keyframes lbAvatarFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes lbPlinthSweep { 0% { left: -40%; } 100% { left: 130%; } }
    @keyframes lbGlowPulse  { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }

    .mm-page ::-webkit-scrollbar { width: 5px; height: 5px; }
    .mm-page ::-webkit-scrollbar-track { background: transparent; }
    .mm-page ::-webkit-scrollbar-thumb { background: ${C.lineMd}; border-radius: 4px; }
    .mm-page ::-webkit-scrollbar-thumb:hover { background: ${C.lineStr}; }

    .lb-table-swap { animation: lbTableSwap 0.28s ease both; }
    @keyframes lbTableSwap { from { opacity: 0.4; } to { opacity: 1; } }

    .lb-row { transition: background 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease; }
    .lb-row:hover { background: ${C.signalTint} !important; transform: translateX(4px); box-shadow: inset 3px 0 0 ${C.signal}; }
    .lb-row-you:hover { box-shadow: inset 3px 0 0 ${C.pulse} !important; }

    .lb-avatar-float { animation: lbAvatarFloat 3.2s ease-in-out infinite; }
    .lb-plinth-sweep { animation: lbPlinthSweep 3.4s ease-in-out infinite 1.1s; }
    .lb-podium-lead { position: relative; }

    .lb-podium-col { transition: transform 0.22s cubic-bezier(.16,1,.3,1); cursor: default; }
    .lb-podium-col:hover { transform: translateY(-4px); }

    .lb-toggle-opt { transition: color 0.2s ease; cursor: pointer; }

    .lb-search-box { transition: border-color 0.16s ease, box-shadow 0.16s ease; }
    .lb-search-box:focus-within { border-color: ${C.signal} !important; box-shadow: 0 0 0 3px ${C.signalTint} !important; }

    .mm-rail-cell { transition: background 0.18s ease !important; }
    .mm-rail-cell:hover { background: ${C.surfaceSunk} !important; }

    .mm-btn-primary { transition: transform 0.15s cubic-bezier(.16,1,.3,1), box-shadow 0.15s ease !important; }
    .mm-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 28px rgba(0,173,224,0.45) !important; }

    .mm-btn-ghost { transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease !important; }
    .mm-btn-ghost:hover { background: rgba(255,255,255,0.14) !important; transform: translateY(-1px) !important; }

    .mm-btn-blue { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .mm-btn-blue:hover { box-shadow: 0 8px 22px rgba(0,87,232,0.35) !important; transform: translateY(-2px) !important; }

    .mm-banner-cta { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .mm-banner-cta:hover { box-shadow: 0 10px 24px rgba(0,87,232,0.32) !important; transform: translateY(-2px) !important; }

    .mm-strip { transition: box-shadow 0.2s ease !important; }
    .mm-strip:hover { box-shadow: ${C.shadowMd} !important; }

    .mm-irs-num { animation: scaleIn 0.7s cubic-bezier(.16,1,.3,1) both 0.1s; }

    @media (prefers-reduced-motion: reduce) {
      .mm-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1020px) {
      .mm-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
      .lb-toggle-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 640px) {
      .mm-hero-top   { flex-direction: column !important; align-items: flex-start !important; }
      .mm-hero-chips { margin-top: 16px !important; }
    }
    @media (max-width: 700px) {
      .lb-college-col, .lb-efficiency-col, .lb-trend-col { display: none !important; }
    }
    @media (max-width: 760px) {
      .mm-strip-r { display: none !important; }
    }
    @media (max-width: 480px) {
      /* Page */
      .mm-page { padding: 14px 12px 60px !important; }
      .mm-stat-rail { grid-template-columns: 1fr !important; }

      /* Hero panel — tighter padding on small screens */
      .mm-hero { padding: 20px 18px 20px !important; border-radius: 18px !important; }

      /* Chip row — hide IRS and GAP on very small screens (3 chips is enough).
         RANK + AVG SCORE + WEAKEST are highest signal, IRS and GAP are secondary. */
      .mm-hero-chip-irs   { display: none !important; }
      .mm-hero-chip-gap   { display: none !important; }

      /* Weakest chip value — long labels like "System Design" need to truncate */
      .mm-hero-chip-weakest .chip-val { font-size: 11px !important; max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* Actions — stack buttons full-width */
      .mm-hero-actions { flex-direction: column !important; align-items: stretch !important; }
      .mm-hero-actions > button { text-align: center !important; justify-content: center !important; }
      .mm-hero-streak { width: 100% !important; justify-content: center !important; }
      .mm-sticky-weak { display: none !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    background: C.paper,
    backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(0,87,232,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,194,232,0.04) 0%, transparent 40%)`,
    padding: '24px 28px 80px',
    fontFamily: F.body,
  },
  container: { maxWidth: 1260, margin: '0 auto' },

  strip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', marginBottom: 20, borderRadius: 11, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow },
  stripL: { display: 'flex', alignItems: 'center', gap: 9 },
  stripR: { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'livePulse 2.4s ease-in-out infinite', flexShrink: 0 },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.3px', color: C.muted },

  stickyBar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 24px', background: 'linear-gradient(135deg, #060E20 0%, #0C2242 100%)',
    boxShadow: '0 6px 20px rgba(4,12,34,0.28)', animation: 'lbFadeUp 0.22s ease',
  },

  // ── HERO — matches Coach's CommandHeader panel exactly (same gradient
  // stops, same glow orbs, same border/shadow) so the two "welcome back"
  // surfaces read as one product. Content below is leaderboard-native. ──
  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '28px 32px', marginBottom: 18, borderRadius: 24,
    background: `linear-gradient(135deg, ${C.heroDark0} 0%, ${C.heroBlue900} 40%, #001A3A 70%, ${C.heroDark0} 100%)`,
    border: '1px solid rgba(0,200,240,0.18)',
    boxShadow: '0 24px 72px rgba(0,20,80,0.55)',
  },
  heroGlowTop:    { position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,240,0.08) 0%, transparent 70%)', pointerEvents: 'none' },
  heroGlowBottom: { position: 'absolute', bottom: -40, left: 80, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,110,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' },
  heroTopRow:     { position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' },
  heroH1:         { margin: '8px 0 6px', fontFamily: F.display, fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.5px', maxWidth: 560 },
  heroSub:        { margin: 0, fontFamily: F.body, fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.52)', maxWidth: 480 },
  heroActions:    { position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 22 },

  // Chip row — exact pixel values from Coach CommandHeader .map() block
  heroChipRow:   { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' },
  heroChip:      { padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', minWidth: 78 },
  heroChipLabel: { fontFamily: F.mono, fontSize: 7.5, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.3)', marginBottom: 4 },
  heroChipVal:   { fontFamily: F.display, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' },

  // Streak chip beside CTAs — subdued so it doesn't compete with primary action
  heroStreakChip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: F.body, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)' },

  // Urgency bar — single glance answer to "how far am I from the leader?"
  urgencyWrap:   { position: 'relative', marginTop: 26 },
  urgencyTrack:  { position: 'relative', height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.10)', overflow: 'visible' },
  urgencyFill:   { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${C.blueBright}, ${C.cyanBright})`, transition: 'width 1.4s cubic-bezier(.16,1,.3,1) 0.4s', boxShadow: `0 0 8px ${C.cyanBright}55` },
  urgencyThumb:  { position: 'absolute', top: '50%', width: 8, height: 8, borderRadius: '50%', background: C.cyanBright, border: '2px solid rgba(10,22,40,0.9)', transform: 'translate(-50%,-50%)', transition: 'left 1.4s cubic-bezier(.16,1,.3,1) 0.4s', boxShadow: `0 0 6px ${C.cyanBright}` },
  urgencyLabels: { display: 'flex', justifyContent: 'space-between', marginTop: 8 },
  urgencyLabelL: { fontFamily: F.mono, fontSize: 9.5, color: C.cyanBright, fontWeight: 700 },
  urgencyLabelR: { fontFamily: F.mono, fontSize: 9.5, color: 'rgba(255,255,255,0.35)', fontWeight: 600 },

  // Climb track — leaderboard-specific (not in Coach), between chips and CTAs
  track:          { position: 'relative', marginTop: 28 },
  trackLine:      { position: 'relative', height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.12)' },
  trackFill:      { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, rgba(0,200,240,0.5), ${C.cyanBright})`, transition: 'width 1.1s cubic-bezier(.16,1,.3,1) 0.3s' },
  trackNode:      { position: 'absolute', top: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(.34,1.4,.64,1)' },
  trackDot:       { width: 12, height: 12, borderRadius: '50%', border: '2px solid', boxSizing: 'border-box' },
  trackDotYou:    { background: C.cyanBright, borderColor: C.cyanBright, boxShadow: `0 0 0 4px rgba(0,200,240,0.18)` },
  trackDotRival:  { background: '#0A1F3E', borderColor: 'rgba(255,255,255,0.55)' },
  trackDotLeader: { background: C.gold, borderColor: C.gold },
  trackTag:       { textAlign: 'center', whiteSpace: 'nowrap' },
  trackTagLabel:  { fontFamily: F.body, fontSize: 11, fontWeight: 700, marginBottom: 2 },
  trackTagScore:  { fontFamily: F.mono, fontSize: 10, color: 'rgba(255,255,255,0.45)' },

  // Bottom CTA banner only — not the hero
  heroNoise:  { position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent)', animation: 'heroSweep 11s linear infinite' },
  heroKicker: { fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: '1.8px', color: C.cyanBright, textTransform: 'uppercase' },

  // Buttons — exact Coach CommandHeader values
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${C.blueBright}, ${C.cyanBright})`, color: '#fff', padding: '11px 22px', fontSize: 13, fontWeight: 800, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,173,224,0.35)' },
  btnGhost: { border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', padding: '11px 22px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer' },
  btnGhostLight: { border: `1px solid ${C.lineMd}`, borderRadius: 11, background: C.surface, color: C.signalDeep, padding: '11px 20px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', marginTop: 6 },
  btnBlue: { border: 'none', borderRadius: 11, background: `linear-gradient(135deg, ${C.signalDeep}, ${C.signal})`, color: '#fff', padding: '12px 24px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 4px 14px rgba(0,87,232,0.28)`, textAlign: 'center', letterSpacing: '-0.1px', marginTop: 8 },
  btnBannerCta: { flexShrink: 0, border: 'none', borderRadius: 12, background: '#fff', color: C.signalDeep, padding: '14px 24px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', position: 'relative' },

  // Dedicated toggle section — its own card, echoes stat-rail grammar
  toggleCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: '20px 22px', boxShadow: C.shadow, marginBottom: 18 },
  toggleHeadRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  toggleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  toggleGroupWrap: {},
  toggleGroupLabel: { display: 'flex', alignItems: 'center', gap: 7, fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: '0.3px', marginBottom: 9, textTransform: 'lowercase' },
  toggleGroupTrack: { position: 'relative', display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: C.surfaceSunk, border: `1px solid ${C.line}` },
  toggleGroupThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 10, transition: 'transform 0.28s cubic-bezier(.16,1,.3,1)', boxShadow: '0 4px 14px rgba(0,0,0,0.14)' },
  toggleGroupBtn: { position: 'relative', zIndex: 1, flex: 1, border: 'none', background: 'transparent', padding: '10px 12px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontFamily: F.body },
  toggleOptLabel: { fontSize: 12.5, fontWeight: 700 },
  toggleOptHelper: { fontSize: 9, fontFamily: F.mono },

  // Podium card — more elevated / centerpiece treatment
  podiumCard: { position: 'relative', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 24, padding: '28px 26px 0', boxShadow: '0 8px 32px rgba(15,45,120,0.10), 0 2px 8px rgba(10,22,40,0.05)', marginBottom: 16, overflow: 'hidden' },
  podiumGlowTop: { position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 420, height: 200, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(173,127,16,0.10), transparent 70%)', pointerEvents: 'none' },
  podiumFloorGlow: { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 40, background: 'radial-gradient(ellipse, rgba(173,127,16,0.14), transparent 75%)', pointerEvents: 'none' },
  podiumHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative' },
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.8px', color: C.signal, marginBottom: 7, textTransform: 'lowercase' },
  cardH2: { margin: 0, fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: '-0.2px' },
  tierBadgeSm: { fontFamily: F.mono, fontSize: 10, fontWeight: 700, padding: '5px 11px', borderRadius: 8, border: '1px solid', flexShrink: 0 },

  searchRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 11, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow, flex: '1 1 260px', maxWidth: 340 },
  searchInput: { border: 'none', outline: 'none', background: 'transparent', fontFamily: F.body, fontSize: 13, color: C.ink, flex: 1, minWidth: 0 },
  searchClear: { border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 11, padding: 2 },

  emptyCard: { background: C.surface, border: `1.5px dashed ${C.lineMd}`, borderRadius: 20, padding: '64px 24px', textAlign: 'center' },
  errorCard: { background: C.surface, border: `1.5px dashed ${C.red}55`, borderRadius: 20, padding: '64px 24px', textAlign: 'center', marginTop: 20 },
  emptyTitle: { fontFamily: F.body, fontSize: 18, fontWeight: 800, color: C.ink, marginBottom: 8 },
  emptyDesc: { fontFamily: F.body, fontSize: 14, color: C.sub, marginBottom: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' },

  tableCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, overflow: 'hidden', boxShadow: C.shadow, marginBottom: 16 },
  tableHeadRow: { display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: `1px solid ${C.line}`, background: C.surfaceSunk },
  colLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.5px' },

  statRail: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 18, borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow, overflow: 'hidden' },
  railCell: { padding: '18px 20px', borderRight: `1px solid ${C.line}` },
  railLabel: { fontSize: 10.5, fontWeight: 500, color: C.muted, letterSpacing: '0.1px', textTransform: 'uppercase' },
  railValRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 },
  railVal: { fontFamily: F.display, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.4px' },
  railSub: { marginTop: 6, fontSize: 10.5, color: C.muted },

  // ── Rival card — DarkCard grammar, accent border-left ──────────────────
  rivalCard: { position: 'relative', marginBottom: 18, borderRadius: 18, background: `linear-gradient(145deg, ${C.heroDark2} 0%, ${C.heroDark1} 100%)`, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,20,80,0.28)', overflow: 'hidden' },
  rivalAccentBar: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%', borderRadius: '18px 0 0 18px' },
  rivalInner: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, padding: '22px 24px 22px 28px', flexWrap: 'wrap' },
  rivalLeft: { flex: '1 1 220px', minWidth: 0 },
  rivalRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  rivalName: { display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 6px' },
  rivalAvatar: { width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.serif, fontSize: 16, fontWeight: 600, color: '#fff', flexShrink: 0 },
  rivalNameText: { fontFamily: F.display, fontSize: 15, fontWeight: 800, color: '#fff' },
  rivalNameSub: { fontFamily: F.mono, fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  rivalMsg: { margin: 0, fontFamily: F.body, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 },
  rivalScoreBlock: { textAlign: 'right' },
  rivalGapBlock: { textAlign: 'right' },
  rivalScoreLabel: { fontFamily: F.mono, fontSize: 7.5, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.3)', marginBottom: 2 },
  rivalScoreVal: { fontFamily: F.display, fontSize: 24, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.5px' },

  // ── Dimension radar ─────────────────────────────────────────────────────
  radarCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: '22px 24px', boxShadow: C.shadow, marginBottom: 18 },
  radarHeader: { marginBottom: 18 },
  cardH2Light: { margin: '0 0 2px', fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink, letterSpacing: '-0.2px' },
  radarSub: { margin: 0, fontFamily: F.body, fontSize: 12, color: C.muted, lineHeight: 1.5 },
  radarBody: { display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' },
  radarLegend: { flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 },
  radarLegendRow: { display: 'flex', alignItems: 'center', gap: 10 },

  ctaBanner: {
    position: 'relative', overflow: 'hidden',
    marginTop: 4, padding: '26px 30px', borderRadius: 20,
    background: `linear-gradient(150deg, #060E20 0%, #0A1832 42%, #0C2340 100%)`,
    boxShadow: C.shadowLg,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
  },
  ctaTitle: { fontFamily: F.serif, fontSize: 19, fontWeight: 500, color: '#fff', margin: '10px 0 6px', lineHeight: 1.3 },
  ctaSub: { fontFamily: F.body, fontSize: 12.5, color: 'rgba(255,255,255,0.62)', maxWidth: 440, lineHeight: 1.6 },

  footerRow: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '20px 4px 0', opacity: 0.42 },
};

export default Leaderboard;
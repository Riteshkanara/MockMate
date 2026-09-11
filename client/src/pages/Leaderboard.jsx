import { useEffect, useMemo, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE from '../config/api.js';
import { AuthContext, authFetch } from '../context/AuthContext.jsx';
import { getAnalytics, getPerformanceAnalytics } from '../Services/interviewService.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — LEADERBOARD v6 (Dashboard-matched hero, shared Navbar restored)
// Hero rebuilt to match the Dashboard's visual language exactly: a flat
// solid blue diagonal-gradient panel (no dark glow panel), a white/light
// rounded card floating on the left holding the rank ring + score, white
// bold headline text on the blue field, a white primary button + light
// ghost buttons. The page-local TopNav header (added in v5) has been
// removed — this page now relies solely on the shared app-wide Navbar
// component, same as every other page. Toggle groups render as light-blue
// pill / black-text, matching Dashboard's active-tab treatment. Podium and
// table are untouched from v4.
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

  // Hero accents — flat Dashboard-matched signal-blue diagonal register.
  // Dashboard's hero runs a simple two/three-stop blue diagonal (deep navy
  // -> signal blue -> lighter sky blue), no dark glow panel underneath.
  heroDark0:    '#080F1E',
  heroDark1:    '#0A1628',
  heroDark2:    '#0D1F3C',
  heroBlue900:  '#001F6B',
  cyanBright:   '#00C8F0',
  blueBright:   '#1A6EFF',
  heroRing:     '#4FD8F5',
  heroSkyEnd:   '#2F8CFF',

  shadow:   '0 1px 2px rgba(10,22,40,0.04), 0 8px 24px rgba(15,45,120,0.06)',
  shadowMd: '0 4px 14px rgba(15,45,120,0.08), 0 1px 3px rgba(10,22,40,0.05)',
  shadowLg: '0 24px 64px rgba(6,16,50,0.28)',
};

const F = {
  serif:   "'Fraunces', 'Georgia', serif",
  // Matches Coach's CommandHeader (F.display in styles/tokens.js) — used
  // in the Leaderboard hero so the two "welcome back" surfaces read as one
  // family, and now also in the tab card labels for visual consistency.
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

// ─── Rank ring — fused rank number inside its own progress ring ─────────────
// Sits inside the white hero card now (Dashboard-matched), so the ring
// track/gradient are tuned for a light background instead of a dark panel:
// signal-blue stroke on a pale blue track, dark ink rank number.
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
        <div style={{ fontFamily: F.display, fontSize: 8, fontWeight: 800, letterSpacing: '1.9px', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', marginBottom: 3 }}>rank</div>
        <div style={{ fontFamily: F.display, fontSize: 37, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-1.5px' }}>
          {rank != null ? `#${rank}` : '—'}
        </div>
      </div>
    </div>
  );
};

// ─── Hero stat — right-aligned score/gap readouts beside the ring ──────────
const HeroStat = ({ label, value, unit, color = '#fff' }) => (
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
    <div style={{ fontFamily: F.display, fontSize: 31, fontWeight: 800, color, letterSpacing: '-0.7px' }}>
      {value}
      {unit && <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{unit}</span>}
    </div>
  </div>
);

// ─── Podium watermark — low-opacity line-art glyph, sits above the hero's
// action row (right side) as a subtle "leaderboard" motif in the background,
// never competing with foreground content or text. ───────────────────────
const PodiumWatermark = () => (
  <svg width="150" height="92" viewBox="0 0 150 92" style={S.heroPodiumWatermark} className="mm-hero-podium-watermark" aria-hidden="true">
    <rect x="8" y="46" width="38" height="40" rx="5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
    <rect x="54" y="18" width="38" height="68" rx="5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
    <rect x="100" y="58" width="38" height="28" rx="5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
    <circle cx="73" cy="8" r="7.5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
  </svg>
);

// ─── Hero icon action button — compact icon-only CTA with a title tooltip ──
const HeroIconButton = ({ icon, title, onClick, primary = false }) => (
  <button
    title={title}
    aria-label={title}
    onClick={onClick}
    className={primary ? 'mm-hero-icon-btn-primary' : 'mm-hero-icon-btn'}
    style={primary ? S.heroIconBtnPrimary : S.heroIconBtnGhost}
  >
    <span aria-hidden="true">{icon}</span>
  </button>
);

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
// NOTE: left fully unchanged from v3/v4 per direction — only the hero,
// nav strip, and toggle bar have been rebuilt to match the Dashboard.

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
      {/* Accent rail */}
      <div
        style={{
          ...S.rivalAccentBar,
          background: `linear-gradient(
            180deg,
            ${urgencyMeta.color} 0%,
            ${C.signal} 48%,
            ${C.pulse} 100%
          )`,
        }}
      />

      <div style={S.rivalInner}>
        {/* LEFT */}
        <div style={S.rivalLeft}>
          <div style={S.rivalEyebrowRow}>
            <span
              style={{
                ...S.rivalEyebrowDot,
                background: urgencyMeta.color,
              }}
            />

            <span
              style={{
                ...S.rivalEyebrow,
                color: urgencyMeta.color,
              }}
            >
              {urgencyMeta.label}
            </span>

            <span style={S.rivalEyebrowDivider}>·</span>

            <span style={S.rivalEyebrowContext}>
              #{userRank - 1} is the next rank
            </span>
          </div>

          <div style={S.rivalName}>
            <div
              style={{
                ...S.rivalAvatar,
                background: `linear-gradient(
                  135deg,
                  ${C.signalTint} 0%,
                  ${C.pulseTint} 100%
                )`,
                border: `1px solid ${C.lineMd}`,
                color: C.signalDeep,
              }}
            >
              {rival.name?.charAt(0).toUpperCase() || '?'}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={S.rivalNameText}>
                {rival.name || `Rank #${userRank - 1}`}
              </div>

              <div style={S.rivalNameSub}>
                {rival.college || 'Ranked just above you'}
              </div>
            </div>
          </div>

          <p style={S.rivalMsg}>
            {urgencyMeta.msg}
          </p>
        </div>

        {/* RIGHT */}
        <div style={S.rivalRight}>
          <div style={S.rivalMetrics}>
            <div style={S.rivalMetric}>
              <div style={S.rivalScoreLabel}>
                THEIR SCORE
              </div>

              <div style={S.rivalScoreVal}>
                {rivalScore}
                <span style={S.rivalScoreUnit}>/100</span>
              </div>
            </div>

            <div style={S.rivalMetricDivider} />

            <div style={S.rivalMetric}>
              <div style={S.rivalScoreLabel}>
                GAP
              </div>

              <div
                style={{
                  ...S.rivalScoreVal,
                  color: urgencyMeta.color,
                }}
              >
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
                ? navigate('/interview', {
                    state: {
                      mode: 'topic',
                      topic: weakestPracticeTopic,
                    },
                  })
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
              width: `${Math.min(
                100,
                Math.max(8, 100 - gapToNext * 10)
              )}%`,
              background: `linear-gradient(
                90deg,
                ${C.signal},
                ${C.pulse}
              )`,
            }}
          />
        </div>

        <span style={S.rivalBottomText}>
          {weakestDim
            ? `Focus: ${weakestDim.label}`
            : 'One focused session could change your rank'}
        </span>
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

  // Field activity — total real sessions logged by everyone on the current
  // board, plus how many of them are on an active streak (streak >= 2).
  // Both come straight off rawData (already fetched), so this replaces the
  // old static "Platinum band · Top 5%" cell with a live, useful signal
  // instead of adding a new fetch.
  const fieldSessions = rawData.reduce((sum, e) => sum + (Number(e.sessionCount) || 0), 0);
  const fieldOnStreak = rawData.filter((e) => (Number(e.streak) || 0) >= 2).length;

  // Capitalized standalone sentence — previously this was lowercase and
  // appended after "Priya, " inline; now the name renders as its own label
  // above the headline, so the verdict needs to read as a complete sentence
  // on its own. Calls out "top 5" specifically when that's the next
  // meaningful milestone (rank 6-10), otherwise names the actual rank ahead.
  const heroVerdict = !currentUser
    ? "Let's get you on the board."
    : userRank == null
      ? 'Complete a session to get ranked.'
      : userIsPlatinum
        ? "You're in the platinum band — top 1%."
        : userRank === 1
          ? `You're #1 ${periodLabel} — defend it.`
          : userRank <= 10
            ? "You're closing in on top 5."
            : `You're #${userRank} ${activeTab === 'global' ? 'globally' : 'in your college'} ${periodLabel}.`;

  // Priority for what the hero pushes: 1) fix the weakest tested skill,
  // 2) close the gap on the rival just ahead, 3) generic percentile line.
  // Only overrides the sub-line for ranked users with real rank-climbing
  // room — someone already #1 shouldn't be told to "fix" anything.
  const weakestPracticeTopic = weakestDim ? (DIMENSION_TO_TOPIC[weakestDim.key] || null) : null;

  // Ring fill — how far along the field's top score the user's own score
  // sits. Calibrated against the leader (top3[0]) so it reads as "distance
  // climbed toward the top", not just an arbitrary progress value. Capped
  // at 99% so it never visually reads "done" while still outranked.
  const ringPct = (() => {
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
               HERO — Dashboard-matched flat blue panel. A white/light card
               floats on the left holding the fused rank+ring centerpiece
               and score readout (mirrors Dashboard's "interview readiness
               score" card). Headline + verdict stay white on the blue
               field, per direction. Buttons follow Dashboard's exact
               pattern: solid white primary + pale ghost buttons.
          ════════════════════════════════════════════════════════════════ */}
          <section ref={heroRef} style={S.hero} className="mm-hero">
            {/* Podium motif — low-opacity line art anchoring the action row */}
            <PodiumWatermark />

            {/* Top row: eyebrow left, live field status pills right */}
            <div style={S.heroStatusRow} className="mm-hero-status-row">
              <Eyebrow color="rgba(255,255,255,0.75)">rank command center</Eyebrow>
              <div style={S.heroPillRow} className="mm-hero-pills">
                <div style={S.heroPillLive}>
                  <span style={S.heroPillLiveDot} />
                  <span style={S.heroPillText}>
                    {totalCount} practicing {periodLabel === 'this week' ? 'this week' : 'overall'}
                  </span>
                </div>
                {top3[0]?.name && top3[0]?.avgScore != null && (
                  <div style={S.heroPillLeader}>
                    <span>🥇</span>
                    <span style={S.heroPillLeaderText}>
                      {top3[0].name.split(' ')[0]} leads · {top3[0].avgScore}/100
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={S.heroTopRow} className="mm-hero-top">
              {/* Left: white rank card (ring + score), Dashboard-matched */}
              <div style={S.heroRankCard} className="mm-hero-rank-card">
                {userRank != null ? (
                  <>
                    <div style={S.heroRankCardLabel}>your rank</div>
                    <div style={S.heroRankCardBody}>
                      <RankRing rank={userRank} pct={ringPct} mounted={mounted} size={104} stroke={6} />
                      <div style={{ minWidth: 0 }}>
                        {currentUserScore != null && (
                          <>
                            <div style={S.heroRankCardScore}>
                              {currentUserScore}<span style={S.heroRankCardScoreUnit}>/100</span>
                            </div>
                            <div style={S.heroRankCardScoreLabel}>avg score</div>
                          </>
                        )}
                      </div>
                    </div>
                    {userPercentile != null && (
                      <div style={S.heroRankCardPill}>Top {100 - userPercentile}%</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={S.heroRankCardLabel}>your rank</div>
                    <div style={S.heroRankCardUnranked}>—</div>
                    <div style={S.heroRankCardPill}>Not ranked yet</div>
                  </>
                )}
              </div>

              {/* Middle: name/verdict/percentile */}
              <div style={S.heroTextGroup} className="mm-hero-text-group">
                {currentUser?.name?.split(' ')[0] && (
                  <div style={S.heroEyebrowLabel}>YOUR STANDING</div>
                )}
                <h1 style={S.heroH1}>{heroVerdict}</h1>
                <p style={S.heroSub}>{heroSub}</p>
                {userPercentile != null && userRank != null && (
                  <div style={S.heroPercentileLine}>
                    <span style={S.heroPercentileHighlight}>Top {100 - userPercentile}%</span>
                    {' '}of {totalCount} students · beating {Math.max(0, totalCount - userRank)} of them
                  </div>
                )}
              </div>

              {/* Right: gap/IRS stat readouts */}
              {(gapToNext != null || userIRS != null) && (
                <div style={S.heroStatRow} className="mm-hero-stats">
                  {gapToNext != null && gapToNext > 0 && (
                    <HeroStat label={`gap to #${userRank - 1}`} value={gapToNext} unit=" pts" color="#fff" />
                  )}
                  {userIRS != null && (
                    <>
                      <div style={S.heroStatDivider} className="mm-hero-irs-divider" />
                      <div className="mm-hero-irs-stat">
                        <HeroStat label="IRS" value={userIRS} unit="/100" color="#fff" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action row — Dashboard-matched button trio: solid white
                primary CTA first, pale ghost buttons after, streak chip
                and compact icon buttons trailing. */}
            <div style={S.heroActions} className="mm-hero-actions">
              <button
                style={S.btnPrimary}
                className="mm-btn-primary mm-hero-cta"
                onClick={() => navigate('/interview')}
              >
                New mock interview
              </button>
              <button style={S.btnGhost} className="mm-btn-ghost" onClick={() => navigate('/analytics')}>
                Full analytics
              </button>
              <button
                style={S.btnGhost}
                className="mm-btn-ghost"
                onClick={() => weakestPracticeTopic
                  ? navigate('/interview', { state: { mode: 'topic', topic: weakestPracticeTopic } })
                  : navigate('/coach')}
              >
                {weakestDim ? `Sharpen ${weakestDim.label}` : 'AI Coach'}
              </button>
              {currentUserStreak >= 2 && (
                <div style={S.heroStreakChip} className="mm-hero-streak">
                  🔥 {currentUserStreak}-day streak
                </div>
              )}
              <div style={{ flex: 1 }} className="mm-hero-actions-spacer" />
              <HeroIconButton icon="🕘" title="Practice history" onClick={() => navigate('/history')} />
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
               TAB CARD — refined 3-zone layout: leaderboard icon badge on
               the left, both toggle groups centered together with a
               divider between them, entry count on the right. Its own
               white surface, visually distinct from the hero panel.
               Toggle pills now match Dashboard's active-tab treatment:
               light blue pill fill + black text.
          ════════════════════════════════════════════════════════════════ */}
          <section style={S.toggleCard} className="lb-toggle-card">
            <div style={S.toggleBar} className="lb-toggle-bar">
              {/* Left: leaderboard icon badge + label */}
              <div style={S.toggleBadgeGroup} className="lb-toggle-badge-group">
                <div style={S.toggleBadgeIcon}>🏆</div>
                <div>
                  <div style={S.toggleBadgeTitle}>Board settings</div>
                  <div style={S.toggleBadgeSub}>customize your view</div>
                </div>
              </div>

              {/* Center: both toggle groups */}
              <div style={S.toggleCenterGroup} className="lb-toggle-center-group">
                <ToggleGroup
                  options={[
                    { id: 'weekly', label: 'This week', helper: 'Resets every Monday' },
                    { id: 'overall', label: 'Overall', helper: 'All-time record' },
                  ]}
                  value={activePeriod}
                  onChange={setActivePeriod}
                />
                <div style={S.toggleDivider} className="lb-toggle-divider" />
                <ToggleGroup
                  options={[
                    { id: 'global', label: 'Global', helper: `${selectedBoard.globalTotal || 0} students` },
                    { id: 'college', label: currentUser?.college?.split(' ')[0] || 'College', helper: `${selectedBoard.collegeTotal || 0} students` },
                  ]}
                  value={activeTab}
                  onChange={setActiveTab}
                />
              </div>

              {/* Right: entry count */}
              <div style={S.toggleMeta} className="lb-toggle-meta">
                <span style={S.mono}>viewing {activeData.length !== rawData.length ? `${activeData.length} of ` : ''}{rawData.length} {rawData.length === 1 ? 'entry' : 'entries'}</span>
              </div>
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
              <RailStat
                label="Field activity"
                value={`${fieldSessions} session${fieldSessions !== 1 ? 's' : ''}`}
                color={C.orange}
                sub={fieldOnStreak > 0 ? `🔥 ${fieldOnStreak} on a streak` : `${periodLabel} on this board`}
              />
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
            <span style={S.mono}>mockmate leaderboard v6 · dashboard-matched</span>
            <span style={S.mono}>ranks recompute live · weekly resets monday</span>
          </footer>
        </div>
      </div>
    </>
  );
};

// ─── Dedicated toggle group — Dashboard-matched: light-blue pill active
// state, black/ink text, plain gray inactive text (no gradient fill). ────

const ToggleGroup = ({ label, icon, options, value, onChange }) => {
  const activeIdx = options.findIndex(o => o.id === value);
  return (
    <div style={S.toggleGroupWrap}>
      {label && (
        <div style={S.toggleGroupLabel}>
          <span style={{ fontSize: 12, color: C.signal }}>{icon}</span>
          <span>{label}</span>
        </div>
      )}
      <div style={S.toggleGroupTrack} className="lb-toggle-track">
        <div
          className="lb-toggle-thumb"
          style={{
            ...S.toggleGroupThumb,
            width: `calc(${100 / options.length}% - 4px)`,
            transform: `translateX(${activeIdx * 100}%)`,
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
                color: isActive ? C.ink : C.muted,
              }}
            >
              <span style={S.toggleOptLabel}>{opt.label}</span>
              <span style={{ ...S.toggleOptHelper, color: isActive ? C.signalDeep : C.faint }}>{opt.helper}</span>
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
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; }
    ::selection { background: rgba(0,87,232,0.16); color: ${C.ink}; }

    @keyframes lbPodiumRise { 0% { opacity: 0; transform: translateY(56px) scale(0.9); } 60% { opacity: 1; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes lbSlideIn    { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes lbFadeUp     { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes livePulse    { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes heroSweep    { 0% { transform:translateX(-30%); } 100% { transform:translateX(130%); } }
    @keyframes scaleIn      { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
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
    .mm-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 26px rgba(0,20,80,0.28) !important; }

    .mm-btn-ghost { transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease !important; }
    .mm-btn-ghost:hover { background: rgba(255,255,255,0.22) !important; transform: translateY(-1px) !important; }

    .mm-hero-icon-btn-primary { transition: transform 0.15s cubic-bezier(.16,1,.3,1), box-shadow 0.15s ease !important; }
    .mm-hero-icon-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 12px 26px rgba(0,10,40,0.3) !important; }
    .mm-hero-icon-btn { transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease !important; }
    .mm-hero-icon-btn:hover { background: rgba(255,255,255,0.2) !important; transform: translateY(-1px) !important; }

    .mm-btn-blue { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .mm-btn-blue:hover { box-shadow: 0 8px 22px rgba(0,87,232,0.35) !important; transform: translateY(-2px) !important; }

    .mm-banner-cta { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .mm-banner-cta:hover { box-shadow: 0 10px 24px rgba(0,87,232,0.32) !important; transform: translateY(-2px) !important; }

    .mm-strip { transition: box-shadow 0.2s ease !important; }
    .mm-strip:hover { box-shadow: ${C.shadowMd} !important; }

    .mm-irs-num { animation: scaleIn 0.7s cubic-bezier(.16,1,.3,1) both 0.1s; }

    .lb-toggle-track { transition: box-shadow 0.2s ease; }
    .lb-toggle-track:focus-within { box-shadow: inset 0 1px 3px rgba(10,22,40,0.06), 0 0 0 3px ${C.signalTint}; }
    .lb-toggle-opt:hover { color: ${C.signalDeep} !important; }
    .lb-toggle-thumb { will-change: transform; }

    .rival-card-hover:hover {
  transform: translateY(-2px);
  box-shadow:
    0 16px 34px rgba(15,45,120,0.11),
    0 3px 8px rgba(10,22,40,0.05);
}

.mm-page button[style*="rivalCta"]:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,40,140,0.12);
  border-color: ${C.signalSoft} !important;
}

    @media (prefers-reduced-motion: reduce) {
      .mm-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1020px) {
      .mm-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 780px) {
      .lb-toggle-bar { grid-template-columns: 1fr !important; justify-items: center; text-align: center; }
      .lb-toggle-badge-group { justify-content: center; }
      .lb-toggle-center-group { flex-wrap: wrap; justify-content: center; }
      .lb-toggle-divider { display: none !important; }
      .lb-toggle-meta { text-align: center !important; }
    }
    @media (max-width: 640px) {
      .mm-hero-top   { flex-direction: column !important; align-items: flex-start !important; }
      .mm-hero-rank-card { width: 100%; }
      .mm-hero-text-group  { width: 100%; }
      .mm-hero-stats { margin-top: 18px !important; width: 100%; justify-content: flex-start !important; }
      .mm-hero-status-row { flex-direction: column !important; align-items: flex-start !important; }
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
      .mm-hero { padding: 22px 18px !important; border-radius: 18px !important; }

      /* Secondary hero stats — IRS is the first to go on very small screens */
      .mm-hero-irs-divider, .mm-hero-irs-stat { display: none !important; }

      /* Podium watermark and leader pill are decorative — drop them before
         anything load-bearing gets cramped on very small screens */
      .mm-hero-podium-watermark { display: none !important; }
      .mm-hero-pills { flex-direction: column !important; align-items: flex-start !important; }

      /* Actions — buttons wrap; primary CTA and ghosts stay compact */
      .mm-hero-actions { flex-wrap: wrap !important; }
      .mm-hero-actions-spacer { display: none !important; }
      .mm-hero-streak { justify-content: center !important; }
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

  // ── HERO — Dashboard-matched flat blue diagonal panel. No dark glow
  // panel underneath; a white rank card floats on the left mirroring
  // Dashboard's "interview readiness score" card exactly. ──────────────
  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '32px 36px', marginBottom: 16, borderRadius: 24,
    background: `linear-gradient(115deg, ${C.signalDeep} 0%, ${C.signal} 55%, ${C.heroSkyEnd} 100%)`,
    boxShadow: '0 20px 48px rgba(0,60,180,0.22)',
  },
  heroPodiumWatermark: { position: 'absolute', bottom: 78, right: 40, opacity: 0.1, pointerEvents: 'none' },

  // Status row — eyebrow left, live field + leader pills right
  heroStatusRow:     { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  heroPillRow:        { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroPillLive:       { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' },
  heroPillLiveDot:    { width: 5, height: 5, borderRadius: '50%', background: '#3ED598', boxShadow: '0 0 5px #3ED598', flexShrink: 0 },
  heroPillText:       { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: '#fff' },
  heroPillLeader:     { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' },
  heroPillLeaderText: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: '#fff' },

  heroTopRow:     { position: 'relative', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' },

  // White/light rank card floating on the hero — Dashboard-matched
  heroRankCard: {
    position: 'relative', flexShrink: 0,
    background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.26)',
    borderRadius: 18, padding: '18px 22px', minWidth: 250,
    backdropFilter: 'blur(6px)',
  },
  heroRankCardLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.2px', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', marginBottom: 12 },
  heroRankCardBody: { display: 'flex', alignItems: 'center', gap: 18 },
  heroRankCardScore: { fontFamily: F.display, fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.6px' },
  heroRankCardScoreUnit: { fontFamily: F.display, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' },
  heroRankCardScoreLabel: { fontFamily: F.mono, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  heroRankCardUnranked: { fontFamily: F.display, fontSize: 34, fontWeight: 900, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  heroRankCardPill: { display: 'inline-block', marginTop: 14, fontFamily: F.body, fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.26)', padding: '5px 12px', borderRadius: 99 },

  heroTextGroup:  { flex: '1 1 260px', minWidth: 0 },
  heroEyebrowLabel: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '1.4px', color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase' },
  heroH1:         { margin: '0 0 10px', fontFamily: F.display, fontSize: 'clamp(23px, 2.8vw, 29px)', fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.5px', maxWidth: 420 },
  heroSub:        { margin: '0 0 9px', fontFamily: F.body, fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.82)', maxWidth: 400 },
  heroPercentileLine: { fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.65)' },
  heroPercentileHighlight: { color: '#fff', fontWeight: 800 },
  heroActions:    { position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 30 },

  // Right-side gap/irs readouts
  heroStatRow:     { display: 'flex', alignItems: 'center', gap: 26, flexShrink: 0, marginLeft: 'auto' },
  heroStatDivider: { width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.25)' },

  // Compact icon-only action buttons — tooltip via title attr
  heroIconBtnPrimary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 12, background: '#fff', color: C.signalDeep, width: 44, height: 44, fontSize: 17, cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,10,40,0.18)', flexShrink: 0 },
  heroIconBtnGhost:   { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, background: 'rgba(255,255,255,0.12)', color: '#fff', width: 44, height: 44, fontSize: 17, cursor: 'pointer', flexShrink: 0 },

  // Streak chip beside CTAs — subdued so it doesn't compete with primary action
  heroStreakChip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 15px', height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', fontFamily: F.body, fontSize: 12, fontWeight: 700, color: '#fff' },

  // Bottom CTA banner only — not the hero
  heroNoise:  { position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent)', animation: 'heroSweep 11s linear infinite' },
  heroKicker: { fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: '1.8px', color: C.cyanBright, textTransform: 'uppercase' },

  // Buttons — Dashboard-matched: solid white primary + pale/ghost secondary,
  // used on the blue hero surface.
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12, background: '#fff', color: C.signalDeep, padding: '13px 22px', fontSize: 13.5, fontWeight: 800, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,10,40,0.18)' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, background: 'rgba(255,255,255,0.14)', color: '#fff', padding: '13px 22px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer' },
  btnGhostLight: { border: `1px solid ${C.lineMd}`, borderRadius: 11, background: C.surface, color: C.signalDeep, padding: '11px 20px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', marginTop: 6 },
  btnBlue: { border: 'none', borderRadius: 11, background: `linear-gradient(135deg, ${C.signalDeep}, ${C.signal})`, color: '#fff', padding: '12px 24px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 4px 14px rgba(0,87,232,0.28)`, textAlign: 'center', letterSpacing: '-0.1px', marginTop: 8 },
  btnBannerCta: { flexShrink: 0, border: 'none', borderRadius: 12, background: '#fff', color: C.signalDeep, padding: '14px 24px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', position: 'relative' },

  // ── TAB CARD — refined 3-zone layout: leaderboard icon badge on the
  // left, both toggle groups centered together with a divider, entry
  // count on the right. Its own white surface, visually distinct from
  // the hero panel below which it sits. Toggle pills use Dashboard's
  // light-blue-fill + black-text active treatment. ─────────────────────
  toggleCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 20px', boxShadow: C.shadow, marginBottom: 18 },
  toggleBar: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14 },

  toggleBadgeGroup: { display: 'flex', alignItems: 'center', gap: 10 },
  toggleBadgeIcon:  { width: 36, height: 36, borderRadius: 10, background: C.signalTint, border: `1px solid ${C.lineMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 },
  toggleBadgeTitle: { fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.ink },
  toggleBadgeSub:   { fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 1 },

  toggleCenterGroup: { display: 'flex', alignItems: 'center', gap: 16, justifySelf: 'center' },
  toggleDivider: { width: 1, height: 32, background: C.line },
  toggleMeta: { textAlign: 'right' },

  toggleGroupWrap: {},
  toggleGroupLabel: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '1.1px', marginBottom: 8, textTransform: 'uppercase' },
  toggleGroupTrack: {
    position: 'relative', display: 'flex', gap: 4, padding: 4, borderRadius: 12,
    background: C.surfaceSunk,
    border: `1px solid ${C.line}`,
  },
  toggleGroupThumb: {
    position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 9,
    transition: 'transform 0.32s cubic-bezier(.16,1,.3,1)',
    background: C.signalTint,
    boxShadow: `inset 0 0 0 1px ${C.lineStr}`,
  },
  toggleGroupBtn: { position: 'relative', zIndex: 1, border: 'none', background: 'transparent', padding: '8px 14px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, fontFamily: F.body },
  toggleOptLabel: { fontSize: 12.5, fontWeight: 700 },
  toggleOptHelper: { fontSize: 9, fontFamily: F.mono },

  // Podium card — unchanged from v3/v4
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

  
// ── Rival card — light Blueprint-blue treatment ────────────────────────────
rivalCard: {
  position: 'relative',
  marginBottom: 18,
  borderRadius: 18,
  background: `linear-gradient(
    135deg,
    #F7FAFF 0%,
    #EEF5FF 52%,
    #E9F8FF 100%
  )`,
  border: `1px solid ${C.lineMd}`,
  boxShadow: `
    0 10px 28px rgba(15,45,120,0.08),
    0 2px 6px rgba(10,22,40,0.04)
  `,
  overflow: 'hidden',
  transition: 'transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s ease',
},

rivalAccentBar: {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 4,
  height: '100%',
  borderRadius: '18px 0 0 18px',
},

rivalInner: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  padding: '22px 24px 20px 28px',
  flexWrap: 'wrap',
},

rivalLeft: {
  flex: '1 1 340px',
  minWidth: 0,
},

rivalRight: {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 12,
  flexShrink: 0,
},

rivalEyebrowRow: {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  marginBottom: 10,
},

rivalEyebrowDot: {
  width: 6,
  height: 6,
  borderRadius: '50%',
  boxShadow: '0 0 0 3px rgba(0,87,232,0.08)',
  flexShrink: 0,
},

rivalEyebrow: {
  fontFamily: F.mono,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '1.25px',
  textTransform: 'uppercase',
},

rivalEyebrowDivider: {
  color: C.lineStr,
  fontFamily: F.mono,
  fontSize: 10,
},

rivalEyebrowContext: {
  fontFamily: F.mono,
  fontSize: 9,
  color: C.muted,
},

rivalName: {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 9,
},

rivalAvatar: {
  width: 42,
  height: 42,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: F.serif,
  fontSize: 17,
  fontWeight: 600,
  flexShrink: 0,
  boxShadow: '0 4px 14px rgba(0,87,232,0.10)',
},

rivalNameText: {
  fontFamily: F.display,
  fontSize: 15,
  fontWeight: 800,
  color: C.ink,
  letterSpacing: '-0.25px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
},

rivalNameSub: {
  fontFamily: F.mono,
  fontSize: 9.5,
  color: C.muted,
  marginTop: 3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
},

rivalMsg: {
  margin: 0,
  maxWidth: 520,
  fontFamily: F.body,
  fontSize: 12.5,
  color: C.sub,
  lineHeight: 1.65,
},

rivalMetrics: {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  padding: '10px 14px',
  borderRadius: 13,
  background: 'rgba(255,255,255,0.72)',
  border: `1px solid ${C.line}`,
},

rivalMetric: {
  minWidth: 70,
  textAlign: 'right',
},

rivalMetricDivider: {
  width: 1,
  height: 32,
  background: C.lineMd,
},

rivalScoreLabel: {
  fontFamily: F.mono,
  fontSize: 7.5,
  fontWeight: 700,
  letterSpacing: '0.85px',
  color: C.muted,
  marginBottom: 4,
},

rivalScoreVal: {
  fontFamily: F.display,
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: '-0.5px',
  color: C.ink,
},

rivalScoreUnit: {
  fontFamily: F.mono,
  fontSize: 8.5,
  fontWeight: 600,
  color: C.muted,
  marginLeft: 2,
},

rivalCta: {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: '1px solid',
  borderRadius: 11,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 800,
  fontFamily: F.body,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,40,140,0.08)',
  transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
},

rivalCtaArrow: {
  fontSize: 14,
  lineHeight: 1,
  marginLeft: 2,
},

rivalBottomLine: {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '0 24px 14px 28px',
},

rivalBottomTrack: {
  flex: 1,
  height: 4,
  borderRadius: 99,
  background: C.line,
  overflow: 'hidden',
},

rivalBottomFill: {
  height: '100%',
  borderRadius: 99,
  transition: 'width 0.8s cubic-bezier(.16,1,.3,1)',
},

rivalBottomText: {
  fontFamily: F.mono,
  fontSize: 8.5,
  fontWeight: 600,
  color: C.muted,
  whiteSpace: 'nowrap',
},



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
import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE from '../config/api.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — LEADERBOARD v3 (Readiness Terminal v6 design language, premium pass)
// Hero updated to match Coach's CommandHeader — brighter cyan/blue gradient,
// glow orbs, uppercase mono eyebrow, glowing progress bar, gradient CTA.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  paper:        '#F6F8FD',
  paperDeep:    '#EEF2FC',

  surface:      '#FFFFFF',
  surfaceSunk:  '#F3F6FD',

  ink:          '#0A1628',
  ink2:         '#111F38',
  sub:          '#41547B',
  muted:        '#7C8CAD',
  faint:        '#AFBCDA',

  line:         '#DEE6F7',
  lineMd:       '#C4D2F0',
  lineStr:      '#8FAAE8',

  signal:       '#0057E8',
  signalDeep:   '#0041B8',
  signalTint:   '#EAF1FF',
  signalSoft:   '#4D8FFF',

  pulse:        '#00C2E8',
  pulseDeep:    '#0093C4',
  pulseTint:    '#E6FAFF',

  green:        '#0E8F63',
  greenTint:    '#E9F9F1',
  amber:        '#B4790A',
  amberTint:    '#FFF6E5',
  orange:       '#C2530C',
  orangeTint:   '#FFF1E6',
  red:          '#C22626',
  redTint:      '#FDECEC',

  bronze:       '#9C6A3E',
  bronzeTint:   '#F7EEE3',
  silver:       '#6E7B99',
  silverTint:   '#EFF2F8',
  gold:         '#AD7F10',
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
  serif: "'Fraunces', 'Georgia', serif",
  body:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:  "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
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
    return <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>No recent session data for this trend.</div>;
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

const PODIUM_METALS = {
  1: { medal: '🥇', color: '#AD7F10', bright: '#F0B93D', tint: '#FBF3DE', glow: 'rgba(173,127,16,0.38)', label: '1st', laurel: '❧' },
  2: { medal: '🥈', color: '#6E7B99', bright: '#A7B3CE', tint: '#EFF2F8', glow: 'rgba(110,123,153,0.30)', label: '2nd', laurel: '' },
  3: { medal: '🥉', color: '#9C6A3E', bright: '#C88E5C', tint: '#F7EEE3', glow: 'rgba(156,106,62,0.30)', label: '3rd', laurel: '' },
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
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}CC)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: F.serif, fontSize: place === 1 ? 28 : place === 2 ? 21 : 18, fontWeight: 600, color: '#fff',
          }}>
            {entry?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
        </div>

        <div style={{ fontSize: place === 1 ? 22 : 16, marginBottom: 6 }}>{meta.medal}</div>

        <div style={{ fontFamily: F.body, fontSize: place === 1 ? 14.5 : 12, fontWeight: 700, color: C.ink, maxWidth: 112, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 auto' }}>
          {entry?.name ?? '—'}
        </div>

        <div style={{ fontFamily: F.serif, fontSize: place === 1 ? 26 : 19, fontWeight: 500, color: meta.color, marginTop: 4, lineHeight: 1 }}>
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const Leaderboard = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);

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
  const [mounted, setMounted] = useState(false);
  const [podiumMounted, setPodiumMounted] = useState(false);

  // ─── Load leaderboard ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/leaderboard`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
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
        if (!cancelled) toast.error(error?.message || 'Failed to load leaderboard');
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
  }, [EMPTY_BOARD]);

  // Replay podium entrance whenever period/scope changes
  useEffect(() => {
    setPodiumMounted(false);
    const t = setTimeout(() => setPodiumMounted(true), 60);
    return () => clearTimeout(t);
  }, [activePeriod, activeTab]);

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

  const heroSub = !currentUser
    ? 'Complete an interview and MockMate ranks you against every student practicing right now.'
    : userRank == null
      ? (activePeriod === 'weekly'
          ? 'Complete an interview this week to appear on the board.'
          : 'Complete an interview to appear on the overall leaderboard.')
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

  return (
    <>
      <GlobalStyles />

      {/* ── Sticky condensed rank bar ── */}
      {showSticky && currentUser && (
        <div style={S.stickyBar} className="lb-sticky">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={S.liveDot} />
            <span style={{ ...S.mono, color: 'rgba(255,255,255,0.5)' }}>leaderboard</span>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
            <span style={{ fontFamily: F.body, fontSize: 12.5, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {userRank ? (
              <>
                <span style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 500, color: '#fff' }}>#{userRank}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.pulse }}>{currentUserScore}/100</span>
              </>
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

          {/* ── HERO ──────────────────────────────────────────────────── */}
          <section ref={heroRef} style={S.hero} className="mm-hero">
            <div style={S.heroGlowTop} />
            <div style={S.heroGlowBottom} />
            <div style={S.heroNoise} />
            <div style={S.heroGrid} className="mm-hero-grid">

              <div style={S.irsBlock}>
                <div style={S.irsLabel}>{rankLabel}</div>
                <div style={S.irsNum} className="mm-irs-num">
                  {userRank ?? '—'}
                  {userRank && <span style={S.irsMax}>#</span>}
                </div>
                {userRank && (
                  <>
                    <div style={{
                      ...S.tierPill,
                      background: userIsPlatinum ? 'rgba(140,150,240,0.16)' : 'rgba(255,255,255,0.08)',
                      color: userIsPlatinum ? '#C7CDFB' : '#fff',
                      border: `1px solid ${userIsPlatinum ? 'rgba(140,150,240,0.4)' : 'rgba(255,255,255,0.18)'}`,
                    }}>
                      {userIsPlatinum ? '♛ platinum band' : `top ${100 - (userPercentile ?? 0)}%`}
                    </div>
                    <div style={S.irsBar}>
                      <div style={{ ...S.irsBarFill, width: mounted ? `${userPercentile ?? 0}%` : '0%' }} />
                    </div>
                    <div style={S.irsGapText}>{totalCount} tracked {activeTab === 'global' ? 'students' : 'in your college'}</div>
                  </>
                )}
              </div>

              <div style={S.verdictBlock}>
                <div style={S.heroKicker}>{periodLabel} · {activeTab}</div>
                <h1 style={S.heroH1}>
                  {currentUser?.name?.split(' ')[0] ? `${currentUser.name.split(' ')[0]}, ` : ''}{heroVerdict}
                </h1>
                <p style={S.heroSub}>{heroSub}</p>

                <div style={S.heroActions}>
                  <button style={S.btnPrimary} className="mm-btn-primary" onClick={() => navigate('/interview')}>
                    Practice now
                  </button>
                  {userRank != null && (
                    <button style={S.btnGhost} className="mm-btn-ghost" onClick={() => navigate('/analytics')}>
                      Your analytics
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

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
              <div style={S.searchBox}>
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
            <div style={S.tableCard}>
              <div style={S.tableHeadRow}>
                <div style={{ width: 46, ...S.colLabel }}>RANK</div>
                <div style={{ width: 44 }} />
                <div style={{ flex: 1, ...S.colLabel }}>NAME</div>
                <div style={{ width: 110, ...S.colLabel }} className="lb-college-col">COLLEGE</div>
                <div style={{ width: 68, textAlign: 'center', ...S.colLabel }} className="lb-efficiency-col">EFF.</div>
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
                        <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: numericRank <= 3 ? tierColor : C.muted }}>
                          #{numericRank}
                        </span>
                      </div>

                      <div style={{ width: 44, flexShrink: 0 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          background: isYou
                            ? `linear-gradient(135deg, ${C.signal}, ${C.pulse})`
                            : (numericRank <= 3 || platinumRow) ? `linear-gradient(135deg, ${tierColor}33, ${tierColor}99)` : C.signalTint,
                          border: `2px solid ${isYou ? C.pulse : (numericRank <= 3 || platinumRow) ? `${tierColor}66` : C.lineMd}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: F.serif, fontSize: 14, fontWeight: 600,
                          color: isYou ? '#fff' : (numericRank <= 3 || platinumRow) ? tierColor : C.signalDeep,
                          boxShadow: isYou ? '0 2px 10px rgba(0,194,232,0.30)' : 'none',
                        }}>
                          {entry.name?.charAt(0).toUpperCase() || '?'}
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

                      <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 500, color: sColor, marginBottom: 5 }}>
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
    @keyframes lbAvatarFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes lbPlinthSweep { 0% { left: -40%; } 100% { left: 130%; } }
    @keyframes lbGlowPulse  { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }

    .mm-page ::-webkit-scrollbar { width: 5px; height: 5px; }
    .mm-page ::-webkit-scrollbar-track { background: transparent; }
    .mm-page ::-webkit-scrollbar-thumb { background: ${C.lineMd}; border-radius: 4px; }
    .mm-page ::-webkit-scrollbar-thumb:hover { background: ${C.lineStr}; }

    .lb-row { transition: background 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease; }
    .lb-row:hover { background: ${C.signalTint} !important; transform: translateX(4px); box-shadow: inset 3px 0 0 ${C.signal}; }
    .lb-row-you:hover { box-shadow: inset 3px 0 0 ${C.pulse} !important; }

    .lb-avatar-float { animation: lbAvatarFloat 3.2s ease-in-out infinite; }
    .lb-plinth-sweep { animation: lbPlinthSweep 3.4s ease-in-out infinite 1.1s; }
    .lb-podium-lead { position: relative; }

    .lb-toggle-opt { transition: color 0.2s ease; cursor: pointer; }

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
      .mm-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
      .mm-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
      .lb-toggle-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 700px) {
      .lb-college-col, .lb-efficiency-col { display: none !important; }
    }
    @media (max-width: 760px) {
      .mm-strip-r { display: none !important; }
    }
    @media (max-width: 480px) {
      .mm-page { padding: 14px 12px 60px !important; }
      .mm-stat-rail { grid-template-columns: 1fr !important; }
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

  // ── HERO — brightened to match Coach's CommandHeader ──────────────────────
  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '44px 36px', marginBottom: 18, borderRadius: 22,
    background: `linear-gradient(135deg, ${C.heroDark0} 0%, ${C.heroBlue900} 40%, #001A3A 70%, ${C.heroDark0} 100%)`,
    border: '1px solid rgba(0,200,240,0.18)',
    boxShadow: '0 24px 72px rgba(0,20,80,0.55)',
  },
  heroNoise: { position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent)', animation: 'heroSweep 11s linear infinite' },
  heroGlowTop: { position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,240,0.10) 0%, transparent 70%)', pointerEvents: 'none' },
  heroGlowBottom: { position: 'absolute', bottom: -40, left: 80, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,110,255,0.09) 0%, transparent 70%)', pointerEvents: 'none' },
  heroGrid: { position: 'relative', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 44, alignItems: 'center' },

  irsBlock: {},
  irsLabel: { fontFamily: F.mono, fontSize: 10, fontWeight: 500, letterSpacing: '1px', color: 'rgba(255,255,255,0.42)', marginBottom: 12, textTransform: 'lowercase' },
  irsNum: { fontFamily: F.serif, fontSize: 86, fontWeight: 500, lineHeight: 0.95, color: '#fff', letterSpacing: '-3px' },
  irsMax: { fontSize: 24, fontWeight: 400, color: 'rgba(255,255,255,0.36)', letterSpacing: 0, fontFamily: F.body },
  tierPill: { display: 'inline-flex', alignItems: 'center', marginTop: 16, padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, letterSpacing: '0.1px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' },
  irsBar: { position: 'relative', height: 4, marginTop: 18, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'visible' },
  irsBarFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.blueBright}, ${C.cyanBright})`, transition: 'width 1.3s cubic-bezier(.16,1,.3,1)', boxShadow: `0 0 12px ${C.cyanBright}80` },
  irsGapText: { marginTop: 10, fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2px' },

  verdictBlock: {},
  heroKicker: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '1.8px', color: C.cyanBright, textTransform: 'uppercase' },
  heroH1: { margin: '14px 0 0', fontFamily: F.serif, fontSize: 32, fontWeight: 500, color: '#fff', lineHeight: 1.28, letterSpacing: '-0.4px', maxWidth: 620 },
  heroSub: { margin: '15px 0 0', fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.62)', maxWidth: 560, fontWeight: 400 },
  heroActions: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26 },

  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 11, background: `linear-gradient(135deg, ${C.blueBright}, ${C.cyanBright})`, color: '#fff', padding: '13px 22px', fontSize: 13.5, fontWeight: 800, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 4px 18px rgba(0,173,224,0.35)`, letterSpacing: '-0.1px' },
  btnGhost: { border: '1px solid rgba(255,255,255,0.16)', borderRadius: 11, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', color: '#fff', padding: '13px 20px', fontSize: 13, fontWeight: 500, fontFamily: F.body, cursor: 'pointer' },
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
  emptyTitle: { fontFamily: F.body, fontSize: 18, fontWeight: 800, color: C.ink, marginBottom: 8 },
  emptyDesc: { fontFamily: F.body, fontSize: 14, color: C.sub, marginBottom: 6 },

  tableCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, overflow: 'hidden', boxShadow: C.shadow, marginBottom: 16 },
  tableHeadRow: { display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: `1px solid ${C.line}`, background: C.surfaceSunk },
  colLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.5px' },

  statRail: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 18, borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow, overflow: 'hidden' },
  railCell: { padding: '18px 20px', borderRight: `1px solid ${C.line}` },
  railLabel: { fontSize: 10.5, fontWeight: 500, color: C.muted, letterSpacing: '0.1px', textTransform: 'uppercase' },
  railValRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 },
  railVal: { fontFamily: F.serif, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.3px' },
  railSub: { marginTop: 6, fontSize: 10.5, color: C.muted },

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
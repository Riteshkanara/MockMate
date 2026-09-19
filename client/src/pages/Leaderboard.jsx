import { useEffect, useMemo, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import API_BASE from '../config/api.js';
import { AuthContext, authFetch } from '../context/AuthContext.jsx';
import { getDashboardAnalytics, getAnalytics } from '../Services/interviewService.js';

import { C, F } from '../components/leaderboard/tokens';
import S from '../components/leaderboard/styles';
import RivalCard from '../components/leaderboard/RivalCard';
import PodiumBlock from '../components/leaderboard/PodiumBlock';
import RankRing from '../components/leaderboard/RankRing';

// ─── Dimension → practice topic bridge ──────────────────────────────────────
const DIMENSION_TO_TOPIC = {
  technical: 'DSA',
  problemSolving: 'DSA',
  communication: 'HR',
  behavioral: 'HR',
  design: 'System Design',
  fundamentals: 'OS',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Small local components (not complex enough for their own files) ──────────

const Eyebrow = ({ children, color = C.cyanBright }) => (
  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: '1.8px', color, marginBottom: 6, textTransform: 'uppercase' }}>{children}</div>
);
Eyebrow.propTypes = { children: PropTypes.node, color: PropTypes.string };

const HeroStat = ({ label, value, unit, color = '#fff' }) => (
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
    <div style={{ fontFamily: F.display, fontSize: 31, fontWeight: 800, color, letterSpacing: '-0.7px' }}>
      {value}
      {unit && <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{unit}</span>}
    </div>
  </div>
);
HeroStat.propTypes = { label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), unit: PropTypes.string, color: PropTypes.string };

const PodiumWatermark = () => (
  <svg width="150" height="92" viewBox="0 0 150 92" style={S.heroPodiumWatermark} className="mm-hero-podium-watermark" aria-hidden="true">
    <rect x="8" y="46" width="38" height="40" rx="5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
    <rect x="54" y="18" width="38" height="68" rx="5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
    <rect x="100" y="58" width="38" height="28" rx="5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
    <circle cx="73" cy="8" r="7.5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
  </svg>
);

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
HeroIconButton.propTypes = { icon: PropTypes.string, title: PropTypes.string, onClick: PropTypes.func, primary: PropTypes.bool };

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
CountUp.propTypes = { target: PropTypes.number, duration: PropTypes.number, suffix: PropTypes.string };

const DeltaBadge = ({ delta, isNew = false, showDelta = true }) => {
  if (!showDelta || (delta === 0 && !isNew)) {
    return <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.faint }}>—</span>;
  }
  if (isNew) {
    return (
      <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: C.pulseTint, color: C.pulseDeep, letterSpacing: '0.3px' }}>NEW</span>
    );
  }
  const up = delta < 0;
  return (
    <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: up ? C.greenTint : C.redTint, color: up ? C.green : C.red }}>
      {up ? `↑${Math.abs(delta)}` : `↓${Math.abs(delta)}`}
    </span>
  );
};
DeltaBadge.propTypes = { delta: PropTypes.number, isNew: PropTypes.bool, showDelta: PropTypes.bool };

const Avatar = ({ src, name, children, style }) => {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', ...style }}>
      {showImage ? (
        <img src={src} alt={name || 'Student avatar'} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : children}
    </div>
  );
};
Avatar.propTypes = { src: PropTypes.string, name: PropTypes.string, children: PropTypes.node, style: PropTypes.object };

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
StreakBadge.propTypes = { streak: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), size: PropTypes.oneOf(['sm', 'lg']) };

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
ScoreBar.propTypes = { score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]) };

const MiniTrend = ({ points = [] }) => {
  if (!points.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: C.surface, border: `1.5px dashed ${C.lineMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📈</div>
        <div>
          <div style={{ fontFamily: F.body, fontSize: 11.5, fontWeight: 600, color: C.sub }}>Trend arrives after a few more sessions</div>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 2 }}>we'll chart the last 6 scores here once there's history to show</div>
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
MiniTrend.propTypes = { points: PropTypes.arrayOf(PropTypes.number) };

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
        <div className="lb-toggle-thumb" style={{ ...S.toggleGroupThumb, width: `calc(${100 / options.length}% - 4px)`, transform: `translateX(${activeIdx * 100}%)` }} />
        {options.map(opt => {
          const isActive = opt.id === value;
          return (
            <button key={opt.id} onClick={() => onChange(opt.id)} className="lb-toggle-opt" style={{ ...S.toggleGroupBtn, color: isActive ? C.ink : C.muted }}>
              <span style={S.toggleOptLabel}>{opt.label}</span>
              <span style={{ ...S.toggleOptHelper, color: isActive ? C.signalDeep : C.faint }}>{opt.helper}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
ToggleGroup.propTypes = {
  label: PropTypes.string,
  icon: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, label: PropTypes.string, helper: PropTypes.string })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

const RailStat = ({ label, value, sub, color }) => (
  <div style={S.railCell} className="mm-rail-cell">
    <div style={S.railLabel}>{label}</div>
    <div style={S.railValRow}>
      <span style={{ ...S.railVal, color, fontSize: 22 }}>{value}</span>
    </div>
    {sub && <div style={S.railSub}>{sub}</div>}
  </div>
);
RailStat.propTypes = { label: PropTypes.string, value: PropTypes.string, sub: PropTypes.string, color: PropTypes.string };

// ─── Global styles ────────────────────────────────────────────────────────────
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
    .rival-card-hover:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(15,45,120,0.11), 0 3px 8px rgba(10,22,40,0.05); }

    @media (prefers-reduced-motion: reduce) { .mm-page * { animation: none !important; transition-duration: 0.01ms !important; } }
    @media (max-width: 1020px) { .mm-stat-rail { grid-template-columns: repeat(2, 1fr) !important; } }
    @media (max-width: 780px) {
      .lb-toggle-bar { grid-template-columns: 1fr !important; justify-items: center; text-align: center; }
      .lb-toggle-badge-group { justify-content: center; }
      .lb-toggle-center-group { flex-wrap: wrap; justify-content: center; }
      .lb-toggle-divider { display: none !important; }
      .lb-toggle-meta { text-align: center !important; }
    }
    @media (max-width: 640px) {
      .mm-hero-top { flex-direction: column !important; align-items: flex-start !important; }
      .mm-hero-rank-card { width: 100%; }
      .mm-hero-text-group { width: 100%; }
      .mm-hero-stats { margin-top: 18px !important; width: 100%; justify-content: flex-start !important; }
      .mm-hero-status-row { flex-direction: column !important; align-items: flex-start !important; }
    }
    @media (max-width: 700px) { .lb-college-col, .lb-efficiency-col, .lb-trend-col { display: none !important; } }
    @media (max-width: 760px) { .mm-strip-r { display: none !important; } }
    @media (max-width: 480px) {
      .mm-page { padding: 14px 12px 60px !important; }
      .mm-stat-rail { grid-template-columns: 1fr !important; }
      .mm-hero { padding: 22px 18px !important; border-radius: 18px !important; }
      .mm-hero-irs-divider, .mm-hero-irs-stat { display: none !important; }
      .mm-hero-podium-watermark { display: none !important; }
      .mm-hero-pills { flex-direction: column !important; align-items: flex-start !important; }
      .mm-hero-actions { flex-wrap: wrap !important; }
      .mm-hero-actions-spacer { display: none !important; }
      .mm-hero-streak { justify-content: center !important; }
      .mm-sticky-weak { display: none !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD — layout + data fetching only
// ═══════════════════════════════════════════════════════════════════════════

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
          { method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } },
          () => setUser(null)
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || `Leaderboard request failed with ${res.status}`);
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

  useEffect(() => {
    setPodiumMounted(false);
    const t = setTimeout(() => setPodiumMounted(true), 60);
    return () => clearTimeout(t);
  }, [activePeriod, activeTab]);

  // ─── Analytics — non-blocking ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [analyticsResult, perfResult] = await Promise.allSettled([
        getAnalytics(),
        getDashboardAnalytics(),
      ]);
      if (cancelled) return;
      if (analyticsResult.status === 'fulfilled') {
        const dims = analyticsResult.value?.dimensionProfile || [];
        const tested = dims.filter((d) => d.hasData);
        if (tested.length) {
          const weakest = [...tested].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
          if (weakest) setWeakestDim(weakest);
        }
      }
      if (perfResult.status === 'fulfilled') {
        const irs = perfResult.value?.irs ?? null;
        if (irs !== null) setUserIRS(Math.round(Number(irs)));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Sticky bar ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      if (!heroRef.current) return;
      setShowSticky(heroRef.current.getBoundingClientRect().bottom < 0);
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
    ? selectedUserPeriod?.globalRival ?? null
    : selectedUserPeriod?.collegeAheadOfUser ?? null;
  const currentUserScore = selectedUserPeriod?.avgScore ?? null;
  const userPercentile = percentileOf(userRank, totalCount);
  const userIsPlatinum = isPlatinumBand(userRank, totalCount);

  const gapToNext = aheadOfUser && currentUserScore != null
    ? Math.round((Number(aheadOfUser.avgScore) - Number(currentUserScore)) * 10) / 10
    : null;

  const currentUserRow = rawData.find((e) => e.isCurrentUser) || null;
  const currentUserStreak = Number(currentUserRow?.streak) || 0;

  const periodLabel = activePeriod === 'weekly' ? 'this week' : 'overall';
  const weakestPracticeTopic = weakestDim ? (DIMENSION_TO_TOPIC[weakestDim.key] || null) : null;

  const ringPct = (() => {
    if (currentUserScore == null || !top3[0]?.avgScore) return null;
    const leader = Number(top3[0].avgScore);
    if (leader <= 0) return null;
    return Math.min(99, Math.round((Number(currentUserScore) / leader) * 100));
  })();

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

  const heroSub = !currentUser
    ? 'Complete an interview and MockMate ranks you against every student practicing right now.'
    : userRank == null
      ? (activePeriod === 'weekly' ? 'Complete an interview this week to appear on the board.' : 'Complete an interview to appear on the overall leaderboard.')
      : weakestDim && userRank !== 1
        ? `${weakestDim.label} is your lowest score (${weakestDim.score}/100)${gapToNext && gapToNext > 0 ? ` — closing it is worth more than the ${gapToNext} pts separating you from #${userRank - 1}` : ' — sharpen it to protect your rank'}.`
        : gapToNext && gapToNext > 0
          ? `${gapToNext} points from #${userRank - 1}${aheadOfUser?.name ? ` (${aheadOfUser.name.split(' ')[0]})` : ''}.`
          : `Top ${100 - (userPercentile ?? 0)}% of ${totalCount} tracked students.`;

  const fieldSessions = rawData.reduce((sum, e) => sum + (Number(e.sessionCount) || 0), 0);
  const fieldOnStreak = rawData.filter((e) => (Number(e.streak) || 0) >= 2).length;

  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);
  const clockNow = new Date();

  // ─── Loading state ─────────────────────────────────────────────────────────
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

  // ─── Error state ───────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorCard}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <div style={S.emptyTitle}>Couldn't load the leaderboard</div>
            <div style={S.emptyDesc}>{loadError}</div>
            <button onClick={() => setRetryToken(t => t + 1)} style={S.btnBlue} className="mm-btn-blue lb-new-iv-btn">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <GlobalStyles />

      {/* Sticky rank bar */}
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
                onClick={() => weakestPracticeTopic ? navigate('/interview', { state: { mode: 'topic', topic: weakestPracticeTopic } }) : navigate('/interview')}
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

          {/* Status strip */}
          <div style={S.strip} className="mm-strip">
            <div style={S.stripL}>
              <span style={S.liveDot} />
              <span style={S.mono}>mockmate leaderboard</span>
            </div>
            <div style={S.stripR} className="mm-strip-r">
              <span style={S.mono}>session {sessionId}</span>
              <span style={{ color: C.lineMd }}>·</span>
              <span style={S.mono}>{clockNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase()}</span>
            </div>
          </div>

          {/* Hero */}
          <section ref={heroRef} style={S.hero} className="mm-hero">
            <PodiumWatermark />
            <div style={S.heroStatusRow} className="mm-hero-status-row">
              <Eyebrow color="rgba(255,255,255,0.75)">rank command center</Eyebrow>
              <div style={S.heroPillRow} className="mm-hero-pills">
                <div style={S.heroPillLive}>
                  <span style={S.heroPillLiveDot} />
                  <span style={S.heroPillText}>{totalCount} practicing {periodLabel === 'this week' ? 'this week' : 'overall'}</span>
                </div>
                {top3[0]?.name && top3[0]?.avgScore != null && (
                  <div style={S.heroPillLeader}>
                    <span>🥇</span>
                    <span style={S.heroPillLeaderText}>{top3[0].name.split(' ')[0]} leads · {top3[0].avgScore}/100</span>
                  </div>
                )}
              </div>
            </div>

            <div style={S.heroTopRow} className="mm-hero-top">
              <div style={S.heroRankCard} className="mm-hero-rank-card">
                {userRank != null ? (
                  <>
                    <div style={S.heroRankCardLabel}>your rank</div>
                    <div style={S.heroRankCardBody}>
                      <RankRing rank={userRank} pct={ringPct} mounted={mounted} size={104} stroke={6} />
                      <div style={{ minWidth: 0 }}>
                        {currentUserScore != null && (
                          <>
                            <div style={S.heroRankCardScore}>{currentUserScore}<span style={S.heroRankCardScoreUnit}>/100</span></div>
                            <div style={S.heroRankCardScoreLabel}>avg score</div>
                          </>
                        )}
                      </div>
                    </div>
                    {userPercentile != null && <div style={S.heroRankCardPill}>Top {100 - userPercentile}%</div>}
                  </>
                ) : (
                  <>
                    <div style={S.heroRankCardLabel}>your rank</div>
                    <div style={S.heroRankCardUnranked}>—</div>
                    <div style={S.heroRankCardPill}>Not ranked yet</div>
                  </>
                )}
              </div>

              <div style={S.heroTextGroup} className="mm-hero-text-group">
                {currentUser?.name?.split(' ')[0] && <div style={S.heroEyebrowLabel}>YOUR STANDING</div>}
                <h1 style={S.heroH1}>{heroVerdict}</h1>
                <p style={S.heroSub}>{heroSub}</p>
                {userPercentile != null && userRank != null && (
                  <div style={S.heroPercentileLine}>
                    <span style={S.heroPercentileHighlight}>Top {100 - userPercentile}%</span>
                    {' '}of {totalCount} students · beating {Math.max(0, totalCount - userRank)} of them
                  </div>
                )}
              </div>

              {(gapToNext != null || userIRS != null) && (
                <div style={S.heroStatRow} className="mm-hero-stats">
                  {gapToNext != null && gapToNext > 0 && <HeroStat label={`gap to #${userRank - 1}`} value={gapToNext} unit=" pts" color="#fff" />}
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

            <div style={S.heroActions} className="mm-hero-actions">
              <button style={S.btnPrimary} className="mm-btn-primary mm-hero-cta" onClick={() => navigate('/interview')}>New mock interview</button>
              <button style={S.btnGhost} className="mm-btn-ghost" onClick={() => navigate('/analytics')}>Full analytics</button>
              <button style={S.btnGhost} className="mm-btn-ghost" onClick={() => weakestPracticeTopic ? navigate('/interview', { state: { mode: 'topic', topic: weakestPracticeTopic } }) : navigate('/coach')}>
                {weakestDim ? `Sharpen ${weakestDim.label}` : 'AI Coach'}
              </button>
              {currentUserStreak >= 2 && <div style={S.heroStreakChip} className="mm-hero-streak">🔥 {currentUserStreak}-day streak</div>}
              <div style={{ flex: 1 }} className="mm-hero-actions-spacer" />
              <HeroIconButton icon="🕘" title="Practice history" onClick={() => navigate('/history')} />
            </div>
          </section>

          {/* Toggle card */}
          <section style={S.toggleCard} className="lb-toggle-card">
            <div style={S.toggleBar} className="lb-toggle-bar">
              <div style={S.toggleBadgeGroup} className="lb-toggle-badge-group">
                <div style={S.toggleBadgeIcon}>🏆</div>
                <div>
                  <div style={S.toggleBadgeTitle}>Board settings</div>
                  <div style={S.toggleBadgeSub}>customize your view</div>
                </div>
              </div>
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
              <div style={S.toggleMeta} className="lb-toggle-meta">
                <span style={S.mono}>viewing {activeData.length !== rawData.length ? `${activeData.length} of ` : ''}{rawData.length} {rawData.length === 1 ? 'entry' : 'entries'}</span>
              </div>
            </div>
          </section>

          {/* Rival card */}
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

          {/* Podium */}
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

          {/* Search row */}
          {rawData.length > 0 && (
            <div style={S.searchRow}>
              <div style={S.searchBox} className="lb-search-box">
                <span style={{ fontSize: 13, color: C.muted }}>🔍</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a name on this board…" style={S.searchInput} />
                {query && <button onClick={() => setQuery('')} style={S.searchClear} aria-label="Clear search">✕</button>}
              </div>
              <div style={S.mono}>{activeData.length} of {rawData.length} shown</div>
            </div>
          )}

          {/* Table */}
          {rawData.length === 0 ? (
            <div style={S.emptyCard}>
              <div style={{ fontSize: 46, marginBottom: 12 }}>🏆</div>
              <div style={S.emptyTitle}>{activePeriod === 'weekly' ? 'No rankings this week' : 'No overall rankings yet'}</div>
              <div style={S.emptyDesc}>{activePeriod === 'weekly' ? 'Complete an interview this week to appear here.' : 'Complete an interview to appear on the overall leaderboard.'}</div>
              <button onClick={() => navigate('/interview')} style={S.btnBlue} className="mm-btn-blue lb-new-iv-btn">Start interview →</button>
            </div>
          ) : activeData.length === 0 ? (
            <div style={S.emptyCard}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔎</div>
              <div style={S.emptyTitle}>No matches for "{query}"</div>
              <div style={S.emptyDesc}>Try a different name, or clear the search to see everyone.</div>
              <button onClick={() => setQuery('')} style={S.btnGhostLight}>Clear search</button>
            </div>
          ) : (
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
                const delta = activePeriod === 'weekly' ? mockDelta(numericRank, idx + String(entry._id || '').charCodeAt(0) || 0) : 0;
                const isNew = activePeriod === 'weekly' && sessionCount === 1 && numericRank > 3;
                const eff = efficiency(numericScore, sessionCount);
                const trendPoints = Array.isArray(entry.recentScores) && entry.recentScores.length ? entry.recentScores.slice(-6) : null;
                const tierColor = numericRank <= 3 ? [C.gold, C.silver, C.bronze][numericRank - 1] : platinumRow ? C.platinum : C.signal;

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
                        <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: numericRank <= 3 ? tierColor : C.muted, letterSpacing: '-0.2px' }}>#{numericRank}</span>
                      </div>
                      <div style={{ width: 44, flexShrink: 0 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, border: `2px solid ${isYou ? C.pulse : (numericRank <= 3 || platinumRow) ? `${tierColor}66` : C.lineMd}`, boxShadow: isYou ? '0 2px 10px rgba(0,194,232,0.30)' : 'none' }}>
                          <Avatar src={entry.avatar} name={entry.name} style={{ borderRadius: 8 }}>
                            <div style={{ width: '100%', height: '100%', background: isYou ? `linear-gradient(135deg, ${C.signal}, ${C.pulse})` : (numericRank <= 3 || platinumRow) ? `linear-gradient(135deg, ${tierColor}33, ${tierColor}99)` : C.signalTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.serif, fontSize: 14, fontWeight: 600, color: isYou ? '#fff' : (numericRank <= 3 || platinumRow) ? tierColor : C.signalDeep }}>
                              {entry.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          </Avatar>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                          <span style={{ fontFamily: F.body, fontSize: 13.5, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name || 'Unknown'}</span>
                          {isYou && <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.pulseDeep, background: C.pulseTint, border: `1px solid ${C.pulse}55`, padding: '1px 7px', borderRadius: 99, flexShrink: 0 }}>YOU</span>}
                          {platinumRow && !isYou && <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.platinum, background: C.platinumTint, border: `1px solid ${C.platinum}44`, padding: '1px 7px', borderRadius: 99, flexShrink: 0 }}>♛</span>}
                          <StreakBadge streak={entry.streak} />
                          <DeltaBadge delta={delta} isNew={isNew} showDelta={activePeriod === 'weekly'} />
                        </div>
                        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{sessionCount} session{sessionCount !== 1 ? 's' : ''}{activePeriod === 'weekly' ? ' this week' : ' total'}</div>
                      </div>
                      <div style={{ width: 110, fontFamily: F.body, fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }} className="lb-college-col">{entry.college || '—'}</div>
                      <div style={{ width: 68, textAlign: 'center', flexShrink: 0 }} className="lb-efficiency-col">
                        <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: eff >= 70 ? C.green : eff >= 50 ? C.signal : C.muted }}>{eff}</span>
                      </div>
                      <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="lb-trend-col">
                        {trendPoints && trendPoints.length > 1 ? (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
                            {trendPoints.slice(-5).map((p, i) => (
                              <div key={i} style={{ width: 5, height: Math.max(3, Math.round((p / 100) * 22)), borderRadius: 2, background: scoreColor(p), opacity: 0.7 + i * 0.06 }} />
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>—</span>
                        )}
                      </div>
                      <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: sColor, marginBottom: 5, letterSpacing: '-0.3px' }}>
                          {numericScore}<span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, color: C.muted }}>/100</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ScoreBar score={numericScore} max={maxScore} /></div>
                      </div>
                      <div style={{ width: 18, textAlign: 'right', flexShrink: 0, color: C.faint, fontSize: 10, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}>›</div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '16px 20px 18px 66px', background: C.surfaceSunk, borderBottom: idx < activeData.length - 1 ? `1px solid ${C.line}` : 'none', animation: 'lbFadeUp 0.22s ease' }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.5px', color: C.muted, marginBottom: 10, textTransform: 'lowercase' }}>recent session trend</div>
                        <MiniTrend points={trendPoints || []} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Stat rail */}
          {rawData.length >= 1 && (
            <section style={S.statRail} className="mm-stat-rail">
              <RailStat label="Top score" value={`${maxScore}/100`} color={C.gold} />
              <RailStat label="Field size" value={`${totalCount} ${totalCount === 1 ? 'student' : 'students'}`} color={C.signal} />
              <RailStat label="Field avg" value={`${rawData.length ? Math.round(rawData.reduce((sum, e) => sum + (Number(e.avgScore) || 0), 0) / rawData.length) : 0}/100`} color={C.pulseDeep} />
              <RailStat label="Field activity" value={`${fieldSessions} session${fieldSessions !== 1 ? 's' : ''}`} color={C.orange} sub={fieldOnStreak > 0 ? `🔥 ${fieldOnStreak} on a streak` : `${periodLabel} on this board`} />
            </section>
          )}

          {/* CTA banner */}
          <div style={S.ctaBanner}>
            <div style={S.heroNoise} />
            <div style={{ position: 'relative' }}>
              <div style={S.heroKicker}>climb the ranks</div>
              <div style={S.ctaTitle}>{activePeriod === 'weekly' ? 'Every interview moves you up this week.' : 'Every interview contributes to your overall standing.'}</div>
              <div style={S.ctaSub}>{activePeriod === 'weekly' ? 'Weekly rankings reset every Monday. Your overall record stays intact.' : 'Overall rankings use all of your completed interviews and never reset.'}</div>
            </div>
            <button onClick={() => navigate('/interview')} style={S.btnBannerCta} className="mm-banner-cta">Practice now →</button>
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

export default Leaderboard;
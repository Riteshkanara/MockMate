import API_BASE from '../config/api.js';
import { useEffect, useMemo, useState, useCallback, useRef, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import useAuth from '../hooks/useAuth';
import { getDashboardAnalytics, startInterview, fixBadges } from '../Services/interviewService';
import { getShareLink } from '../Services/profileServices';
import PageLoader from '../components/PageLoader';
import Button from '../components/Button';
import { C, F } from '../styles/token';
import BadgeShowcase, { EXTENDED_BADGE_CATALOGUE } from '../components/BadgeShowcase';

import HeroSection        from '../components/dashboard/HeroSection.jsx';
import ActivityHeatmap    from '../components/dashboard/ActivityHeatmap';
import WeeklyChallenges   from '../components/dashboard/WeeklyChallenges';
import MomentumBoard      from '../components/dashboard/MomentumBoard';
import ShareCard          from '../components/dashboard/ShareCard';
import TierProgressLadder from '../components/dashboard/TierProgressLadder';
import HeroSparkline      from '../components/dashboard/HeroSparkline';
import AICoachDrawer      from '../components/dashboard/AICoachDrawer';

const PALETTE_EXT = {
  pulseTint:    '#E3FAFF',
  bronze:       '#9C6A3E', bronzeTint:   '#F7EEE3',
  silver:       '#6E7B99', silverTint:   '#EFF2F8',
  gold:         '#AD7F10', goldTint:     '#FBF3DE',
  platinum:     '#4C57C7', platinumTint: '#EDEEFC',
  dark0:        '#080F1E',
  dark1:        '#0A1628',
};
const X = PALETTE_EXT;

const TIER_META = {
  '₹3–6 LPA':   { color: C.muted,   bg: C.cardAlt },
  '₹6–12 LPA':  { color: C.amber,   bg: C.amberTint },
  '₹12–20 LPA': { color: C.blue500, bg: C.blue50 },
  '₹20 LPA+':   { color: C.cyan500, bg: X.pulseTint },
};

const DIMENSION_META = [
  { key: 'technical',      label: 'Technical Depth', icon: '⚙',  weight: 0.28, tip: 'Core CS fundamentals — the first thing technical screeners test.' },
  { key: 'problemSolving', label: 'Problem Solving', icon: '◈',  weight: 0.22, tip: 'How you break down unknowns — decisive in live coding rounds.' },
  { key: 'communication',  label: 'Communication',   icon: '◐',  weight: 0.18, tip: 'Clarity of thought, not just English — interviewers notice it fast.' },
  { key: 'behavioral',     label: 'Behavioral',      icon: '◇',  weight: 0.12, tip: 'Situational judgment and self-awareness under HR scrutiny.' },
  { key: 'design',         label: 'System Design',   icon: '▣',  weight: 0.10, tip: 'Matters at ₹12 LPA+ — often the differentiator between tiers.' },
  { key: 'fundamentals',   label: 'CS Fundamentals', icon: '▤',  weight: 0.10, tip: 'Breadth of core knowledge — separates prepared from lucky.' },
];

const ARCHETYPES = [
  { id: 'inconsistentGenius', label: 'Inconsistent Genius', icon: '◈', desc: 'High variance — brilliant when in flow but needs to build floor quality.', fix: 'Consistency drills: hold 65+ on every session before chasing 90+.' },
  { id: 'consistentClimber',  label: 'Consistent Climber',  icon: '↗', desc: 'Steady, reliable improvement — the archetype that wins campus placements.', fix: 'Keep the streak; add harder topic rotations to keep growing.' },
  { id: 'speedRunner',        label: 'Speed Runner',        icon: '⚡', desc: 'Fast answers but sometimes sacrifices depth for pace.', fix: 'Practise "think aloud" — say your reasoning before your answer.' },
  { id: 'deepThinker',        label: 'Deep Thinker',        icon: '◐', desc: 'Thorough and accurate — needs to improve time management under live pressure.', fix: 'Run timed drills; 2-minute cap per answer in quick-fire mode.' },
  { id: 'pressureCooker',     label: 'Pressure Cooker',     icon: '◆', desc: 'Scores improve in timed sessions — performs well under competition conditions.', fix: 'Channel this by signing up for live contest platforms weekly.' },
];

const ALL_TIERS = [
  { label: '₹3–6 LPA',   minIRS: 0  },
  { label: '₹6–12 LPA',  minIRS: 35 },
  { label: '₹12–20 LPA', minIRS: 60 },
  { label: '₹20 LPA+',   minIRS: 80 },
];

const clamp  = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));
const ewma   = (values, alpha = 0.35) => !values.length ? 0 : values.reduce((acc, v, i) => i === 0 ? v : alpha * v + (1 - alpha) * acc, values[0]);
const stdDev = (values) => {
  if (values.length < 2) return 0;
  const m = values.reduce((a, v) => a + v, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + Math.pow(v - m, 2), 0) / (values.length - 1));
};
const slope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
  const den = values.reduce((a, _, i) => a + Math.pow(i - xm, 2), 0);
  return den ? num / den : 0;
};

const pickArchetype = (scoreTrend, avgTimePerQ) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1];
  const sd = stdDev(scores), sl = slope(scores);
  if (sd > 18) return ARCHETYPES[0];
  if (sl > 2)  return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};

const topROITarget = (topicPerformance, dimensionProfile) => {
  if (!topicPerformance.length) return null;
  return topicPerformance.map(t => {
    const dim = DIMENSION_META.find(d => d.key === (dimensionProfile.find(dp => dp.contributingTopics?.includes(t.topic))?.key)) ?? {};
    return { ...t, roi: (dim.weight ?? 0.1) * (100 - (t.averageScore || 0)) };
  }).sort((a, b) => b.roi - a.roi)[0];
};

const scoreColor = (s) => s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

const useLiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

class SectionBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error('[Dashboard section error]', err); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ padding: '20px 24px', borderRadius: 16, marginBottom: 18, background: C.redTint, border: `1px solid ${C.red}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>This section ran into a problem</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
            The rest of the dashboard is fine.{' '}
            <button onClick={() => this.setState({ hasError: false })} style={{ color: C.blue500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>Try again</button>
          </div>
        </div>
      </div>
    );
  }
}

const LoadError = ({ onRetry, retrying }) => (
  <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: C.bg }}>
    <div style={{ maxWidth: 420, textAlign: 'center', padding: '36px 32px', borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ fontSize: 26, marginBottom: 14 }}>⚠️</div>
      <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>Couldn't load your dashboard</h2>
      <p style={{ margin: '10px 0 20px', fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
        Your session data didn't come through. This is usually a connection hiccup — try again.
      </p>
      <Button variant="gradient" onClick={onRetry} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again'}</Button>
    </div>
  </div>
);

LoadError.propTypes = {
  onRetry:  PropTypes.func.isRequired,
  retrying: PropTypes.bool.isRequired,
};

const observeVisibility = (el, onVisible, delay) => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) { onVisible(); observer.disconnect(); }
    },
    { threshold: 0.08 }
  );
  const t = setTimeout(() => observer.observe(el), delay);
  return () => { clearTimeout(t); observer.disconnect(); };
};

const AnimatedSection = ({ children, delay = 0, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeVisibility(el, () => setVisible(true), delay);
  }, [delay]);
  return (
    <div
      ref={ref}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.5s cubic-bezier(.16,1,.3,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

AnimatedSection.propTypes = {
  children: PropTypes.node.isRequired,
  delay:    PropTypes.number,
  style:    PropTypes.object,
};

const TROPHY_TIER = {
  bronze:   { h: 52,  hueBase: 18,  hueSpread: 64,  sat: 88, lightTop: 73, lightBot: 48, label: '#9A3412' },
  silver:   { h: 72,  hueBase: 188, hueSpread: 110, sat: 72, lightTop: 80, lightBot: 52, label: '#0E7490' },
  gold:     { h: 96,  hueBase: 44,  hueSpread: 72,  sat: 94, lightTop: 76, lightBot: 46, label: '#A16207' },
  platinum: { h: 120, hueBase: 270, hueSpread: 100, sat: 86, lightTop: 80, lightBot: 50, label: '#6D28D9' },
};

const hueFromId = (id = '') => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
};

const badgeColors = (badge = {}) => {
  const T    = TROPHY_TIER[badge.tier] || TROPHY_TIER.bronze;
  const seed = hueFromId(badge.id || badge.label || 'badge');
  const hue  = (T.hueBase + (seed % T.hueSpread) - T.hueSpread / 2 + 360) % 360;
  const hue2 = (hue + 24 + (seed % 13)) % 360;
  return {
    grad:    `linear-gradient(180deg, hsl(${hue} ${T.sat}% ${T.lightTop}%) 0%, hsl(${hue2} ${Math.min(100, T.sat + 2)}% ${T.lightBot}%) 100%)`,
    capGrad: `linear-gradient(135deg, hsl(${hue} ${T.sat}% ${T.lightTop + 9}%), hsl(${hue2} ${T.sat}% ${T.lightTop - 1}%))`,
    iconBg:  `linear-gradient(135deg, hsl(${hue} ${Math.min(T.sat, 60)}% 97%), hsl(${hue2} ${Math.min(T.sat, 52)}% 90%))`,
    iconCol: `hsl(${hue} ${Math.min(100, T.sat + 4)}% 30%)`,
    label:   `hsl(${hue} ${Math.min(100, T.sat + 2)}% 34%)`,
    h:        T.h,
    glow:    `hsl(${hue2} ${T.sat}% 58%)`,
    accent:  `hsl(${hue2} ${Math.min(100, T.sat + 4)}% 50%)`,
  };
};

const UnlockedTrophyBtn = ({ b, isSel, onClick }) => {
  const bc = badgeColors(b);
  return (
    <button
      onClick={onClick}
      title={b.desc}
      aria-label={`${b.label}, ${b.tier} tier, earned. ${b.desc}`}
      aria-pressed={isSel}
      className="mm-trophy-btn"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        width: 64, flexShrink: 0,
        filter:    isSel ? `drop-shadow(0 0 10px ${bc.glow}88)` : 'none',
        transform: isSel ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'filter 0.2s ease, transform 0.2s ease',
      }}
    >
      <div style={{ width: 44, height: 12, borderRadius: '6px 6px 0 0', background: bc.capGrad, boxShadow: `0 4px 12px ${bc.glow}24` }} />
      <div style={{ width: 44, height: 44, background: bc.iconBg, border: `2px solid ${bc.iconCol}30`, boxShadow: `0 7px 16px ${bc.glow}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, color: bc.iconCol }}>
        {b.icon}
      </div>
      <div style={{ width: 18, height: bc.h, background: bc.grad, borderRadius: '0 0 2px 2px' }} />
      <div style={{ width: 52, height: 7, background: bc.grad, borderRadius: '0 0 4px 4px', opacity: 0.75 }} />
      <div style={{ marginTop: 7, fontSize: 9.5, fontWeight: 700, color: bc.label, textAlign: 'center', lineHeight: 1.25, maxWidth: 60, wordBreak: 'break-word' }}>{b.label}</div>
      <div style={{ fontSize: 8, fontFamily: F.mono, color: C.muted, marginTop: 2 }}>{b.tier}</div>
    </button>
  );
};

UnlockedTrophyBtn.propTypes = {
  b:       PropTypes.object.isRequired,
  isSel:   PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

const Toast = ({ toast }) => toast ? (
  <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? C.red : C.text, color: '#fff', padding: '11px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, zIndex: 9999, pointerEvents: 'none', fontFamily: F.body, boxShadow: `0 8px 28px ${toast.type === 'error' ? 'rgba(220,38,38,0.3)' : 'rgba(15,26,53,0.3)'}`, animation: 'fadeUp 0.22s ease' }}>
    {toast.msg}
  </div>
) : null;

Toast.propTypes = { toast: PropTypes.object };

const RailStat = ({ label, value, unit, sub, color, onClick }) => (
  <div style={{ ...S.railCell, cursor: onClick ? 'pointer' : 'default' }} className="mm-rail-cell" onClick={onClick}>
    <div style={S.railLabel}>{label}</div>
    <div style={S.railValRow}>
      <span style={{ ...S.railVal, color }}>{value}</span>
      {unit && <span style={S.railUnit}>{unit}</span>}
    </div>
    <div style={S.railSub}>{sub}</div>
  </div>
);

RailStat.propTypes = {
  label:   PropTypes.string.isRequired,
  value:   PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  unit:    PropTypes.string,
  sub:     PropTypes.string.isRequired,
  color:   PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

const FIRST_TIME_UNLOCKS = [
  { icon: '◎', label: 'IRS score',           desc: 'A weighted readiness number mapped to real salary tiers — ₹3L to ₹20L+.' },
  { icon: '▤', label: 'Momentum Board',      desc: 'Three action cards that tell you exactly what to drill next and why.' },
  { icon: '⚙', label: 'Dimension breakdown', desc: '6-axis profile showing where you lose IRS points and by how much.' },
  { icon: '◆', label: 'Badges & streaks',    desc: 'Earned from real patterns — comebacks, speed, consistency, percentile rank.' },
  { icon: '▣', label: 'Activity heatmap',    desc: 'Your practice log as a GitHub-style calendar. Every day counts.' },
  { icon: '↗', label: 'AI Coach plan',       desc: 'A 30-day battle plan built from your actual data, not generic advice.' },
];

const FirstTimeCard = ({ onStart, starting }) => (
  <section style={{ marginBottom: 20 }}>
    <div style={{ marginBottom: 16 }}>
      <div style={S.eyebrow}>what one session unlocks</div>
      <h2 style={{ ...S.cardH2, marginBottom: 4 }}>Your full dashboard, computed from real performance</h2>
      <p style={S.cardSub}>Everything below is empty right now — because it's all derived from your actual answers, not defaults.</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="mm-first-time-grid">
      {FIRST_TIME_UNLOCKS.map(u => (
        <div key={u.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: C.blue50, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.blue500, flexShrink: 0 }}>{u.icon}</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{u.label}</div>
          </div>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, paddingLeft: 42 }}>{u.desc}</div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 14, padding: '18px 22px', borderRadius: 16, background: `linear-gradient(135deg, ${C.blue50}, ${X.pulseTint})`, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Takes under 10 minutes.</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>Quick-fire mode: 10 questions, instant scoring, full IRS computed on completion.</div>
      </div>
      <Button variant="gradient" onClick={onStart} disabled={starting}>
        {starting ? 'Launching…' : 'Run first interview →'}
      </Button>
    </div>
  </section>
);

FirstTimeCard.propTypes = {
  onStart:  PropTypes.func.isRequired,
  starting: PropTypes.bool.isRequired,
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const clock     = useLiveClock();

  const [dashStats,  setDashStats]  = useState(null);
  const [analytics,  setAnalytics]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [retrying,   setRetrying]   = useState(false);
  const [starting,   setStarting]   = useState(false);
  const [coachOpen,  setCoachOpen]  = useState(false);
  const [toast,      setToast]      = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoadError(false);
      const statsReq = fetch(`${API_BASE}/dashboard/stats`, { credentials: 'include' }).then(r => r.json());
      const analyticsData = await getDashboardAnalytics();
      statsReq.then(s => setDashStats(s)).catch(() => {});
      setAnalytics(analyticsData);
    } catch (e) {
      console.error('Dashboard load:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleRetry = useCallback(() => {
    setRetrying(true); setLoading(true);
    loadDashboard();
  }, [loadDashboard]);

  const startQuick = useCallback(async (topic = '') => {
    try {
      setStarting(true);
      const r = await startInterview({ mode: 'quick', company: '', topic });
      navigate('/interview', { state: { sessionId: r.sessionId, questions: r.questions, mode: 'quick' } });
    } catch (e) { console.error('Start interview:', e); }
    finally { setStarting(false); }
  }, [navigate]);

  const [fixingBadges, setFixingBadges] = useState(false);

  const handleFixBadges = useCallback(async () => {
    setFixingBadges(true);
    try {
      const data  = await fixBadges();
      const [fresh, freshStats] = await Promise.all([
        getDashboardAnalytics(),
        fetch(`${API_BASE}/dashboard/stats`, { credentials: 'include' }).then(r => r.json()),
      ]);
      setAnalytics(fresh);
      setDashStats(freshStats);
      const gained = data.newBadges?.length ?? 0;
      setToast({ msg: gained > 0 ? `${gained} badge${gained > 1 ? 's' : ''} unlocked` : 'Badges are up to date', type: 'success' });
    } catch {
      setToast({ msg: 'Could not recheck badges — try again', type: 'error' });
    } finally {
      setFixingBadges(false);
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const totalInterviews  = analytics?.totalInterviews ?? analytics?.totalSessions ?? 0;
  const averageScore     = analytics?.averageScore ?? 0;
  const bestScore        = analytics?.bestScore ?? analytics?.highestScore ?? dashStats?.stats?.bestScore ?? 0;
  const scoreTrend       = analytics?.scoreTrend ?? [];
  const topicPerformance = useMemo(() => analytics?.topicPerformance ?? [], [analytics]);
  const badgesRaw        = useMemo(() => analytics?.badges ?? [], [analytics]);
  const streakDays       = user?.streak?.current ?? dashStats?.stats?.currentStreak ?? 0;
  const avgTimePerQ      = analytics?.timePerformance?.averageTimePerQuestion ?? null;
  const hasData          = totalInterviews > 0;

  const latestScore = scoreTrend.at(-1)?.score ?? 0;
  const prevScore   = scoreTrend.at(-2)?.score ?? latestScore;
  const delta       = latestScore - prevScore;
  const irs         = analytics?.irs ?? 0;

  const currentTierLabel = analytics?.currentTier ?? '₹3–6 LPA';
  const activeTierMeta   = TIER_META[currentTierLabel] ?? TIER_META['₹3–6 LPA'];
  const currentTier      = { label: currentTierLabel, ...activeTierMeta };

  const apiTiers        = analytics?.tiers ?? [];
  const activeTierApi   = apiTiers.find(t => t.label === currentTierLabel) ?? null;
  const activeTierFloor = activeTierApi?.minIRS ?? (ALL_TIERS.find(t => t.label === currentTierLabel)?.minIRS ?? 0);
  const nextTierApi     = apiTiers.find(t => !t.isUnlocked && t.label !== currentTierLabel) ?? null;
  const nextTier        = nextTierApi ? { label: nextTierApi.label, minScore: nextTierApi.minIRS, color: TIER_META[nextTierApi.label]?.color ?? C.blue500, advice: nextTierApi.advice } : null;
  const irsGap          = nextTier ? Math.max(0, nextTier.minScore - irs) : 0;

  const dimensionProfile = useMemo(() => {
    const apiProfile = analytics?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const d = apiProfile.find(d => d.key === meta.key);
      return { ...meta, score: d?.score ?? 0, hasData: d?.hasData ?? false, isProvisional: d?.isProvisional ?? false, answeredCount: d?.answeredCount ?? 0, contributingTopics: d?.contributingTopics ?? [] };
    });
  }, [analytics]);

  const archetype    = useMemo(() => pickArchetype(scoreTrend, avgTimePerQ), [scoreTrend, avgTimePerQ]);
  const dimWithData  = dimensionProfile.filter(d => d.hasData);
  const strongestDim = [...dimWithData].sort((a, b) => b.score - a.score)[0];
  const weakestDim   = [...dimWithData].sort((a, b) => a.score - b.score)[0];
  const fixTarget    = useMemo(() => topROITarget(topicPerformance, dimensionProfile), [topicPerformance, dimensionProfile]);

  const PCT_THRESHOLDS = { pct_50: 50, pct_25: 25, pct_10: 10, pct_5: 5 };
  const percentile = analytics?.percentile ?? null;

  const badges = useMemo(() => {
    const byId = Object.fromEntries(badgesRaw.map(b => [b.id, b]));
    return EXTENDED_BADGE_CATALOGUE.map(def => {
      const pctMax = PCT_THRESHOLDS[def.id];
      if (pctMax != null) {
        const unlocked = percentile != null && percentile <= pctMax;
        const progress = percentile == null ? null : unlocked ? 1 : Math.max(0, Math.min(1, pctMax / percentile));
        return { ...def, unlocked, progress, meta: unlocked ? { percentile } : null };
      }
      const live = byId[def.id];
      return { ...def, unlocked: live?.unlocked ?? false, progress: live?.progress ?? null, meta: live?.meta ?? null };
    });
  }, [badgesRaw, percentile]);

  const unlockedCount = badges.filter(b => b.unlocked).length;
  const nextBadge = useMemo(() => {
    const locked = badges.filter(b => !b.unlocked && typeof b.progress === 'number');
    return locked.sort((a, b) => (b.progress || 0) - (a.progress || 0))[0] || null;
  }, [badges]);

  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);

  if (loading)   return <PageLoader />;
  if (loadError) return <LoadError onRetry={handleRetry} retrying={retrying} />;

  return (
    <div style={S.page} className="mm-page">
      <GlobalStyles />
      <Toast toast={toast} />

      <AICoachDrawer
        open={coachOpen} onClose={() => setCoachOpen(false)}
        irs={irs} archetype={archetype} topTier={currentTier}
        weakest={weakestDim} strongest={strongestDim}
        scoreTrend={scoreTrend}
      />

      <div style={S.container}>

        <AnimatedSection delay={0}>
          <div style={S.strip} className="mm-strip">
            <div style={S.stripL}>
              <span style={S.liveDot} />
              <span style={S.mono}>mockmate readiness terminal</span>
            </div>
            <div style={S.stripR} className="mm-strip-r">
              <span style={S.mono}>session {sessionId}</span>
              <span style={{ color: C.borderMd }}>·</span>
              <span style={S.mono}>{clock.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase()} {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={60}>
          <SectionBoundary>
            <HeroSection
              user={user} hasData={hasData} currentTier={currentTier}
              totalInterviews={totalInterviews} strongestDim={strongestDim} weakestDim={weakestDim}
              scoreTrend={scoreTrend} starting={starting} startQuick={startQuick}
              navigate={navigate} setCoachOpen={setCoachOpen}
              irs={irs} apiTiers={apiTiers} currentTierLabel={currentTierLabel}
              nextTier={nextTier} irsGap={irsGap} analytics={analytics}
              averageScore={averageScore} bestScore={bestScore}
              streakDays={streakDays} delta={delta} archetype={archetype}
              tierLadder={
                <TierProgressLadder
                  irs={irs} hasData={hasData} apiTiers={apiTiers}
                  currentTierLabel={currentTierLabel} nextTier={nextTier} irsGap={irsGap}
                  isGated={analytics?.currentTierIsGated} gatedRaw={analytics?.currentTierRaw}
                  sessionsNeeded={analytics?.rawTierSessionsLeft}
                />
              }
              sparkline={<HeroSparkline scoreTrend={scoreTrend} />}
            />
          </SectionBoundary>
        </AnimatedSection>

        {!hasData && (
          <AnimatedSection delay={80}>
            <SectionBoundary>
              <FirstTimeCard onStart={() => startQuick()} starting={starting} />
            </SectionBoundary>
          </AnimatedSection>
        )}

        {hasData && (<>

          <AnimatedSection delay={0}>
            <SectionBoundary>
              <section style={S.statRail} className="mm-stat-rail">
                <RailStat label="Average score"   value={averageScore}    unit="/100" sub="Mean across all sessions"                                    color={scoreColor(averageScore)} onClick={() => navigate('/analytics')} />
                <RailStat label="Best session"    value={bestScore}       unit="/100" sub="Your personal ceiling"                                       color={C.blue500}                onClick={() => navigate('/history')} />
                <RailStat label="Sessions logged" value={totalInterviews} unit=""     sub={streakDays ? `${streakDays}-day streak` : 'No active streak'} color={C.green}                 onClick={() => navigate('/history')} />
                <RailStat label="Last session"    value={`${delta >= 0 ? '+' : ''}${delta}`} unit=" pts" sub={delta > 0 ? 'Moving up' : delta < 0 ? 'Slipping — drill now' : 'Flat'} color={delta >= 0 ? C.green : C.orange} onClick={() => startQuick()} />
              </section>
            </SectionBoundary>
          </AnimatedSection>

          <AnimatedSection delay={0}>
            <SectionBoundary>
              <MomentumBoard
                irs={irs} fixTarget={fixTarget} weakestDim={weakestDim}
                irsGap={irsGap} activeTierFloor={activeTierFloor} nextTier={nextTier}
                scoreTrend={scoreTrend} streakDays={streakDays} archetype={archetype}
                onDrill={startQuick} onOpenAnalytics={() => navigate('/analytics')}
                starting={starting}
              />
            </SectionBoundary>
          </AnimatedSection>

          <AnimatedSection delay={0}>
            <SectionBoundary>
              <section style={S.twoCol} className="mm-two-col">
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <div>
                      <div style={S.eyebrow}>six-dimension breakdown</div>
                      <h2 style={S.cardH2}>Your IRS components</h2>
                      <p style={S.cardSub}>Heavier dimensions influence your IRS more. Gaps here are where readiness points are lost.</p>
                    </div>
                    <Button surface="light" variant="link" onClick={() => navigate('/analytics')}>Full radar →</Button>
                  </div>
                  <div style={S.dimList}>
                    {dimensionProfile.map(d => {
                      const col = d.hasData ? scoreColor(d.score) : C.faint;
                      return (
                        <div key={d.key} style={S.dimRow} className="mm-dim-row" title={d.tip}>
                          <div style={S.dimMeta}>
                            <div style={S.dimLeft}>
                              <span style={S.dimIcon}>{d.icon}</span>
                              <div>
                                <span style={S.dimName}>{d.label}</span>
                                <span style={S.dimWeight}>{Math.round((d.weight ?? 0) * 100)}% weight</span>
                              </div>
                            </div>
                            <span style={{ ...S.dimScore, color: d.hasData ? col : C.faint }}>
                              {d.hasData ? d.score : '—'}
                              {d.isProvisional && d.hasData && <span title="Provisional" style={{ fontSize: 9, marginLeft: 3, color: C.amber, fontWeight: 700 }}>~</span>}
                            </span>
                          </div>
                          <div style={S.dimTrack}>
                            <div style={{ ...S.dimFill, width: d.hasData ? `${d.score}%` : '0%', background: col, opacity: d.hasData ? 1 : 0.3 }} />
                          </div>
                          {!d.hasData && <div style={S.dimNoData}>No sessions for these topics yet</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <WeeklyChallenges
                  scoreTrend={scoreTrend}
                  topicPerformance={topicPerformance}
                  streakDays={streakDays}
                />
              </section>
            </SectionBoundary>
          </AnimatedSection>

          <AnimatedSection delay={0}>
            <SectionBoundary>
              <ActivityHeatmap
                scoreTrend={scoreTrend}
                sapiStreakDays={dashStats?.stats?.longestStreak ?? streakDays}
              />
            </SectionBoundary>
          </AnimatedSection>

          <AnimatedSection delay={0}>
            <SectionBoundary>
              <BadgeShowcase badges={badges} unlockedCount={unlockedCount} nextBadge={nextBadge} onFixBadges={handleFixBadges} />
            </SectionBoundary>
          </AnimatedSection>

          <AnimatedSection delay={0}>
            <SectionBoundary>
              <ShareCard
                name={user?.name?.split(' ')[0] || 'Candidate'}
                irs={irs} tier={currentTier} strongest={strongestDim}
                weakest={weakestDim} archetype={archetype}
                sessions={totalInterviews} streakDays={streakDays}
                bestScore={bestScore} averageScore={averageScore}
                percentile={percentile}
              />
            </SectionBoundary>
          </AnimatedSection>

        </>)}

        <AnimatedSection delay={0}>
          <footer style={S.footerRow}>
            <span style={S.mono}>mockmate readiness engine v11.0</span>
            <span style={S.mono}>irs = weighted dimension avg · ewma trend · breadth · consistency</span>
          </footer>
        </AnimatedSection>

      </div>
    </div>
  );
};

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    @keyframes spin           { to { transform: rotate(360deg); } }
    @keyframes livePulse      { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes fadeUp         { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes scaleIn        { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
    @keyframes barFill        { from { width:0; } }
    @keyframes heroGlowFloat  { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-14px,16px); } }
    @keyframes heroEmojiFloat { 0%,100% { translate: 0 0; opacity: 0.10; } 50% { translate: 0 -6px; opacity: 0.17; } }
    @keyframes hmTileIn       { from { opacity:0; transform:translateY(8px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes hmFadeIn       { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }

    *, *::before, *::after { box-sizing: border-box; }
    ::selection { background: rgba(26,110,255,0.16); }

    .mm-page button:focus-visible,
    .mm-page a:focus-visible,
    .mm-page [role="button"]:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 3px; border-radius: 6px; }
    .mm-page ::-webkit-scrollbar       { width: 5px; height: 5px; }
    .mm-page ::-webkit-scrollbar-track { background: transparent; }
    .mm-page ::-webkit-scrollbar-thumb { background: ${C.borderMd}; border-radius: 4px; }

    .mm-rail-cell { transition: background 0.18s ease !important; }
    .mm-rail-cell:hover { background: ${C.cardAlt} !important; }

    .mm-badge-grid button { transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.18s ease !important; }
    .mm-badge-grid button:hover { transform: translateY(-3px) !important; box-shadow: 0 6px 18px rgba(26,110,255,0.14) !important; }
    .mm-badge-grid button:active { transform: translateY(-1px) !important; }

    .mm-dim-row { transition: background 0.16s ease, border-color 0.16s ease !important; }
    .mm-dim-row:hover { background: ${C.blue50} !important; border-color: ${C.borderMd} !important; }

    .mm-challenge-row { transition: background 0.16s ease, border-color 0.16s ease !important; }
    .mm-challenge-row:hover { background: ${C.blue50} !important; border-color: ${C.borderMd} !important; }

    .mm-irs-num { animation: scaleIn 0.7s cubic-bezier(.16,1,.3,1) both 0.1s; }

    .mm-momentum-grid > div { transition: box-shadow 0.2s ease, transform 0.2s ease !important; }
    .mm-momentum-grid > div:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }

    .mm-trophy-btn { transition: transform 0.2s cubic-bezier(.16,1,.3,1), filter 0.2s ease !important; }
    .mm-trophy-btn:hover { transform: translateY(-5px) !important; }
    .mm-trophy-locked:hover { opacity: 0.55 !important; }
    .mm-trophy-btn:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 3px; border-radius: 6px; }

    .mm-hm-scroll [role="button"]:focus-visible { outline: 2px solid ${C.blue600}; outline-offset: 2px; }

    .mm-hm-seam::before, .mm-hm-seam::after { content: ''; flex: 1; height: 1px; background: ${C.border}; }
    .mm-hm-seam::before { margin-right: 12px; }

    .mm-hm-metric-tile { animation: hmTileIn 0.42s cubic-bezier(.16,1,.3,1) both; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease !important; }
    .mm-hm-metric-tile:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26,110,255,0.10); border-color: ${C.borderMd}; }
    .mm-hm-fade-card { animation: hmFadeIn 0.5s cubic-bezier(.16,1,.3,1) both 0.16s; transition: box-shadow 0.18s ease, transform 0.18s ease !important; }
    .mm-hm-fade-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26,110,255,0.08); }

    @media (prefers-reduced-motion: reduce) {
      .mm-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1120px) {
      .mm-hero-grid     { grid-template-columns: 1fr !important; gap: 32px !important; }
      .mm-two-col       { grid-template-columns: 1fr !important; }
      .mm-badge-grid    { grid-template-columns: repeat(4, 1fr) !important; }
      .mm-stat-rail     { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-momentum-grid { grid-template-columns: 1fr !important; }
      .mm-hm-narrative-row { grid-template-columns: 1fr 1fr !important; }
      .mm-hm-narrative-row > div:nth-child(3) { grid-column: span 2 !important; }
    }
    @media (max-width: 760px) {
      .mm-hero          { padding: 24px 18px !important; }
      .mm-hero-grid     { gap: 22px !important; }
      .mm-hm-panel      { padding: 16px 12px !important; overflow: hidden !important; }
      .mm-hero-metrics  { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .mm-share-row     { flex-direction: column !important; }
      .mm-badge-grid    { grid-template-columns: repeat(3, 1fr) !important; }
      .mm-strip-r       { display: none !important; }
      .mm-momentum-grid { grid-template-columns: 1fr !important; }
      .mm-first-time-grid  { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-hm-metrics-row   { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .mm-hm-narrative-row { grid-template-columns: 1fr !important; }
      .mm-hm-narrative-row > div:nth-child(3) { grid-column: span 1 !important; }
    }
    @media (max-width: 520px) {
      .mm-page          { padding: 12px 10px 54px !important; }
      .mm-trophy-shelf  { border-radius: 16px !important; }
      .mm-trophy-shelf .mm-trophy-btn                    { width: 58px !important; }
      .mm-trophy-shelf .mm-trophy-btn > div:nth-child(2) { width: 40px !important; height: 40px !important; }
      .mm-trophy-shelf .mm-trophy-btn > div:nth-child(3) { width: 16px !important; }
      .mm-trophy-shelf .mm-trophy-btn > div:nth-child(4) { width: 48px !important; }
      .mm-stat-rail     { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .mm-hm-panel .mm-hm-scroll { margin-left: -2px; margin-right: -2px; }
      .mm-badge-grid    { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-momentum-grid { grid-template-columns: 1fr !important; }
      .mm-first-time-grid { grid-template-columns: 1fr !important; }
      .mm-hero-metrics  { gap: 6px !important; }
    }
    @media (max-width: 380px) {
      .mm-stat-rail     { grid-template-columns: 1fr !important; }
      .mm-hm-panel      { padding-left: 10px !important; padding-right: 10px !important; }
      .mm-hm-panel .mm-hm-scroll { padding-left: 0 !important; padding-right: 0 !important; }
      .mm-hero-metrics  { grid-template-columns: 1fr 1fr !important; }
      .mm-hm-metrics-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
  `}</style>
);

const S = {
  page:      { minHeight: 'calc(100vh - 64px)', background: C.bg, backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(26,110,255,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,200,240,0.04) 0%, transparent 40%)`, padding: '24px 28px 80px', fontFamily: F.body },
  container: { maxWidth: 1260, margin: '0 auto' },
  strip:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', marginBottom: 20, borderRadius: 11, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripL:    { display: 'flex', alignItems: 'center', gap: 9 },
  stripR:    { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot:   { width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'livePulse 2.4s ease-in-out infinite' },
  mono:      { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.3px', color: C.muted },
  card:      { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 26, boxShadow: C.shadow, marginBottom: 18 },
  cardHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  eyebrow:   { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', color: C.blue500, marginBottom: 7, textTransform: 'lowercase' },
  cardH2:    { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' },
  cardSub:   { margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 440 },
  twoCol:    { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginBottom: 18 },
  statRail:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20, borderRadius: 18, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: 'hidden' },
  railCell:  { padding: '20px 24px', borderRight: `1px solid ${C.border}` },
  railLabel: { fontSize: 11, fontWeight: 600, color: C.muted },
  railValRow:{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 },
  railVal:   { fontFamily: F.display, fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.8px' },
  railUnit:  { fontFamily: F.mono, fontSize: 12, color: C.muted },
  railSub:   { marginTop: 8, fontSize: 11, color: C.muted, lineHeight: 1.5 },
  dimList:   { display: 'flex', flexDirection: 'column', gap: 10 },
  dimRow:    { padding: '14px 16px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` },
  dimMeta:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  dimLeft:   { display: 'flex', alignItems: 'center', gap: 11 },
  dimIcon:   { fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0, color: C.blue500 },
  dimName:   { fontSize: 12.5, fontWeight: 700, color: C.text, display: 'block' },
  dimWeight: { fontSize: 10, color: C.muted, fontFamily: F.mono, display: 'block', marginTop: 2 },
  dimScore:  { fontFamily: F.display, fontSize: 19, fontWeight: 800 },
  dimTrack:  { height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  dimFill:   { height: '100%', borderRadius: 999, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' },
  dimNoData: { marginTop: 5, fontSize: 10.5, color: C.faint, fontFamily: F.mono },
  footerRow: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '20px 4px 0', opacity: 0.42 },
};

export default Dashboard;
import API_BASE from '../config/api.js';
import { useEffect, useMemo, useState, useCallback, useRef, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getPerformanceAnalytics, startInterview, fixBadges, getAICoach } from '../Services/interviewService';
import { getShareLink } from '../Services/profileServices';
import PageLoader from '../components/PageLoader';
import Button from '../components/Button';
import { C, F } from '../styles/token';
import BadgeShowcase, { EXTENDED_BADGE_CATALOGUE } from '../components/BadgeShowcase';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — READINESS TERMINAL v11
//
// WHAT CHANGED FROM v10:
//   - Activity heatmap grid is now WIDTH-RESPONSIVE: cell size is derived
//     from the measured container width via ResizeObserver, so all 53 weeks
//     fit without horizontal scrolling on any viewport ≥ ~360px. Scrolling
//     is kept only as a last-resort fallback below the minimum legible cell
//     size, rather than being the default behaviour.
//   - Fixed: weekly activity pulse was checking `d.future` (always
//     undefined) instead of `d.isFuture`, so future days were silently
//     included in the "last 12 weeks" average.
//   - Fixed: Momentum Board's "next tier" progress bar used a different,
//     inconsistent formula from the Tier Progress Ladder in the hero —
//     both now compute progress the same way (gap from previous tier's
//     floor, not from zero), so the two bars never disagree with each other.
//   - Fixed: AI Coach's generateAnalysis carried a long list of useCallback
//     dependencies that were never actually sent to getAICoach(). Trimmed
//     to what's really used, so the effect doesn't needlessly re-arm on
//     every unrelated prop change.
//   - Consolidated the two trophy color systems (TROPHY_TIER / TROPHY_TIER_V2)
//     into one, so tier height and tier hue live in a single source of truth.
//   - Added a real error state for dashboard load failures — previously a
//     failed analytics fetch just logged to console and silently rendered
//     an all-zero dashboard with no way to retry.
//   - Added keyboard focus + aria labelling to heatmap cells and trophy
//     buttons so both are operable and readable without a mouse.
//   - Everything else carried forward unchanged from v10 (Tier Ladder,
//     Trophy Podium Shelf, Momentum Board, AI Coach drawer, 12-month grid).
// ═══════════════════════════════════════════════════════════════════════════

const X = {
  pulseTint: '#E3FAFF',
  bronze: '#9C6A3E',   bronzeTint: '#F7EEE3',
  silver: '#6E7B99',   silverTint: '#EFF2F8',
  gold:   '#AD7F10',   goldTint:   '#FBF3DE',
  platinum: '#4C57C7', platinumTint: '#EDEEFC',
  dark0: '#080F1E',
  dark1: '#0A1628',
};

const TIER_STYLE = {
  bronze:   { color: X.bronze,   tint: X.bronzeTint,   ring: 'rgba(156,106,62,0.28)' },
  silver:   { color: X.silver,   tint: X.silverTint,   ring: 'rgba(110,123,153,0.28)' },
  gold:     { color: X.gold,     tint: X.goldTint,     ring: 'rgba(173,127,16,0.28)' },
  platinum: { color: X.platinum, tint: X.platinumTint, ring: 'rgba(76,87,199,0.28)' },
};

const TIER_META = {
  '₹3–6 LPA':   { color: C.muted,   bg: C.cardAlt },
  '₹6–12 LPA':  { color: C.amber,   bg: C.amberTint },
  '₹12–20 LPA': { color: C.blue500, bg: C.blue50 },
  '₹20 LPA+':   { color: C.cyan500, bg: X.pulseTint },
};

const DIMENSION_META = [
  { key: 'technical',      label: 'Technical Depth', icon: '⚙',  weight: 0.28, tip: 'Core CS fundamentals — the first thing technical screeners test.' },
  { key: 'problemSolving', label: 'Problem Solving', icon: '◈', weight: 0.22, tip: 'How you break down unknowns — decisive in live coding rounds.' },
  { key: 'communication',  label: 'Communication',   icon: '◐', weight: 0.18, tip: 'Clarity of thought, not just English — interviewers notice it fast.' },
  { key: 'behavioral',     label: 'Behavioral',      icon: '◇', weight: 0.12, tip: 'Situational judgment and self-awareness under HR scrutiny.' },
  { key: 'design',         label: 'System Design',   icon: '▣', weight: 0.10, tip: 'Matters at ₹12 LPA+ — often the differentiator between tiers.' },
  { key: 'fundamentals',   label: 'CS Fundamentals', icon: '▤', weight: 0.10, tip: 'Breadth of core knowledge — separates prepared from lucky.' },
];

const ARCHETYPES = [
  { id: 'inconsistentGenius', label: 'Inconsistent Genius', icon: '◈', desc: 'High variance — brilliant when in flow but needs to build floor quality.', fix: 'Consistency drills: hold 65+ on every session before chasing 90+.' },
  { id: 'consistentClimber',  label: 'Consistent Climber',  icon: '↗', desc: 'Steady, reliable improvement — the archetype that wins campus placements.', fix: 'Keep the streak; add harder topic rotations to keep growing.' },
  { id: 'speedRunner',        label: 'Speed Runner',        icon: '⚡', desc: 'Fast answers but sometimes sacrifices depth for pace.', fix: 'Practise "think aloud" — say your reasoning before your answer.' },
  { id: 'deepThinker',        label: 'Deep Thinker',        icon: '◐', desc: 'Thorough and accurate — needs to improve time management under live pressure.', fix: 'Run timed drills; 2-minute cap per answer in quick-fire mode.' },
  { id: 'pressureCooker',     label: 'Pressure Cooker',     icon: '◆', desc: 'Scores improve in timed sessions — performs well under competition conditions.', fix: 'Channel this by signing up for live contest platforms weekly.' },
];


// ─── Pure math helpers ─────────────────────────────────────────────────────
const clamp   = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));
const ewma    = (values, alpha = 0.35) => !values.length ? 0 : values.reduce((acc, v, i) => i === 0 ? v : alpha * v + (1 - alpha) * acc, values[0]);
const stdDev  = (values) => { if (values.length < 2) return 0; const m = values.reduce((a, v) => a + v, 0) / values.length; return Math.sqrt(values.reduce((a, v) => a + Math.pow(v - m, 2), 0) / (values.length - 1)); };
const trendSlope = (values) => { const n = values.length; if (n < 2) return 0; const xm = (n - 1) / 2, ym = values.reduce((a, v) => a + v, 0) / n; const num = values.reduce((a, v, i) => a + (i - xm) * (v - ym), 0); const den = values.reduce((a, _, i) => a + Math.pow(i - xm, 2), 0); return den ? num / den : 0; };

const deriveArchetype = (scoreTrend, avgTimePerQ, averageScore) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1];
  const sd = stdDev(scores), slope = trendSlope(scores);
  if (sd > 18) return ARCHETYPES[0];
  if (slope > 2) return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};

// Shared tier-progress math: how far into the gap between the previous
// tier's floor and this tier's floor the current IRS sits. Used by both
// the hero's Tier Progress Ladder and the Momentum Board's tier card so
// the two progress bars can never disagree with each other.
const tierRungProgress = (irs, prevMinIRS, minIRS) => {
  const range = minIRS - (prevMinIRS ?? 0);
  if (range <= 0) return 100;
  return clamp(((irs - (prevMinIRS ?? 0)) / range) * 100);
};

// ─── Contribution-grid helpers ───────────────────────────────────────────────
const localDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const buildContributionGrid = (scoreTrend, weeksBack = 53) => {
  const byDate = {};
  (scoreTrend ?? []).forEach(s => {
    if (!s.date) return;
    const k = s.date.slice(0, 10);
    byDate[k] = byDate[k]
      ? { score: Math.round((byDate[k].score + (s.score ?? 0)) / 2), count: byDate[k].count + 1 }
      : { score: s.score ?? 0, count: 1 };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Align the grid start to the most recent Sunday, `weeksBack` weeks ago.
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() - today.getDay());
  const start = new Date(endSunday);
  start.setDate(start.getDate() - (weeksBack - 1) * 7);

  const weeks = [];
  let cursor = new Date(start);
  for (let w = 0; w < weeksBack; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const k = localDateKey(cursor);
      const isFuture = cursor > today;
      const isToday = cursor.getTime() === today.getTime();
      const entry = byDate[k];
      col.push({
        date: k,
        dateObj: new Date(cursor),
        score: entry?.score ?? 0,
        sessions: entry?.count ?? 0,
        hasData: Boolean(entry),
        isFuture,
        isToday,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(col);
  }

  const activeDates = Object.keys(byDate).sort();
  const firstActiveDate = activeDates[0] ?? null;

  return { weeks, firstActiveDate, totalActive: activeDates.length };
};

const contributionStats = (weeks) => {
  const cells = weeks.flat().filter(c => !c.isFuture && c.hasData);
  if (!cells.length) return { activeDays: 0, currentStreak: 0, longestStreak: 0, totalSessions: 0, avgScore: 0 };

  const sortedDates = [...new Set(cells.map(c => c.date))].sort();
  let longest = 1, current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = (new Date(sortedDates[i]) - new Date(sortedDates[i - 1])) / 86400000;
    if (diff === 1) { current++; longest = Math.max(longest, current); } else current = 1;
  }

  // Current streak: walk backwards from today/yesterday.
  const dateSet = new Set(sortedDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentStreak = 0;
  const probe = new Date(today);
  // Allow "today not logged yet" to not break the streak.
  if (!dateSet.has(localDateKey(probe))) probe.setDate(probe.getDate() - 1);
  while (dateSet.has(localDateKey(probe))) {
    currentStreak++;
    probe.setDate(probe.getDate() - 1);
  }

  const totalSessions = cells.reduce((s, c) => s + c.sessions, 0);
  const avgScore = Math.round(cells.reduce((s, c) => s + c.score, 0) / cells.length);

  return { activeDays: cells.length, currentStreak, longestStreak: longest, totalSessions, avgScore };
};

// Default (unclamped) sizing constants — used as the ceiling for the
// responsive grid and as the fallback before the container has been
// measured on first render.
const CELL_SIZE_MAX = 13;
const CELL_SIZE_MIN_DESKTOP = 8;
const CELL_SIZE_MIN_MOBILE = 6;
const CELL_GAP = 3;
const CELL_GAP_MOBILE = 2;
const MONTH_LABEL_H = 16;
const DAY_LABEL_W = 26;
const DAY_LABEL_W_MOBILE = 20;

const cellColor = (cell, C) => {
  if (cell.isFuture) return 'transparent';
  if (!cell.hasData) return C.cardAlt;
  const s = cell.score;
  if (s >= 85) return C.blue700 ?? '#1D4ED8';
  if (s >= 70) return C.blue600 ?? '#2563EB';
  if (s >= 55) return C.blue500 ?? '#3B82F6';
  if (s >= 35) return C.blue300 ?? '#93C5FD';
  return C.blue100 ?? '#DBEAFE';
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const bestFixTarget = (topicPerformance, dimensionProfile) => {
  if (!topicPerformance.length) return null;
  return topicPerformance.map(t => {
    const dim = DIMENSION_META.find(d => d.key === (dimensionProfile.find(dp => dp.contributingTopics?.includes(t.topic))?.key)) ?? {};
    return { ...t, roi: (dim.weight ?? 0.1) * (100 - (t.averageScore || 0)) };
  }).sort((a, b) => b.roi - a.roi)[0];
};

const daysSinceLastSession = (scoreTrend) => {
  const last = scoreTrend.at(-1)?.date;
  if (!last) return null;
  return Math.floor((new Date() - new Date(last)) / 86400000);
};

const useLiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
};

const scoreColor = (s) => s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

// ─── Container width observer ──────────────────────────────────────────────
// Small reusable hook: measures a ref's content-box width and updates on
// resize. Used by the heatmap so its grid can size itself to whatever room
// it actually has, instead of assuming a fixed pixel budget.
const useContainerWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') {
      setWidth(el.getBoundingClientRect().width);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number') setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
};

// ─── Error boundary ────────────────────────────────────────────────────────
class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error('[Dashboard section error]', err); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: '20px 24px', borderRadius: 16, marginBottom: 18, background: C.redTint, border: `1px solid ${C.red}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>This section ran into a problem</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>The rest of the dashboard is fine. <button onClick={() => this.setState({ hasError: false })} style={{ color: C.blue500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>Try again</button></div>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ─── Full-page error state ─────────────────────────────────────────────────
// Shown when the initial analytics fetch fails outright, instead of
// silently falling through to an all-zero dashboard with no way to retry.
const DashboardLoadError = ({ onRetry, retrying }) => (
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

// ─── Animated section ──────────────────────────────────────────────────────
const AnimatedSection = ({ children, delay = 0, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.08 });
    const t = setTimeout(() => observer.observe(el), delay);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [delay]);
  return <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: `opacity 0.5s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.5s cubic-bezier(.16,1,.3,1) ${delay}ms`, ...style }}>{children}</div>;
};

// ═══════════════════════════════════════════════════════════════════════════
// AI COACH DRAWER — replaces the centered modal.
// Slides in from the right edge. No scroll fighting. No z-index war.
// The user can read their plan while seeing the dashboard context behind it.
// ═══════════════════════════════════════════════════════════════════════════
const sectionAccents = {
  'VERDICT':               C.cyan400,
  'CRITICAL GAPS':         '#FF6B6B',
  'STRENGTHS TO LEVERAGE': '#4ADE9C',
  '30-DAY BATTLE PLAN':    C.blue400,
  'MINDSET ALERT':         '#F0B94D',
};
const sectionIcons = {
  'VERDICT':               '◎',
  'CRITICAL GAPS':         '▲',
  'STRENGTHS TO LEVERAGE': '✦',
  '30-DAY BATTLE PLAN':    '▤',
  'MINDSET ALERT':         '◐',
};

const AICoachDrawer = ({ open, onClose, irs, archetype, topTier, weakest, strongest, scoreTrend, totalSessions }) => {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const scores  = (scoreTrend || []).map(s => s.score || 0);
  const slope   = scores.length >= 2 ? trendSlope(scores.slice(-6)) : 0;
  const sd      = scores.length >= 2 ? stdDev(scores) : 0;

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // NOTE: getAICoach() currently takes no arguments — the server derives
  // the analysis from the user's session on its own. This callback only
  // depends on things that affect ITS OWN behaviour (open/loading/analysis
  // guards), not on dashboard props that aren't actually sent anywhere.
  // If/when getAICoach is updated to accept explicit context (irs,
  // archetype, weakest/strongest dimension, etc.), pass it as an argument
  // here and re-add those to the dependency array at that point.
  const generateAnalysis = useCallback(async () => {
    setLoading(true); setAnalysis(''); setDone(false);
    try {
      const coach = await getAICoach();
      if (coach?.analysis) {
        const a = coach.analysis;
        setAnalysis(['VERDICT', a.verdict, '', 'CRITICAL GAPS', a.criticalGaps, '', 'STRENGTHS TO LEVERAGE', a.strengths, '', '30-DAY BATTLE PLAN', a.battlePlan, '', 'MINDSET ALERT', a.mindset].join('\n'));
      } else { setAnalysis('Unable to generate analysis. Try again.'); }
    } catch (err) {
      setAnalysis(err?.isQuota
        ? 'QUOTA EXHAUSTED\n\nGemini free-tier limit (20 req/day) used up. Open server/.env, set GEMINI_MODEL=gemini-2.5-flash, restart. Resets at midnight Pacific.'
        : 'Could not reach AI coach. Check your connection and try again.');
    } finally { setLoading(false); setDone(true); }
  }, []);

  useEffect(() => { if (open && !done && !loading && !analysis) generateAnalysis(); }, [open, done, loading, analysis, generateAnalysis]);

  const parsedSections = done
    ? analysis.split(/\n(?=[A-Z][A-Z ]{3,}\n)/).filter(Boolean).map(s => {
        const lines = s.trim().split('\n');
        const heading = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        return { heading, body, accent: sectionAccents[heading] || C.blue400, icon: sectionIcons[heading] || '•' };
      }).filter(s => s.heading && s.body)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(6,14,32,0.55)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Drawer panel — slides in from right edge */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Readiness Coach"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 'min(540px, 100vw)',
          height: '100vh',
          zIndex: 10000,
          overflowY: 'auto',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(.16,1,.3,1)',
          background: `linear-gradient(160deg, ${X.dark0} 0%, #001535 60%, ${X.dark0} 100%)`,
          borderLeft: '1px solid rgba(0,200,240,0.16)',
          boxShadow: '-32px 0 72px rgba(2,8,24,0.55)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <style>{`
          @keyframes drawerSection { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes livePulse2   { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
        `}</style>

        {/* Header */}
        <div style={{ padding: '24px 26px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, position: 'sticky', top: 0, background: X.dark0, zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: C.cyan400, marginBottom: 7 }}>AI Readiness Coach</div>
              <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Your personalised action plan</h2>
              <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.44)', fontSize: 12, lineHeight: 1.6, maxWidth: 380 }}>Built from your IRS components, score variance, and dimension gaps.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 2 }}>
              {done && <Button surface="dark" variant="ghost" size="sm" onClick={generateAnalysis} disabled={loading}>Re-analyse</Button>}
              <button onClick={onClose} aria-label="Close AI coach" style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>

          {/* Stat bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 18, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { label: 'IRS', val: `${irs}/100`, color: scoreColor(irs) },
              { label: 'Tier', val: topTier?.label || '—', color: C.cyan400 },
              { label: 'Archetype', val: archetype?.label || '—', color: C.blue400 },
              { label: 'Trend', val: slope >= 0 ? `+${slope.toFixed(1)}/s` : `${slope.toFixed(1)}/s`, color: slope >= 0 ? '#4ADE9C' : '#FF8B6B' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'lowercase' }}>{item.label}</div>
                <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: item.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 26px 32px', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[`Scanning IRS = ${irs}/100 across 6 dimensions…`, `Computing variance (StdDev: ${sd.toFixed(1)})…`, `Mapping ${strongest?.label || '—'} vs ${weakest?.label || '—'}…`, 'Drafting 30-day battle plan…'].map((msg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,240,0.1)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan400, flexShrink: 0, animation: `livePulse2 1.4s ease ${i * 0.28}s infinite` }} />
                  <div style={{ color: 'rgba(255,255,255,0.44)', fontSize: 12, fontFamily: F.mono }}>{msg}</div>
                </div>
              ))}
            </div>
          )}

          {done && parsedSections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {parsedSections.map((s, i) => (
                <div key={i} style={{ padding: '15px 17px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `2px solid ${s.accent}`, animation: `drawerSection 0.36s ease ${i * 0.07}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: s.accent }}>{s.icon}</span>
                    <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, letterSpacing: '1px', color: s.accent, textTransform: 'lowercase' }}>{s.heading}</div>
                  </div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.body}</p>
                </div>
              ))}
              <div style={{ marginTop: 6, padding: '13px 16px', borderRadius: 11, background: 'rgba(26,110,255,0.1)', border: '1px solid rgba(26,110,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>Skill velocity, confidence gaps, and blind spots are on your Analytics page.</div>
                <a href="/analytics" onClick={onClose} style={{ borderRadius: 8, background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`, color: '#fff', padding: '8px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>Full analytics →</a>
              </div>
            </div>
          )}

          {done && parsedSections.length === 0 && analysis && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{analysis}</p>
          )}
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MOMENTUM BOARD — replaces Growth Velocity + Predictor + Focus This Week
//   + Fix This Next + Next Tier Banner + AI Coach Teaser.
//
// Three action cards. Zero extra API calls. Everything derived from already-
// computed props. Each card has exactly one CTA that starts a session.
//
// Card 1 — highest-ROI drill target (from fixTarget / weakestDim)
// Card 2 — next tier unlock status (from irsGap / nextTier / streakDays)
// Card 3 — streak health / predicted score (from scoreTrend / streakDays)
// ═══════════════════════════════════════════════════════════════════════════
const MomentumBoard = ({ irs, fixTarget, weakestDim, irsGap, currentTierMinIRS, nextTier, scoreTrend, streakDays, archetype, onDrill, onNavigateAnalytics, starting }) => {
  const daysSinceLast = daysSinceLastSession(scoreTrend);
  // memoize scores so downstream useMemo deps are stable
  const scores = useMemo(() => scoreTrend.map(s => s.score || 0), [scoreTrend]);
  const slope  = trendSlope(scores.slice(-6));
  const predicted = useMemo(() => {
    if (scores.length < 2) return null;
    const recent = scores.slice(-8);
    return clamp(ewma(recent) + trendSlope(recent) * 0.6);
  }, [scores]);

  const drillTopic = fixTarget?.topic || weakestDim?.label;
  const drillScore = fixTarget?.averageScore ?? weakestDim?.score ?? 0;
  const drillGap   = 100 - drillScore;
  const drillRoi   = fixTarget?.roi ?? null;

  // Same gap-from-previous-tier-floor math as the hero's Tier Progress
  // Ladder, so this bar and that one always show the same picture.
  const tierProgressPct = nextTier ? tierRungProgress(irs, currentTierMinIRS, nextTier.minScore) : 100;

  // Card 3 label: streak vs predicted vs slipping
  const streakAtRisk   = streakDays >= 3 && daysSinceLast >= 2;
  const streakHealthy  = streakDays >= 3 && (daysSinceLast === null || daysSinceLast < 2);
  const isTrending     = slope > 1.5;

  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={S.eyebrow}>momentum board</div>
        <h2 style={{ ...S.cardH2, marginBottom: 4 }}>Three things to act on right now</h2>
        <p style={S.cardSub}>Each card is a decision, not a stat. One click starts the session.</p>
      </div>

      <div style={S.momentumGrid} className="mm-momentum-grid">

        {/* ── Card 1: highest-ROI fix ── */}
        <div style={{ ...S.momentumCard, borderColor: drillTopic ? `${C.orange}44` : C.border, background: drillTopic ? `${C.orange}08` : C.card }}>
          <div style={{ ...S.momentumBadge, color: C.orange, background: `${C.orange}18` }}>
            <span>↯</span> highest ROI fix
          </div>
          <div>
            <div style={S.momentumTopic}>{drillTopic || 'No weak topic yet'}</div>
            <div style={S.momentumMeta}>
              Score {drillScore} · {drillGap} pts to max
              {drillRoi != null ? ` · ROI ${Math.round(drillRoi * 10) / 10}` : ''}
            </div>
          </div>
          <div style={S.momentumBar}>
            <div style={{ ...S.momentumBarFill, width: `${drillScore}%`, background: scoreColor(drillScore) }} />
          </div>
          <div style={S.momentumHint}>
            Closing this gap moves your IRS more than any other single change right now.
          </div>
          {drillTopic && (
            <Button variant="gradient" size="sm" onClick={() => onDrill(drillTopic)} disabled={starting}>
              Drill {drillTopic} →
            </Button>
          )}
        </div>

        {/* ── Card 2: next tier unlock ── */}
        <div style={{ ...S.momentumCard, borderColor: nextTier && irsGap <= 15 ? `${C.blue500}44` : C.border, background: nextTier && irsGap <= 15 ? `${C.blue500}08` : C.card }}>
          {nextTier ? (
            <>
              <div style={{ ...S.momentumBadge, color: irsGap <= 15 ? C.blue500 : C.muted, background: irsGap <= 15 ? `${C.blue500}18` : C.cardAlt }}>
                <span>↑</span> {irsGap <= 15 ? 'within striking distance' : 'next milestone'}
              </div>
              <div>
                <div style={S.momentumTopic}>{nextTier.label}</div>
                <div style={S.momentumMeta}>
                  {irsGap} IRS points away · Current {scoreTrend.length > 0 ? (scoreTrend.at(-1)?.score ?? '—') : '—'}
                </div>
              </div>
              <div style={S.momentumBar}>
                <div style={{ ...S.momentumBarFill, width: `${tierProgressPct}%`, background: C.blue500 }} />
              </div>
              <div style={S.momentumHint}>
                {irsGap <= 8
                  ? 'One strong session could push you over. Focus on your weakest dimension first.'
                  : `Fix ${weakestDim?.label ?? 'your weakest dimension'} — it's the biggest IRS lever you have.`}
              </div>
              <Button surface="light" variant="secondary" size="sm" onClick={onNavigateAnalytics}>
                See what's blocking →
              </Button>
            </>
          ) : (
            <>
              <div style={{ ...S.momentumBadge, color: C.green, background: `${C.green}18` }}><span>✓</span> top tier reached</div>
              <div style={S.momentumTopic}>₹20 LPA+ eligible</div>
              <div style={S.momentumHint}>You've crossed every IRS threshold. Now it's about consistency and breadth.</div>
              <Button surface="light" variant="secondary" size="sm" onClick={onNavigateAnalytics}>Review your profile →</Button>
            </>
          )}
        </div>

        {/* ── Card 3: streak health / predicted score ── */}
        <div style={{ ...S.momentumCard, borderColor: streakAtRisk ? `${C.amber}55` : streakHealthy ? `${C.green}44` : C.border, background: streakAtRisk ? `${C.amber}08` : streakHealthy ? `${C.green}08` : C.card }}>
          {streakAtRisk ? (
            <>
              <div style={{ ...S.momentumBadge, color: C.amber, background: `${C.amber}18` }}><span>⚠</span> streak at risk</div>
              <div>
                <div style={S.momentumTopic}>{streakDays}-day streak</div>
                <div style={S.momentumMeta}>Last session {daysSinceLast}d ago · Resets if you miss today</div>
              </div>
              <div style={S.momentumBar}>
                <div style={{ ...S.momentumBarFill, width: `${Math.min(100, (streakDays / 14) * 100)}%`, background: C.amber }} />
              </div>
              <div style={S.momentumHint}>5-minute quick-fire keeps it alive. Don't lose what you built.</div>
              <Button variant="gradient" size="sm" onClick={() => onDrill('')} disabled={starting}>Keep streak alive →</Button>
            </>
          ) : isTrending && predicted != null ? (
            <>
              <div style={{ ...S.momentumBadge, color: C.green, background: `${C.green}18` }}><span>↗</span> on a roll</div>
              <div>
                <div style={S.momentumTopic}>Predicted {predicted}</div>
                <div style={S.momentumMeta}>+{slope.toFixed(1)} pts/session · EWMA trend</div>
              </div>
              <div style={S.momentumBar}>
                <div style={{ ...S.momentumBarFill, width: `${predicted}%`, background: C.green }} />
              </div>
              <div style={S.momentumHint}>
                You're trending up. {archetype?.fix}
              </div>
              <Button variant="gradient" size="sm" onClick={() => onDrill('')} disabled={starting}>Beat the forecast →</Button>
            </>
          ) : (
            <>
              <div style={{ ...S.momentumBadge, color: C.blue500, background: `${C.blue500}18` }}><span>◈</span> your pattern</div>
              <div>
                <div style={S.momentumTopic}>{archetype?.label ?? '—'}</div>
                <div style={S.momentumMeta}>{streakDays > 0 ? `${streakDays}-day streak` : 'No active streak'}</div>
              </div>
              <div style={S.momentumBar}>
                <div style={{ ...S.momentumBarFill, width: `${Math.min(100, (streakDays / 14) * 100)}%`, background: C.blue500 }} />
              </div>
              <div style={S.momentumHint}>{archetype?.fix ?? 'Start a session to build your performance pattern.'}</div>
              <Button surface="light" variant="secondary" size="sm" onClick={() => onDrill('')} disabled={starting}>Start a session →</Button>
            </>
          )}
        </div>

      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════
const WeeklyChallenges = ({ scoreTrend, topicPerformance, streakDays }) => {
  const now = new Date(), weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const thisWeek = scoreTrend.filter(s => s.date && new Date(s.date) >= weekAgo);
  const strongSessions = thisWeek.filter(s => (s.score || 0) >= 75).length;
  const topicsTouched = new Set(topicPerformance.filter(t => (t.attempts ?? 0) > 0).map(t => t.topic)).size;

  const challenges = [
    { icon: '◎', title: 'Score 75+ in 3 sessions', current: Math.min(strongSessions, 3), target: 3, helper: 'Build a reliable performance floor.' },
    { icon: '◇', title: 'Cover 5 topics', current: Math.min(topicsTouched, 5), target: 5, helper: 'Keep your preparation broad.' },
    { icon: '◆', title: 'Hold a 7-day streak', current: Math.min(streakDays, 7), target: 7, helper: 'Consistency compounds.' },
  ];
  const completed = challenges.filter(c => c.current >= c.target).length;

  return (
    <section style={S.card}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrow}>weekly challenges</div>
          <h2 style={S.cardH2}>This week's targets</h2>
          <p style={S.cardSub}>Small targets that build consistency, breadth, and confidence.</p>
        </div>
        <div style={S.challengeSummary}>
          <div>{completed}/{challenges.length}</div>
          <span style={S.challengeSummarySpan}>done</span>
        </div>
      </div>
      <div style={S.challengeList}>
        {challenges.map(ch => {
          const progress = Math.min(100, Math.round((ch.current / ch.target) * 100));
          const done = ch.current >= ch.target;
          return (
            <div key={ch.title} style={S.challengeRow} className="mm-challenge-row">
              <div style={S.challengeIcon}>{ch.icon}</div>
              <div style={S.challengeBody}>
                <div style={S.challengeTop}>
                  <div>
                    <div style={S.challengeTitle}>{ch.title}</div>
                    <div style={S.challengeHelper}>{ch.helper}</div>
                  </div>
                  <div style={{ ...S.challengeCount, color: done ? C.green : C.blue600 }}>{ch.current}/{ch.target}</div>
                </div>
                <div style={S.challengeTrack}>
                  <div style={{ ...S.challengeFill, width: `${progress}%`, background: done ? C.green : `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})` }} />
                </div>
              </div>
              <div style={{ ...S.challengeStatus, color: done ? C.green : C.muted }}>{done ? '✓' : `${progress}%`}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TROPHY PODIUM SHELF
// Unlocked badges = colourful trophies, column height encodes tier rarity.
// Locked badges = ghost columns at the end with progress bars.
// Click any trophy to expand its detail panel below the shelf.
//
// Single source of truth for tier styling: height (rarity) is fixed per
// tier, hue is derived per-badge within a tier-specific hue band so badges
// within the same tier still look distinct from each other.
// ═══════════════════════════════════════════════════════════════════════════
const TROPHY_TIER = {
  bronze:   { h: 52,  hueBase: 18,  hueSpread: 64,  sat: 88, lightTop: 73, lightBot: 48, label: '#9A3412' },
  silver:   { h: 72,  hueBase: 188, hueSpread: 110, sat: 72, lightTop: 80, lightBot: 52, label: '#0E7490' },
  gold:     { h: 96,  hueBase: 44,  hueSpread: 72,  sat: 94, lightTop: 76, lightBot: 46, label: '#A16207' },
  platinum: { h: 120, hueBase: 270, hueSpread: 100, sat: 86, lightTop: 80, lightBot: 50, label: '#6D28D9' },
};

// Deterministic hash → hue offset per badge id.
const hueFromId = (id = '') => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
};

const badgeColors = (badge = {}) => {
  const T = TROPHY_TIER[badge.tier] || TROPHY_TIER.bronze;
  const seed = hueFromId(badge.id || badge.label || 'badge');
  const hueOffset = (seed % T.hueSpread) - T.hueSpread / 2;
  const hue = (T.hueBase + hueOffset + 360) % 360;
  const hue2 = (hue + 24 + (seed % 13)) % 360;

  return {
    grad: `linear-gradient(180deg, hsl(${hue} ${T.sat}% ${T.lightTop}%) 0%, hsl(${hue2} ${Math.min(100, T.sat + 2)}% ${T.lightBot}%) 100%)`,
    capGrad: `linear-gradient(135deg, hsl(${hue} ${T.sat}% ${T.lightTop + 9}%), hsl(${hue2} ${T.sat}% ${T.lightTop - 1}%))`,
    iconBg: `linear-gradient(135deg, hsl(${hue} ${Math.min(T.sat, 60)}% 97%), hsl(${hue2} ${Math.min(T.sat, 52)}% 90%))`,
    iconCol: `hsl(${hue} ${Math.min(100, T.sat + 4)}% 30%)`,
    label: `hsl(${hue} ${Math.min(100, T.sat + 2)}% 34%)`,
    h: T.h,
    glow: `hsl(${hue2} ${T.sat}% 58%)`,
    accent: `hsl(${hue2} ${Math.min(100, T.sat + 4)}% 50%)`,
  };
};

const UnlockedTrophyButton = ({ b, isSel, onClick }) => {
  const bc = badgeColors(b);

  return (
    <button
      onClick={onClick}
      title={b.desc}
      aria-label={`${b.label}, ${b.tier} tier, earned. ${b.desc}`}
      aria-pressed={isSel}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        width: 64,
        flexShrink: 0,
        filter: isSel ? `drop-shadow(0 0 10px ${bc.glow}88)` : 'none',
        transition: 'filter 0.2s ease, transform 0.2s ease',
        transform: isSel ? 'translateY(-4px)' : 'translateY(0)',
      }}
      className="mm-trophy-btn"
    >
      <div style={{ width: 44, height: 12, borderRadius: '6px 6px 0 0', background: bc.capGrad, boxShadow: `0 4px 12px ${bc.glow}24` }} />
      <div style={{
        width: 44,
        height: 44,
        background: bc.iconBg,
        border: `2px solid ${bc.iconCol}30`,
        boxShadow: `0 7px 16px ${bc.glow}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 19,
        color: bc.iconCol,
      }}>
        {b.icon}
      </div>
      <div style={{ width: 18, height: bc.h, background: bc.grad, borderRadius: '0 0 2px 2px' }} />
      <div style={{ width: 52, height: 7, background: bc.grad, borderRadius: '0 0 4px 4px', opacity: 0.75 }} />
      <div style={{
        marginTop: 7,
        fontSize: 9.5,
        fontWeight: 700,
        color: bc.label,
        textAlign: 'center',
        lineHeight: 1.25,
        maxWidth: 60,
        wordBreak: 'break-word',
      }}>
        {b.label}
      </div>
      <div style={{ fontSize: 8, fontFamily: F.mono, color: C.muted, marginTop: 2 }}>{b.tier}</div>
    </button>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// 12-MONTH CONTRIBUTION HEATMAP
// GitHub / LeetCode-style daily activity grid with a compact activity pulse.

const ActivityHeatmapV2 = ({ scoreTrend, streakDaysFromApi, S, C, F }) => {
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [scrollRef, measuredWidth] = useContainerWidth();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const weeksBack = 53;
  const dayLabelW = isMobile ? DAY_LABEL_W_MOBILE : DAY_LABEL_W;
  const monthLabelH = isMobile ? 15 : MONTH_LABEL_H;
  const gapFloor = isMobile ? CELL_GAP_MOBILE : CELL_GAP;
  const cellFloor = isMobile ? CELL_SIZE_MIN_MOBILE : CELL_SIZE_MIN_DESKTOP;

  // Derive cell size + gap from the measured container width so all 53
  // columns fit without scrolling. Falls back to the max fixed size until
  // the container has been measured (first paint), then re-solves whenever
  // the container resizes.
  const { cellSize, cellGap, needsScrollFallback } = useMemo(() => {
    if (!measuredWidth) return { cellSize: CELL_SIZE_MAX, cellGap: gapFloor, needsScrollFallback: false };
    const available = Math.max(0, measuredWidth - dayLabelW - 4);
    // Solve for cell size assuming the floor gap first.
    const rawCell = available / weeksBack - gapFloor;
    const clampedCell = Math.max(cellFloor, Math.min(CELL_SIZE_MAX, rawCell));
    // Gap can shrink a touch further on very tight widths before we give up
    // and allow horizontal scroll, so narrow phones still get a full grid
    // more often than not.
    const tightGap = clampedCell === cellFloor && rawCell < cellFloor
      ? Math.max(1, gapFloor - 1)
      : gapFloor;
    return {
      cellSize: clampedCell,
      cellGap: tightGap,
      needsScrollFallback: rawCell < cellFloor - 1,
    };
  }, [measuredWidth, dayLabelW, gapFloor, cellFloor]);

  const { weeks, firstActiveDate } = useMemo(
    () => buildContributionGrid(scoreTrend, weeksBack),
    [scoreTrend]
  );
  const stats = useMemo(() => contributionStats(weeks), [weeks]);
  const longestStreak = Math.max(stats.longestStreak, streakDaysFromApi ?? 0);

  const activityInsight = useMemo(() => {
    const cells = weeks.flat().filter(c => !c.isFuture);
    const active = cells.filter(c => c.hasData);
    const strongDays = active.filter(c => c.score >= 75).length;
    const recentWindow = cells.filter(c => {
      const d = new Date(c.date);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - 55);
      return d >= from;
    });
    const priorWindow = cells.filter(c => {
      const d = new Date(c.date);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - 111);
      const to = new Date(from);
      to.setDate(to.getDate() + 56);
      return d >= from && d < to;
    });
    const avg = arr => arr.length ? Math.round(arr.reduce((sum, c) => sum + c.score, 0) / arr.length) : 0;
    const recentAvg = avg(recentWindow.filter(c => c.hasData));
    const priorAvg = avg(priorWindow.filter(c => c.hasData));
    const delta = priorWindow.some(c => c.hasData) && recentWindow.some(c => c.hasData) ? recentAvg - priorAvg : null;
    const bestDay = [...active].sort((a, b) => b.score - a.score)[0] ?? null;
    const busiestDay = [...active].sort((a, b) => b.sessions - a.sessions || b.score - a.score)[0] ?? null;
    const annualWindow = cells.filter(c => !c.isFuture).length || 365;
    const activityRate = Math.round((stats.activeDays / annualWindow) * 100);
    return { strongDays, recentAvg, delta, bestDay, busiestDay, activityRate };
  }, [weeks, stats.activeDays]);

  const monthLabels = useMemo(() => {
    const labels = [];
    let lastKey = null;
    weeks.forEach((col, wi) => {
      const firstOfMonth = col.find(d => d.dateObj.getDate() <= 7);
      if (!firstOfMonth) return;
      const key = `${firstOfMonth.dateObj.getFullYear()}-${firstOfMonth.dateObj.getMonth()}`;
      if (key !== lastKey) {
        labels.push({ wi, label: MONTH_NAMES[firstOfMonth.dateObj.getMonth()] });
        lastKey = key;
      }
    });
    return labels;
  }, [weeks]);

  // Fixed: was checking `d.future` (always undefined, so this never
  // excluded anything) instead of `d.isFuture`. Future cells are now
  // correctly left out of the weekly pulse average.
  const weeklyPulse = useMemo(() => {
    return weeks.slice(-12).map((week, index) => {
      const active = week.filter(d => d.hasData && !d.isFuture);
      const score = active.length ? Math.round(active.reduce((sum, d) => sum + d.score, 0) / active.length) : 0;
      return {
        index,
        score,
        sessions: active.reduce((sum, d) => sum + d.sessions, 0),
        startDate: week[0]?.dateObj,
      };
    });
  }, [weeks]);

  const gridWidth = weeks.length * (cellSize + cellGap);

  const handleEnter = (cell, e) => {
    if (cell.isFuture || isMobile) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.closest('.mm-hm-scroll')?.getBoundingClientRect();
    setHovered({
      cell,
      x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
      y: rect.top - (parentRect?.top ?? 0),
    });
  };

  const visibleStatsLabel = firstActiveDate == null
    ? 'No sessions yet'
    : `${stats.activeDays} active day${stats.activeDays === 1 ? '' : 's'} · ${stats.avgScore}/100 avg`;

  const bestDayLabel = activityInsight.bestDay
    ? activityInsight.bestDay.dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '—';

  // Snapshot metric cards — defined as data so the row below can be mapped
  // and staggered rather than hand-written per-card. Each carries its own
  // accent so the row reads as a spectrum rather than four identical tiles.
  const snapshotMetrics = [
    { icon: '🗓️', value: stats.activeDays, label: 'active days', accent: C.blue500 },
    { icon: '🎯', value: activityInsight.strongDays, label: 'days at 75+', accent: C.green },
    { icon: '🔥', value: `${longestStreak}d`, label: 'longest streak', accent: C.amber },
    { icon: '📈', value: stats.avgScore || '—', label: 'average score', accent: C.cyan500 },
  ];

  return (
    <section style={{ ...S.hmPanel, padding: isMobile ? '16px 12px' : '20px 22px' }} className="mm-hm-panel">
      <div style={S.hmHeaderRow}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={S.eyebrow}>practice activity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={S.cardH2}>12-month contribution map</h2>
            <span style={S.hmHeaderDataPill}>{visibleStatsLabel}</span>
          </div>
          <p style={S.cardSub}>
            {firstActiveDate == null
              ? 'Run your first mock interview to start building your preparation history.'
              : 'Each square is one day. Darker blue means a stronger average score that day.'}
          </p>
        </div>
        <div style={S.hmRangeChip}>
          <span style={{ fontSize: 14 }}>◫</span>
          <div>
            <div style={S.hmRangeValue}>53 weeks</div>
            <div style={S.hmRangeLabel}>rolling year</div>
          </div>
        </div>
      </div>

      {/* ── Grid block — now full card width, no sidebar competing for space ── */}
      <div style={S.hmGridCard}>
        <div
          ref={scrollRef}
          className="mm-hm-scroll"
          style={{
            position: 'relative',
            overflowX: needsScrollFallback ? 'auto' : 'hidden',
            overflowY: 'visible',
            padding: '2px 2px 8px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ position: 'relative', width: needsScrollFallback ? gridWidth + dayLabelW : '100%', minWidth: needsScrollFallback ? gridWidth + dayLabelW : 0 }}>
            <div style={{ position: 'relative', height: monthLabelH, marginLeft: dayLabelW }}>
              {monthLabels.map((m, i) => (
                <span key={i} style={{
                  position: 'absolute', left: m.wi * (cellSize + cellGap), top: 0,
                  fontFamily: F.mono, fontSize: isMobile ? 8.5 : 9.5, color: C.muted, fontWeight: 800,
                }}>
                  {m.label}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: cellGap,
                width: dayLabelW, flexShrink: 0,
              }}>
                {DAY_LABELS.map((d, i) => (
                  <div key={i} style={{
                    height: cellSize, fontFamily: F.mono, fontSize: isMobile ? 7.5 : 8.5, color: C.faint,
                    display: 'flex', alignItems: 'center', paddingRight: 5,
                  }}>
                    {d}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: cellGap, justifyContent: needsScrollFallback ? 'flex-start' : 'space-between', flex: needsScrollFallback ? 'initial' : 1 }}>
                {weeks.map((col, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: cellGap }}>
                    {col.map(cell => {
                      const isActivePinned = pinned && pinned.date === cell.date;
                      const background = cellColor(cell, C);
                      const cellLabel = cell.isFuture
                        ? ''
                        : `${cell.dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${cell.hasData ? `, score ${cell.score}${cell.sessions > 1 ? `, ${cell.sessions} sessions` : ''}` : ', no session'}`;
                      return (
                        <div
                          key={cell.date}
                          role={cell.hasData ? 'button' : undefined}
                          tabIndex={cell.hasData ? 0 : -1}
                          aria-label={cellLabel || undefined}
                          onMouseEnter={(e) => handleEnter(cell, e)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => cell.hasData && setPinned(isActivePinned ? null : cell)}
                          onKeyDown={(e) => {
                            if (!cell.hasData) return;
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned(isActivePinned ? null : cell); }
                          }}
                          title={cellLabel}
                          style={{
                            width: cellSize, height: cellSize, borderRadius: isMobile ? 2 : 3,
                            background: cell.isFuture ? 'transparent' : background,
                            cursor: cell.hasData ? 'pointer' : 'default',
                            border: cell.isToday
                              ? `1.5px solid ${C.text}`
                              : isActivePinned
                                ? `1.5px solid ${C.blue700 || C.blue600}`
                                : `1px solid ${cell.hasData ? 'rgba(23,75,150,0.08)' : 'rgba(0,0,0,0.035)'}`,
                            boxShadow: isActivePinned ? `0 0 0 2px ${C.blue500}33` : 'none',
                            outlineOffset: 2,
                            transition: 'transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease',
                            transform: hovered?.cell?.date === cell.date ? 'scale(1.28)' : 'scale(1)',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {hovered && !pinned && (
              <div style={{
                position: 'absolute', left: hovered.x, top: Math.max(22, hovered.y - 8),
                transform: 'translate(-50%, -100%)', background: C.text, color: '#fff',
                padding: '7px 10px', borderRadius: 8, fontSize: 10.5, fontFamily: F.body,
                whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              }}>
                <div style={{ fontWeight: 800 }}>
                  {hovered.cell.hasData ? `Score ${hovered.cell.score}` : 'No session'}
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 9, opacity: 0.72, marginTop: 2 }}>
                  {hovered.cell.dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {hovered.cell.sessions > 1 ? ` · ${hovered.cell.sessions} sessions` : ''}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compact recent pulse prevents dead space and makes activity visible even when sessions are sparse. */}
        <div style={S.hmPulseBlock}>
          <div style={S.hmPulseHeader}>
            <span style={S.hmInsightEyebrow}>recent activity pulse</span>
            <span style={S.hmPulseCaption}>last 12 weeks</span>
          </div>
          <div style={S.hmPulseChart}>
            {weeklyPulse.map((week, i) => (
              <div key={i} style={S.hmPulseColumn} title={`${week.startDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${week.score || 0} avg · ${week.sessions} session${week.sessions !== 1 ? 's' : ''}`}>
                <div style={{ ...S.hmPulseBar, height: `${Math.max(4, Math.round((week.score / 100) * 38))}px`, background: week.score ? cellColor({ score: week.score, hasData: true, isFuture: false }, C) : C.border }} />
              </div>
            ))}
          </div>
          <div style={S.hmPulseAxis}>
            <span>12 weeks ago</span>
            <span>today</span>
          </div>
        </div>

        <div style={S.hmGridFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>Less</span>
            {[
              C.cardAlt,
              C.blue100 ?? '#DBEAFE',
              C.blue300 ?? '#93C5FD',
              C.blue500 ?? '#3B82F6',
              C.blue700 ?? '#1D4ED8',
            ].map((col, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: col, border: '1px solid rgba(0,0,0,0.05)' }} />
            ))}
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>More</span>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>outline = today</span>
        </div>
      </div>

      {pinned && (
        <div style={{
          marginTop: 12, padding: isMobile ? '11px 12px' : '12px 16px', borderRadius: 12,
          background: `${cellColor(pinned, C)}22`, border: `1px solid ${cellColor(pinned, C)}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          animation: 'fadeUp 0.18s ease',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginBottom: 3 }}>
              {pinned.dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: F.display, fontSize: 23, fontWeight: 900, color: C.text }}>{pinned.score}</span>
              <span style={{ fontSize: 11.5, color: C.sub }}>avg score · {pinned.sessions} session{pinned.sessions !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={() => setPinned(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 11.5, padding: 4 }}>Dismiss ✕</button>
        </div>
      )}

      {/* ── Divider — quiet seam between the raw grid and its narrative ── */}
      <div aria-hidden="true" style={S.hmSeam} className="mm-hm-seam">
        <span style={S.hmSeamLabel}>12-month snapshot</span>
      </div>

      {/* ── Snapshot band — full-width now, reads left→right as one story:
          headline rhythm → four metric tiles → momentum callout → best/busiest
          → activity rate. Each block fades/lifts in on scroll via
          AnimatedSection-style CSS rather than JS observers, since this
          section is already inside the page's own IntersectionObserver
          wrapper — these are just staggered transition-delays on mount. ── */}
      <div style={S.hmSnapshotBand} className="mm-hm-snapshot">
        <div style={S.hmSnapshotIntro}>
          <div style={S.hmInsightTitle}>Your preparation rhythm</div>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.6, maxWidth: 480 }}>
            A read on how consistently you're showing up, not just how well you're scoring.
          </p>
        </div>

        <div style={S.hmMetricsRow} className="mm-hm-metrics-row">
          {snapshotMetrics.map((m, i) => (
            <div key={m.label} style={{ ...S.hmMetricTile, animationDelay: `${i * 60}ms` }} className="mm-hm-metric-tile">
              <div style={{ ...S.hmMetricTileBar, background: m.accent }} />
              <div style={S.hmMetricTileIcon}>{m.icon}</div>
              <div style={{ ...S.hmMetricTileValue, color: C.text }}>{m.value}</div>
              <div style={S.hmMetricTileLabel}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={S.hmNarrativeRow} className="mm-hm-narrative-row">
          {/* Momentum callout */}
          <div style={S.hmMomentumCard} className="mm-hm-fade-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={S.hmInsightEyebrow}>recent momentum</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>8 weeks</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
              <div>
                <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: C.text }}>{activityInsight.recentAvg || '—'}</div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 2 }}>recent avg</div>
              </div>
              {activityInsight.delta != null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 8px', borderRadius: 8,
                  background: activityInsight.delta >= 0 ? `${C.green}14` : `${C.orange}14`,
                  color: activityInsight.delta >= 0 ? C.green : C.orange,
                  fontFamily: F.mono, fontSize: 10, fontWeight: 800,
                }}>
                  {activityInsight.delta >= 0 ? '↗' : '↘'} {activityInsight.delta >= 0 ? '+' : ''}{activityInsight.delta} pts
                </div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: C.sub, lineHeight: 1.55 }}>
              {activityInsight.delta == null
                ? 'Keep logging sessions to unlock a trend comparison.'
                : activityInsight.delta > 0
                  ? 'Recent performance is improving against the previous 8-week window.'
                  : activityInsight.delta < 0
                    ? 'Your recent average has dipped. A few focused sessions can turn this around.'
                    : 'Your recent average is holding steady. Keep the rhythm and sharpen your weakest dimension.'}
            </div>
          </div>

          {/* Best / busiest day pair */}
          <div style={S.hmBestPair} className="mm-hm-fade-card">
            <div style={S.hmBestRow}>
              <div>
                <div style={S.hmInsightEyebrow}>best day</div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: C.text }}>{bestDayLabel}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.blue600 }}>{activityInsight.bestDay?.score ?? '—'}</div>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>score</div>
              </div>
            </div>
            <div style={{ ...S.hmBestRow, marginTop: 8 }}>
              <div>
                <div style={S.hmInsightEyebrow}>busiest day</div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: C.text }}>
                  {activityInsight.busiestDay
                    ? activityInsight.busiestDay.dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.cyan500 }}>{activityInsight.busiestDay?.sessions ?? 0}</div>
                <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>sessions</div>
              </div>
            </div>
          </div>

          {/* Annual activity rate */}
          <div style={S.hmRateCard} className="mm-hm-fade-card">
            <div style={S.hmInsightEyebrow}>annual activity rate</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
              <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: C.text }}>{activityInsight.activityRate}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>%</span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: C.border, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', width: `${activityInsight.activityRate}%`, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})`, borderRadius: 999, transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>Share of days in the last year with a logged session.</div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Share card ────────────────────────────────────────────────────────────
const ShareCard = ({ name, irs, tier, strongest, percentile, archetype, sessions }) => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState(false);

  const handleShare = async () => {
    const text = `${name}'s MockMate readiness: IRS ${irs}/100 — ${tier.label} eligible. Strongest in ${strongest?.label ?? '—'}${percentile ? `, top ${100 - percentile + 1}%` : ''}. Style: ${archetype.label}. ${sessions} sessions logged.`;
    try {
      if (navigator.share) { await navigator.share({ title: 'My MockMate Readiness Score', text }); }
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    } catch { /* user cancelled */ }
  };

  const handleCopyProfileLink = async () => {
    setLinkLoading(true); setLinkError(false);
    try {
      const { slug } = await getShareLink();
      const url = `${window.location.origin}/p/${slug}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2200);
    } catch { setLinkError(true); setTimeout(() => setLinkError(false), 2200); }
    finally { setLinkLoading(false); }
  };

  return (
    <div style={S.shareCard}>
      <div style={S.shareGlow} />
      <div style={S.heroKicker}>Shareable score card</div>
      <div style={S.shareRow} className="mm-share-row">
        <div style={S.shareLeft}>
          <div style={S.shareIRS}>{irs}</div>
          <div style={S.shareIRSLabel}>irs</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={S.shareTitle}>{name} is {tier.label} eligible</h2>
          <p style={S.shareDesc}>
            Strongest: <strong style={{ color: '#fff', fontWeight: 700 }}>{strongest?.label ?? '—'}</strong>
            {percentile ? <> · Top <strong style={{ color: C.cyan400, fontWeight: 700 }}>{100 - percentile + 1}%</strong></> : null}
            {' '}· {archetype.label}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Button variant="gradient" size="sm" onClick={handleShare}>{copied ? 'Copied' : 'Share your score'}</Button>
            <Button surface="dark" variant="secondary" size="sm" onClick={handleCopyProfileLink} disabled={linkLoading}>
              {linkLoading ? 'Generating…' : linkError ? 'Try again' : linkCopied ? 'Link copied' : 'Copy profile link'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Toast ─────────────────────────────────────────────────────────────────
const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? C.red : C.text, color: '#fff', padding: '11px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, zIndex: 9999, pointerEvents: 'none', fontFamily: F.body, boxShadow: `0 8px 28px ${toast.type === 'error' ? 'rgba(220,38,38,0.3)' : 'rgba(15,26,53,0.3)'}`, animation: 'fadeUp 0.22s ease' }}>
      {toast.msg}
    </div>
  );
};

// ─── Stat rail ─────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// TIER PROGRESS LADDER — replaces the plain IRS number in the hero card.
// Shows all 4 salary tiers as rungs stacked bottom→top.
// Current tier: highlighted with "you" pill and fill bar at 100%.
// Completed tiers below: ticked, fully filled, slightly muted.
// Next tier above: progress bar showing IRS gap, animated on mount.
// Locked tiers beyond next: empty bars, dimmed.
// The IRS number is still shown prominently at the top of the card.
// ═══════════════════════════════════════════════════════════════════════════
const ALL_TIERS = [
  { label: '₹3–6 LPA',   minIRS: 0,  color: '#6B7280', fill: '#E5E7EB', text: '#374151' },
  { label: '₹6–12 LPA',  minIRS: 35, color: '#D97706', fill: '#FEF3C7', text: '#92400E' },
  { label: '₹12–20 LPA', minIRS: 60, color: '#2563EB', fill: '#DBEAFE', text: '#1E3A8A' },
  { label: '₹20 LPA+',   minIRS: 80, color: '#0E9F8E', fill: '#CCFBF1', text: '#065F46' },
];

const TierProgressLadder = ({ irs, hasData, apiTiers, currentTierLabel, nextTier, irsGap, isGated, gatedRaw, sessionsNeeded }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);

  // Merge API tier data (minIRS) with our static colour config
  const tiers = ALL_TIERS.map(t => {
    const api = apiTiers?.find(a => a.label === t.label);
    return { ...t, minIRS: api?.minIRS ?? t.minIRS, isUnlocked: api?.isUnlocked ?? (irs >= t.minIRS) };
  });

  const currentIdx = tiers.findIndex(t => t.label === currentTierLabel);

  // IRS number colour
  const irsCol = irs >= 80 ? '#4ADE80' : irs >= 60 ? '#60A5FA' : irs >= 40 ? '#FCD34D' : '#FB923C';

  return (
    <div style={{ padding: '20px 22px', borderRadius: 16, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)' }}>
      {/* IRS number — kept but smaller to make room for rungs */}
      <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, letterSpacing: '1px', color: 'rgba(255,255,255,0.65)', marginBottom: 8, textTransform: 'lowercase' }}>interview readiness score</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
        <span style={{ fontFamily: F.display, fontSize: hasData ? 52 : 36, fontWeight: 900, color: hasData ? '#fff' : 'rgba(255,255,255,0.4)', letterSpacing: '-2px', lineHeight: 1 }} className="mm-irs-num">
          {hasData ? irs : '—'}
        </span>
        {hasData && <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.55)', fontFamily: F.body }}>/100</span>}
      </div>

      {!hasData ? (
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>Run your first session to unlock the tier ladder.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 7 }}>
          {tiers.map((t, i) => {
            const isCurrent  = t.label === currentTierLabel;
            const isCompleted = i < currentIdx;
            const isNext     = nextTier && t.label === nextTier.label;
            const isLocked   = !isCurrent && !isCompleted && !isNext;

            // Progress bar fill width for this rung — same
            // gap-from-previous-tier-floor formula used everywhere else
            // this progress is shown (see tierRungProgress).
            let fillPct = 0;
            if (isCompleted) fillPct = 100;
            if (isCurrent)   fillPct = 100;
            if (isNext)      fillPct = tierRungProgress(irs, tiers[i - 1]?.minIRS ?? 0, t.minIRS);

            const opacity = isLocked ? 0.35 : 1;

            return (
              <div key={t.label} style={{ opacity, transition: 'opacity 0.3s ease' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px', borderRadius: 9,
                  background: isCurrent ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isCurrent ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  {/* Tier dot */}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: isCompleted || isCurrent ? t.color : 'rgba(255,255,255,0.25)', flexShrink: 0, boxShadow: isCurrent ? `0 0 0 3px ${t.color}44` : 'none' }} />

                  {/* Label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? '#fff' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{t.label}</div>
                    {/* Progress bar */}
                    <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.12)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        background: isCompleted ? t.color : isCurrent ? '#fff' : isNext ? t.color : 'rgba(255,255,255,0.2)',
                        width: `${mounted ? fillPct : 0}%`,
                        transition: 'width 1.1s cubic-bezier(.16,1,.3,1)',
                      }} />
                    </div>
                  </div>

                  {/* Right label */}
                  {isCompleted && <span style={{ fontSize: 11, color: t.color, fontWeight: 800, flexShrink: 0 }}>✓</span>}
                  {isCurrent && <span style={{ fontSize: 9, fontFamily: F.mono, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.22)', color: '#fff', flexShrink: 0 }}>you</span>}
                  {isNext && <span style={{ fontSize: 9, fontFamily: F.mono, color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}>+{irsGap} pts</span>}
                  {isLocked && <span style={{ fontSize: 9, fontFamily: F.mono, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>need {t.minIRS}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isGated && hasData && (
        <div style={{ marginTop: 12, fontSize: 10.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
          Tracking toward {gatedRaw} — {sessionsNeeded} more session{sessionsNeeded === 1 ? '' : 's'} to confirm.
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// HERO IMPROVEMENTS
// Time-aware greeting, recent-score sparkline, animated background texture,
// and clearer CTA hierarchy.
// ═══════════════════════════════════════════════════════════════════════════
const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Still up,';
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  if (h < 21) return 'Good evening,';
  return 'Late night grind,';
};

// Tiny inline sparkline — last 8 sessions, no library needed.
const HeroSparkline = ({ scoreTrend }) => {
  const pts = scoreTrend.slice(-8).map(s => s.score || 0);
  if (pts.length < 2) return null;

  const w = 120, h = 34, max = 100, min = 0;
  const step = w / (pts.length - 1);
  const path = pts.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / (max - min)) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastX = (pts.length - 1) * step;
  const lastY = h - ((pts.at(-1) - min) / (max - min)) * h;

  return (
    <svg width={w} height={h + 6} viewBox={`0 0 ${w} ${h + 6}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#fff" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#fff" opacity="0.4">
        <animate attributeName="r" values="3.5;8;3.5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
};

const HeroSectionImproved = ({
  user,
  hasData,
  currentTier,
  totalInterviews,
  strongestDim,
  weakestDim,
  scoreTrend,
  starting,
  startQuick,
  navigate,
  setCoachOpen,
  irs,
  apiTiers,
  currentTierLabel,
  nextTier,
  irsGap,
  analytics,
  averageScore,
  bestScore,
  streakDays,
  delta,
  archetype,
}) => {
  const recentScores = scoreTrend.slice(-8).map(s => s.score || 0);
  const recentAverage = recentScores.length ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : 0;
  const trend = trendSlope(recentScores);
  const firstName = user?.name?.split(' ')[0] || '';
  const nextGapLabel = nextTier ? `${irsGap} pts to ${nextTier.label}` : 'Top tier unlocked';

  const heroDecor = [
    { emoji: '⚡', top: '8%', left: '4%', size: 24, rotate: -12 },
    { emoji: '🎯', top: '14%', right: '7%', size: 28, rotate: 10 },
    { emoji: '💻', top: '48%', right: '18%', size: 23, rotate: -8 },
    { emoji: '🚀', bottom: '10%', right: '5%', size: 29, rotate: 8 },
    { emoji: '🔥', bottom: '9%', left: '34%', size: 22, rotate: -8 },
    { emoji: '🏆', top: '26%', left: '41%', size: 19, rotate: 12 },
    { emoji: '✦', bottom: '22%', left: '8%', size: 20, rotate: 18 },
  ];

  return (
    <section style={{ ...S.hero, position: 'relative' }} className="mm-hero">
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0.38, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        maskImage: 'linear-gradient(to bottom, black, transparent 88%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 88%)',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', top: -130, right: -90, width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,220,255,0.24), transparent 70%)',
        pointerEvents: 'none', animation: 'heroGlowFloat 9s ease-in-out infinite',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: -150, left: '28%', width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%)',
        pointerEvents: 'none', animation: 'heroGlowFloat 11s ease-in-out infinite reverse',
      }} />

      {heroDecor.map((item, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: item.top,
            right: item.right,
            bottom: item.bottom,
            left: item.left,
            fontSize: item.size,
            lineHeight: 1,
            opacity: 0.13,
            filter: 'saturate(0.9)',
            transform: `rotate(${item.rotate}deg)`,
            pointerEvents: 'none',
            animation: `heroEmojiFloat ${6 + i * 0.45}s ease-in-out ${i * 0.25}s infinite`,
          }}
        >
          {item.emoji}
        </span>
      ))}

      <div style={{ ...S.heroGrid, gridTemplateColumns: '300px 1fr' }} className="mm-hero-grid">
        <TierProgressLadder
          irs={irs}
          hasData={hasData}
          apiTiers={apiTiers}
          currentTierLabel={currentTierLabel}
          nextTier={nextTier}
          irsGap={irsGap}
          isGated={analytics?.currentTierIsGated}
          gatedRaw={analytics?.currentTierRaw}
          sessionsNeeded={analytics?.sessionsNeededForRawTier}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={S.heroTopLine}>
            <div style={S.heroKicker}>{timeGreeting()} your next interview rep</div>
            <div style={S.heroLivePill}><span style={S.heroLiveDot} /> live readiness</div>
          </div>

          <h1 style={S.heroH1}>
            {firstName ? `${firstName}, ` : ''}
            {!hasData ? "let's build your readiness profile." : `you're trending toward ${currentTier.label}.`}
          </h1>

          <p style={{ ...S.heroSub, maxWidth: 650 }}>
            {!hasData
              ? 'Your dashboard becomes a live preparation cockpit after the first mock. Scores, streaks, dimensions and tier movement all update from real interview sessions.'
              : `You have ${totalInterviews} session${totalInterviews !== 1 ? 's' : ''} logged, with ${strongestDim?.label ?? '—'} leading and ${weakestDim?.label ?? '—'} as the biggest improvement lever.`}
          </p>

          <div style={S.heroMetricsGrid} className="mm-hero-metrics">
            <div style={S.heroMetricCard}>
              <div style={S.heroMetricTop}><span>IRS</span><span>◉</span></div>
              <div style={S.heroMetricValue}>{irs}<small>/100</small></div>
              <div style={S.heroMetricFoot}>{nextGapLabel}</div>
            </div>
            <div style={S.heroMetricCard}>
              <div style={S.heroMetricTop}><span>AVERAGE</span><span>◌</span></div>
              <div style={S.heroMetricValue}>{averageScore}<small>/100</small></div>
              <div style={S.heroMetricFoot}>all sessions</div>
            </div>
            <div style={S.heroMetricCard}>
              <div style={S.heroMetricTop}><span>BEST</span><span>★</span></div>
              <div style={S.heroMetricValue}>{bestScore}<small>/100</small></div>
              <div style={S.heroMetricFoot}>personal ceiling</div>
            </div>
            <div style={S.heroMetricCard}>
              <div style={S.heroMetricTop}><span>STREAK</span><span>🔥</span></div>
              <div style={S.heroMetricValue}>{streakDays}<small>d</small></div>
              <div style={S.heroMetricFoot}>{archetype?.label ?? 'building pattern'}</div>
            </div>
          </div>

          <div style={S.heroSignalRow}>
            <div style={S.heroSignalMain}>
              <HeroSparkline scoreTrend={scoreTrend} />
              <div>
                <div style={S.heroSignalLabel}>recent performance</div>
                <div style={S.heroSignalValue}>
                  {recentAverage || '—'} avg
                  <span style={{ color: trend >= 0 ? C.green : C.orange, marginLeft: 7 }}>
                    {recentScores.length >= 2 ? `${trend >= 0 ? '↗' : '↘'} ${Math.abs(trend).toFixed(1)}/session` : '—'}
                  </span>
                </div>
              </div>
            </div>
            <div style={S.heroDeltaChip}>
              <span style={{ fontSize: 14 }}>{delta >= 0 ? '↗' : '↘'}</span>
              <div>
                <div style={S.heroDeltaValue}>{delta >= 0 ? '+' : ''}{delta} pts</div>
                <div style={S.heroDeltaLabel}>last session</div>
              </div>
            </div>
          </div>

          <div style={S.heroActions}>
            <button
              onClick={() => startQuick()}
              disabled={starting}
              style={{
                padding: '12px 22px', borderRadius: 12, border: 'none', cursor: starting ? 'default' : 'pointer',
                background: '#fff', color: C.blue600, fontWeight: 800, fontSize: 13.5, fontFamily: F.body,
                boxShadow: '0 8px 20px rgba(0,0,0,0.18)', opacity: starting ? 0.7 : 1,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
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
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clock = useLiveClock();

  const [dashStats, setDashStats] = useState(null);
  const [analytics, setAnalytics]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [retrying, setRetrying]     = useState(false);
  const [starting, setStarting]     = useState(false);
  const [coachOpen, setCoachOpen]   = useState(false);
  const [toast, setToast]           = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoadError(false);
      const statsPromise = fetch(`${API_BASE}/dashboard/stats`, { credentials: 'include' }).then(r => r.json());
      const analyticsData = await getPerformanceAnalytics();
      statsPromise.then(s => setDashStats(s)).catch(() => {
        // Dashboard stats are supplementary (streak/best-score fallbacks) —
        // analytics is the primary data source, so a stats-only failure
        // shouldn't block the whole page, just leave those fallbacks unset.
      });
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
    setRetrying(true);
    setLoading(true);
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
      const data = await fixBadges();
      const fresh = await getPerformanceAnalytics();
      setAnalytics(fresh);
      const gained = data.newBadges?.length ?? 0;
      setToast({ msg: gained > 0 ? `${gained} badge${gained > 1 ? 's' : ''} unlocked` : 'Badges are up to date', type: 'success' });
    } catch { setToast({ msg: 'Could not recheck badges — try again', type: 'error' }); }
    finally { setFixingBadges(false); setTimeout(() => setToast(null), 3000); }
  }, []);

  // ── Derived fields ───────────────────────────────────────────────────────
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
  const currentTierMeta  = TIER_META[currentTierLabel] ?? TIER_META['₹3–6 LPA'];
  const currentTier      = { label: currentTierLabel, ...currentTierMeta };

  const apiTiers   = analytics?.tiers ?? [];
  const currentTierApi = apiTiers.find(t => t.label === currentTierLabel) ?? null;
  const currentTierMinIRS = currentTierApi?.minIRS ?? (ALL_TIERS.find(t => t.label === currentTierLabel)?.minIRS ?? 0);
  const nextTierApi = apiTiers.find(t => !t.isUnlocked && t.label !== currentTierLabel) ?? null;
  const nextTier   = nextTierApi ? { label: nextTierApi.label, minScore: nextTierApi.minIRS, color: TIER_META[nextTierApi.label]?.color ?? C.blue500, advice: nextTierApi.advice } : null;
  const irsGap     = nextTier ? Math.max(0, nextTier.minScore - irs) : 0;

  const dimensionProfile = useMemo(() => {
    const apiProfile = analytics?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const apiDim = apiProfile.find(d => d.key === meta.key);
      return { ...meta, score: apiDim?.score ?? 0, hasData: apiDim?.hasData ?? false, isProvisional: apiDim?.isProvisional ?? false, answeredCount: apiDim?.answeredCount ?? 0, contributingTopics: apiDim?.contributingTopics ?? [] };
    });
  }, [analytics]);

  const archetype   = useMemo(() => deriveArchetype(scoreTrend, avgTimePerQ, averageScore), [scoreTrend, avgTimePerQ, averageScore]);
  const dimWithData = dimensionProfile.filter(d => d.hasData);
  const strongestDim = [...dimWithData].sort((a, b) => b.score - a.score)[0];
  const weakestDim   = [...dimWithData].sort((a, b) => a.score - b.score)[0];
  const fixTarget    = useMemo(() => bestFixTarget(topicPerformance, dimensionProfile), [topicPerformance, dimensionProfile]);


  const PCT_THRESHOLDS = { pct_50: 50, pct_25: 25, pct_10: 10, pct_5: 5 };
  const percentile = analytics?.percentile ?? null;

  const badges = useMemo(() => {
    const byId = {};
    badgesRaw.forEach(b => { byId[b.id] = b; });
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
  const nextBadge = useMemo(() => { const locked = badges.filter(b => !b.unlocked && typeof b.progress === 'number'); return locked.sort((a, b) => (b.progress || 0) - (a.progress || 0))[0] || null; }, [badges]);
  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);

  if (loading) return <PageLoader />;
  if (loadError) return <DashboardLoadError onRetry={handleRetry} retrying={retrying} />;

  return (
    <div style={S.page} className="mm-page">
      <GlobalStyles />
      <Toast toast={toast} />

      {/* AI Coach — right-side drawer, not a centered modal */}
      <AICoachDrawer
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        irs={irs}
        archetype={archetype}
        topTier={currentTier}
        weakest={weakestDim}
        strongest={strongestDim}
        scoreTrend={scoreTrend}
        totalSessions={totalInterviews}
      />

      <div style={S.container}>

        {/* ── STATUS STRIP ── */}
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

        {/* ── HERO ── */}
        <AnimatedSection delay={60}>
          <SectionErrorBoundary>
            <HeroSectionImproved
              user={user}
              hasData={hasData}
              currentTier={currentTier}
              totalInterviews={totalInterviews}
              strongestDim={strongestDim}
              weakestDim={weakestDim}
              scoreTrend={scoreTrend}
              starting={starting}
              startQuick={startQuick}
              navigate={navigate}
              setCoachOpen={setCoachOpen}
              irs={irs}
              apiTiers={apiTiers}
              currentTierLabel={currentTierLabel}
              nextTier={nextTier}
              irsGap={irsGap}
              analytics={analytics}
              averageScore={averageScore}
              bestScore={bestScore}
              streakDays={streakDays}
              delta={delta}
              archetype={archetype}
            />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* ── FIRST-TIME ONBOARDING — only visible before first session ── */}
        {!hasData && (
          <AnimatedSection delay={80}>
            <SectionErrorBoundary>
              <FirstTimeCard onStart={() => startQuick()} starting={starting} />
            </SectionErrorBoundary>
          </AnimatedSection>
        )}

        {hasData && (<>

          {/* ── STAT RAIL ── */}
          <AnimatedSection delay={0}>
            <SectionErrorBoundary>
              <section style={S.statRail} className="mm-stat-rail">
                <RailStat label="Average score"  value={averageScore} unit="/100" sub="Mean across all sessions"                 color={scoreColor(averageScore)} onClick={() => navigate('/analytics')} />
                <RailStat label="Best session"   value={bestScore}    unit="/100" sub="Your personal ceiling"                   color={C.blue500}                onClick={() => navigate('/history')} />
                <RailStat label="Sessions logged" value={totalInterviews} unit="" sub={streakDays ? `${streakDays}-day streak` : 'No active streak'} color={C.green} onClick={() => navigate('/history')} />
                <RailStat label="Last session"   value={`${delta >= 0 ? '+' : ''}${delta}`} unit=" pts" sub={delta > 0 ? 'Moving up' : delta < 0 ? 'Slipping — drill now' : 'Flat'} color={delta >= 0 ? C.green : C.orange} onClick={() => startQuick()} />
              </section>
            </SectionErrorBoundary>
          </AnimatedSection>

          {/* ── MOMENTUM BOARD ── replaces Growth Velocity + Predictor + Focus + Fix + Tier Banner ── */}
          <AnimatedSection delay={0}>
            <SectionErrorBoundary>
              <MomentumBoard
                irs={irs}
                fixTarget={fixTarget}
                weakestDim={weakestDim}
                irsGap={irsGap}
                currentTierMinIRS={currentTierMinIRS}
                nextTier={nextTier}
                scoreTrend={scoreTrend}
                streakDays={streakDays}
                archetype={archetype}
                onDrill={startQuick}
                onNavigateAnalytics={() => navigate('/analytics')}
                starting={starting}
              />
            </SectionErrorBoundary>
          </AnimatedSection>

          {/* ── IRS BREAKDOWN + WEEKLY CHALLENGES ── */}
          <AnimatedSection delay={0}>
            <SectionErrorBoundary>
              <section style={S.twoCol} className="mm-two-col">

                {/* Six-dimension breakdown */}
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

                {/* Weekly challenges — moved here, now full height alongside dimensions */}
                <WeeklyChallenges
                  scoreTrend={scoreTrend}
                  topicPerformance={topicPerformance}
                  streakDays={streakDays}
                />

              </section>
            </SectionErrorBoundary>
          </AnimatedSection>

          {/* ── ACTIVITY HEATMAP — 12-month contribution grid above trophies ── */}
          <AnimatedSection delay={0}>
            <SectionErrorBoundary>
              <ActivityHeatmapV2
                scoreTrend={scoreTrend}
                streakDaysFromApi={dashStats?.stats?.longestStreak ?? streakDays}
                S={S}
                C={C}
                F={F}
              />
            </SectionErrorBoundary>
          </AnimatedSection>

          {/* ── BADGE SHOWCASE ── */}
          <AnimatedSection delay={0}>
            <SectionErrorBoundary>
              <BadgeShowcase badges={badges} unlockedCount={unlockedCount} nextBadge={nextBadge} onFixBadges={handleFixBadges} />
            </SectionErrorBoundary>
          </AnimatedSection>

          {/* ── SHARE CARD ── */}
          <AnimatedSection delay={0}>
            <SectionErrorBoundary>
              <ShareCard
                name={user?.name?.split(' ')[0] || 'Candidate'}
                irs={irs}
                tier={currentTier}
                strongest={strongestDim}
                archetype={archetype}
                sessions={totalInterviews}
              />
            </SectionErrorBoundary>
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

// ═══════════════════════════════════════════════════════════════════════════
// FIRST-TIME CARD — shown below the hero when the user has zero sessions.
// Not a placeholder. Tells them specifically what each section unlocks so
// they understand the value before they commit to the first session.
// ═══════════════════════════════════════════════════════════════════════════
const FirstTimeCard = ({ onStart, starting }) => {
  const unlocks = [
    { icon: '◎', label: 'IRS score', desc: 'A weighted readiness number mapped to real salary tiers — ₹3L to ₹20L+.' },
    { icon: '▤', label: 'Momentum Board', desc: 'Three action cards that tell you exactly what to drill next and why.' },
    { icon: '⚙', label: 'Dimension breakdown', desc: '6-axis profile showing where you lose IRS points and by how much.' },
    { icon: '◆', label: 'Badges & streaks', desc: 'Earned from real patterns — comebacks, speed, consistency, percentile rank.' },
    { icon: '▣', label: 'Activity heatmap', desc: 'Your practice log as a GitHub-style calendar. Every day counts.' },
    { icon: '↗', label: 'AI Coach plan', desc: 'A 30-day battle plan built from your actual data, not generic advice.' },
  ];

  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={S.eyebrow}>what one session unlocks</div>
        <h2 style={{ ...S.cardH2, marginBottom: 4 }}>Your full dashboard, computed from real performance</h2>
        <p style={S.cardSub}>Everything below is empty right now — because it's all derived from your actual answers, not defaults.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="mm-first-time-grid">
        {unlocks.map(u => (
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
};

// ─── Global styles ──────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    @keyframes spin      { to { transform: rotate(360deg); } }
    @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes fadeUp    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes scaleIn   { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
    @keyframes barFill   { from { width:0; } }
    @keyframes heroGlowFloat { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-14px,16px); } }
    @keyframes heroEmojiFloat { 0%,100% { translate: 0 0; opacity: 0.10; } 50% { translate: 0 -6px; opacity: 0.17; } }
    @keyframes hmTileIn  { from { opacity:0; transform:translateY(8px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes hmFadeIn  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }

    *, *::before, *::after { box-sizing: border-box; }
    ::selection { background: rgba(26,110,255,0.16); }

    .mm-page button:focus-visible, .mm-page a:focus-visible, .mm-page [role="button"]:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 3px; border-radius: 6px; }
    .mm-page ::-webkit-scrollbar { width: 5px; height: 5px; }
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

    /* Momentum board card hover */
    .mm-momentum-grid > div { transition: box-shadow 0.2s ease, transform 0.2s ease !important; }
    .mm-momentum-grid > div:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }

    /* Trophy shelf */
    .mm-trophy-btn { transition: transform 0.2s cubic-bezier(.16,1,.3,1), filter 0.2s ease !important; }
    .mm-trophy-btn:hover { transform: translateY(-5px) !important; }
    .mm-trophy-locked:hover { opacity: 0.55 !important; }
    .mm-trophy-btn:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 3px; border-radius: 6px; }
    .mm-trophy-shelf { background-clip: padding-box; }

    /* Heatmap cells: visible keyboard focus ring even though they're plain divs with role="button" */
    .mm-hm-scroll [role="button"]:focus-visible { outline: 2px solid ${C.blue600}; outline-offset: 2px; }

    /* Seam divider between the grid and the snapshot band — a quiet
       hairline with an inline label, rather than a second bordered card
       stacked directly under the first. */
    .mm-hm-seam::before, .mm-hm-seam::after { content: ''; flex: 1; height: 1px; background: ${C.border}; }
    .mm-hm-seam::before { margin-right: 12px; }

    /* Snapshot band — full-width now, sits below the grid. Tiles and
       narrative cards fade/lift in with a small stagger so the section
       reads as a reveal rather than popping in all at once, and each
       tile lifts slightly on hover to stay consistent with the rest of
       the dashboard's card language (momentum cards, dim rows, etc). */
    .mm-hm-metric-tile { animation: hmTileIn 0.42s cubic-bezier(.16,1,.3,1) both; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease !important; }
    .mm-hm-metric-tile:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26,110,255,0.10); border-color: ${C.borderMd}; }
    .mm-hm-fade-card { animation: hmFadeIn 0.5s cubic-bezier(.16,1,.3,1) both 0.16s; transition: box-shadow 0.18s ease, transform 0.18s ease !important; }
    .mm-hm-fade-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26,110,255,0.08); }

    @media (prefers-reduced-motion: reduce) {
      .mm-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1120px) {
      .mm-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
      .mm-two-col { grid-template-columns: 1fr !important; }
      .mm-badge-grid { grid-template-columns: repeat(4, 1fr) !important; }
      .mm-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-momentum-grid { grid-template-columns: 1fr !important; }
      .mm-hm-narrative-row { grid-template-columns: 1fr 1fr !important; }
      .mm-hm-narrative-row > div:nth-child(3) { grid-column: span 2 !important; }
    }
    @media (max-width: 760px) {
      .mm-hero { padding: 24px 18px !important; }
      .mm-hero-grid { gap: 22px !important; }
      .mm-hm-panel { padding: 16px 12px !important; overflow: hidden !important; }
      .mm-hero-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .mm-share-row { flex-direction: column !important; }
      .mm-badge-grid { grid-template-columns: repeat(3, 1fr) !important; }
      .mm-strip-r { display: none !important; }
      .mm-momentum-grid { grid-template-columns: 1fr !important; }
      .mm-first-time-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-hm-metrics-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .mm-hm-narrative-row { grid-template-columns: 1fr !important; }
      .mm-hm-narrative-row > div:nth-child(3) { grid-column: span 1 !important; }
    }
    @media (max-width: 520px) {
      .mm-page { padding: 12px 10px 54px !important; }
      .mm-trophy-shelf { border-radius: 16px !important; }
      .mm-trophy-shelf .mm-trophy-btn { width: 58px !important; }
      .mm-trophy-shelf .mm-trophy-btn > div:nth-child(2) { width: 40px !important; height: 40px !important; }
      .mm-trophy-shelf .mm-trophy-btn > div:nth-child(3) { width: 16px !important; }
      .mm-trophy-shelf .mm-trophy-btn > div:nth-child(4) { width: 48px !important; }

      .mm-stat-rail { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .mm-hm-panel .mm-hm-scroll { margin-left: -2px; margin-right: -2px; }
      .mm-badge-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-momentum-grid { grid-template-columns: 1fr !important; }
      .mm-first-time-grid { grid-template-columns: 1fr !important; }
      .mm-hero-metrics { gap: 6px !important; }
    }
    @media (max-width: 380px) {
      .mm-stat-rail { grid-template-columns: 1fr !important; }
      .mm-hm-panel { padding-left: 10px !important; padding-right: 10px !important; }
      .mm-hm-panel .mm-hm-scroll { padding-left: 0 !important; padding-right: 0 !important; }
      .mm-hero-metrics { grid-template-columns: 1fr 1fr !important; }
      .mm-hm-metrics-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: { minHeight: 'calc(100vh - 64px)', background: C.bg, backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(26,110,255,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,200,240,0.04) 0%, transparent 40%)`, padding: '24px 28px 80px', fontFamily: F.body },
  container: { maxWidth: 1260, margin: '0 auto' },

  strip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', marginBottom: 20, borderRadius: 11, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripL: { display: 'flex', alignItems: 'center', gap: 9 },
  stripR: { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'livePulse 2.4s ease-in-out infinite' },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.3px', color: C.muted },

  hero: { position: 'relative', overflow: 'hidden', padding: '32px 36px', marginBottom: 20, borderRadius: 22, background: `linear-gradient(135deg, ${C.blue500} 0%, ${C.blue600} 45%, ${C.cyan500} 100%)`, boxShadow: C.shadowLg },
  heroGrid: { position: 'relative', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 44, alignItems: 'center' },

  irsCard: { padding: '20px 22px', borderRadius: 16, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.24)', backdropFilter: 'blur(6px)' },
  irsLabel: { fontFamily: F.mono, fontSize: 10, fontWeight: 600, letterSpacing: '1px', color: 'rgba(255,255,255,0.7)', marginBottom: 12, textTransform: 'lowercase' },
  irsNum: { fontFamily: F.display, fontSize: 68, fontWeight: 900, lineHeight: 0.95, color: '#fff', letterSpacing: '-2.5px' },
  irsMax: { fontSize: 19, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0, fontFamily: F.body },
  tierPill: { display: 'inline-flex', alignItems: 'center', marginTop: 16, padding: '6px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' },
  irsBar: { position: 'relative', height: 5, marginTop: 18, borderRadius: 999, background: 'rgba(255,255,255,0.22)', overflow: 'visible' },
  irsBarFill: { height: '100%', borderRadius: 999, background: '#fff', transition: 'width 1.3s cubic-bezier(.16,1,.3,1)' },
  irsNextMark: { position: 'absolute', top: -4, width: 2, height: 13, borderRadius: 1, background: 'rgba(255,255,255,0.85)', transform: 'translateX(-50%)' },
  irsGapText: { marginTop: 10, fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.75)' },

  verdictBlock: {},
  heroKicker: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '1.8px', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  heroH1: { margin: '14px 0 0', fontFamily: F.display, fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1.22, letterSpacing: '-0.8px', maxWidth: 620 },
  heroSub: { margin: '15px 0 0', fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.85)', maxWidth: 560, fontWeight: 400 },
  heroActions: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  heroTopLine: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  heroLivePill: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.74)', textTransform: 'uppercase' },
  heroLiveDot: { width: 6, height: 6, borderRadius: '50%', background: '#79F2B2', boxShadow: '0 0 0 3px rgba(121,242,178,0.14)', animation: 'livePulse 2.2s ease-in-out infinite' },
  heroMetricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 18 },
  heroMetricCard: { minWidth: 0, padding: '11px 12px', borderRadius: 12, background: 'rgba(2,20,55,0.19)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(5px)' },
  heroMetricTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', fontFamily: F.mono, fontSize: 8, letterSpacing: '0.7px' },
  heroMetricValue: { marginTop: 6, fontFamily: F.display, fontSize: 21, fontWeight: 900, color: '#fff', lineHeight: 1 },
  heroMetricFoot: { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontFamily: F.mono, fontSize: 8.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  heroSignalRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' },
  heroSignalMain: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  heroSignalLabel: { fontFamily: F.mono, fontSize: 8, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.44)' },
  heroSignalValue: { marginTop: 3, fontSize: 11, fontWeight: 800, color: '#fff' },
  heroDeltaChip: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 9, background: 'rgba(255,255,255,0.08)', flexShrink: 0 },
  heroDeltaValue: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: '#fff' },
  heroDeltaLabel: { marginTop: 2, fontFamily: F.mono, fontSize: 7.5, color: 'rgba(255,255,255,0.44)' },

  statRail: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20, borderRadius: 18, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: 'hidden' },
  railCell: { padding: '20px 24px', borderRight: `1px solid ${C.border}` },
  railLabel: { fontSize: 11, fontWeight: 600, color: C.muted },
  railValRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 },
  railVal: { fontFamily: F.display, fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.8px' },
  railUnit: { fontFamily: F.mono, fontSize: 12, color: C.muted },
  railSub: { marginTop: 8, fontSize: 11, color: C.muted, lineHeight: 1.5 },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 26, boxShadow: C.shadow, marginBottom: 18 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', color: C.blue500, marginBottom: 7, textTransform: 'lowercase' },
  cardH2: { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' },
  cardSub: { margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 440 },

  twoCol: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginBottom: 18 },

  // Momentum board
  momentumGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  momentumCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 11 },
  momentumBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, width: 'fit-content', fontFamily: F.mono },
  momentumTopic: { fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.2 },
  momentumMeta: { fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.5 },
  momentumBar: { height: 4, borderRadius: 999, background: C.border, overflow: 'hidden' },
  momentumBarFill: { height: '100%', borderRadius: 999, transition: 'width 0.9s cubic-bezier(.16,1,.3,1)' },
  momentumHint: { fontSize: 12, color: C.sub, lineHeight: 1.6 },

  dimList: { display: 'flex', flexDirection: 'column', gap: 10 },
  dimRow: { padding: '14px 16px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` },
  dimMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  dimLeft: { display: 'flex', alignItems: 'center', gap: 11 },
  dimIcon: { fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0, color: C.blue500 },
  dimName: { fontSize: 12.5, fontWeight: 700, color: C.text, display: 'block' },
  dimWeight: { fontSize: 10, color: C.muted, fontFamily: F.mono, display: 'block', marginTop: 2 },
  dimScore: { fontFamily: F.display, fontSize: 19, fontWeight: 800 },
  dimTrack: { height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  dimFill: { height: '100%', borderRadius: 999, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' },
  dimNoData: { marginTop: 5, fontSize: 10.5, color: C.faint, fontFamily: F.mono },

  challengeSummary: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 54, height: 54, borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}`, color: C.blue600, fontFamily: F.display, fontSize: 19, fontWeight: 900, lineHeight: 1 },
  challengeSummarySpan: { marginTop: 4, fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.3px' },
  challengeList: { display: 'flex', flexDirection: 'column', gap: 10 },
  challengeRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` },
  challengeIcon: { width: 34, height: 34, borderRadius: 9, background: C.blue50, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.blue500, flexShrink: 0 },
  challengeBody: { flex: 1, minWidth: 0 },
  challengeTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  challengeTitle: { fontSize: 11.5, fontWeight: 800, color: C.text },
  challengeHelper: { marginTop: 2, fontSize: 10, color: C.muted },
  challengeCount: { fontFamily: F.mono, fontSize: 10, fontWeight: 700, flexShrink: 0 },
  challengeTrack: { height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  challengeFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(.16,1,.3,1)' },
  challengeStatus: { width: 28, textAlign: 'right', fontFamily: F.mono, fontSize: 9, fontWeight: 700, flexShrink: 0 },

  nextBadgeChip: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}`, flexShrink: 0, minWidth: 180 },
  nextBadgeLabel: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 500, letterSpacing: '0.4px', color: C.muted },
  nextBadgeName: { fontSize: 11.5, fontWeight: 800, color: C.text, marginTop: 1 },
  nextBadgeProgress: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  nextBadgeTrack: { width: 44, height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  nextBadgeFill: { height: '100%', borderRadius: 999, background: C.blue500 },
  nextBadgePct: { fontFamily: F.mono, fontSize: 9.5, color: C.blue600, fontWeight: 700 },

  badgeGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 },
  badgeCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '17px 10px', borderRadius: 14, cursor: 'pointer', fontFamily: F.body, textAlign: 'center', position: 'relative', overflow: 'hidden' },
  badgeIcon: { fontSize: 19 },
  badgeName: { fontSize: 10, fontWeight: 700, lineHeight: 1.25 },
  badgeSub: { fontSize: 8.5, fontWeight: 500, fontFamily: F.mono, letterSpacing: '0.1px', opacity: 0.85 },
  badgeTierTag: { fontSize: 8.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6, textTransform: 'lowercase', letterSpacing: '0.2px', fontFamily: F.mono },
  badgeLockedTag: { fontSize: 8.5, fontWeight: 500, color: C.faint, fontFamily: F.mono },
  badgeMiniTrack: { width: '80%', height: 4, borderRadius: 999, background: C.border, overflow: 'hidden', marginTop: 2 },
  badgeMiniFill: { height: '100%', borderRadius: 999, background: C.blue400 },
  badgeDetail: { display: 'flex', gap: 15, alignItems: 'flex-start', marginTop: 18, padding: '17px 19px', borderRadius: 13, background: C.cardAlt, border: '1.5px solid' },
  badgeDetailName: { fontFamily: F.body, fontSize: 15, fontWeight: 800, color: C.text },
  badgeDetailDesc: { margin: '7px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.6 },
  badgeDetailMeta: { margin: '9px 0 0', fontSize: 11, color: C.blue600, lineHeight: 1.6, fontFamily: F.mono },

  hmPanel: { position: 'relative', overflow: 'hidden', padding: '24px 26px', marginBottom: 18, borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  hmHeaderRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 16, flexWrap: 'wrap' },
  hmRangeChip: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 10, background: C.blue50, border: `1px solid ${C.borderMd}`, flexShrink: 0 },
  hmRangeValue: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, color: C.blue600 },
  hmRangeLabel: { marginTop: 2, fontFamily: F.mono, fontSize: 7.5, color: C.muted },
  hmHeaderDataPill: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: C.blue50, border: `1px solid ${C.borderMd}`, fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.blue600 },
  // Grid block — full width now (was one side of a 1.7fr/0.9fr split).
  hmGridCard: { minWidth: 0, padding: '12px 12px 10px', borderRadius: 15, background: C.cardAlt, border: `1px solid ${C.border}` },
  hmGridFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' },
  hmPulseBlock: { marginTop: 4, padding: '10px 10px 8px', borderRadius: 11, background: C.card, border: `1px solid ${C.border}` },
  hmPulseHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hmPulseCaption: { fontFamily: F.mono, fontSize: 8.5, color: C.muted },
  hmPulseChart: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, height: 42, marginTop: 8 },
  hmPulseColumn: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flex: 1, minWidth: 0, height: '100%' },
  hmPulseBar: { width: '72%', minWidth: 4, borderRadius: '3px 3px 2px 2px', opacity: 0.94, transition: 'height 0.2s ease' },
  hmPulseAxis: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, fontFamily: F.mono, fontSize: 8, color: C.faint },
  hmInsightEyebrow: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.6px', color: C.blue600, textTransform: 'uppercase' },
  hmInsightTitle: { fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text },

  // Seam — a quiet divider between the raw grid and its narrative below,
  // rather than two cards visually competing for attention.
  hmSeam: { position: 'relative', display: 'flex', alignItems: 'center', margin: '22px 0 18px' },
  hmSeamLabel: { position: 'relative', zIndex: 1, background: C.card, paddingRight: 12, fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.8px', color: C.muted, textTransform: 'lowercase' },

  // Snapshot band — full width, stacked below the grid. Reads left to
  // right / top to bottom as one continuous story rather than a sidebar
  // of disconnected boxes.
  hmSnapshotBand: { display: 'flex', flexDirection: 'column', gap: 14 },
  hmSnapshotIntro: {},
  hmMetricsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 },
  hmMetricTile: { position: 'relative', overflow: 'hidden', padding: '14px 14px 12px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}` },
  hmMetricTileBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.85 },
  hmMetricTileIcon: { fontSize: 15 },
  hmMetricTileValue: { marginTop: 8, fontFamily: F.display, fontSize: 23, fontWeight: 900, lineHeight: 1 },
  hmMetricTileLabel: { marginTop: 5, fontFamily: F.mono, fontSize: 9, color: C.muted },
  hmNarrativeRow: { display: 'grid', gridTemplateColumns: '1.15fr 1fr 0.9fr', gap: 12, alignItems: 'stretch' },
  hmMomentumCard: { padding: '13px 14px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}` },
  hmBestPair: { padding: '13px 14px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  hmBestRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hmRateCard: { padding: '13px 14px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}` },

  shareCard: { position: 'relative', overflow: 'hidden', padding: '28px 30px', borderRadius: 18, background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 50%, ${C.cyan600} 100%)`, boxShadow: C.shadowLg, marginBottom: 18 },
  shareGlow: { position: 'absolute', top: -90, right: -90, width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(circle, rgba(0,200,240,0.16), transparent 68%)`, pointerEvents: 'none' },
  shareRow: { position: 'relative', display: 'flex', alignItems: 'center', gap: 24 },
  shareLeft: { textAlign: 'center', flexShrink: 0, width: 92 },
  shareIRS: { fontFamily: F.display, fontSize: 58, fontWeight: 900, color: '#fff', lineHeight: 1 },
  shareIRSLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.42)', marginTop: 6 },
  shareTitle: { margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: '#fff' },
  shareDesc: { margin: '8px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.66)', lineHeight: 1.6 },

  footerRow: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '20px 4px 0', opacity: 0.42 },
};

export default Dashboard;
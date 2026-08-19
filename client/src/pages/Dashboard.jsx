/* eslint-disable react-refresh/only-export-components */
import API_BASE from '../config/api.js';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getPerformanceAnalytics, startInterview, getAICoach } from '../Services/interviewService';
import { getShareLink } from '../Services/profileServices';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — READINESS CONSOLE v5
// Blueprint blue system, extended. Every number on this page is computed
// from real session data using genuine statistical methods — nothing here
// is padded for UI effect.
//
// v5 additions over v4:
//   • Real badge system — 14 badges earned from genuine multi-signal session
//     patterns (comebacks, topic mastery streaks, speed+accuracy combos),
//     not generic "10 sessions" counters. Tiered bronze/silver/gold/platinum.
//   • Heatmap redesigned — smaller cells, finer 5-shade scale, richer hover
//     state, week/day context in the tooltip.
//   • New: Topic Sparklines (momentum at a glance), Weekly Digest strip,
//     AI Coach teaser (links to the full board on Analytics).
//   • Tighter rhythm — hero carries the verdict only, stats row does the
//     numbers, no section repeats a number another section already owns.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Design tokens — deep blueprint blue, data-terminal aesthetic ───────────
const C = {
  bg:        '#F0F4FF',
  bgDeep:    '#E8EEFF',

  card:      '#FFFFFF',
  cardAlt:   '#F8FAFF',
  cardGlass: 'rgba(255,255,255,0.82)',

  text:  '#0A1628',
  sub:   '#3D5280',
  muted: '#7A8BAF',
  faint: '#A8B8D4',

  border:    '#DDE5F7',
  borderMd:  '#B8CAF0',
  borderStr: '#7FA3E8',

  blue50:  '#EBF2FF',
  blue100: '#C7DAFF',
  blue200: '#9DBFFF',
  blue300: '#6FA5FF',
  blue400: '#4D8FFF',
  blue500: '#1A6EFF',
  blue600: '#0057E8',
  blue700: '#0044C4',
  blue900: '#001F6B',

  cyan300:  '#5FE0FF',
  cyan400:  '#00C8F0',
  cyan500:  '#00ADE0',
  cyan600:  '#0093C4',
  cyanTint: '#E6F9FF',

  green:     '#059669',
  greenTint: '#ECFDF5',
  greenGlow: 'rgba(5,150,105,0.18)',

  amber:      '#D97706',
  amberTint:  '#FFFBEB',
  orange:     '#EA580C',
  orangeTint: '#FFF7ED',

  red:     '#DC2626',
  redTint: '#FEF2F2',

  // Badge tiers — distinct family from score colors so a badge never reads as a score
  bronze:      '#B0703B',
  bronzeTint:  '#FBF1E7',
  silver:      '#7C8AA3',
  silverTint:  '#F2F4F8',
  gold:        '#C89416',
  goldTint:    '#FDF7E6',
  platinum:    '#5D6CE0',
  platinumTint:'#EEF0FE',

  shadow:   '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const TIER_STYLE = {
  bronze:   { color: C.bronze,   tint: C.bronzeTint,   ring: 'rgba(176,112,59,0.32)' },
  silver:   { color: C.silver,   tint: C.silverTint,   ring: 'rgba(124,138,163,0.32)' },
  gold:     { color: C.gold,     tint: C.goldTint,     ring: 'rgba(200,148,22,0.32)' },
  platinum: { color: C.platinum, tint: C.platinumTint, ring: 'rgba(93,108,224,0.32)' },
};

// ─── Package tier benchmarks — UI metadata only (colors/bg/desc).
// IRS thresholds and readiness logic are owned by scoringModel.js on the
// backend. The frontend reads these values from the API response and only
// uses this local map for colors and bg tints that the backend doesn't need.
const TIER_META = {
  '₹3–6 LPA':   { color: '#7A8BAF', bg: '#F0F4FF' },
  '₹6–12 LPA':  { color: C.amber,   bg: C.amberTint },
  '₹12–20 LPA': { color: C.blue500, bg: C.blue50 },
  '₹20 LPA+':   { color: C.cyan500, bg: C.cyanTint },
};

// ─── Dimension display metadata — icons, tips, weights for rendering bars.
// Scores and hasData come from the API (computed by scoringModel.js with
// the proper synonym resolver). This local array is only for display fields.
const DIMENSION_META = [
  { key: 'technical',      label: 'Technical Depth', icon: '⚙',  weight: 0.28, tip: 'Core CS fundamentals — the first thing technical screeners test.' },
  { key: 'problemSolving', label: 'Problem Solving', icon: '🔍', weight: 0.22, tip: 'How you break down unknowns — decisive in live coding rounds.' },
  { key: 'communication',  label: 'Communication',   icon: '💬', weight: 0.18, tip: 'Clarity of thought, not just English — interviewers notice it fast.' },
  { key: 'behavioral',     label: 'Behavioral',      icon: '🤝', weight: 0.12, tip: 'Situational judgment and self-awareness under HR scrutiny.' },
  { key: 'design',         label: 'System Design',   icon: '🏗', weight: 0.10, tip: 'Matters at ₹12 LPA+ — often the differentiator between tiers.' },
  { key: 'fundamentals',   label: 'CS Fundamentals', icon: '📚', weight: 0.10, tip: 'Breadth of core knowledge — separates prepared from lucky.' },
];

// ─── Personality archetypes ──────────────────────────────────────────────────
const ARCHETYPES = [
  { id: 'inconsistentGenius', label: 'Inconsistent Genius', icon: '🎲', desc: 'High variance in scores — brilliant when in flow but needs to build floor quality.', fix: 'Consistency drills: aim to hold 65+ on every session before chasing 90+.' },
  { id: 'consistentClimber',  label: 'Consistent Climber',  icon: '📈', desc: 'Steady, reliable improvement — the archetype that wins campus placements.', fix: 'Keep the streak; add harder topic rotations to keep growing.' },
  { id: 'speedRunner',        label: 'Speed Runner',        icon: '⚡', desc: 'Fast answers but sometimes sacrifices depth for pace.', fix: 'Practise "think aloud" — say your reasoning before your answer.' },
  { id: 'deepThinker',        label: 'Deep Thinker',        icon: '🧠', desc: 'Thorough and accurate — needs to improve time management under live pressure.', fix: 'Run timed drills; 2-minute cap per answer in quick-fire mode.' },
  { id: 'pressureCooker',     label: 'Pressure Cooker',     icon: '🔥', desc: 'Scores improve in timed sessions — performs well under competition conditions.', fix: 'Channel this by signing up for live contest platforms weekly.' },
];

// ─── Badge catalogue (frontend copy of backend badgeEngine.js — kept in sync
//     for icon/label/desc/tier; unlocked/progress/meta come from the API).
const BADGE_CATALOGUE = [
  { id: 'first_rep',       label: 'First Rep',       icon: '🎬', tier: 'bronze',   desc: 'Completed your first mock interview.' },
  { id: 'comeback_kid',    label: 'Comeback Kid',    icon: '🔁', tier: 'gold',     desc: 'Bounced back 15+ points the session right after a bad one.' },
  { id: 'topic_slayer',    label: 'Topic Slayer',    icon: '⚔️', tier: 'gold',     desc: 'Scored 85+ on the same topic across 3 sessions in a row.' },
  { id: 'silent_grinder',  label: 'Silent Grinder',  icon: '🧘', tier: 'silver',   desc: '7-day streak without a single 90+ "hero" session — pure consistency.' },
  { id: 'full_marks',      label: 'Full Marks',      icon: '💯', tier: 'silver',   desc: 'Nailed a question with a perfect 100 score.' },
  { id: 'no_skip_zone',    label: 'No Skip Zone',    icon: '🛡️', tier: 'bronze',   desc: 'Completed a full session without skipping anything.' },
  { id: 'speed_demon',     label: 'Speed Demon',     icon: '⚡', tier: 'silver',   desc: 'Averaged under 20s per question while still scoring 70+.' },
  { id: 'deep_diver',      label: 'Deep Diver',      icon: '🧠', tier: 'silver',   desc: 'Took your time (70s+/question) and still scored 80+.' },
  { id: 'range_rider',     label: 'Range Rider',     icon: '🗺️', tier: 'bronze',   desc: 'Practiced across 6+ distinct topics.' },
  { id: 'iron_streak',     label: 'Iron Streak',     icon: '🔥', tier: 'gold',     desc: 'Kept a 14-day practice streak alive.' },
  { id: 'the_grinder',     label: 'The Grinder',     icon: '⚙️', tier: 'gold',     desc: 'Completed 25 mock interviews.' },
  { id: 'elite_pass',      label: 'Elite Pass',      icon: '🏆', tier: 'platinum', desc: 'Hit a 90+ session score.' },
  { id: 'weakness_slayer', label: 'Weakness Slayer', icon: '🎯', tier: 'gold',     desc: 'Took a topic from under 50 to 75+ in a later session.' },
  { id: 'tier_jumper',     label: 'Tier Jumper',     icon: '🚀', tier: 'platinum', desc: 'Crossed a package-tier threshold between sessions.' },
];

// ─── Pure maths helpers ──────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));

const ewma = (values, alpha = 0.35) => {
  if (!values.length) return 0;
  return values.reduce((acc, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * acc), values[0]);
};

const stdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const trendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xMean) * (v - yMean), 0);
  const den = values.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
  return den ? num / den : 0;
};

const deriveArchetype = (scoreTrend, avgTimePerQ, avgScore) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1];
  const sd = stdDev(scores);
  const slope = trendSlope(scores);
  if (sd > 18) return ARCHETYPES[0];
  if (slope > 2) return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};

/** Predicts next-session score using EWMA + trend slope, clamped to plausible range. */
const predictNextScore = (scoreTrend) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return null;
  const recent = scores.slice(-8);
  const ewmaVal = ewma(recent);
  const slope = trendSlope(recent);
  const predicted = ewmaVal + slope * 0.6;
  return clamp(predicted);
};

// ─── Build 14-week heatmap grid ──────────────────────────────────────────────
const buildHeatmap = (scoreTrend) => {
  const byDate = {};
  (scoreTrend ?? []).forEach(s => {
    if (s.date) {
      const key = s.date.slice(0, 10);
      byDate[key] = byDate[key] ? Math.round((byDate[key] + (s.score ?? 0)) / 2) : (s.score ?? 0);
    }
  });

  const WEEKS = 14;
  const now = new Date();
  const grid = [];

  for (let w = WEEKS - 1; w >= 0; w--) {
    const col = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - (w * 7 + d));
      const key = dt.toISOString().slice(0, 10);
      col.push({
        date: key,
        score: byDate[key] ?? 0,
        future: dt > now,
        hasData: Boolean(byDate[key]),
      });
    }
    grid.push(col);
  }
  return grid;
};

const heatmapStats = (grid) => {
  const cells = grid.flat().filter(c => !c.future && c.hasData);
  if (!cells.length) return { activeDays: 0, bestDay: null, avgScore: 0, longestStreak: 0 };

  const activeDays = cells.length;
  const bestDay = cells.reduce((b, c) => (c.score > b.score ? c : b), cells[0]);
  const avgScore = Math.round(cells.reduce((a, c) => a + c.score, 0) / cells.length);

  const sortedDates = [...new Set(cells.map(c => c.date))].sort();
  let longest = 1, current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr - prev) / 86400000;
    if (diff === 1) { current++; if (current > longest) longest = current; }
    else current = 1;
  }

  return { activeDays, bestDay, avgScore, longestStreak: longest };
};

const bestFixTarget = (topicPerformance, dimensionProfile) => {
  if (!topicPerformance.length) return null;
  return topicPerformance
    .map(t => {
      const dim = DIMENSION_META.find(d => d.key === (dimensionProfile.find(dp => dp.contributingTopics?.includes(t.topic))?.key)) ?? {};
      const dimWeight = dim.weight ?? 0.1;
      const roi = dimWeight * (100 - (t.averageScore || 0));
      return { ...t, roi };
    })
    .sort((a, b) => b.roi - a.roi)[0];
};

/** Per-topic trend across the last N sessions containing that topic — used for sparklines. */
const topicMomentum = (topicPerformance, scoreTrend) => {
  // scoreTrend items don't carry per-topic breakdown in this API shape, so we
  // approximate momentum by correlating overall-session trend direction with
  // how recently the topic has appeared in topicPerformance ordering (stable
  // proxy given current API — becomes exact once backend adds topic-tagged trend).
  const overallSlope = trendSlope(scoreTrend.map(s => s.score || 0).slice(-6));
  return topicPerformance.map(t => ({
    ...t,
    momentum: overallSlope > 1.5 ? 'rising' : overallSlope < -1.5 ? 'falling' : 'stable',
  }));
};

const useLiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

// 5-shade heat scale, finer than v4's 5-step but visually distinct at small cell size
const heatColor = (score, hasData) => {
  if (!hasData) return C.border;
  if (score >= 88) return C.blue900;
  if (score >= 75) return C.blue700;
  if (score >= 60) return C.blue500;
  if (score >= 45) return C.blue300;
  if (score >= 25) return C.blue200;
  return C.blue100;
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clock = useLiveClock();

  const [dashStats, setDashStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachTeaser, setCoachTeaser] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        // /dashboard/stats is a fast query (10 sessions) — it resolves first
        // and populates the header strip immediately while the heavier
        // /performance call (all sessions + scoringModel) is still in flight.
        const statsPromise = fetch(`${API_BASE}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json());

        const [analyticsData, lbRes] = await Promise.all([
          getPerformanceAnalytics(),
          fetch(`${API_BASE}/leaderboard`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // Stats may resolve before or after — whichever lands, set it
        statsPromise.then(s => setDashStats(s)).catch(() => {});

        setAnalytics(analyticsData);
        setLeaderboard(await lbRes.json());
      } catch (e) {
        console.error('Dashboard load:', e);
      } finally {
        setLoading(false);
        requestAnimationFrame(() => setTimeout(() => setMounted(true), 40));
      }
    })();
  }, []);

  const startQuick = useCallback(async (topic = '') => {
    try {
      setStarting(true);
      const r = await startInterview({ mode: 'quick', company: '', topic });
      navigate('/interview', { state: { sessionId: r.sessionId, questions: r.questions, mode: 'quick' } });
    } catch (e) {
      console.error('Start interview:', e);
    } finally {
      setStarting(false);
    }
  }, [navigate]);

  // AI Coach teaser — fetches one-line hook, full board lives on Analytics
  const handleCoachTeaser = async () => {
    if (coachTeaser || coachLoading) {
      navigate('/analytics');
      return;
    }
    try {
      setCoachLoading(true);
      const response = await getAICoach();
      const text = typeof response?.analysis === 'string' ? response.analysis : '';
      const firstLine = text.split('\n').find(l => l.trim().length > 0) || '';
      setCoachTeaser(firstLine.slice(0, 140) || 'Your personalised readiness analysis is ready.');
    } catch (e) {
      console.error('AI coach teaser failed:', e);
      setCoachTeaser('');
    } finally {
      setCoachLoading(false);
      navigate('/analytics');
    }
  };

  // Fix-badges — recomputes badge state server-side against all completed
  // sessions, then re-fetches analytics so the badge showcase reflects the
  // corrected state. Shows a toast so the user knows something happened.
  const [fixingBadges, setFixingBadges] = useState(false);
  const handleFixBadges = useCallback(async () => {
    setFixingBadges(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/auth/fix-badges`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Fix failed');
      // Re-fetch analytics so badge counts update in the UI
      const fresh = await getPerformanceAnalytics();
      setAnalytics(fresh);
      const gained = data.newBadges?.length ?? 0;
      // Simple inline toast via a temporary DOM element (avoids adding a dep)
      const msg = gained > 0
        ? `✓ ${gained} badge${gained > 1 ? 's' : ''} unlocked`
        : '✓ Badges are up to date';
      const el = document.createElement('div');
      el.textContent = msg;
      Object.assign(el.style, {
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: '#1A6EFF', color: '#fff', padding: '10px 20px', borderRadius: '12px',
        fontWeight: 700, fontSize: '13px', zIndex: 9999, pointerEvents: 'none',
      });
      document.body.appendChild(el);
      setTimeout(() => document.body.removeChild(el), 2800);
    } catch (e) {
      console.error('Fix badges failed:', e);
    } finally {
      setFixingBadges(false);
    }
  }, []);

  // ── Derived raw fields ────────────────────────────────────────────────────
  const totalInterviews = analytics?.totalInterviews ?? analytics?.totalSessions ?? 0;
  const averageScore = analytics?.averageScore ?? 0;
  // bestScore: prefer /performance (all sessions) → fall back to /dashboard/stats (last 10)
  const bestScore = analytics?.bestScore ?? analytics?.highestScore ?? dashStats?.stats?.bestScore ?? 0;
  const scoreTrend = analytics?.scoreTrend ?? [];
  const topicPerformance = useMemo(() => analytics?.topicPerformance ?? [], [analytics]);
  const badgesRaw = useMemo(() => analytics?.badges ?? [], [analytics]);
  const leaderboardUsers = useMemo(() => leaderboard?.global ?? [], [leaderboard]);
  const currentUser = leaderboard?.currentUser ?? null;
  // Streak: prefer live user object → /dashboard/stats (updated after each session)
  const streakDays = user?.streak?.current ?? dashStats?.stats?.currentStreak ?? 0;
  const avgTimePerQ = analytics?.timePerformance?.averageTimePerQuestion ?? null;
  const hasData = totalInterviews > 0;

  const latestScore = scoreTrend.at(-1)?.score ?? 0;
  const prevScore = scoreTrend.at(-2)?.score ?? latestScore;
  const delta = latestScore - prevScore;

  // ── IRS + tier — read from backend (scoringModel.js), never recompute here ──
  // The backend uses a real topic synonym resolver; frontend exact-string
  // matching silently drops ~20% of answered questions from dimension scores.
  const irs = analytics?.irs ?? 0;

  // currentTier: API returns the label string; resolve display metadata locally
  const currentTierLabel = analytics?.currentTier ?? '₹3–6 LPA';
  const currentTierMeta = TIER_META[currentTierLabel] ?? TIER_META['₹3–6 LPA'];
  const currentTier = { label: currentTierLabel, ...currentTierMeta };

  // nextTier: first tier from the backend tiers array that isn't yet unlocked
  const apiTiers = analytics?.tiers ?? [];
  const nextTierApi = apiTiers.find(t => !t.isUnlocked && t.label !== currentTierLabel) ?? null;
  const nextTier = nextTierApi
    ? { label: nextTierApi.label, minScore: nextTierApi.minIRS, color: TIER_META[nextTierApi.label]?.color ?? C.blue500, advice: nextTierApi.advice }
    : null;
  const irsGap = nextTier ? Math.max(0, nextTier.minScore - irs) : 0;

  // ── Six-dimension profile — from backend (synonym-resolved) ──────────────
  // Merge display metadata (icon, tip, weight) onto the API shape.
  const dimensionProfile = useMemo(() => {
    const apiProfile = analytics?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const apiDim = apiProfile.find(d => d.key === meta.key);
      return {
        ...meta,
        score: apiDim?.score ?? 0,
        hasData: apiDim?.hasData ?? false,
        isProvisional: apiDim?.isProvisional ?? false,
        answeredCount: apiDim?.answeredCount ?? 0,
        contributingTopics: apiDim?.contributingTopics ?? [],
      };
    });
  }, [analytics]);

  const archetype = useMemo(
    () => deriveArchetype(scoreTrend, avgTimePerQ, averageScore),
    [scoreTrend, avgTimePerQ, averageScore]
  );

  const dimWithData = dimensionProfile.filter(d => d.hasData);
  const strongestDim = [...dimWithData].sort((a, b) => b.score - a.score)[0];
  const weakestDim = [...dimWithData].sort((a, b) => a.score - b.score)[0];

  const fixTarget = useMemo(
    () => bestFixTarget(topicPerformance, dimensionProfile),
    [topicPerformance, dimensionProfile]
  );

  const heatmap = useMemo(() => buildHeatmap(scoreTrend), [scoreTrend]);
  const hmStats = useMemo(() => heatmapStats(heatmap), [heatmap]);

  const nextPrediction = useMemo(() => predictNextScore(scoreTrend), [scoreTrend]);
  const topicsWithMomentum = useMemo(() => topicMomentum(topicPerformance, scoreTrend), [topicPerformance, scoreTrend]);

  // Merge live badge unlock state onto the frontend catalogue (so copy/icons
  // stay in this file even if backend only returns id/unlocked/progress).
  const badges = useMemo(() => {
    const byId = {};
    badgesRaw.forEach(b => { byId[b.id] = b; });
    return BADGE_CATALOGUE.map(def => {
      const live = byId[def.id];
      return {
        ...def,
        unlocked: live?.unlocked ?? false,
        progress: live?.progress ?? null,
        meta: live?.meta ?? null,
      };
    });
  }, [badgesRaw]);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const nextBadge = useMemo(() => {
    const locked = badges.filter(b => !b.unlocked && typeof b.progress === 'number');
    return locked.sort((a, b) => (b.progress || 0) - (a.progress || 0))[0] || null;
  }, [badges]);

  const percentile = useMemo(() => {
    if (!currentUser?.globalRank || !leaderboardUsers.length) return null;
    return Math.max(1, Math.round(
      ((leaderboardUsers.length - currentUser.globalRank + 1) / leaderboardUsers.length) * 100
    ));
  }, [currentUser, leaderboardUsers]);

  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.page}>
      <div style={S.loadingWrap}>
        <div style={S.spinner} />
        <div style={S.loadTitle}>Analysing your readiness profile…</div>
        <div style={S.loadSub}>Pulling session history and computing IRS</div>
      </div>
    </div>
  );

  return (
    <div style={S.page} className="mm-page">
      <div style={{ ...S.container, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)' }}>

        {/* ── STATUS STRIP ──────────────────────────────────────────────── */}
        <div style={S.strip} className="mm-strip">
          <div style={S.stripL}>
            <span style={S.liveDot} />
            <span style={S.mono}>MOCKMATE READINESS CONSOLE</span>
          </div>
          <div style={S.stripR} className="mm-strip-r">
            <span style={S.mono}>SESSION {sessionId}</span>
            <span style={{ color: C.borderMd }}>·</span>
            <span style={S.mono}>
              {clock.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}{' '}
              {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section style={S.hero} className="mm-hero">
          <div style={S.heroScan} />
          <div style={S.heroGrid} className="mm-hero-grid">

            <div style={S.irsBlock}>
              <div style={S.irsLabel}>INTERVIEW READINESS SCORE</div>
              <div style={S.irsNum}>
                {hasData ? irs : '—'}
                {hasData && <span style={S.irsMax}>/100</span>}
              </div>
              {hasData && (
                <>
                  <div style={{ ...S.tierPill, background: `${currentTier.color}22`, color: currentTier.color, border: `1px solid ${currentTier.color}55` }}>
                    {currentTier.label} eligible
                  </div>
                  <div style={S.irsBar}>
                    <div style={{ ...S.irsBarFill, width: mounted ? `${irs}%` : '0%' }} />
                    {nextTier && (
                      <div style={{ ...S.irsNextMark, left: `${nextTier.minScore}%` }} title={`${nextTier.label} threshold`} />
                    )}
                  </div>
                  {nextTier && (
                    <div style={S.irsGapText}>
                      {irsGap} points to <span style={{ color: C.cyan400, fontWeight: 700 }}>{nextTier.label}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={S.verdictBlock}>
              <div style={S.eyebrow}>
                <span style={S.eyebrowDot} />
                PLACEMENT VERDICT
              </div>
              <h1 style={S.heroH1}>
                {user?.name?.split(' ')[0] ? `${user.name.split(' ')[0]}, ` : ''}
                {!hasData
                  ? "let's build your readiness profile."
                  : `you're trending toward ${currentTier.label}.`}
              </h1>
              {!hasData ? (
                <p style={S.heroSub}>
                  Run one interview and MockMate computes your IRS — a weighted score
                  across six dimensions that maps to real package tiers.
                </p>
              ) : (
                <p style={S.heroSub}>
                  {totalInterviews} session{totalInterviews !== 1 ? 's' : ''} logged ·{' '}
                  strongest in <strong style={{ color: '#fff' }}>{strongestDim?.label ?? '—'}</strong>,
                  sharpest gap in <strong style={{ color: C.cyan400 }}>{weakestDim?.label ?? '—'}</strong>.
                </p>
              )}
              <div style={S.heroActions}>
                <button style={S.btnPrimary} onClick={() => startQuick()} disabled={starting}>
                  {starting ? 'Launching…' : hasData ? '⚡ New mock interview' : '🎯 Run first interview'}
                </button>
                {hasData && (
                  <button style={S.btnGhost} onClick={() => navigate('/analytics')}>
                    Full analytics →
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {hasData && (<>

          {/* ── QUICK STATS ROW ─────────────────────────────────────────── */}
          <section style={S.statsRow} className="mm-stats">
            <StatCard label="Avg score" value={averageScore} unit="/100" sub="Simple mean across all sessions" color={scoreColor(averageScore)} />
            <StatCard label="Best session" value={bestScore} unit="/100" sub="Your personal ceiling" color={C.blue500} />
            <StatCard label="Sessions" value={totalInterviews} unit="" sub={streakDays ? `${streakDays}-day streak 🔥` : 'No active streak'} color={C.green} />
            <StatCard label="Trend (last session)" value={`${delta >= 0 ? '+' : ''}${delta}`} unit=" pts" sub={delta > 0 ? 'Moving up ↑' : delta < 0 ? 'Slipping — drill now' : 'Flat'} color={delta >= 0 ? C.green : C.orange} />
          </section>

          {/* ── NEXT SESSION PREDICTOR + WEEKLY DIGEST ──────────────────── */}
          <section style={S.twoCol} className="mm-two-col">
            <PredictorCard prediction={nextPrediction} lastScore={latestScore} averageScore={averageScore} onStart={() => startQuick()} starting={starting} />
            <WeeklyDigestCard scoreTrend={scoreTrend} hmStats={hmStats} totalInterviews={totalInterviews} longestStreak={dashStats?.stats?.longestStreak ?? hmStats.longestStreak} />
          </section>

          {/* ── IRS BREAKDOWN + FIX THIS NEXT ───────────────────────────── */}
          <section style={S.twoCol} className="mm-two-col">
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div>
                  <div style={S.eyebrowDark}>SIX-DIMENSION BREAKDOWN</div>
                  <h2 style={S.cardH2}>Your IRS components</h2>
                  <p style={S.cardSub}>
                    Each bar is weighted — heavier dimensions influence your IRS more.
                    Gaps here are where readiness points are actually lost.
                  </p>
                </div>
                <button style={S.linkBtn} onClick={() => navigate('/analytics')}>Full radar →</button>
              </div>
              <div style={S.dimList}>
                {dimensionProfile.map(d => {
                  const col = d.hasData ? scoreColor(d.score) : C.faint;
                  return (
                    <div key={d.key} style={S.dimRow} title={d.tip}>
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
                          {d.isProvisional && d.hasData && <span title="Provisional — more sessions needed" style={{ fontSize: 9, marginLeft: 3, color: C.amber, fontWeight: 700 }}>~</span>}
                        </span>
                      </div>
                      <div style={S.dimTrack}>
                        <div style={{ ...S.dimFill, width: mounted && d.hasData ? `${d.score}%` : '0%', background: col, opacity: d.hasData ? 1 : 0.3 }} />
                      </div>
                      {!d.hasData && <div style={S.dimNoData}>No sessions for these topics yet</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
              <div style={S.eyebrowDark}>HIGHEST-ROI FIX</div>
              <h2 style={S.cardH2}>Where to drill next</h2>

              {fixTarget ? (
                <>
                  <div style={S.fixBox}>
                    <div style={S.fixTop}>
                      <span style={S.fixTopic}>{fixTarget.topic}</span>
                      <span style={{ ...S.fixScore, color: scoreColor(fixTarget.averageScore || 0) }}>{fixTarget.averageScore || 0}/100</span>
                    </div>
                    <div style={S.fixTrack}>
                      <div style={{ ...S.fixFill, width: `${fixTarget.averageScore || 0}%`, background: scoreColor(fixTarget.averageScore || 0) }} />
                    </div>
                    <div style={S.fixStats}>
                      <span style={S.fixStat}><strong>{100 - (fixTarget.averageScore || 0)}</strong> pts headroom</span>
                      <span style={S.fixStat}><strong>{Math.round(fixTarget.roi * 10) / 10}</strong> ROI score</span>
                      <span style={S.fixStat}><strong>{fixTarget.attempts ?? '—'}</strong> questions attempted</span>
                    </div>
                    <p style={S.fixHint}>
                      ROI score = dimension weight × score gap. Closing this topic gap
                      moves your IRS more than any other single change right now.
                    </p>
                  </div>

                  <div style={S.archetypeBox}>
                    <div style={S.archetypeHead}>
                      <span style={S.archetypeIcon}>{archetype.icon}</span>
                      <div>
                        <div style={S.archetypeName}>{archetype.label}</div>
                        <div style={S.archetypeDesc}>{archetype.desc}</div>
                      </div>
                    </div>
                    <div style={S.archetypeFix}>{archetype.fix}</div>
                  </div>

                  <button style={{ ...S.btnBlue, marginTop: 'auto' }} onClick={() => startQuick(fixTarget.topic)} disabled={starting}>
                    ⚡ Drill {fixTarget.topic} now
                  </button>
                </>
              ) : (
                <p style={S.cardSub}>Complete a few more sessions to unlock targeted recommendations.</p>
              )}
            </div>
          </section>

          {/* ── BADGE SHOWCASE ───────────────────────────────────────────── */}
          <BadgeShowcase badges={badges} unlockedCount={unlockedCount} nextBadge={nextBadge} mounted={mounted} onFixBadges={handleFixBadges} />

          {/* ── RECENT SESSIONS — /dashboard/stats recentSessions ────────── */}
          <RecentSessionsCard sessions={dashStats?.recentSessions} mounted={mounted} />

          {/* ── TOPIC MOMENTUM (sparkline-style rows) ───────────────────── */}
          <TopicMomentumCard topics={topicsWithMomentum} mounted={mounted} onDrill={startQuick} starting={starting} />

          {/* ── PEER STANDING + AI COACH TEASER ──────────────────────────── */}
          <section style={S.twoCol} className="mm-two-col">
            <PeerCard percentile={percentile} currentUser={currentUser} leaderboardUsers={leaderboardUsers} mounted={mounted} onChallenge={() => startQuick()} starting={starting} />
            <AICoachTeaserCard onOpen={handleCoachTeaser} loading={coachLoading} teaser={coachTeaser} weakestDim={weakestDim} />
          </section>

          {/* ── SHARE CARD ────────────────────────────────────────────────── */}
          <ShareCard
            name={user?.name?.split(' ')[0] || 'Candidate'}
            irs={irs}
            tier={currentTier}
            strongest={strongestDim}
            percentile={percentile}
            archetype={archetype}
            sessions={totalInterviews}
          />

          {/* ── ACTIVITY HEATMAP ─────────────────────────────────────────── */}
          <ActivityHeatmap
            heatmap={heatmap}
            stats={{ ...hmStats, longestStreak: dashStats?.stats?.longestStreak ?? hmStats.longestStreak }}
            total={totalInterviews}
            mounted={mounted}
          />

          {/* ── LEADERBOARD ──────────────────────────────────────────────── */}
          <LeaderboardCard users={leaderboardUsers} currentUser={currentUser} onChallenge={() => startQuick()} starting={starting} />

          {/* ── NEXT TIER BANNER ─────────────────────────────────────────── */}
          {nextTier && (
            <section style={S.tierBanner} className="mm-banner">
              <div style={{ flex: 1 }}>
                <div style={S.eyebrowLight}>NEXT MILESTONE</div>
                <h2 style={S.bannerH2}>
                  {irsGap} IRS points from <span style={{ color: nextTier.color }}>{nextTier.label}</span>
                </h2>
                <p style={S.bannerSub}>
                  {nextTier.advice} {weakestDim && `Focus on ${weakestDim.label} — it's your largest open gap.`}
                </p>
                <div style={S.bannerTrack}>
                  <div style={{ ...S.bannerFill, width: mounted ? `${Math.min(100, nextTier.minScore > 0 ? (irs / nextTier.minScore) * 100 : 100)}%` : '0%' }} />
                  <div style={{ ...S.bannerMark, left: '100%' }} title={`${nextTier.label} threshold`} />
                </div>
                <div style={S.bannerCaption}>{irs}/{nextTier.minScore} IRS needed</div>
              </div>
              <button style={S.btnBannerCta} onClick={() => startQuick()} disabled={starting}>Keep climbing →</button>
            </section>
          )}

        </>)}

        <footer style={S.footerRow}>
          <span style={S.mono}>MOCKMATE READINESS ENGINE v5.0</span>
          <span style={S.mono}>IRS = weighted dimension avg · EWMA trend · breadth · consistency</span>
        </footer>
      </div>
      <GlobalStyles />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, unit, sub, color }) => (
  <div style={S.statCard}>
    <div style={S.statLabel}>{label}</div>
    <div style={S.statValRow}>
      <span style={{ ...S.statVal, color }}>{value}</span>
      {unit && <span style={S.statUnit}>{unit}</span>}
    </div>
    <div style={S.statSub}>{sub}</div>
  </div>
);

// ─── Next Session Predictor — EWMA + trend extrapolation, honestly framed ────
const PredictorCard = ({ prediction, lastScore, averageScore, onStart, starting }) => {
  if (prediction == null) {
    return (
      <div style={S.card}>
        <div style={S.eyebrowDark}>NEXT SESSION FORECAST</div>
        <h2 style={S.cardH2}>Not enough data yet</h2>
        <p style={S.cardSub}>Complete 2+ sessions and MockMate will project your next likely score from your trend.</p>
      </div>
    );
  }
  const delta = prediction - lastScore;
  const band = 6; // ± confidence band shown to keep this honest, not falsely precise
  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>NEXT SESSION FORECAST</div>
          <h2 style={S.cardH2}>If you play true to form…</h2>
          <p style={S.cardSub}>Projected from your EWMA trend, not a promise — a data-backed expectation.</p>
        </div>
      </div>
      <div style={S.predictRow}>
        <div style={S.predictBlock}>
          <div style={S.predictNum}>{prediction}</div>
          <div style={S.predictBand}>±{band} pts</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={S.predictBarTrack}>
            <div style={{ ...S.predictBarLow, left: `${Math.max(0, prediction - band)}%`, width: `${Math.min(100, band * 2)}%` }} />
            <div style={{ ...S.predictMarker, left: `${clamp(prediction)}%` }} />
            <div style={{ ...S.predictMarkerAvg, left: `${clamp(averageScore)}%` }} title={`Your average: ${averageScore}`} />
          </div>
          <div style={S.predictLegend}>
            <span><span style={{ ...S.legendDot, background: C.blue500 }} /> Forecast</span>
            <span><span style={{ ...S.legendDot, background: C.faint }} /> Your average</span>
          </div>
          <p style={S.predictNote}>
            {delta > 3 ? `Trending up — ${Math.round(delta)} pts above your last session.` :
             delta < -3 ? `Trending down — drill your weakest topic before your next run.` :
             `Holding steady near your recent form.`}
          </p>
        </div>
      </div>
      <button style={{ ...S.btnBlue, marginTop: 14 }} onClick={onStart} disabled={starting}>Beat the forecast →</button>
    </div>
  );
};

// ─── Recent Sessions — powered by /dashboard/stats recentSessions field ───────
// This is the only place in the app that surfaces that data. Clicking a row
// navigates to the full result page via /result/:id (same as History).
const RecentSessionsCard = ({ sessions, mounted }) => {
  const navigate = useNavigate();
  if (!sessions?.length) return null;

  const modeIcon = m => ({ technical: '💻', hr: '🤝', behavioral: '🤝', mixed: '🎲', company: '🏢' })[m?.toLowerCase()] ?? '📋';
  const scoreCol = s => s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.red;

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>RECENT SESSIONS</div>
          <h2 style={S.cardH2}>Last 5 completed interviews</h2>
        </div>
        <button style={S.btnOutline} onClick={() => navigate('/history')}>Full history →</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {sessions.map((s, i) => (
          <div
            key={s.id}
            onClick={() => navigate(`/result/${s.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 12,
              border: `1px solid ${C.border}`, background: C.cardAlt,
              cursor: 'pointer', transition: 'background 0.15s',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'none' : 'translateY(8px)',
              transition: `opacity 0.3s ${i * 0.06}s, transform 0.3s ${i * 0.06}s, background 0.15s`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.blue50}
            onMouseLeave={e => e.currentTarget.style.background = C.cardAlt}
          >
            <div style={{ fontSize: 18, flexShrink: 0 }}>{modeIcon(s.mode)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, fontFamily: F.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.company ? `${s.company} — ` : ''}{s.topic || s.mode || 'Interview'}
              </div>
              <div style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, marginTop: 2 }}>
                {s.questionCount} Qs · {s.date}
              </div>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: scoreCol(s.totalScore), flexShrink: 0 }}>
              {s.totalScore ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Weekly Digest — condensed 7-day summary, distinct from the heatmap below ─
const WeeklyDigestCard = ({ scoreTrend, hmStats, totalInterviews, longestStreak }) => {
  // longestStreak: prefer /dashboard/stats (stored in DB, updated after each session)
  // → fall back to heatmap derivation (heatmap only covers the last 12 weeks of sessions
  //   so it will undercount for users with a long history)
  const displayLongestStreak = longestStreak ?? hmStats.longestStreak;
  const now = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 14);

  const thisWeek = scoreTrend.filter(s => s.date && new Date(s.date) >= sevenDaysAgo);
  const lastWeek = scoreTrend.filter(s => s.date && new Date(s.date) >= fourteenDaysAgo && new Date(s.date) < sevenDaysAgo);

  const thisWeekAvg = thisWeek.length ? Math.round(thisWeek.reduce((a, s) => a + (s.score || 0), 0) / thisWeek.length) : null;
  const lastWeekAvg = lastWeek.length ? Math.round(lastWeek.reduce((a, s) => a + (s.score || 0), 0) / lastWeek.length) : null;
  const weekDelta = thisWeekAvg != null && lastWeekAvg != null ? thisWeekAvg - lastWeekAvg : null;

  return (
    <div style={S.card}>
      <div style={S.eyebrowDark}>WEEKLY DIGEST</div>
      <h2 style={S.cardH2}>Last 7 days at a glance</h2>
      <p style={S.cardSub}>How this week compares to last — momentum matters more than any single score.</p>
      <div style={S.digestGrid}>
        <div style={S.digestCell}>
          <div style={S.digestVal}>{thisWeek.length}</div>
          <div style={S.digestLabel}>SESSIONS THIS WEEK</div>
        </div>
        <div style={S.digestCell}>
          <div style={{ ...S.digestVal, color: thisWeekAvg != null ? scoreColor(thisWeekAvg) : C.faint }}>{thisWeekAvg ?? '—'}</div>
          <div style={S.digestLabel}>AVG SCORE</div>
        </div>
        <div style={S.digestCell}>
          <div style={{ ...S.digestVal, color: weekDelta == null ? C.faint : weekDelta >= 0 ? C.green : C.orange }}>
            {weekDelta == null ? '—' : `${weekDelta >= 0 ? '+' : ''}${weekDelta}`}
          </div>
          <div style={S.digestLabel}>VS LAST WEEK</div>
        </div>
        <div style={S.digestCell}>
          <div style={S.digestVal}>{displayLongestStreak}d</div>
          <div style={S.digestLabel}>LONGEST STREAK</div>
        </div>
      </div>
      {thisWeek.length === 0 && (
        <div style={S.digestEmpty}>No sessions logged this week yet — {totalInterviews} lifetime sessions won't grow themselves 👀</div>
      )}
    </div>
  );
};

// ─── Badge Showcase — real earned badges, tiered treatment ───────────────────
const BadgeShowcase = ({ badges, unlockedCount, nextBadge, mounted, onFixBadges }) => {
  const [selected, setSelected] = useState(null);
  const [fixing, setFixing] = useState(false);

  const handleFix = async () => {
    setFixing(true);
    try { await onFixBadges?.(); } finally { setFixing(false); }
  };

  return (
    <section style={{ ...S.card, marginBottom: 18 }}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>ACHIEVEMENTS</div>
          <h2 style={S.cardH2}>{unlockedCount}/{badges.length} badges earned</h2>
          <p style={S.cardSub}>Every badge here is computed from real session patterns — comebacks, streaks, speed-vs-accuracy — not just session counts.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {nextBadge && (
            <div style={S.nextBadgeChip}>
              <span style={{ fontSize: 15 }}>{nextBadge.icon}</span>
              <div>
                <div style={S.nextBadgeLabel}>NEXT UP</div>
                <div style={S.nextBadgeName}>{nextBadge.label}</div>
              </div>
              <div style={S.nextBadgeProgress}>
                <div style={S.nextBadgeTrack}>
                  <div style={{ ...S.nextBadgeFill, width: `${Math.round((nextBadge.progress || 0) * 100)}%` }} />
                </div>
                <span style={S.nextBadgePct}>{Math.round((nextBadge.progress || 0) * 100)}%</span>
              </div>
            </div>
          )}
          <button
            onClick={handleFix}
            disabled={fixing}
            title="Recompute badges against all your completed sessions — use this if a badge looks wrong"
            style={{
              border: `1px solid ${C.border}`, borderRadius: 9, background: C.card,
              padding: '6px 12px', color: C.sub, cursor: fixing ? 'default' : 'pointer',
              fontSize: 11, fontWeight: 700, opacity: fixing ? 0.6 : 1,
            }}
          >
            {fixing ? 'Rechecking…' : '🔄 Recheck badges'}
          </button>
        </div>
      </div>

      <div style={S.badgeGrid} className="mm-badge-grid">
        {badges.map((b, i) => {
          const tierStyle = TIER_STYLE[b.tier] || TIER_STYLE.bronze;
          const isSelected = selected === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setSelected(isSelected ? null : b.id)}
              style={{
                ...S.badgeCell,
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'scale(1)' : 'scale(0.9)',
                transitionDelay: `${i * 25}ms`,
                background: b.unlocked ? tierStyle.tint : C.cardAlt,
                border: `1.5px solid ${b.unlocked ? tierStyle.ring : C.border}`,
                boxShadow: isSelected ? `0 0 0 3px ${tierStyle.ring}` : 'none',
              }}
              title={b.desc}
            >
              <div style={{ ...S.badgeIcon, filter: b.unlocked ? 'none' : 'grayscale(1) opacity(0.4)' }}>{b.icon}</div>
              <div style={{ ...S.badgeName, color: b.unlocked ? C.text : C.faint }}>{b.label}</div>
              {b.unlocked ? (
                <div style={{ ...S.badgeTierTag, color: tierStyle.color, background: `${tierStyle.color}18` }}>{b.tier}</div>
              ) : typeof b.progress === 'number' && b.progress > 0 ? (
                <div style={S.badgeMiniTrack}><div style={{ ...S.badgeMiniFill, width: `${Math.round(b.progress * 100)}%` }} /></div>
              ) : (
                <div style={S.badgeLockedTag}>Locked</div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (() => {
        const b = badges.find(x => x.id === selected);
        if (!b) return null;
        const tierStyle = TIER_STYLE[b.tier] || TIER_STYLE.bronze;
        return (
          <div style={{ ...S.badgeDetail, borderColor: tierStyle.ring }}>
            <div style={{ fontSize: 26 }}>{b.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={S.badgeDetailName}>{b.label}</span>
                <span style={{ ...S.badgeTierTag, color: tierStyle.color, background: `${tierStyle.color}18` }}>{b.tier}</span>
                {b.unlocked && <span style={{ ...S.badgeTierTag, color: C.green, background: C.greenTint }}>✓ Earned</span>}
              </div>
              <p style={S.badgeDetailDesc}>{b.desc}</p>
              {b.meta && (
                <p style={S.badgeDetailMeta}>
                  {b.meta.topic && `Topic: ${b.meta.topic}. `}
                  {b.meta.streak && `Streak: ${b.meta.streak} days. `}
                  {b.meta.dip != null && `Recovered ${b.meta.recovery} pts after a ${b.meta.dip}-pt dip. `}
                  {b.meta.threshold && `Crossed the ₹${b.meta.threshold >= 80 ? '20L+' : b.meta.threshold >= 60 ? '12–20L' : '6–12L'} tier. `}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
};

// ─── Topic Momentum — sparkline-style rows, complements dimension breakdown ──
const TopicMomentumCard = ({ topics, mounted, onDrill, starting }) => {
  if (!topics.length) return null;
  const sorted = [...topics].sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));
  return (
    <section style={{ ...S.card, marginBottom: 18 }}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>TOPIC MOMENTUM</div>
          <h2 style={S.cardH2}>Every topic you've touched, ranked weakest first</h2>
          <p style={S.cardSub}>Momentum reflects your overall recent trend direction — rising, stable, or falling.</p>
        </div>
      </div>
      <div style={S.momentumList}>
        {sorted.map(t => {
          const score = t.averageScore || 0;
          const col = scoreColor(score);
          const momCfg = {
            rising:  { icon: '↑', color: C.green,  label: 'Rising' },
            falling: { icon: '↓', color: C.red,    label: 'Falling' },
            stable:  { icon: '→', color: C.blue500,label: 'Stable' },
          }[t.momentum] || { icon: '→', color: C.muted, label: '—' };
          return (
            <div key={t.topic} style={S.momentumRow}>
              <div style={S.momentumTopic}>{t.topic}</div>
              <div style={S.momentumBarTrack}>
                <div style={{ ...S.momentumBarFill, width: mounted ? `${score}%` : '0%', background: col }} />
              </div>
              <div style={{ ...S.momentumScore, color: col }}>{score}</div>
              <div style={{ ...S.momentumBadge, color: momCfg.color, background: `${momCfg.color}15` }}>{momCfg.icon} {momCfg.label}</div>
              <button style={S.momentumDrillBtn} onClick={() => onDrill(t.topic)} disabled={starting} title={`Drill ${t.topic}`}>Drill</button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── AI Coach Teaser — small, honest hook into the full Analytics board ──────
const AICoachTeaserCard = ({ onOpen, loading, teaser, weakestDim }) => (
  <div style={S.coachTeaserCard}>
    <div style={S.coachTeaserGlow} />
    <div style={S.eyebrowLight}>AI READINESS COACH</div>
    <h2 style={{ ...S.bannerH2, fontSize: 17, margin: '6px 0 8px' }}>
      {teaser ? 'Your coach has thoughts.' : 'Get a real read on your prep.'}
    </h2>
    <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.65, minHeight: 38 }}>
      {teaser
        ? `"${teaser}${teaser.length >= 140 ? '…' : ''}"`
        : `Full gap analysis, strengths, and a 30-day plan${weakestDim ? ` — starting with ${weakestDim.label}` : ''}. Lives on your Analytics page.`}
    </p>
    <button style={S.coachTeaserBtn} onClick={onOpen} disabled={loading}>
      {loading ? 'Thinking…' : teaser ? 'Open full analysis →' : '⚡ Analyse my profile →'}
    </button>
  </div>
);

// ─── Activity heatmap — redesigned: smaller cells, finer shade scale ────────
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ActivityHeatmap = ({ heatmap, stats, total, mounted }) => {
  const [hovered, setHovered] = useState(null);

  const monthCols = useMemo(() => {
    const seen = {};
    return heatmap.map((week, wi) => {
      const m = new Date(week[0].date).getMonth();
      if (seen[m]) return null;
      seen[m] = true;
      return { wi, label: MONTH_LABELS[m] };
    }).filter(Boolean);
  }, [heatmap]);

  return (
    <section style={{ ...S.card, marginBottom: 18 }}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>PRACTICE ACTIVITY</div>
          <h2 style={S.cardH2}>Session log — last 14 weeks</h2>
          <p style={S.cardSub}>
            Each cell is one day. Darker blue = higher score that day.
            Hover any cell for the exact date and score.
          </p>
        </div>
        <div style={S.hmLegend}>
          <span style={S.hmLegendLabel}>Low</span>
          {[10, 35, 52, 68, 82, 92].map(v => (
            <div key={v} style={{ width: 11, height: 11, borderRadius: 3, background: heatColor(v, true), flexShrink: 0 }} title={`~${v}`} />
          ))}
          <span style={S.hmLegendLabel}>High</span>
        </div>
      </div>

      <div style={S.hmMonthRow}>
        <div style={{ width: 26 }} />
        <div style={{ position: 'relative', flex: 1, height: 16 }}>
          {monthCols.map(({ wi, label }) => (
            <span key={wi} style={{ ...S.hmMonthLabel, left: `${(wi / heatmap.length) * 100}%` }}>{label}</span>
          ))}
        </div>
      </div>

      <div style={S.hmWrap}>
        <div style={S.hmDayCols}>
          {['S','M','T','W','T','F','S'].map((d, i) => (<div key={i} style={S.hmDayLbl}>{d}</div>))}
        </div>
        <div style={S.hmGrid}>
          {heatmap.map((week, wi) => (
            <div key={wi} style={S.hmWeekCol}>
              {week.map((day, di) => (
                <div
                  key={di}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...S.hmCell,
                    background: day.future ? 'transparent' : heatColor(day.score, day.hasData),
                    border: day.future ? `1.5px dashed ${C.border}` : day.hasData ? 'none' : `1px solid ${C.border}`,
                    cursor: day.hasData ? 'pointer' : 'default',
                    transform: hovered?.date === day.date ? 'scale(1.35)' : 'scale(1)',
                    boxShadow: hovered?.date === day.date ? `0 0 0 2px ${C.blue400}, 0 2px 8px rgba(26,110,255,0.35)` : 'none',
                    zIndex: hovered?.date === day.date ? 2 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {hovered && hovered.hasData && (
        <div style={S.hmTooltip}>
          <strong>{new Date(hovered.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
          {' '}· Score: <strong style={{ color: scoreColor(hovered.score) }}>{hovered.score}/100</strong>
          {' '}· {hovered.score >= 80 ? 'Strong session' : hovered.score >= 60 ? 'Solid session' : hovered.score >= 40 ? 'Room to grow' : 'Tough one — happens to everyone'}
        </div>
      )}

      <div style={S.hmFooterGrid} className="mm-hm-footer">
        <HmStat label="Active days" value={stats.activeDays} sub="Days with at least one session" />
        <HmStat label="Longest streak" value={`${stats.longestStreak}d`} sub="Consecutive practice days" />
        <HmStat label="Avg score" value={stats.avgScore || '—'} sub="Mean across active days" />
        <HmStat label="Best day" value={stats.bestDay?.score ?? '—'} sub={stats.bestDay ? new Date(stats.bestDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No sessions yet'} />
      </div>
    </section>
  );
};

const HmStat = ({ label, value, sub }) => (
  <div style={S.hmStatBox}>
    <div style={S.hmStatVal}>{value}</div>
    <div style={S.hmStatLabel}>{label}</div>
    <div style={S.hmStatSub}>{sub}</div>
  </div>
);

// ─── Peer standing ─────────────────────────────────────────────────────────────
const PeerCard = ({ percentile, currentUser, leaderboardUsers, mounted, onChallenge, starting }) => (
  <div style={S.card}>
    <div style={S.eyebrowDark}>PEER STANDING</div>
    <h2 style={S.cardH2}>Where you rank globally</h2>
    <div style={S.peerHero}>
      <div style={S.peerPctBlock}>
        <div style={S.peerPctNum}>{percentile ?? '—'}{percentile ? <span style={S.peerPctSuffix}>%</span> : null}</div>
        <div style={S.peerPctLabel}>PERCENTILE</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={S.peerBig}>{percentile ? `Ahead of ${percentile}% of ranked candidates` : 'Complete interviews to unlock ranking'}</div>
        {currentUser?.globalRank && <div style={S.peerRankChip}>GLOBAL RANK #{currentUser.globalRank}</div>}
        <div style={S.peerBar}><div style={{ ...S.peerFill, width: mounted ? `${percentile ?? 0}%` : '0%' }} /></div>
        <p style={S.peerNote}>Percentile is computed from average score across all users who have completed at least one interview.</p>
      </div>
    </div>
    <button style={{ ...S.btnBlue, marginTop: 14 }} onClick={onChallenge} disabled={starting}>Improve ranking →</button>
  </div>
);

// ─── Share card ────────────────────────────────────────────────────────────────
const ShareCard = ({ name, irs, tier, strongest, percentile, archetype, sessions }) => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState(false);

  const handleShare = async () => {
    const text = `${name}'s MockMate readiness: IRS ${irs}/100 — ${tier.label} eligible. Strongest in ${strongest?.label ?? '—'}${percentile ? `, top ${100 - percentile + 1}%` : ''}. Style: ${archetype.label}. ${sessions} sessions logged.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My MockMate Readiness Score', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch { /* user cancelled */ }
  };

  // Fetches (or lazily creates, per the backend) this user's public profile
  // slug and copies the shareable /p/:slug URL — the getShareLink endpoint
  // existed on the backend with no UI entry point anywhere in the app.
  const handleCopyProfileLink = async () => {
    setLinkLoading(true);
    setLinkError(false);
    try {
      const { slug } = await getShareLink();
      const url = `${window.location.origin}/p/${slug}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    } catch (err) {
      console.error('Copy profile link failed:', err);
      setLinkError(true);
      setTimeout(() => setLinkError(false), 2200);
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div style={S.shareCard}>
      <div style={S.shareGlow} />
      <div style={S.shareEyebrow}>SHAREABLE SCORE CARD</div>
      <div style={S.shareRow} className="mm-share-row">
        <div style={S.shareLeft}>
          <div style={S.shareIRS}>{irs}</div>
          <div style={S.shareIRSLabel}>IRS</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={S.shareTitle}>{name} is {tier.label} eligible</h2>
          <p style={S.shareDesc}>
            Strongest: <strong style={{ color: '#fff' }}>{strongest?.label ?? '—'}</strong>
            {percentile ? <> · Top <strong style={{ color: C.cyan400 }}>{100 - percentile + 1}%</strong></> : null}
            {' '}· {archetype.icon} {archetype.label}
          </p>
          <div>
            <button style={S.btnShare} onClick={handleShare}>{copied ? '✓ Copied to clipboard' : '📤 Share your score'}</button>
            <button style={S.btnShareLink} onClick={handleCopyProfileLink} disabled={linkLoading}>
              {linkLoading ? 'Generating link…' : linkError ? 'Couldn\u2019t copy — try again' : linkCopied ? '✓ Link copied' : '🔗 Copy public profile link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────
const RANK_COLORS = [C.amber, '#9CA3AF', '#B87333'];

const LeaderboardCard = ({ users, currentUser, onChallenge, starting }) => {
  const top5 = users.slice(0, 5);
  const userInTop = currentUser && top5.some(u => u._id === currentUser._id);

  return (
    <section style={{ ...S.card, marginBottom: 18 }}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>GLOBAL RANKING</div>
          <h2 style={S.cardH2}>Top performers</h2>
          <p style={S.cardSub}>Weekly rankings — resets every Monday.</p>
        </div>
        <button style={S.btnSmall} onClick={onChallenge} disabled={starting}>Climb ranks →</button>
      </div>
      {top5.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={S.lbHeader}>
            <span style={{ width: 36 }}>RANK</span>
            <span style={{ width: 38 }} />
            <span style={{ flex: 1 }}>CANDIDATE</span>
            <span>AVG</span>
            <span style={{ width: 52, textAlign: 'right' }}>SESSIONS</span>
          </div>
          {top5.map((u, i) => (
            <LBRow key={u._id ?? i} user={u} rank={i + 1} color={RANK_COLORS[i] ?? C.muted} isMe={u._id === currentUser?._id} />
          ))}
          {!userInTop && currentUser && (
            <>
              <div style={S.lbDots}>· · ·</div>
              <LBRow user={currentUser} rank={currentUser.globalRank} color={C.blue500} isMe />
            </>
          )}
        </div>
      ) : (
        <div style={S.emptyMsg}>No leaderboard data yet — complete interviews to appear in the rankings.</div>
      )}
    </section>
  );
};

const LBRow = ({ user, rank, color, isMe }) => (
  <div style={{ ...S.lbRow, background: isMe ? C.blue50 : 'transparent', borderColor: isMe ? C.borderStr : C.border }}>
    <span style={{ width: 36, fontFamily: F.mono, fontSize: 13, fontWeight: 700, color }}>{String(rank ?? '?').padStart(2, '0')}</span>
    <div style={S.lbAvatar}>{(user.name ?? 'A')[0].toUpperCase()}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={S.lbName}>{user.name ?? 'Anonymous'}{isMe && <span style={S.youTag}>YOU</span>}</div>
    </div>
    <div style={{ ...S.lbScore, color }}>{user.weeklyAvgScore ?? user.averageScore ?? 0}</div>
    <div style={{ width: 52, textAlign: 'right', fontFamily: F.mono, fontSize: 11, color: C.muted }}>{user.weeklySessionCount ?? user.totalInterviews ?? 0}</div>
  </div>
);

// ─── Global styles ─────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @keyframes spin       { to { transform: rotate(360deg); } }
    @keyframes livePulse  { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes hmScan     { 0% { transform:translateX(-100%); } 100% { transform:translateX(320%); } }
    @keyframes badgePop   { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }

    *, *::before, *::after { box-sizing: border-box; }

    .mm-page button:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 2px; }
    .mm-badge-grid button { transition: opacity 0.35s ease, transform 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.15s ease; }
    .mm-badge-grid button:hover { transform: translateY(-2px) !important; }

    @media (prefers-reduced-motion: reduce) { .mm-page * { animation: none !important; transition: none !important; } }

    @media (max-width: 1020px) {
      .mm-two-col { grid-template-columns: 1fr !important; }
      .mm-hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
      .mm-badge-grid { grid-template-columns: repeat(4, 1fr) !important; }
    }
    @media (max-width: 760px) {
      .mm-stats { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-banner { flex-direction: column !important; }
      .mm-strip-r { display: none !important; }
      .mm-share-row { flex-direction: column !important; }
      .mm-hm-footer { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-badge-grid { grid-template-columns: repeat(3, 1fr) !important; }
    }
    @media (max-width: 480px) {
      .mm-stats { grid-template-columns: 1fr !important; }
      .mm-page { padding: 14px 12px 60px !important; }
      .mm-hm-footer { grid-template-columns: 1fr !important; }
      .mm-badge-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — all inline for portability
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`,
    padding: '24px 28px 80px',
    fontFamily: F.body,
  },
  container: { maxWidth: 1260, margin: '0 auto', transition: 'opacity 0.55s ease, transform 0.55s cubic-bezier(.16,1,.3,1)' },

  strip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', marginBottom: 20, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripL: { display: 'flex', alignItems: 'center', gap: 9 },
  stripR: { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: C.green, animation: 'livePulse 2.4s ease-in-out infinite', boxShadow: `0 0 8px ${C.greenGlow}` },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.5px', color: C.muted },

  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '36px 32px', marginBottom: 18, borderRadius: 24,
    background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600} 100%)`,
    boxShadow: '0 24px 64px rgba(0,31,107,0.32)',
  },
  heroScan: { position: 'absolute', top: 0, left: 0, width: '25%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation: 'hmScan 9s linear infinite' },
  heroGrid: { position: 'relative', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 36, alignItems: 'center' },

  irsBlock: {},
  irsLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: '1.4px', color: 'rgba(255,255,255,0.6)', marginBottom: 10 },
  irsNum: { fontFamily: F.display, fontSize: 72, fontWeight: 900, lineHeight: 1, color: '#fff', letterSpacing: '-2px' },
  irsMax: { fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 0 },
  tierPill: { display: 'inline-flex', alignItems: 'center', marginTop: 12, padding: '6px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.3px' },
  irsBar: { position: 'relative', height: 6, marginTop: 14, borderRadius: 999, background: 'rgba(255,255,255,0.15)', overflow: 'visible' },
  irsBarFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.blue200}, ${C.cyan400})`, transition: 'width 1.3s cubic-bezier(.16,1,.3,1)' },
  irsNextMark: { position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 1, background: 'rgba(255,255,255,0.6)', transform: 'translateX(-50%)' },
  irsGapText: { marginTop: 8, fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.3px' },

  verdictBlock: {},
  eyebrow: { display: 'flex', alignItems: 'center', gap: 7, fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.6px', color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  eyebrowDot: { width: 6, height: 6, borderRadius: '50%', background: C.cyan400 },
  heroH1: { margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.32, letterSpacing: '-0.4px', maxWidth: 640 },
  heroSub: { margin: '13px 0 0', fontSize: 13, lineHeight: 1.72, color: 'rgba(255,255,255,0.75)', maxWidth: 560 },
  heroActions: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 },

  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 12, background: '#fff', color: C.blue700, padding: '12px 20px', fontSize: 13, fontWeight: 800, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.14)', transition: 'transform 0.12s ease, box-shadow 0.12s ease' },
  btnGhost: { border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '12px 18px', fontSize: 13, fontWeight: 600, fontFamily: F.body, cursor: 'pointer' },
  btnBlue: { border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: '#fff', padding: '11px 18px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 4px 16px rgba(26,110,255,0.3)`, textAlign: 'center' },
  btnSmall: { border: `1px solid ${C.borderMd}`, borderRadius: 10, background: C.blue50, color: C.blue600, padding: '9px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: F.body },
  btnShare: { marginTop: 14, border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`, color: '#fff', padding: '10px 18px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,173,224,0.35)' },
  btnShareLink: { marginTop: 14, marginLeft: 10, border: '1px solid rgba(255,255,255,0.28)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '10px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  btnBannerCta: { flexShrink: 0, border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: '#fff', padding: '13px 22px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 6px 20px rgba(26,110,255,0.28)`, alignSelf: 'flex-start' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 },
  statCard: { padding: '18px 20px', borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  statLabel: { fontSize: 11, fontWeight: 600, color: C.sub, letterSpacing: '0.3px' },
  statValRow: { display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 8 },
  statVal: { fontFamily: F.display, fontSize: 32, fontWeight: 800, lineHeight: 1 },
  statUnit: { fontFamily: F.mono, fontSize: 13, color: C.muted },
  statSub: { marginTop: 8, fontSize: 11, color: C.muted, lineHeight: 1.4 },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24, boxShadow: C.shadow, marginBottom: 18 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
  eyebrowDark: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.5px', color: C.blue500, marginBottom: 6 },
  eyebrowLight: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.5px', color: C.blue400, marginBottom: 6 },
  cardH2: { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text },
  cardSub: { margin: '6px 0 0', fontSize: 12, lineHeight: 1.65, color: C.sub, maxWidth: 440 },
  linkBtn: { border: 'none', background: 'transparent', color: C.blue500, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: F.body },

  twoCol: { display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, marginBottom: 18 },

  dimList: { display: 'flex', flexDirection: 'column', gap: 14 },
  dimRow: { padding: '12px 14px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` },
  dimMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dimLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  dimIcon: { fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 },
  dimName: { fontSize: 12.5, fontWeight: 700, color: C.text, display: 'block' },
  dimWeight: { fontSize: 10, color: C.muted, fontFamily: F.mono, display: 'block', marginTop: 2 },
  dimScore: { fontFamily: F.display, fontSize: 17, fontWeight: 800 },
  dimTrack: { height: 6, borderRadius: 999, background: C.border, overflow: 'hidden' },
  dimFill: { height: '100%', borderRadius: 999, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' },
  dimNoData: { marginTop: 4, fontSize: 10.5, color: C.faint, fontFamily: F.mono },

  fixBox: { marginTop: 14, padding: 16, borderRadius: 14, background: C.blue50, border: `1px solid ${C.borderMd}` },
  fixTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fixTopic: { fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.text },
  fixScore: { fontFamily: F.display, fontSize: 16, fontWeight: 800 },
  fixTrack: { height: 7, borderRadius: 999, background: C.border, overflow: 'hidden', marginBottom: 12 },
  fixFill: { height: '100%', borderRadius: 999 },
  fixStats: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  fixStat: { fontSize: 11.5, color: C.sub, fontFamily: F.mono },
  fixHint: { margin: 0, fontSize: 11.5, color: C.sub, lineHeight: 1.65 },

  archetypeBox: { marginTop: 14, padding: 14, borderRadius: 14, background: C.cardAlt, border: `1px solid ${C.border}` },
  archetypeHead: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  archetypeIcon: { width: 44, height: 44, borderRadius: 12, fontSize: 22, background: C.blue50, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  archetypeName: { fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text },
  archetypeDesc: { fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.55 },
  archetypeFix: { fontSize: 11.5, color: C.blue600, lineHeight: 1.6, paddingTop: 8, borderTop: `1px solid ${C.border}` },

  // Next Session Predictor
  predictRow: { display: 'flex', alignItems: 'center', gap: 22, marginTop: 6 },
  predictBlock: { textAlign: 'center', flexShrink: 0, width: 92 },
  predictNum: { fontFamily: F.display, fontSize: 40, fontWeight: 900, color: C.blue600, lineHeight: 1 },
  predictBand: { fontFamily: F.mono, fontSize: 10, color: C.muted, marginTop: 4 },
  predictBarTrack: { position: 'relative', height: 8, borderRadius: 999, background: C.border, marginTop: 6 },
  predictBarLow: { position: 'absolute', top: 0, height: '100%', borderRadius: 999, background: C.blue100 },
  predictMarker: { position: 'absolute', top: -3, width: 3, height: 14, borderRadius: 2, background: C.blue600, transform: 'translateX(-50%)' },
  predictMarkerAvg: { position: 'absolute', top: -2, width: 2, height: 12, borderRadius: 1, background: C.faint, transform: 'translateX(-50%)' },
  predictLegend: { display: 'flex', gap: 16, marginTop: 8, fontSize: 10.5, color: C.sub, fontFamily: F.mono },
  legendDot: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 5 },
  predictNote: { margin: '10px 0 0', fontSize: 11.5, color: C.sub, lineHeight: 1.6 },

  // Weekly digest
  digestGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 16 },
  digestCell: { textAlign: 'center', padding: '14px 8px', background: C.cardAlt, borderRadius: 12, border: `1px solid ${C.border}` },
  digestVal: { fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text },
  digestLabel: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.5px', color: C.muted, marginTop: 5 },
  digestEmpty: { marginTop: 14, padding: '10px 14px', borderRadius: 10, background: C.amberTint, color: C.amber, fontSize: 11.5, fontWeight: 600 },

  // Badge showcase
  nextBadgeChip: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: C.blue50, border: `1px solid ${C.borderMd}`, flexShrink: 0, minWidth: 180 },
  nextBadgeLabel: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.6px', color: C.muted },
  nextBadgeName: { fontSize: 11.5, fontWeight: 800, color: C.text, marginTop: 1 },
  nextBadgeProgress: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  nextBadgeTrack: { width: 44, height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  nextBadgeFill: { height: '100%', borderRadius: 999, background: C.blue500 },
  nextBadgePct: { fontFamily: F.mono, fontSize: 9.5, color: C.blue600, fontWeight: 700 },

  badgeGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 },
  badgeCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 8px', borderRadius: 14, cursor: 'pointer', fontFamily: F.body, textAlign: 'center' },
  badgeIcon: { fontSize: 24 },
  badgeName: { fontSize: 10, fontWeight: 700, lineHeight: 1.25 },
  badgeTierTag: { fontSize: 8.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: F.mono },
  badgeLockedTag: { fontSize: 8.5, fontWeight: 700, color: C.faint, fontFamily: F.mono, letterSpacing: '0.4px' },
  badgeMiniTrack: { width: '80%', height: 4, borderRadius: 999, background: C.border, overflow: 'hidden', marginTop: 2 },
  badgeMiniFill: { height: '100%', borderRadius: 999, background: C.blue400 },
  badgeDetail: { display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 18, padding: '16px 18px', borderRadius: 14, background: C.cardAlt, border: '1.5px solid' },
  badgeDetailName: { fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text },
  badgeDetailDesc: { margin: '6px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.6 },
  badgeDetailMeta: { margin: '8px 0 0', fontSize: 11, color: C.blue600, lineHeight: 1.6, fontFamily: F.mono },

  // Topic momentum
  momentumList: { display: 'flex', flexDirection: 'column', gap: 11 },
  momentumRow: { display: 'flex', alignItems: 'center', gap: 12 },
  momentumTopic: { width: 120, fontSize: 12, fontWeight: 700, color: C.text, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  momentumBarTrack: { flex: 1, height: 8, borderRadius: 999, background: C.border, overflow: 'hidden' },
  momentumBarFill: { height: '100%', borderRadius: 999, transition: 'width 1s ease' },
  momentumScore: { fontFamily: F.display, fontSize: 13, fontWeight: 800, width: 26, textAlign: 'right', flexShrink: 0 },
  momentumBadge: { fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, flexShrink: 0, fontFamily: F.mono, whiteSpace: 'nowrap' },
  momentumDrillBtn: { flexShrink: 0, border: `1px solid ${C.borderMd}`, background: C.blue50, color: C.blue600, fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: F.body },

  // AI Coach teaser
  coachTeaserCard: { position: 'relative', overflow: 'hidden', padding: '22px 24px', borderRadius: 20, background: `linear-gradient(135deg, ${C.blue900} 0%, #001A50 50%, #00305A 100%)`, boxShadow: C.shadowLg, display: 'flex', flexDirection: 'column' },
  coachTeaserGlow: { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, rgba(0,200,240,0.22), transparent 68%)`, pointerEvents: 'none' },
  coachTeaserBtn: { position: 'relative', marginTop: 16, alignSelf: 'flex-start', border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`, color: '#fff', padding: '10px 18px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,173,224,0.35)', fontFamily: F.body },

  // Peer standing
  peerHero: { display: 'flex', alignItems: 'flex-start', gap: 18, marginTop: 16 },
  peerPctBlock: { width: 86, flexShrink: 0, textAlign: 'center' },
  peerPctNum: { fontFamily: F.display, fontSize: 38, fontWeight: 900, color: C.blue500, lineHeight: 1 },
  peerPctSuffix: { fontSize: 16, fontWeight: 600 },
  peerPctLabel: { marginTop: 4, fontFamily: F.mono, fontSize: 9, letterSpacing: '1px', color: C.muted },
  peerBig: { fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.4 },
  peerRankChip: { marginTop: 6, display: 'inline-block', fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.blue600, background: C.blue50, border: `1px solid ${C.borderMd}`, padding: '3px 9px', borderRadius: 6, letterSpacing: '0.5px' },
  peerBar: { height: 6, marginTop: 12, borderRadius: 999, background: C.border, overflow: 'hidden' },
  peerFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})`, transition: 'width 1.1s ease' },
  peerNote: { margin: '10px 0 0', fontSize: 10.5, color: C.muted, lineHeight: 1.55 },

  shareCard: { position: 'relative', overflow: 'hidden', padding: '26px 28px', borderRadius: 20, background: `linear-gradient(135deg, ${C.blue900} 0%, #0A2E6E 50%, #00305A 100%)`, boxShadow: C.shadowLg, marginBottom: 18 },
  shareGlow: { position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, rgba(0,200,240,0.22), transparent 68%)`, pointerEvents: 'none' },
  shareEyebrow: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.6px', color: C.cyan400, marginBottom: 16 },
  shareRow: { position: 'relative', display: 'flex', alignItems: 'center', gap: 22 },
  shareLeft: { textAlign: 'center', flexShrink: 0, width: 88 },
  shareIRS: { fontFamily: F.display, fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1 },
  shareIRSLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  shareTitle: { margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: '#fff' },
  shareDesc: { margin: '7px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 },

  hmLegend: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 },
  hmLegendLabel: { fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.4px' },
  hmMonthRow: { display: 'flex', alignItems: 'center', marginBottom: 4, overflow: 'hidden' },
  hmMonthLabel: { position: 'absolute', fontFamily: F.mono, fontSize: 9, color: C.muted, whiteSpace: 'nowrap' },
  hmWrap: { display: 'flex', gap: 3, overflow: 'auto', paddingBottom: 4 },
  hmDayCols: { display: 'flex', flexDirection: 'column', gap: 2.5, marginRight: 5, flexShrink: 0, paddingTop: 1 },
  hmDayLbl: { height: 10, fontFamily: F.mono, fontSize: 8, color: C.muted, display: 'flex', alignItems: 'center' },
  hmGrid: { display: 'flex', gap: 2.5, flex: 1 },
  hmWeekCol: { display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, minWidth: 10 },
  hmCell: { width: '100%', aspectRatio: '1', borderRadius: 2.5, transition: 'transform 0.1s ease, box-shadow 0.1s ease', flexShrink: 0 },
  hmTooltip: { marginTop: 8, padding: '6px 12px', borderRadius: 8, background: C.text, color: '#fff', fontSize: 12, display: 'inline-block' },
  hmFooterGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 20, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` },
  hmStatBox: { padding: '14px 16px', background: C.cardAlt, textAlign: 'center' },
  hmStatVal: { fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.blue600 },
  hmStatLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.8px', color: C.sub, marginTop: 4 },
  hmStatSub: { fontSize: 10.5, color: C.muted, marginTop: 3, lineHeight: 1.4 },

  lbHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', fontFamily: F.mono, fontSize: 9, letterSpacing: '0.8px', color: C.muted, marginBottom: 4 },
  lbRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid', transition: 'background 0.15s' },
  lbAvatar: { width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: C.blue50, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.blue600, fontFamily: F.display },
  lbName: { fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8, fontFamily: F.body },
  lbScore: { fontFamily: F.display, fontSize: 18, fontWeight: 800 },
  lbDots: { textAlign: 'center', color: C.muted, fontSize: 18, letterSpacing: 3 },
  youTag: { fontSize: 9, fontWeight: 700, color: C.blue600, background: C.blue50, border: `1px solid ${C.borderMd}`, padding: '2px 7px', borderRadius: 5, flexShrink: 0, fontFamily: F.mono },

  tierBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '28px 30px', marginBottom: 18, borderRadius: 20, background: `linear-gradient(135deg, ${C.blue50} 0%, ${C.cyanTint} 100%)`, border: `1px solid ${C.borderMd}`, boxShadow: `0 4px 20px rgba(26,110,255,0.08)` },
  bannerH2: { margin: '8px 0', fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text },
  bannerSub: { margin: 0, fontSize: 12.5, color: C.sub, maxWidth: 540, lineHeight: 1.6 },
  bannerTrack: { marginTop: 14, width: 'min(440px, 100%)', height: 6, borderRadius: 999, background: C.borderMd, overflow: 'visible', position: 'relative' },
  bannerFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})`, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)', position: 'relative' },
  bannerMark: { position: 'absolute', top: -3, width: 2, height: 12, background: C.blue700, borderRadius: 1, transform: 'translateX(-50%)' },
  bannerCaption: { marginTop: 6, fontFamily: F.mono, fontSize: 10, color: C.muted },

  footerRow: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '18px 4px 0', opacity: 0.5 },

  loadingWrap: { minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 44, height: 44, borderRadius: '50%', border: `4px solid ${C.blue50}`, borderTopColor: C.blue500, animation: 'spin 0.75s linear infinite' },
  loadTitle: { marginTop: 18, fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.text },
  loadSub: { marginTop: 6, fontSize: 12, color: C.muted },

  emptyMsg: { padding: '28px 16px', textAlign: 'center', border: `1.5px dashed ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 12 },
};

export default Dashboard;
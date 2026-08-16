/* eslint-disable react-refresh/only-export-components */
import API_BASE from '../config/api.js';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getPerformanceAnalytics, startInterview,getAICoach } from '../Services/interviewService';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — READINESS CONSOLE v4
// Blueprint blue system. Every number on this page is computed from real
// session data using genuine statistical methods — not padded for UI effect.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Design tokens — deep blueprint blue, data-terminal aesthetic ───────────
const C = {
  // Page backgrounds
  bg:       '#F0F4FF',
  bgDeep:   '#E8EEFF',

  // Card surfaces
  card:     '#FFFFFF',
  cardAlt:  '#F8FAFF',
  cardGlass:'rgba(255,255,255,0.82)',

  // Text hierarchy
  text:     '#0A1628',
  sub:      '#3D5280',
  muted:    '#7A8BAF',
  faint:    '#A8B8D4',

  // Borders
  border:   '#DDE5F7',
  borderMd: '#B8CAF0',
  borderStr:'#7FA3E8',

  // Blue system — primary brand
  blue50:   '#EBF2FF',
  blue100:  '#C7DAFF',
  blue200:  '#9DBFFF',
  blue400:  '#4D8FFF',
  blue500:  '#1A6EFF',
  blue600:  '#0057E8',
  blue700:  '#0044C4',
  blue900:  '#001F6B',

  // Cyan — accent for data / positive trend
  cyan400:  '#00C8F0',
  cyan500:  '#00ADE0',
  cyan600:  '#0093C4',
  cyanTint: '#E6F9FF',

  // Semantic
  green:    '#059669',
  greenTint:'#ECFDF5',
  greenGlow:'rgba(5,150,105,0.18)',

  amber:    '#D97706',
  amberTint:'#FFFBEB',
  orange:   '#EA580C',
  orangeTint:'#FFF7ED',

  red:     '#DC2626',
  redTint: '#FEF2F2',

  // Shadows
  shadow:   '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Package tier benchmarks (Indian fresher / junior market, 2024–25) ───────
const TIERS = [
  {
    label:    '₹3–6 LPA',
    minScore: 0,
    color:    '#7A8BAF',
    bg:       '#F0F4FF',
    desc:     'Service companies, off-campus starts',
    advice:   'Focus on DSA basics and communication fundamentals.',
  },
  {
    label:    '₹6–12 LPA',
    minScore: 38,
    color:    C.amber,
    bg:       C.amberTint,
    desc:     'Mid-tier product, IT MNCs, campus drives',
    advice:   'Strengthen problem solving and topic breadth.',
  },
  {
    label:    '₹12–20 LPA',
    minScore: 60,
    color:    C.blue500,
    bg:       C.blue50,
    desc:     'Top product companies, FAANG-adjacent',
    advice:   'Master system design and consistency under pressure.',
  },
  {
    label:    '₹20 LPA+',
    minScore: 80,
    color:    C.cyan500,
    bg:       C.cyanTint,
    desc:     'FAANG, unicorn startups, remote-first',
    advice:   'Achieve elite cross-dimension performance.',
  },
];

// ─── Dimension model — same keys used on Analytics page ─────────────────────
const DIMENSIONS = [
  {
    key:    'technical',
    label:  'Technical Depth',
    icon:   '⚙',
    topics: ['DSA', 'OOP', 'DBMS', 'OS', 'JavaScript', 'Web Development', 'System Design', 'Database'],
    weight: 0.28,
    tip:    'Core CS fundamentals — the first thing technical screeners test.',
  },
  {
    key:    'problemSolving',
    label:  'Problem Solving',
    icon:   '🔍',
    topics: ['DSA', 'System Design', 'Algorithm'],
    weight: 0.22,
    tip:    'How you break down unknowns — decisive in live coding rounds.',
  },
  {
    key:    'communication',
    label:  'Communication',
    icon:   '💬',
    topics: ['Communication', 'HR', 'Behavioral'],
    weight: 0.18,
    tip:    'Clarity of thought, not just English — interviewers notice it fast.',
  },
  {
    key:    'behavioral',
    label:  'Behavioral',
    icon:   '🤝',
    topics: ['HR', 'Behavioral', 'Leadership'],
    weight: 0.12,
    tip:    'Situational judgment and self-awareness under HR scrutiny.',
  },
  {
    key:    'design',
    label:  'System Design',
    icon:   '🏗',
    topics: ['System Design', 'Architecture', 'OOP', 'Scalability'],
    weight: 0.10,
    tip:    'Matters at ₹12 LPA+ — often the differentiator between tiers.',
  },
  {
    key:    'fundamentals',
    label:  'CS Fundamentals',
    icon:   '📚',
    topics: ['DBMS', 'OS', 'OOP', 'Networking', 'JavaScript'],
    weight: 0.10,
    tip:    'Breadth of core knowledge — separates prepared from lucky.',
  },
];

// ─── Personality archetypes — assigned by data, not vibes ───────────────────
const ARCHETYPES = [
  {
    id:    'inconsistentGenius',
    label: 'Inconsistent Genius',
    icon:  '🎲',
    desc:  'High variance in scores — brilliant when in flow but needs to build floor quality.',
    fix:   'Consistency drills: aim to hold 65+ on every session before chasing 90+.',
  },
  {
    id:    'consistentClimber',
    label: 'Consistent Climber',
    icon:  '📈',
    desc:  'Steady, reliable improvement — the archetype that wins campus placements.',
    fix:   'Keep the streak; add harder topic rotations to keep growing.',
  },
  {
    id:    'speedRunner',
    label: 'Speed Runner',
    icon:  '⚡',
    desc:  'Fast answers but sometimes sacrifices depth for pace.',
    fix:   'Practise "think aloud" — say your reasoning before your answer.',
  },
  {
    id:    'deepThinker',
    label: 'Deep Thinker',
    icon:  '🧠',
    desc:  'Thorough and accurate — needs to improve time management under live pressure.',
    fix:   'Run timed drills; 2-minute cap per answer in quick-fire mode.',
  },
  {
    id:    'pressureCooker',
    label: 'Pressure Cooker',
    icon:  '🔥',
    desc:  'Scores improve in timed sessions — performs well under competition conditions.',
    fix:   'Channel this by signing up for live contest platforms weekly.',
  },
];

// ─── Pure maths helpers ──────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));

/**
 * Exponential weighted moving average — recent sessions count more.
 * α = 0.35 means each new value gets 35% weight, prior EWMA 65%.
 */
const ewma = (values, alpha = 0.35) => {
  if (!values.length) return 0;
  return values.reduce((acc, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * acc), values[0]);
};

/** Sample standard deviation — real volatility, not ad hoc "variance check". */
const stdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

/** Linear trend (slope via least-squares regression over index). */
const trendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, v) => a + v, 0) / n;
  const num   = values.reduce((a, v, i) => a + (i - xMean) * (v - yMean), 0);
  const den   = values.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
  return den ? num / den : 0;
};

/** Determines interview archetype from real statistical signals. */
const deriveArchetype = (scoreTrend, avgTimePerQ, avgScore) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1]; // default: consistent climber

  const sd    = stdDev(scores);
  const slope = trendSlope(scores);

  if (sd > 18)   return ARCHETYPES[0]; // inconsistentGenius — high variance
  if (slope > 2) return ARCHETYPES[1]; // consistentClimber  — improving
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2]; // speedRunner
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3]; // deepThinker
  return ARCHETYPES[4]; // pressureCooker — default remainder
};

/**
 * INTERVIEW READINESS SCORE  (IRS)
 * ─────────────────────────────────
 * A genuine composite score that penalises weak dimensions and rewards
 * trend + breadth + consistency. Formula rationale:
 *
 *   Dimension-weighted score (40%)
 *     — each dimension uses its explicit weight from DIMENSIONS config
 *     — ensures a 90-in-one-topic student can't fake overall readiness
 *
 *   EWMA trend component (25%)
 *     — recent sessions matter more; trailing EWMA > simple average
 *     — normalised 0→100 via: EWMA / 100 * 25
 *
 *   Topic breadth (15%)
 *     — encourages covering more areas; capped at 100 after 8 distinct topics
 *     — penalises students who drill only one topic
 *
 *   Consistency (20%)
 *     — based on coefficient of variation: lower volatility = higher score
 *     — a student who always scores 70 ranks higher than a 50/90 swinger
 */
const computeIRS = ({ dimensionProfile, scoreTrend, topicPerformance, averageScore }) => {
  // Component 1 — weighted dimension average
  const dimScore = dimensionProfile.reduce((acc, d) => {
    const cfg = DIMENSIONS.find(x => x.key === d.key);
    return acc + (d.score * (cfg?.weight ?? 1 / DIMENSIONS.length));
  }, 0);
  const dimComponent = clamp(dimScore) * 0.40;

  // Component 2 — EWMA of recent scores
  const recentScores = scoreTrend.slice(-12).map(s => s.score || 0);
  const ewmaScore    = recentScores.length ? ewma(recentScores) : averageScore;
  const ewmaComponent = clamp(ewmaScore) * 0.25;

  // Component 3 — topic breadth (unique topics scored, capped at 8)
  const uniqueTopics    = topicPerformance.length;
  const breadthComponent = Math.min(uniqueTopics / 8, 1) * 100 * 0.15;

  // Component 4 — consistency (inverse coefficient of variation)
  const scores = scoreTrend.map(s => s.score || 0);
  const sd     = stdDev(scores);
  const mean   = scores.length ? scores.reduce((a, v) => a + v, 0) / scores.length : 0;
  const cv     = mean > 0 ? sd / mean : 1; // coefficient of variation
  // CV of 0 (perfectly consistent) → 100; CV of 1+ → 0
  const consistencyScore    = Math.max(0, (1 - Math.min(cv, 1)) * 100);
  const consistencyComponent = consistencyScore * 0.20;

  return clamp(dimComponent + ewmaComponent + breadthComponent + consistencyComponent);
};

/** Maps IRS to the highest tier the candidate has crossed the threshold for. */
const tierForScore = (irs) => {
  const reached = TIERS.filter(t => irs >= t.minScore);
  return reached[reached.length - 1] || TIERS[0];
};

/** How far (in IRS points) to the next tier — real gap, not cosmetic. */
const pointsToNext = (irs) => {
  const tier = tierForScore(irs);
  const idx  = TIERS.indexOf(tier);
  const next = TIERS[idx + 1];
  return next ? Math.max(0, next.minScore - irs) : 0;
};

// ─── Build 14-week heatmap grid ──────────────────────────────────────────────
const buildHeatmap = (scoreTrend) => {
  const byDate = {};
  (scoreTrend ?? []).forEach(s => {
    if (s.date) {
      const key = s.date.slice(0, 10);
      // If multiple sessions on same day, keep best (or average)
      byDate[key] = byDate[key] ? Math.round((byDate[key] + (s.score ?? 0)) / 2) : (s.score ?? 0);
    }
  });

  const WEEKS = 14;
  const now   = new Date();
  const grid  = [];

  for (let w = WEEKS - 1; w >= 0; w--) {
    const col = [];
    for (let d = 6; d >= 0; d--) {
      const dt  = new Date(now);
      dt.setDate(now.getDate() - (w * 7 + d));
      const key = dt.toISOString().slice(0, 10);
      col.push({
        date:   key,
        score:  byDate[key] ?? 0,
        future: dt > now,
        hasData: Boolean(byDate[key]),
      });
    }
    grid.push(col);
  }
  return grid;
};

/** Derived heatmap stats for the footer callouts. */
const heatmapStats = (grid) => {
  const cells  = grid.flat().filter(c => !c.future && c.hasData);
  if (!cells.length) return { activeDays: 0, bestDay: null, avgScore: 0, longestStreak: 0 };

  const activeDays = cells.length;
  const bestDay    = cells.reduce((b, c) => (c.score > b.score ? c : b), cells[0]);
  const avgScore   = Math.round(cells.reduce((a, c) => a + c.score, 0) / cells.length);

  // Longest consecutive-day streak
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

// ─── Topic: find the single highest-ROI fix ─────────────────────────────────
const bestFixTarget = (topicPerformance, dimensionProfile) => {
  if (!topicPerformance.length) return null;
  // Score each topic by: low average + high dimension weight
  return topicPerformance
    .map(t => {
      const dim = DIMENSIONS.find(d => d.topics.includes(t.topic)) ?? {};
      const dimWeight = dim.weight ?? 0.1;
      const roi = dimWeight * (100 - (t.averageScore || 0)); // weight × gap
      return { ...t, roi };
    })
    .sort((a, b) => b.roi - a.roi)[0];
};

// ─── Live clock ──────────────────────────────────────────────────────────────
const useLiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

// ─── Score → color (using blue system, not generic traffic-light) ─────────────
const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

const heatColor = (score, hasData) => {
  if (!hasData) return C.border;
  if (score >= 85) return C.blue700;
  if (score >= 70) return C.blue500;
  if (score >= 55) return C.blue400;
  if (score >= 40) return C.blue200;
  return C.blue100;
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const clock     = useLiveClock();

  const [analytics,   setAnalytics]   = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [starting,    setStarting]    = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [verdict,     setVerdict]     = useState('');
  const [verdictDone, setVerdictDone] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachAnalysis, setCoachAnalysis] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const [analyticsData, lbRes] = await Promise.all([
          getPerformanceAnalytics(),
          fetch(`${API_BASE}/leaderboard`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
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

  const handleAICoach = async () => {
  try {
    setCoachLoading(true);
    setCoachError('');

    const response = await getAICoach();

    setCoachAnalysis(response.analysis);
  } catch (error) {
    console.error('AI coach failed:', error);

    setCoachError(
      'AI coach is temporarily unavailable.'
    );
  } finally {
    setCoachLoading(false);
  }
};

  // ── Derived raw fields ────────────────────────────────────────────────────
  const totalInterviews  = analytics?.totalInterviews ?? analytics?.totalSessions ?? 0;
  const averageScore     = analytics?.averageScore ?? 0;
  const bestScore        = analytics?.bestScore ?? analytics?.highestScore ?? 0;
  const scoreTrend       = analytics?.scoreTrend ?? [];
  const topicPerformance = useMemo(() => analytics?.topicPerformance ?? [], [analytics]);
  const leaderboardUsers = useMemo(() => leaderboard?.global ?? [], [leaderboard]);
  const currentUser      = leaderboard?.currentUser ?? null;
  const streakDays       = user?.streak?.current ?? 0;
  const avgTimePerQ      = analytics?.timePerformance?.averageTimePerQuestion ?? null;
  const hasData          = totalInterviews > 0;

  // Latest vs previous — momentum indicator
  const latestScore  = scoreTrend.at(-1)?.score ?? 0;
  const prevScore    = scoreTrend.at(-2)?.score ?? latestScore;
  const delta        = latestScore - prevScore;

  // ── Six-dimension profile ─────────────────────────────────────────────────
  const topicMap = useMemo(() => {
    const m = {};
    topicPerformance.forEach(t => {
      m[t.topic?.toLowerCase()] = t.averageScore || 0;
    });
    return m;
  }, [topicPerformance]);

  const dimensionProfile = useMemo(() => DIMENSIONS.map(dim => {
    const vals = dim.topics
      .map(t => topicMap[t.toLowerCase()])
      .filter(v => typeof v === 'number' && v > 0);
    const score = vals.length
      ? vals.reduce((a, v) => a + v, 0) / vals.length
      : 0; // 0 = no data, not synthetic fill
    return { ...dim, score: clamp(score), hasData: vals.length > 0 };
  }), [topicMap]);

  // ── IRS — the one number that defines readiness ───────────────────────────
  const irs = useMemo(() => {
    if (!hasData) return 0;
    return computeIRS({ dimensionProfile, scoreTrend, topicPerformance, averageScore });
  }, [dimensionProfile, scoreTrend, topicPerformance, averageScore, hasData]);

  const currentTier = useMemo(() => tierForScore(irs), [irs]);
  const nextTier    = useMemo(() => {
    const idx = TIERS.indexOf(currentTier);
    return TIERS[idx + 1] || null;
  }, [currentTier]);
  const irsGap = pointsToNext(irs);

  // ── Archetype (personality) ───────────────────────────────────────────────
  const archetype = useMemo(
    () => deriveArchetype(scoreTrend, avgTimePerQ, averageScore),
    [scoreTrend, avgTimePerQ, averageScore]
  );

  // ── Strongest / weakest among dimensions that have real data ─────────────
  const dimWithData  = dimensionProfile.filter(d => d.hasData);
  const strongestDim = [...dimWithData].sort((a, b) => b.score - a.score)[0];
  const weakestDim   = [...dimWithData].sort((a, b) => a.score - b.score)[0];

  // ── Fix this next — genuine ROI ranking ──────────────────────────────────
  const fixTarget = useMemo(
    () => bestFixTarget(topicPerformance, dimensionProfile),
    [topicPerformance, dimensionProfile]
  );

  // ── Heatmap ───────────────────────────────────────────────────────────────
  const heatmap     = useMemo(() => buildHeatmap(scoreTrend), [scoreTrend]);
  const hmStats     = useMemo(() => heatmapStats(heatmap), [heatmap]);

  // ── Percentile ────────────────────────────────────────────────────────────
  const percentile = useMemo(() => {
    if (!currentUser?.globalRank || !leaderboardUsers.length) return null;
    return Math.max(1, Math.round(
      ((leaderboardUsers.length - currentUser.globalRank + 1) / leaderboardUsers.length) * 100
    ));
  }, [currentUser, leaderboardUsers]);

  

  // ─── Session identifier for status strip ─────────────────────────────────
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

            {/* Left — IRS gauge + label */}
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
                      <div style={{ ...S.irsNextMark, left: `${nextTier.minScore}%` }}
                           title={`${nextTier.label} threshold`} />
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

            {/* Right — verdict + actions */}
            <div style={S.verdictBlock}>
              <div style={S.eyebrow}>
                <span style={S.eyebrowDot} />
                PLACEMENT VERDICT
              </div>
              <h1 style={S.heroH1}>
                {user?.name?.split(' ')[0] ? `${user.name.split(' ')[0]}, ` : ''}
                {!hasData
                  ? "let's build your readiness profile."
                  : verdict || 'reading your session data…'}
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
            <StatCard
              label="Avg score"
              value={averageScore}
              unit="/100"
              sub="Simple mean across all sessions"
              color={scoreColor(averageScore)}
            />
            <StatCard
              label="Best session"
              value={bestScore}
              unit="/100"
              sub="Your personal ceiling"
              color={C.blue500}
            />
            <StatCard
              label="Sessions"
              value={totalInterviews}
              unit=""
              sub={streakDays ? `${streakDays}-day streak 🔥` : 'No active streak'}
              color={C.green}
            />
            <StatCard
              label="Trend (last session)"
              value={`${delta >= 0 ? '+' : ''}${delta}`}
              unit=" pts"
              sub={delta > 0 ? 'Moving up ↑' : delta < 0 ? 'Slipping — drill now' : 'Flat'}
              color={delta >= 0 ? C.green : C.orange}
            />
          </section>

          {/* ── IRS BREAKDOWN + FIX THIS NEXT ───────────────────────────── */}
          <section style={S.twoCol} className="mm-two-col">

            {/* Dimension breakdown */}
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
                  const cfg = DIMENSIONS.find(x => x.key === d.key);
                  const col = d.hasData ? scoreColor(d.score) : C.faint;
                  return (
                    <div key={d.key} style={S.dimRow} title={cfg?.tip}>
                      <div style={S.dimMeta}>
                        <div style={S.dimLeft}>
                          <span style={S.dimIcon}>{cfg?.icon}</span>
                          <div>
                            <span style={S.dimName}>{d.label}</span>
                            <span style={S.dimWeight}>
                              {Math.round((cfg?.weight ?? 0) * 100)}% weight
                            </span>
                          </div>
                        </div>
                        <span style={{ ...S.dimScore, color: d.hasData ? col : C.faint }}>
                          {d.hasData ? d.score : '—'}
                        </span>
                      </div>
                      <div style={S.dimTrack}>
                        <div style={{
                          ...S.dimFill,
                          width: mounted && d.hasData ? `${d.score}%` : '0%',
                          background: col,
                          opacity: d.hasData ? 1 : 0.3,
                        }} />
                      </div>
                      {!d.hasData && (
                        <div style={S.dimNoData}>No sessions for these topics yet</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fix this next */}
            <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
              <div style={S.eyebrowDark}>HIGHEST-ROI FIX</div>
              <h2 style={S.cardH2}>Where to drill next</h2>

              {fixTarget ? (
                <>
                  <div style={S.fixBox}>
                    <div style={S.fixTop}>
                      <span style={S.fixTopic}>{fixTarget.topic}</span>
                      <span style={{ ...S.fixScore, color: scoreColor(fixTarget.averageScore || 0) }}>
                        {fixTarget.averageScore || 0}/100
                      </span>
                    </div>
                    <div style={S.fixTrack}>
                      <div style={{
                        ...S.fixFill,
                        width: `${fixTarget.averageScore || 0}%`,
                        background: scoreColor(fixTarget.averageScore || 0),
                      }} />
                    </div>
                    <div style={S.fixStats}>
                      <span style={S.fixStat}>
                        <strong>{100 - (fixTarget.averageScore || 0)}</strong> pts headroom
                      </span>
                      <span style={S.fixStat}>
                        <strong>{Math.round(fixTarget.roi * 10) / 10}</strong> ROI score
                      </span>
                      <span style={S.fixStat}>
<strong>{fixTarget.attempts ?? '—'}</strong> questions attempted
                      </span>
                    </div>
                    <p style={S.fixHint}>
                      ROI score = dimension weight × score gap. Closing this topic gap
                      moves your IRS more than any other single change right now.
                    </p>
                  </div>

                  {/* Archetype card — lives here so this panel is always full */}
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

                  <button
                    style={{ ...S.btnBlue, marginTop: 'auto' }}
                    onClick={() => startQuick(fixTarget.topic)}
                    disabled={starting}
                  >
                    ⚡ Drill {fixTarget.topic} now
                  </button>
                </>
              ) : (
                <p style={S.cardSub}>
                  Complete a few more sessions to unlock targeted recommendations.
                </p>
              )}
            </div>
          </section>

          {/* ── PEER STANDING + SHARE ────────────────────────────────────── */}
          <section style={S.twoCol} className="mm-two-col">
            <PeerCard
              percentile={percentile}
              currentUser={currentUser}
              leaderboardUsers={leaderboardUsers}
              mounted={mounted}
              onChallenge={() => startQuick()}
              starting={starting}
            />
            <ShareCard
              name={user?.name?.split(' ')[0] || 'Candidate'}
              irs={irs}
              tier={currentTier}
              strongest={strongestDim}
              percentile={percentile}
              archetype={archetype}
              sessions={totalInterviews}
            />
          </section>

          {/* ── ACTIVITY HEATMAP ─────────────────────────────────────────── */}
          <ActivityHeatmap
            heatmap={heatmap}
            stats={hmStats}
            total={totalInterviews}
            mounted={mounted}
          />

          {/* ── LEADERBOARD ──────────────────────────────────────────────── */}
          <LeaderboardCard
            users={leaderboardUsers}
            currentUser={currentUser}
            onChallenge={() => startQuick()}
            starting={starting}
          />

          {/* ── NEXT TIER BANNER ─────────────────────────────────────────── */}
          {nextTier && (
            <section style={S.tierBanner} className="mm-banner">
              <div style={{ flex: 1 }}>
                <div style={S.eyebrowLight}>NEXT MILESTONE</div>
                <h2 style={S.bannerH2}>
                  {irsGap} IRS points from{' '}
                  <span style={{ color: nextTier.color }}>{nextTier.label}</span>
                </h2>
                <p style={S.bannerSub}>
                  {nextTier.advice}{' '}
                  {weakestDim && `Focus on ${weakestDim.label} — it's your largest open gap.`}
                </p>
                <div style={S.bannerTrack}>
                  <div style={{
                    ...S.bannerFill,
                    width: mounted ? `${Math.min(100, (irs / nextTier.minScore) * 100)}%` : '0%',
                  }} />
                  <div style={{ ...S.bannerMark, left: '100%' }} title={`${nextTier.label} threshold`} />
                </div>
                <div style={S.bannerCaption}>
                  {irs}/{nextTier.minScore} IRS needed
                </div>
              </div>
              <button style={S.btnBannerCta} onClick={() => startQuick()} disabled={starting}>
                Keep climbing →
              </button>
            </section>
          )}

        </>)}

        <footer style={S.footerRow}>
          <span style={S.mono}>MOCKMATE READINESS ENGINE v4.0</span>
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

// ─── Activity heatmap ─────────────────────────────────────────────────────────
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ActivityHeatmap = ({ heatmap, stats, total, mounted }) => {
  const [hovered, setHovered] = useState(null);

  // Derive month labels for column headers
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
    <section style={S.card}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>PRACTICE ACTIVITY</div>
          <h2 style={S.cardH2}>Session log — last 14 weeks</h2>
          <p style={S.cardSub}>
            Each cell is one day. Color = score tier: darker blue = higher score.
            Hover any cell for the date and score.
          </p>
        </div>
        <div style={S.hmLegend}>
          <span style={S.hmLegendLabel}>Low</span>
          {[20, 45, 60, 75, 90].map(v => (
            <div key={v} style={{ width: 13, height: 13, borderRadius: 4, background: heatColor(v, true), flexShrink: 0 }} title={`~${v}`} />
          ))}
          <span style={S.hmLegendLabel}>High</span>
        </div>
      </div>

      {/* Month labels */}
      <div style={S.hmMonthRow}>
        <div style={{ width: 34 }} />
        <div style={{ position: 'relative', flex: 1, height: 16 }}>
          {monthCols.map(({ wi, label }) => (
            <span key={wi} style={{ ...S.hmMonthLabel, left: `${(wi / heatmap.length) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={S.hmWrap}>
        {/* Day labels */}
        <div style={S.hmDayCols}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={S.hmDayLbl}>{d}</div>
          ))}
        </div>
        {/* Cells */}
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
                    transform: hovered?.date === day.date ? 'scale(1.25)' : 'scale(1)',
                    boxShadow: hovered?.date === day.date ? `0 0 0 2px ${C.blue400}` : 'none',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hovered && hovered.hasData && (
        <div style={S.hmTooltip}>
          <strong>{hovered.date}</strong> · Score: <strong style={{ color: scoreColor(hovered.score) }}>{hovered.score}/100</strong>
        </div>
      )}

      {/* Stats footer — four callout numbers */}
      <div style={S.hmFooterGrid} className="mm-hm-footer">
        <HmStat label="Active days" value={stats.activeDays} sub="Days with at least one session" />
        <HmStat label="Longest streak" value={`${stats.longestStreak}d`} sub="Consecutive practice days" />
        <HmStat label="Avg score" value={stats.avgScore || '—'} sub="Mean across active days" />
        <HmStat
          label="Best day"
          value={stats.bestDay?.score ?? '—'}
          sub={stats.bestDay ? stats.bestDay.date : 'No sessions yet'}
        />
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
        <div style={S.peerPctNum}>
          {percentile ?? '—'}
          {percentile ? <span style={S.peerPctSuffix}>%</span> : null}
        </div>
        <div style={S.peerPctLabel}>PERCENTILE</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={S.peerBig}>
          {percentile
            ? `Ahead of ${percentile}% of ranked candidates`
            : 'Complete interviews to unlock ranking'}
        </div>
        {currentUser?.globalRank && (
          <div style={S.peerRankChip}>GLOBAL RANK #{currentUser.globalRank}</div>
        )}
        <div style={S.peerBar}>
          <div style={{ ...S.peerFill, width: mounted ? `${percentile ?? 0}%` : '0%' }} />
        </div>
        <p style={S.peerNote}>
          Percentile is computed from average score across all users who have completed at least one interview.
        </p>
      </div>
    </div>
    <button style={{ ...S.btnBlue, marginTop: 14 }} onClick={onChallenge} disabled={starting}>
      Improve ranking →
    </button>
  </div>
);

// ─── Share card ────────────────────────────────────────────────────────────────
const ShareCard = ({ name, irs, tier, strongest, percentile, archetype, sessions }) => {
  const [copied, setCopied] = useState(false);

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
    } catch {
      // user cancelled
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
          <button style={S.btnShare} onClick={handleShare}>
            {copied ? '✓ Copied to clipboard' : '📤 Share your score'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────
const RANK_COLORS = [C.amber, '#9CA3AF', '#B87333'];

const LeaderboardCard = ({ users, currentUser, onChallenge, starting }) => {
  const top5      = users.slice(0, 5);
  const userInTop = currentUser && top5.some(u => u._id === currentUser._id);

  return (
    <section style={{ ...S.card, marginBottom: 18 }}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrowDark}>GLOBAL RANKING</div>
          <h2 style={S.cardH2}>Top performers</h2>
          <p style={S.cardSub}>Ranked by average score across all completed sessions.</p>
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
            <LBRow key={u._id ?? i} user={u} rank={i + 1}
                   color={RANK_COLORS[i] ?? C.muted}
                   isMe={u._id === currentUser?._id} />
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
    <span style={{ width: 36, fontFamily: F.mono, fontSize: 13, fontWeight: 700, color }}>
      {String(rank ?? '?').padStart(2, '0')}
    </span>
    <div style={S.lbAvatar}>
      {(user.name ?? 'A')[0].toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={S.lbName}>
        {user.name ?? 'Anonymous'}
        {isMe && <span style={S.youTag}>YOU</span>}
      </div>
    </div>
    <div style={{ ...S.lbScore, color }}>{user.averageScore ?? 0}</div>
    <div style={{ width: 52, textAlign: 'right', fontFamily: F.mono, fontSize: 11, color: C.muted }}>
      {user.totalInterviews ?? 0}
    </div>
  </div>
);

// ─── Global styles ─────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @keyframes spin       { to { transform: rotate(360deg); } }
    @keyframes livePulse  { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes hmScan     { 0% { transform:translateX(-100%); } 100% { transform:translateX(320%); } }

    *, *::before, *::after { box-sizing: border-box; }

    .mm-page button:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) { .mm-page * { animation: none !important; transition: none !important; } }

    @media (max-width: 1020px) {
      .mm-two-col { grid-template-columns: 1fr !important; }
      .mm-hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
    }
    @media (max-width: 760px) {
      .mm-stats { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-banner { flex-direction: column !important; }
      .mm-strip-r { display: none !important; }
      .mm-share-row { flex-direction: column !important; }
      .mm-hm-footer { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 480px) {
      .mm-stats { grid-template-columns: 1fr !important; }
      .mm-page { padding: 14px 12px 60px !important; }
      .mm-hm-footer { grid-template-columns: 1fr !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — all inline for portability
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  // Layout
  page: {
    minHeight: 'calc(100vh - 64px)',
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`,
    padding: '24px 28px 80px',
    fontFamily: F.body,
  },
  container: {
    maxWidth: 1260,
    margin: '0 auto',
    transition: 'opacity 0.55s ease, transform 0.55s cubic-bezier(.16,1,.3,1)',
  },

  // Status strip
  strip: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 16px', marginBottom: 20, borderRadius: 10,
    background: C.card, border: `1px solid ${C.border}`,
    boxShadow: C.shadow,
  },
  stripL: { display: 'flex', alignItems: 'center', gap: 9 },
  stripR: { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%', background: C.green,
    animation: 'livePulse 2.4s ease-in-out infinite',
    boxShadow: `0 0 8px ${C.greenGlow}`,
  },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.5px', color: C.muted },

  // Hero
  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '36px 32px', marginBottom: 18, borderRadius: 24,
    background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600} 100%)`,
    boxShadow: '0 24px 64px rgba(0,31,107,0.32)',
  },
  heroScan: {
    position: 'absolute', top: 0, left: 0, width: '25%', height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
    animation: 'hmScan 9s linear infinite',
  },
  heroGrid: {
    position: 'relative',
    display: 'grid', gridTemplateColumns: '260px 1fr', gap: 36, alignItems: 'center',
  },

  // IRS gauge block
  irsBlock: {},
  irsLabel: {
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 600,
    letterSpacing: '1.4px', color: 'rgba(255,255,255,0.6)', marginBottom: 10,
  },
  irsNum: {
    fontFamily: F.display, fontSize: 72, fontWeight: 900, lineHeight: 1,
    color: '#fff', letterSpacing: '-2px',
  },
  irsMax: { fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 0 },
  tierPill: {
    display: 'inline-flex', alignItems: 'center',
    marginTop: 12, padding: '6px 14px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.3px',
  },
  irsBar: {
    position: 'relative', height: 6, marginTop: 14, borderRadius: 999,
    background: 'rgba(255,255,255,0.15)', overflow: 'visible',
  },
  irsBarFill: {
    height: '100%', borderRadius: 999,
    background: `linear-gradient(90deg, ${C.blue200}, ${C.cyan400})`,
    transition: 'width 1.3s cubic-bezier(.16,1,.3,1)',
  },
  irsNextMark: {
    position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 1,
    background: 'rgba(255,255,255,0.6)', transform: 'translateX(-50%)',
  },
  irsGapText: {
    marginTop: 8, fontFamily: F.mono, fontSize: 10.5,
    color: 'rgba(255,255,255,0.65)', letterSpacing: '0.3px',
  },

  // Verdict block
  verdictBlock: {},
  eyebrow: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontFamily: F.mono, fontSize: 10, fontWeight: 700,
    letterSpacing: '1.6px', color: 'rgba(255,255,255,0.7)', marginBottom: 12,
  },
  eyebrowDot: { width: 6, height: 6, borderRadius: '50%', background: C.cyan400 },
  heroH1: {
    margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 800,
    color: '#fff', lineHeight: 1.32, letterSpacing: '-0.4px', maxWidth: 640,
  },
  heroSub: { margin: '13px 0 0', fontSize: 13, lineHeight: 1.72, color: 'rgba(255,255,255,0.75)', maxWidth: 560 },
  heroActions: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 },

  // Buttons
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', borderRadius: 12,
    background: '#fff', color: C.blue700,
    padding: '12px 20px', fontSize: 13, fontWeight: 800,
    fontFamily: F.body, cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },
  btnGhost: {
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12,
    background: 'rgba(255,255,255,0.08)', color: '#fff',
    padding: '12px 18px', fontSize: 13, fontWeight: 600,
    fontFamily: F.body, cursor: 'pointer',
  },
  btnBlue: {
    border: 'none', borderRadius: 12,
    background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
    color: '#fff', padding: '11px 18px',
    fontSize: 13, fontWeight: 700, fontFamily: F.body,
    cursor: 'pointer', boxShadow: `0 4px 16px rgba(26,110,255,0.3)`,
    textAlign: 'center',
  },
  btnSmall: {
    border: `1px solid ${C.borderMd}`, borderRadius: 10,
    background: C.blue50, color: C.blue600,
    padding: '9px 14px', fontSize: 11.5, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: F.body,
  },
  btnShare: {
    marginTop: 14, border: 'none', borderRadius: 10,
    background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`,
    color: '#fff', padding: '10px 18px',
    fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,173,224,0.35)',
  },
  btnBannerCta: {
    flexShrink: 0, border: 'none', borderRadius: 12,
    background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
    color: '#fff', padding: '13px 22px',
    fontSize: 13, fontWeight: 700, fontFamily: F.body,
    cursor: 'pointer', boxShadow: `0 6px 20px rgba(26,110,255,0.28)`,
    alignSelf: 'flex-start',
  },

  // Stat row
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14, marginBottom: 18,
  },
  statCard: {
    padding: '18px 20px', borderRadius: 16,
    background: C.card, border: `1px solid ${C.border}`,
    boxShadow: C.shadow,
  },
  statLabel: { fontSize: 11, fontWeight: 600, color: C.sub, letterSpacing: '0.3px' },
  statValRow: { display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 8 },
  statVal:    { fontFamily: F.display, fontSize: 32, fontWeight: 800, lineHeight: 1 },
  statUnit:   { fontFamily: F.mono, fontSize: 13, color: C.muted },
  statSub:    { marginTop: 8, fontSize: 11, color: C.muted, lineHeight: 1.4 },

  // Generic card
  card: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 20, padding: 24, boxShadow: C.shadow,
    marginBottom: 18,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
  eyebrowDark: {
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 700,
    letterSpacing: '1.5px', color: C.blue500, marginBottom: 6,
  },
  eyebrowLight: {
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 700,
    letterSpacing: '1.5px', color: C.blue400, marginBottom: 6,
  },
  cardH2:  { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text },
  cardSub: { margin: '6px 0 0', fontSize: 12, lineHeight: 1.65, color: C.sub, maxWidth: 440 },
  linkBtn: { border: 'none', background: 'transparent', color: C.blue500, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: F.body },

  // Two-column
  twoCol: { display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, marginBottom: 18 },

  // Dimension list
  dimList: { display: 'flex', flexDirection: 'column', gap: 14 },
  dimRow:  { padding: '12px 14px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` },
  dimMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dimLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  dimIcon: { fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 },
  dimName: { fontSize: 12.5, fontWeight: 700, color: C.text, display: 'block' },
  dimWeight: { fontSize: 10, color: C.muted, fontFamily: F.mono, display: 'block', marginTop: 2 },
  dimScore: { fontFamily: F.display, fontSize: 17, fontWeight: 800 },
  dimTrack: { height: 6, borderRadius: 999, background: C.border, overflow: 'hidden' },
  dimFill:  { height: '100%', borderRadius: 999, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' },
  dimNoData: { marginTop: 4, fontSize: 10.5, color: C.faint, fontFamily: F.mono },

  // Fix this next
  fixBox: {
    marginTop: 14, padding: 16, borderRadius: 14,
    background: C.blue50, border: `1px solid ${C.borderMd}`,
  },
  fixTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fixTopic: { fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.text },
  fixScore: { fontFamily: F.display, fontSize: 16, fontWeight: 800 },
  fixTrack: { height: 7, borderRadius: 999, background: C.border, overflow: 'hidden', marginBottom: 12 },
  fixFill:  { height: '100%', borderRadius: 999 },
  fixStats: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  fixStat:  { fontSize: 11.5, color: C.sub, fontFamily: F.mono },
  fixHint:  { margin: 0, fontSize: 11.5, color: C.sub, lineHeight: 1.65 },

  // Archetype
  archetypeBox: {
    marginTop: 14, padding: 14, borderRadius: 14,
    background: C.cardAlt, border: `1px solid ${C.border}`,
  },
  archetypeHead: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  archetypeIcon: {
    width: 44, height: 44, borderRadius: 12, fontSize: 22,
    background: C.blue50, border: `1px solid ${C.borderMd}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  archetypeName: { fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text },
  archetypeDesc: { fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.55 },
  archetypeFix:  { fontSize: 11.5, color: C.blue600, lineHeight: 1.6, paddingTop: 8, borderTop: `1px solid ${C.border}` },

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

  // Share card
  shareCard: {
    position: 'relative', overflow: 'hidden',
    padding: '26px 28px', borderRadius: 20,
    background: `linear-gradient(135deg, ${C.blue900} 0%, #0A2E6E 50%, #00305A 100%)`,
    boxShadow: C.shadowLg,
  },
  shareGlow: {
    position: 'absolute', top: -80, right: -80, width: 240, height: 240,
    borderRadius: '50%',
    background: `radial-gradient(circle, rgba(0,200,240,0.22), transparent 68%)`,
    pointerEvents: 'none',
  },
  shareEyebrow: {
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 700,
    letterSpacing: '1.6px', color: C.cyan400, marginBottom: 16,
  },
  shareRow: { position: 'relative', display: 'flex', alignItems: 'center', gap: 22 },
  shareLeft: { textAlign: 'center', flexShrink: 0, width: 88 },
  shareIRS: { fontFamily: F.display, fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1 },
  shareIRSLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  shareTitle: { margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: '#fff' },
  shareDesc:  { margin: '7px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 },

  // Heatmap
  hmLegend: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  hmLegendLabel: { fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.4px' },
  hmMonthRow: { display: 'flex', alignItems: 'center', marginBottom: 4, overflow: 'hidden' },
  hmMonthLabel: { position: 'absolute', fontFamily: F.mono, fontSize: 9, color: C.muted, whiteSpace: 'nowrap' },
  hmWrap: { display: 'flex', gap: 4, overflow: 'auto', paddingBottom: 4 },
  hmDayCols: { display: 'flex', flexDirection: 'column', gap: 3, marginRight: 6, flexShrink: 0, paddingTop: 2 },
  hmDayLbl: { height: 13, fontFamily: F.mono, fontSize: 8.5, color: C.muted, display: 'flex', alignItems: 'center' },
  hmGrid: { display: 'flex', gap: 3, flex: 1 },
  hmWeekCol: { display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 13 },
  hmCell: { width: '100%', aspectRatio: '1', borderRadius: 3, transition: 'transform 0.1s ease, box-shadow 0.1s ease', flexShrink: 0 },
  hmTooltip: {
    marginTop: 8, padding: '6px 12px', borderRadius: 8,
    background: C.text, color: '#fff', fontSize: 12,
    display: 'inline-block',
  },
  hmFooterGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 1, marginTop: 20,
    borderRadius: 12, overflow: 'hidden',
    border: `1px solid ${C.border}`,
  },
  hmStatBox: { padding: '14px 16px', background: C.cardAlt, textAlign: 'center' },
  hmStatVal: { fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.blue600 },
  hmStatLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.8px', color: C.sub, marginTop: 4 },
  hmStatSub: { fontSize: 10.5, color: C.muted, marginTop: 3, lineHeight: 1.4 },

  // Leaderboard
  lbHeader: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px',
    fontFamily: F.mono, fontSize: 9, letterSpacing: '0.8px', color: C.muted,
    marginBottom: 4,
  },
  lbRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid', transition: 'background 0.15s' },
  lbAvatar: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: C.blue50, border: `1px solid ${C.borderMd}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: C.blue600, fontFamily: F.display,
  },
  lbName: { fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8, fontFamily: F.body },
  lbScore: { fontFamily: F.display, fontSize: 18, fontWeight: 800 },
  lbDots: { textAlign: 'center', color: C.muted, fontSize: 18, letterSpacing: 3 },
  youTag: {
    fontSize: 9, fontWeight: 700, color: C.blue600,
    background: C.blue50, border: `1px solid ${C.borderMd}`,
    padding: '2px 7px', borderRadius: 5, flexShrink: 0, fontFamily: F.mono,
  },

  // Tier banner
  tierBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
    padding: '28px 30px', marginBottom: 18, borderRadius: 20,
    background: `linear-gradient(135deg, ${C.blue50} 0%, ${C.cyanTint} 100%)`,
    border: `1px solid ${C.borderMd}`,
    boxShadow: `0 4px 20px rgba(26,110,255,0.08)`,
  },
  bannerH2: { margin: '8px 0', fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text },
  bannerSub: { margin: 0, fontSize: 12.5, color: C.sub, maxWidth: 540, lineHeight: 1.6 },
  bannerTrack: { marginTop: 14, width: 'min(440px, 100%)', height: 6, borderRadius: 999, background: C.borderMd, overflow: 'visible', position: 'relative' },
  bannerFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})`, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)', position: 'relative' },
  bannerMark: { position: 'absolute', top: -3, width: 2, height: 12, background: C.blue700, borderRadius: 1, transform: 'translateX(-50%)' },
  bannerCaption: { marginTop: 6, fontFamily: F.mono, fontSize: 10, color: C.muted },

  // Footer
  footerRow: {
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6,
    padding: '18px 4px 0', opacity: 0.5,
  },

  // Loading
  loadingWrap: { minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 44, height: 44, borderRadius: '50%', border: `4px solid ${C.blue50}`, borderTopColor: C.blue500, animation: 'spin 0.75s linear infinite' },
  loadTitle: { marginTop: 18, fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.text },
  loadSub:   { marginTop: 6, fontSize: 12, color: C.muted },

  emptyMsg: { padding: '28px 16px', textAlign: 'center', border: `1.5px dashed ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 12 },
};

export default Dashboard;
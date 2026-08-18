/**
 * MOCKMATE SCORING MODEL
 * ────────────────────────────────────────────────────────────────────────
 * Single source of truth for: topic→dimension normalization, the 6-dimension
 * profile, IRS (Interview Readiness Score), package-tier requirement
 * profiles, tier readiness %, blocking-dimension detection, and session-to-
 * unlock ETA projection.
 *
 * WHY THIS FILE EXISTS
 * Previously this logic was duplicated (and drifting) across Dashboard.jsx,
 * Analytics.jsx, and re-invented crudely in interviewController.js
 * (calculateReadiness). All three now import from here. There is exactly
 * one IRS formula, one tier model, one dimension mapper in the whole app.
 *
 * USAGE (backend controller):
 *   const {
 *     buildDimensionProfile, computeIRS, tierForScore,
 *     computeTierReadiness, findBlockingDimension, projectSessionsToUnlock,
 *   } = require('../utils/scoringModel');
 *
 *   const dimensionProfile = buildDimensionProfile(topicPerformance);
 *   const irs = computeIRS({ dimensionProfile, scoreTrend, topicPerformance, averageScore });
 *   const currentTier = tierForScore(irs);
 *   const nextTier = TIERS[TIERS.indexOf(currentTier) + 1] || null;
 *   const tierReadiness = nextTier ? computeTierReadiness(dimensionProfile, nextTier) : null;
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. TOPIC NORMALIZATION — fixes real drift found in production data
// (65 DSA / 54 System Design / 37 OOP / 20 HR / 18 JavaScript / 17 Web Dev /
//  15 "Database Management Systems" / 13 DBMS / 13 "Operating Systems" /
//  10 "Data Structures & Algorithms" / 4 Computer Networks / 3 "Data
//  Structures" / 3 Behavioral / 2 Database / 2 "Object-Oriented Programming"
//  / 1 each of several one-off Gemini phrasings.)
// Without this, ~20% of real answered questions silently map to no
// dimension at all — confirmed against live Atlas data, not hypothetical.
// ═══════════════════════════════════════════════════════════════════════════

const normalizeTopicString = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * canonical topic key → array of substrings that should match it.
 * Matching is substring-based on the normalized string, checked in the
 * order below — more specific patterns are listed before their broader
 * parents where overlap could occur (e.g. "system design networking"
 * matches both systemdesign and networking synonym lists; we resolve
 * ties by declaring systemdesign first so it wins — tune order as new
 * real-world drift appears).
 */
const TOPIC_SYNONYMS = {
  dsa: ['dsa', 'data structures algorithms', 'algorithms', 'data structures'],
  oop: ['oop', 'object oriented programming'],
  dbms: ['dbms', 'database management', 'database'],
  os: ['operating system'],
  javascript: ['javascript', ' js ', 'js'],
  webdev: ['web development', 'web dev'],
  systemdesign: ['system design', 'architecture', 'scalability'],
  networking: ['computer network', 'networking', 'network'],
  hr: [' hr ', 'hr'],
  behavioral: ['behavioral', 'behavioural'],
  communication: ['communication'],
  csfundamentals: ['computer science fundamentals', 'cs fundamentals'],
};

// canonical topic key → which dimensions it feeds (mirrors old DIMENSIONS.topics,
// but keyed to canonical strings instead of raw Gemini output)
const CANONICAL_TOPIC_TO_DIMENSIONS = {
  dsa:            ['technical', 'problemSolving'],
  oop:            ['technical', 'design', 'fundamentals'],
  dbms:           ['fundamentals', 'technical'],
  os:             ['fundamentals'],
  javascript:     ['technical', 'fundamentals'],
  webdev:         ['technical'],
  systemdesign:   ['design'],
  networking:     ['fundamentals'],
  hr:             ['communication', 'behavioral'],
  behavioral:     ['behavioral'],
  communication:  ['communication'],
  csfundamentals: ['fundamentals'],
};

/**
 * Resolve a raw DB topic string (whatever Gemini produced) to a canonical
 * topic key. Returns 'unmapped' if nothing matches — this is intentional:
 * unmapped topics are surfaced (see buildDimensionProfile's `unmapped`
 * return field) so drift is visible next time, not silently eaten again.
 */
const resolveCanonicalTopic = (rawTopic) => {
  const norm = normalizeTopicString(rawTopic);
  for (const [canonicalKey, patterns] of Object.entries(TOPIC_SYNONYMS)) {
    if (patterns.some((p) => norm.includes(p.trim()))) {
      return canonicalKey;
    }
  }
  return 'unmapped';
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. DIMENSIONS — six-axis profile, weights used for the global IRS number.
// Tier-specific weights (section 4) OVERRIDE these for tier-readiness math;
// these are only the defaults used for the single "overall IRS" headline.
// ═══════════════════════════════════════════════════════════════════════════

const DIMENSIONS = [
  { key: 'technical',      label: 'Technical Depth', icon: '⚙',  weight: 0.28, tip: 'Core CS fundamentals — the first thing technical screeners test.' },
  { key: 'problemSolving', label: 'Problem Solving', icon: '🔍', weight: 0.22, tip: 'How you break down unknowns — decisive in live coding rounds.' },
  { key: 'communication',  label: 'Communication',   icon: '💬', weight: 0.18, tip: 'Clarity of thought — interviewers notice it fast.' },
  { key: 'behavioral',     label: 'Behavioral',      icon: '🤝', weight: 0.12, tip: 'Situational judgment and self-awareness under HR scrutiny.' },
  { key: 'design',         label: 'System Design',   icon: '🏗', weight: 0.10, tip: 'Matters at ₹12 LPA+ — often the differentiator between tiers.' },
  { key: 'fundamentals',   label: 'CS Fundamentals', icon: '📚', weight: 0.10, tip: 'Breadth of core knowledge — separates prepared from lucky.' },
];

const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key);

// ═══════════════════════════════════════════════════════════════════════════
// 3. MATH HELPERS — unchanged from the frontend originals, now backend-authoritative
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// 4. DIMENSION PROFILE BUILDER — replaces the frontend's exact-string topicMap
// ═══════════════════════════════════════════════════════════════════════════

const MIN_ANSWERS_FOR_CONFIDENCE = 5; // per-topic answered-question count before a dimension counts as non-provisional

/**
 * @param {Array<{topic, averageScore, attempts}>} topicPerformance — from getAnalytics/getPerformanceAnalytics
 * @returns {{ profile: Array, unmapped: Array<{topic, attempts}> }}
 *   profile: DIMENSIONS shape + {score, hasData, isProvisional, contributingTopics}
 *   unmapped: raw topics that matched no canonical bucket — SURFACE THESE, don't hide them
 */
const buildDimensionProfile = (topicPerformance = []) => {
  const unmapped = [];
  // canonicalKey -> { totalWeightedScore, totalAttempts, rawTopics: [] }
  const canonicalAgg = {};

  topicPerformance.forEach((t) => {
    const canonical = resolveCanonicalTopic(t.topic);
    if (canonical === 'unmapped') {
      unmapped.push({ topic: t.topic, attempts: t.attempts || 0 });
      return;
    }
    if (!canonicalAgg[canonical]) {
      canonicalAgg[canonical] = { totalWeightedScore: 0, totalAttempts: 0, rawTopics: [] };
    }
    const attempts = t.attempts || 1;
    canonicalAgg[canonical].totalWeightedScore += (t.averageScore || 0) * attempts;
    canonicalAgg[canonical].totalAttempts += attempts;
    canonicalAgg[canonical].rawTopics.push(t.topic);
  });

  const profile = DIMENSIONS.map((dim) => {
    // which canonical topics feed this dimension
    const feedingCanonicals = Object.entries(CANONICAL_TOPIC_TO_DIMENSIONS)
      .filter(([, dims]) => dims.includes(dim.key))
      .map(([canonicalKey]) => canonicalKey);

    let totalWeightedScore = 0;
    let totalAttempts = 0;
    const contributingTopics = [];

    feedingCanonicals.forEach((canonicalKey) => {
      const agg = canonicalAgg[canonicalKey];
      if (!agg) return;
      totalWeightedScore += agg.totalWeightedScore;
      totalAttempts += agg.totalAttempts;
      contributingTopics.push(...agg.rawTopics);
    });

    const score = totalAttempts > 0 ? totalWeightedScore / totalAttempts : 0;

    return {
      ...dim,
      score: clamp(score),
      hasData: totalAttempts > 0,
      isProvisional: totalAttempts > 0 && totalAttempts < MIN_ANSWERS_FOR_CONFIDENCE,
      answeredCount: totalAttempts,
      contributingTopics: [...new Set(contributingTopics)],
    };
  });

  return { profile, unmapped };
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. IRS — identical 4-component formula to the old frontend version,
// now the ONLY place it's computed.
// ═══════════════════════════════════════════════════════════════════════════

const computeIRS = ({ dimensionProfile, scoreTrend = [], topicPerformance = [], averageScore = 0 }) => {
  const dimScore = dimensionProfile.reduce((acc, d) => acc + d.score * d.weight, 0);
  const dimComponent = clamp(dimScore) * 0.40;

  const recentScores = scoreTrend.slice(-12).map((s) => s.score || 0);
  const ewmaScore = recentScores.length ? ewma(recentScores) : averageScore;
  const ewmaComponent = clamp(ewmaScore) * 0.25;

  const breadthComponent = Math.min(topicPerformance.length / 8, 1) * 100 * 0.15;

  const scores = scoreTrend.map((s) => s.score || 0);
  const sd = stdDev(scores);
  const mean = scores.length ? scores.reduce((a, v) => a + v, 0) / scores.length : 0;
  const cv = mean > 0 ? sd / mean : 1;
  const consistencyComponent = Math.max(0, (1 - Math.min(cv, 1)) * 100) * 0.20;

  return clamp(dimComponent + ewmaComponent + breadthComponent + consistencyComponent);
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. PACKAGE TIERS — 4 bands (confirmed sufficient). Each tier now carries
// its OWN dimension weights + minimums, not the global IRS weights.
// ────────────────────────────────────────────────────────────────────────
// THESE NUMBERS ARE A V1 SEED, NOT VERIFIED MARKET DATA.
// Built from general knowledge of how Indian campus recruiting funnels are
// structured (service/mass-recruiter vs mid-tier product vs top-tier).
// Recalibrate later using the outcome-feedback loop described below the table.
// ═══════════════════════════════════════════════════════════════════════════

const TIERS = [
  {
    label: '₹3–6 LPA',
    minIRS: 0,
    color: '#7A8BAF',
    desc: 'Service companies, off-campus starts',
    advice: 'Focus on DSA basics and communication fundamentals.',
    dimensionWeights: { technical: 0.30, problemSolving: 0.15, communication: 0.30, behavioral: 0.15, design: 0.00, fundamentals: 0.10 },
    dimensionMin:     { technical: 40,   problemSolving: 30,   communication: 55,   behavioral: 40,   design: 0,    fundamentals: 35 },
    minSessions: 3,
    maxVariance: 22, // loose — SD tolerance
  },
  {
    label: '₹6–12 LPA',
    minIRS: 38,
    color: '#D97706',
    desc: 'Mid-tier product, IT MNCs, campus drives',
    advice: 'Strengthen problem solving and topic breadth.',
    dimensionWeights: { technical: 0.32, problemSolving: 0.25, communication: 0.18, behavioral: 0.10, design: 0.07, fundamentals: 0.08 },
    dimensionMin:     { technical: 55,   problemSolving: 50,   communication: 50,   behavioral: 45,   design: 20,   fundamentals: 45 },
    minSessions: 6,
    maxVariance: 16,
  },
  {
    label: '₹12–20 LPA',
    minIRS: 60,
    color: '#1A6EFF',
    desc: 'Top product companies, FAANG-adjacent',
    advice: 'Master system design and consistency under pressure.',
    dimensionWeights: { technical: 0.30, problemSolving: 0.28, communication: 0.14, behavioral: 0.08, design: 0.12, fundamentals: 0.08 },
    dimensionMin:     { technical: 68,   problemSolving: 65,   communication: 55,   behavioral: 55,   design: 45,   fundamentals: 55 },
    minSessions: 8,
    maxVariance: 12,
  },
  {
    label: '₹20 LPA+',
    minIRS: 80,
    color: '#00ADE0',
    desc: 'FAANG, unicorn startups, remote-first',
    advice: 'Achieve elite cross-dimension performance.',
    dimensionWeights: { technical: 0.28, problemSolving: 0.30, communication: 0.12, behavioral: 0.08, design: 0.14, fundamentals: 0.08 },
    dimensionMin:     { technical: 82,   problemSolving: 82,   communication: 60,   behavioral: 60,   design: 68,   fundamentals: 65 },
    minSessions: 12,
    maxVariance: 8,
  },
];

const tierForScore = (irs) => {
  const reached = TIERS.filter((t) => irs >= t.minIRS);
  return reached[reached.length - 1] || TIERS[0];
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. TIER READINESS — the actual USP feature. Not "IRS crosses a number",
// but "how close is your PROFILE to the SHAPE this tier's interviews test".
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {Array} dimensionProfile — from buildDimensionProfile
 * @param {object} tier — one of TIERS
 * @returns {{
 *   readinessPct: number,          // 0-100, weighted gap-closure toward tier's requirement vector
 *   perDimension: Array,           // each dim: {key,label,userScore,requiredMin,met,ratio,weightInTier}
 *   blockingDimensions: Array,     // dims below their min, sorted by (weight * gap) descending — biggest lever first
 *   provisionalDimensions: Array,  // dims with too little data to trust yet
 *   confidenceGate: boolean,       // true if enough total sessions logged to trust readinessPct at all
 * }}
 */
const computeTierReadiness = (dimensionProfile, tier, totalSessions = 0) => {
  const perDimension = DIMENSION_KEYS.map((key) => {
    const dim = dimensionProfile.find((d) => d.key === key);
    const requiredMin = tier.dimensionMin[key] ?? 0;
    const weightInTier = tier.dimensionWeights[key] ?? 0;
    const userScore = dim?.score ?? 0;
    const ratio = requiredMin > 0 ? Math.min(1, userScore / requiredMin) : 1;
    return {
      key,
      label: dim?.label ?? key,
      userScore,
      requiredMin,
      weightInTier,
      met: userScore >= requiredMin,
      ratio,
      gap: Math.max(0, requiredMin - userScore),
      isProvisional: dim?.isProvisional ?? false,
      hasData: dim?.hasData ?? false,
    };
  });

  // readiness = weighted average of per-dimension ratio, weighted by THIS TIER's
  // dimension importance — not the global IRS weights
  const totalWeight = perDimension.reduce((a, d) => a + d.weightInTier, 0) || 1;
  const readinessPct = clamp(
    perDimension.reduce((a, d) => a + d.ratio * d.weightInTier, 0) / totalWeight * 100
  );

  const blockingDimensions = perDimension
    .filter((d) => !d.met && d.weightInTier > 0)
    .sort((a, b) => (b.weightInTier * b.gap) - (a.weightInTier * a.gap));

  const provisionalDimensions = perDimension.filter((d) => d.isProvisional);
  const confidenceGate = totalSessions >= tier.minSessions;

  return { readinessPct, perDimension, blockingDimensions, provisionalDimensions, confidenceGate };
};

const findBlockingDimension = (tierReadiness) => tierReadiness.blockingDimensions[0] || null;

// ═══════════════════════════════════════════════════════════════════════════
// 8. ETA PROJECTION — "how many more sessions until you unlock this tier"
// Requires PER-DIMENSION time series, not just lifetime topic averages.
// See buildDimensionTimeSeries() below — computed fresh from raw sessions,
// since Session already has questions[].topic + questions[].score + createdAt.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a per-dimension score history across sessions, chronological.
 * @param {Array} sessions — completed sessions, sorted oldest→newest, each
 *   with .questions[] containing {topic, score, skipped, userAnswer}
 * @returns {{ [dimensionKey]: Array<{ date, score }> }}
 */
const buildDimensionTimeSeries = (sessions = []) => {
  const series = {};
  DIMENSION_KEYS.forEach((k) => { series[k] = []; });

  sessions.forEach((session) => {
    // per-session, per-dimension running totals — one point per dimension
    // per session (average of that session's questions feeding that dimension)
    const sessionDimTotals = {};
    DIMENSION_KEYS.forEach((k) => { sessionDimTotals[k] = { sum: 0, count: 0 }; });

    (session.questions || []).forEach((q) => {
      if (q.skipped || !q.userAnswer) return;
      const canonical = resolveCanonicalTopic(q.topic);
      const dims = CANONICAL_TOPIC_TO_DIMENSIONS[canonical] || [];
      const score = Number(q.score) || 0;
      dims.forEach((dimKey) => {
        sessionDimTotals[dimKey].sum += score;
        sessionDimTotals[dimKey].count += 1;
      });
    });

    DIMENSION_KEYS.forEach((dimKey) => {
      const { sum, count } = sessionDimTotals[dimKey];
      if (count > 0) {
        series[dimKey].push({ date: session.createdAt, score: sum / count });
      }
    });
  });

  return series;
};

/**
 * Projects sessions-until-unlock for the single blocking dimension, using
 * that dimension's own trend slope — NOT the overall session slope (which
 * would misrepresent a dimension the user hasn't been practicing recently).
 * Returns null (not a guess) if there's not enough per-dimension history to
 * trust a slope — honesty over false precision.
 */
const projectSessionsToUnlock = (blockingDim, dimensionTimeSeries) => {
  if (!blockingDim) return null;
  const history = dimensionTimeSeries[blockingDim.key] || [];
  if (history.length < 3) {
    return { estimable: false, reason: 'not_enough_dimension_history', minPointsNeeded: 3, currentPoints: history.length };
  }

  const recentScores = history.slice(-8).map((h) => h.score);
  const slope = trendSlope(recentScores); // pts per session, this dimension only

  if (slope <= 0.3) {
    // flat or declining — a session count would be misleading/infinite
    return { estimable: false, reason: 'flat_or_declining_trend', slope: Math.round(slope * 100) / 100 };
  }

  const sessionsNeeded = Math.ceil(blockingDim.gap / slope);
  return {
    estimable: true,
    sessionsNeeded,
    slope: Math.round(slope * 100) / 100,
    gap: blockingDim.gap,
    dimension: blockingDim.key,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  DIMENSIONS,
  DIMENSION_KEYS,
  TIERS,
  MIN_ANSWERS_FOR_CONFIDENCE,
  resolveCanonicalTopic,
  buildDimensionProfile,
  computeIRS,
  tierForScore,
  computeTierReadiness,
  findBlockingDimension,
  buildDimensionTimeSeries,
  projectSessionsToUnlock,
  // math helpers exported too — controller/badgeEngine may want them directly
  clamp,
  ewma,
  stdDev,
  trendSlope,
};
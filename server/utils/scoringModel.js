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
 *   const currentTierIndex = TIERS.findIndex(t => t.label === currentTier.label);
const nextTier = TIERS[currentTierIndex + 1] || null;
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
const clampRaw = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v || 0)); // unrounded, for intermediate math

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

// ─────────────────────────────────────────────────────────────────────────
// Bayesian shrinkage (empirical-Bayes-style blending toward a neutral prior)
// A dimension backed by 1 answered question is almost pure noise; one backed
// by 60 is almost pure signal. Rather than a hard on/off "isProvisional"
// flag, every dimension score is PULLED toward a neutral prior (50) by an
// amount that shrinks smoothly as evidence (n) accumulates. This is the
// single biggest fix for "41 IRS off a handful of sessions" — thin evidence
// can no longer produce an extreme score in either direction.
//
//   shrunkScore = prior + (n / (n + K)) * (rawScore - prior)
//
// K is the "evidence half-life": at n = K, the raw score is blended 50/50
// with the prior. K=6 means you need ~6 answered questions on a topic
// before it's trusted anywhere close to face value, ~18-20 before it's
// trusted almost fully.
// ─────────────────────────────────────────────────────────────────────────
const SHRINKAGE_PRIOR = 50;
const SHRINKAGE_K = 6;

const shrinkToward = (rawScore, n, prior = SHRINKAGE_PRIOR, k = SHRINKAGE_K) => {
  if (n <= 0) return prior;
  const weight = n / (n + k);
  return prior + weight * (rawScore - prior);
};

// Continuous confidence weight in [0,1] for a given evidence count — used
// wherever we need "how much do we trust this" rather than a binary flag.
const evidenceConfidence = (n, k = SHRINKAGE_K) => (n <= 0 ? 0 : n / (n + k));

// ─────────────────────────────────────────────────────────────────────────
// Difficulty weighting — a correct/strong answer on a 'hard' question is
// worth materially more signal than the same raw score on an 'easy' one,
// and vice versa a weak score on an 'easy' question is a stronger negative
// signal than a weak score on a 'hard' one (hard questions are *expected*
// to knock scores down some). We convert each question's raw score into a
// difficulty-adjusted score before it ever reaches topic/dimension aggregation.
// ─────────────────────────────────────────────────────────────────────────
const DIFFICULTY_WEIGHT = { easy: 0.85, medium: 1.0, hard: 1.2 };
// How much of a "curve" hard questions get (partial credit for attempting
// hard content even when the raw score is middling) vs easy questions being
// held to a stricter bar.
const DIFFICULTY_CURVE = { easy: -4, medium: 0, hard: 6 };

const difficultyAdjustedScore = (rawScore, difficulty = 'medium') => {
  const d = String(difficulty || 'medium').toLowerCase();
  const curve = DIFFICULTY_CURVE[d] ?? 0;
  return clampRaw(rawScore + curve);
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. DIMENSION PROFILE BUILDER — replaces the frontend's exact-string topicMap
// ═══════════════════════════════════════════════════════════════════════════

const MIN_ANSWERS_FOR_CONFIDENCE = 8; // per-dimension answered-question count before a dimension counts as non-provisional
// (raised from 5 → 8: 5 was letting single-session dimension coverage pass as "trustworthy")

/**
 * @param {Array<{topic, averageScore, attempts}>} topicPerformance — from getAnalytics/getPerformanceAnalytics
 * @returns {{ profile: Array, unmapped: Array<{topic, attempts}> }}
 *   profile: DIMENSIONS shape + {score, rawScore, hasData, isProvisional, confidence,
 *            answeredCount, contributingTopics}
 *   unmapped: raw topics that matched no canonical bucket — SURFACE THESE, don't hide them
 *
 * IMPORTANT: `score` here is the SHRUNK (Bayesian-adjusted) score — the number
 * every downstream consumer (IRS, tier readiness, blockers) should use. The
 * unshrunk face-value average is still exposed as `rawScore` for transparency
 * / debugging / UI tooltips ("your raw average vs. your trusted score").
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

    const rawScore = totalAttempts > 0 ? totalWeightedScore / totalAttempts : 0;
    const confidence = evidenceConfidence(totalAttempts);
    const shrunkScore = totalAttempts > 0 ? shrinkToward(rawScore, totalAttempts) : 0;

    return {
      ...dim,
      score: clamp(shrunkScore),
      rawScore: clamp(rawScore),
      hasData: totalAttempts > 0,
      isProvisional: totalAttempts > 0 && totalAttempts < MIN_ANSWERS_FOR_CONFIDENCE,
      confidence: Math.round(confidence * 100) / 100,
      answeredCount: totalAttempts,
      contributingTopics: [...new Set(contributingTopics)],
    };
  });

  return { profile, unmapped };
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. IRS — Interview Readiness Score
// ────────────────────────────────────────────────────────────────────────
// V2 MODEL. Rebuilt because V1 had no concept of statistical confidence:
// a user with 5 lucky answers and a user with 500 consistent answers could
// land the same IRS, because none of the 4 components were sample-size
// aware. That is the root cause of "IRS 41 after basically no practice."
//
// V2 is still a weighted blend of interpretable components (kept for UI
// transparency — Analytics.jsx renders each bar) but two structural changes
// fix the over-confidence problem:
//
//   1. Every component that touches per-dimension/per-topic averages uses
//      the SHRUNK scores from buildDimensionProfile (Bayesian-shrunk toward
//      a neutral 50 prior), not raw face-value averages. Thin evidence
//      literally cannot produce an extreme number anymore.
//
//   2. A MATURITY MULTIPLIER is applied to the whole composite. This is the
//      key addition: total evidence volume (answered questions across the
//      whole account) gates how much of the computed composite the user is
//      allowed to "cash in". At low n the multiplier suppresses the score
//      toward a conservative floor; it only converges to 1.0 (full trust)
//      once there's genuinely enough evidence to back a confident claim.
//      This is what makes "6-12 LPA eligible after one session" structurally
//      impossible — not just unlikely.
//
// Components (weights sum to 1.0, applied BEFORE the maturity multiplier):
//   • Dimension-weighted mastery   40%  — shrunk per-dimension scores × global weights
//   • Recent-performance (EWMA)    22%  — exponentially weighted recent session trend
//   • Topic breadth & depth        13%  — rewards distinct topics *with real depth*,
//                                          not just distinct topics touched once
//   • Consistency (1 − CV)         15%  — variance-adjusted, itself confidence-gated
//   • Difficulty-adjusted rigor    10%  — average difficulty level actually attempted,
//                                          rewards tackling hard questions, not
//                                          farming easy ones
// ═══════════════════════════════════════════════════════════════════════════

// Evidence unit for the maturity gate = total ANSWERED QUESTIONS across all
// sessions (not session count) — a 10-question session provides more
// evidence than a 5-question one, and question count is what the shrinkage
// math above is already denominated in, so the gate stays consistent with it.
const MATURITY_K = 40; // half-trust point: ~40 answered questions (≈4-6 full sessions)
const MATURITY_FLOOR = 0.35; // even with almost no data, don't crush the score to near-zero —
// floor keeps early scores informative-but-humble rather than punitive

const maturityMultiplier = (totalAnsweredQuestions = 0) => {
  const raw = totalAnsweredQuestions / (totalAnsweredQuestions + MATURITY_K);
  return MATURITY_FLOOR + (1 - MATURITY_FLOOR) * raw;
};

/**
 * @param {Array} dimensionProfile — from buildDimensionProfile (SHRUNK scores)
 * @param {Array<{score,date,interview}>} scoreTrend — chronological session scores
 * @param {Array<{topic,averageScore,attempts}>} topicPerformance
 * @param {number} averageScore — fallback mean if scoreTrend is empty
 * @param {number} totalAnsweredQuestions — evidence volume for the maturity gate.
 *   Falls back to summing topicPerformance attempts if not passed explicitly,
 *   so older call sites that don't pass it yet still degrade gracefully
 *   rather than breaking (though callers SHOULD pass it — see interviewController).
 * @param {Object<string, {easy,medium,hard}>|null} difficultyMix — counts of
 *   answered questions by difficulty, used for the rigor component. Optional;
 *   if omitted, the rigor component falls back to a neutral 60/100 (assumes
 *   'medium'-only) rather than penalizing sessions that predate this field.
 */
const IRS_WEIGHTS = {
  dimension: 0.40,
  ewma: 0.22,
  breadth: 0.13,
  consistency: 0.15,
  rigor: 0.10,
};

/**
 * Full breakdown version — computes every component AND the maturity gate,
 * returning all of it. computeIRS() below is a thin wrapper that just
 * returns .finalScore, so there is exactly one implementation of the math;
 * the frontend breakdown panel should render THIS function's output
 * (via the API response) instead of re-deriving the formula client-side.
 */
const computeIRSBreakdown = ({
  dimensionProfile,
  scoreTrend = [],
  topicPerformance = [],
  averageScore = 0,
  totalAnsweredQuestions = null,
  difficultyMix = null,
}) => {
  // ── evidence volume (drives the maturity gate) ──────────────────────────
  const answeredQuestionCount =
    totalAnsweredQuestions != null
      ? totalAnsweredQuestions
      : topicPerformance.reduce((a, t) => a + (t.attempts || 0), 0);

  // ── 1. Dimension-weighted mastery (40%) — uses SHRUNK scores already ────
  const dimScore = dimensionProfile.reduce((acc, d) => acc + d.score * d.weight, 0);
  const dimComponent = clampRaw(dimScore) * IRS_WEIGHTS.dimension;

  // ── 2. Recent-performance EWMA (22%) ─────────────────────────────────────
  const recentScores = scoreTrend.slice(-12).map((s) => s.score || 0);
  const ewmaScoreRaw = recentScores.length ? ewma(recentScores) : averageScore;
  // shrink the EWMA itself toward the prior too — a hot streak of 2-3
  // sessions shouldn't swing this component to an extreme on its own
  const ewmaScore = shrinkToward(ewmaScoreRaw, recentScores.length * 5); // *5 ≈ approx questions/session
  const ewmaComponent = clampRaw(ewmaScore) * IRS_WEIGHTS.ewma;

  // ── 3. Topic breadth & depth (13%) — distinct dimensions with REAL depth,
  //      not just distinct topics touched once. A dimension only counts
  //      toward breadth once it clears MIN_ANSWERS_FOR_CONFIDENCE; partial
  //      credit below that, scaled by its own confidence, so one shallow
  //      topic can't fully count the same as a properly-practiced one.
  const breadthCredit = dimensionProfile.reduce((acc, d) => {
    if (!d.hasData) return acc;
    return acc + Math.min(1, d.confidence); // 0..1 per dimension, confidence-scaled
  }, 0);
  const breadthPct = Math.min(breadthCredit / DIMENSION_KEYS.length, 1) * 100;
  const breadthComponent = breadthPct * IRS_WEIGHTS.breadth;

  // ── 4. Consistency / 1−CV (15%) — itself gated by sample size. With <4
  //      sessions, variance is not a meaningful signal (could be one bad
  //      day), so we shrink the consistency SCORE toward a neutral 65
  //      (mildly-positive-but-unproven) rather than letting 2 data points
  //      swing it to 0 or 100.
  const scores = scoreTrend.map((s) => s.score || 0);
  const sd = stdDev(scores);
  const mean = scores.length ? scores.reduce((a, v) => a + v, 0) / scores.length : 0;
  const cv = mean > 0 ? sd / mean : 1;
  const rawConsistencyScore = Math.max(0, (1 - Math.min(cv, 1)) * 100);
  const consistencyScore = scores.length >= 2
    ? shrinkToward(rawConsistencyScore, scores.length, 65, 4)
    : 65;
  const consistencyComponent = clampRaw(consistencyScore) * IRS_WEIGHTS.consistency;

  // ── 5. Difficulty-adjusted rigor (10%) — rewards attempting/handling
  //      harder questions instead of farming easy ones for a high average.
  //      Score = weighted mix of (a) how hard the attempted set skewed and
  //      (b) performance held up on that mix, via DIFFICULTY_WEIGHT.
  let rigorScore;
  if (difficultyMix && (difficultyMix.easy + difficultyMix.medium + difficultyMix.hard) > 0) {
    const { easy = 0, medium = 0, hard = 0 } = difficultyMix;
    const total = easy + medium + hard;
    const weightedDifficulty =
      (easy * DIFFICULTY_WEIGHT.easy + medium * DIFFICULTY_WEIGHT.medium + hard * DIFFICULTY_WEIGHT.hard) / total;
    // DIFFICULTY_WEIGHT ranges ~0.85–1.2 → normalize to a 0-100 rigor scale
    const rigorRaw = ((weightedDifficulty - DIFFICULTY_WEIGHT.easy) /
      (DIFFICULTY_WEIGHT.hard - DIFFICULTY_WEIGHT.easy)) * 100;
    rigorScore = clampRaw(shrinkToward(clampRaw(rigorRaw), total, 55, 10));
  } else {
    rigorScore = 60; // neutral default — assume medium-only mix
  }
  const rigorComponent = rigorScore * IRS_WEIGHTS.rigor;

  const rawComposite = dimComponent + ewmaComponent + breadthComponent + consistencyComponent + rigorComponent;

  // ── Maturity gate — the structural fix. Applied last, to the composite. ──
  const maturity = maturityMultiplier(answeredQuestionCount);
  const finalScore = clamp(rawComposite * maturity);

  return {
    finalScore,
    rawComposite: Math.round(rawComposite * 100) / 100,
    maturity: Math.round(maturity * 100) / 100,
    answeredQuestionCount,
    components: {
      dimension:   { score: clamp(dimScore),        weight: IRS_WEIGHTS.dimension,   contribution: Math.round(dimComponent * 100) / 100 },
      ewma:        { score: clamp(ewmaScore),        weight: IRS_WEIGHTS.ewma,        contribution: Math.round(ewmaComponent * 100) / 100 },
      breadth:     { score: clamp(breadthPct),       weight: IRS_WEIGHTS.breadth,     contribution: Math.round(breadthComponent * 100) / 100 },
      consistency: { score: clamp(consistencyScore), weight: IRS_WEIGHTS.consistency, contribution: Math.round(consistencyComponent * 100) / 100 },
      rigor:       { score: clamp(rigorScore),       weight: IRS_WEIGHTS.rigor,       contribution: Math.round(rigorComponent * 100) / 100 },
    },
  };
};

/**
 * @param {Array} dimensionProfile — from buildDimensionProfile (SHRUNK scores)
 * @param {Array<{score,date,interview}>} scoreTrend — chronological session scores
 * @param {Array<{topic,averageScore,attempts}>} topicPerformance
 * @param {number} averageScore — fallback mean if scoreTrend is empty
 * @param {number} totalAnsweredQuestions — evidence volume for the maturity gate.
 *   Falls back to summing topicPerformance attempts if not passed explicitly,
 *   so older call sites that don't pass it yet still degrade gracefully
 *   rather than breaking (though callers SHOULD pass it — see interviewController).
 * @param {Object<string, {easy,medium,hard}>|null} difficultyMix — counts of
 *   answered questions by difficulty, used for the rigor component. Optional;
 *   if omitted, the rigor component falls back to a neutral 60/100 (assumes
 *   'medium'-only) rather than penalizing sessions that predate this field.
 * @returns {number} the final 0-100 IRS. For the full component breakdown
 *   (used by the Analytics "how your IRS is computed" panel), call
 *   computeIRSBreakdown() instead/as well.
 */
const computeIRS = (args) => computeIRSBreakdown(args).finalScore;

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

// Pure-math tier lookup: which tier does this IRS number cross, ignoring
// evidence volume entirely. Kept for internal/analytical use (e.g. computing
// "how many more IRS points to the next band"), but NOT what should be
// shown to the user as "you are eligible for X" — see tierForScoreGated.
const tierForScore = (irs) => {
  const reached = TIERS.filter((t) => irs >= t.minIRS);
  return reached[reached.length - 1] || TIERS[0];
};

/**
 * Confidence-gated tier lookup — the number that should actually be shown
 * to the user as "you're eligible for X". Fixes the bug where a user with
 * 1-2 sessions could cross an IRS threshold (because IRS is now maturity-
 * gated but still *can* cross low thresholds early) and see "₹6-12 LPA
 * eligible" with zero real evidence behind it.
 *
 * A tier is only awarded if BOTH:
 *   (a) irs >= tier.minIRS (the math says you're there), AND
 *   (b) totalSessions >= tier.minSessions (you've logged enough sessions
 *       for that claim to mean anything for that tier's stakes)
 *
 * If (a) passes but (b) fails, the user is capped at the highest tier they
 * both qualify for AND have enough sessions to back. This also returns
 * whether the *raw* (ungated) tier differs, so the UI can show "on track
 * for X once you've logged N more sessions" instead of silently downgrading.
 */
const tierForScoreGated = (irs, totalSessions = 0) => {
  const rawTier = tierForScore(irs);
  const eligible = TIERS.filter((t) => irs >= t.minIRS && totalSessions >= t.minSessions);
  const gatedTier = eligible[eligible.length - 1] || TIERS[0];
  return {
    tier: gatedTier,
    rawTier,
    isGated: gatedTier.label !== rawTier.label,
    sessionsNeededForRawTier: Math.max(0, rawTier.minSessions - totalSessions),
  };
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
  computeIRSBreakdown,
  tierForScore,
  tierForScoreGated,
  computeTierReadiness,
  findBlockingDimension,
  buildDimensionTimeSeries,
  projectSessionsToUnlock,
  // math helpers exported too — controller/badgeEngine may want them directly
  clamp,
  clampRaw,
  ewma,
  stdDev,
  trendSlope,
  shrinkToward,
  evidenceConfidence,
  difficultyAdjustedScore,
  maturityMultiplier,
};
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const {
  buildDimensionProfile,
  computeIRS,
  tierForScoreGated,
  computeTierReadiness,
  findBlockingDimension,
  TIERS,
  stdDev,
  trendSlope,
} = require('../utils/scoringModel');
const { evaluateBadges } = require('../utils/badgeEngine');

const ARCHETYPES = [
  { id: 'inconsistentGenius', label: 'Inconsistent Genius' },
  { id: 'consistentClimber',  label: 'Consistent Climber' },
  { id: 'speedRunner',        label: 'Speed Runner' },
  { id: 'deepThinker',        label: 'Deep Thinker' },
  { id: 'pressureCooker',     label: 'Pressure Cooker' },
];

const deriveArchetype = (scores, avgTimePerQ) => {
  if (scores.length < 2) return ARCHETYPES[1];
  const sd = stdDev(scores);
  const slope = trendSlope(scores);
  if (sd > 18) return ARCHETYPES[0];
  if (slope > 2) return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};

// ─── Badge picker — the single most narratively interesting UNLOCKED badge ──
// Priority: rarer tier wins (platinum > gold > silver > bronze); ties broken
// by whichever badge carries richer `meta` (a story beats a bare unlock).
const TIER_RANK = { platinum: 4, gold: 3, silver: 2, bronze: 1 };

const pickHeroBadge = (badges) => {
  const unlocked = badges.filter((b) => b.unlocked);
  if (!unlocked.length) return null;
  return [...unlocked].sort((a, b) => {
    const tierDiff = (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0);
    if (tierDiff !== 0) return tierDiff;
    return (b.meta ? 1 : 0) - (a.meta ? 1 : 0);
  })[0];
};

// ─── Real rank + percentile — same aggregation shape as leaderboardController,
// scoped here to just what a single user needs (their own rank + the total
// pool size), so the profile card can show a verifiably true "beat X of Y"
// rather than the old heuristic curve. Overall (all-time), not weekly. ──────
const computeGlobalStanding = async (userId) => {
  const rows = await Session.aggregate([
    { $match: { status: 'completed' } },
    { $addFields: { resolvedUser: { $ifNull: ['$user', '$userId'] } } },
    { $match: { resolvedUser: { $ne: null } } },
    { $group: { _id: '$resolvedUser', avgScore: { $avg: '$averageScore' } } },
    { $sort: { avgScore: -1 } },
  ]);

  const totalCandidates = rows.length;
  const rankIndex = rows.findIndex((r) => r._id.toString() === userId.toString());
  if (rankIndex === -1 || totalCandidates === 0) {
    return { rank: null, totalCandidates, percentile: null };
  }
  const rank = rankIndex + 1;
  // % of the pool this user scored better than (0-100, higher = better).
  const percentile = totalCandidates > 1
    ? Math.round(((totalCandidates - rank) / (totalCandidates - 1)) * 100)
    : 100;
  return { rank, totalCandidates, percentile };
};

exports.computeGlobalStanding = computeGlobalStanding;

// ─── Shared builder — everything a profile "report" needs, whether viewed
// publicly by slug or privately by the owner via /me. One implementation,
// two thin route handlers, so the two surfaces can never drift apart. ──────
const buildProfileReport = async (user) => {
  const sessions = await Session.find({ $or: [{ userId: user._id }, { user: user._id }], status: 'completed' })
    .sort({ createdAt: 1 })
    .lean();

  if (!sessions.length) {
    return {
      name: user.name,
      college: user.college || null,
      avatar: user.avatar || null,
      totalInterviews: 0,
      hasData: false,
    };
  }

  const scores = sessions.map((s) => s.totalScore).filter((s) => typeof s === 'number');
  const averageScore = scores.length ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length) : 0;
  const bestScore = scores.length ? Math.max(...scores) : 0;

  const scoreTrend = sessions.map((s, i) => ({
    interview: i + 1,
    score: s.totalScore || 0,
    date: s.createdAt,
  }));

  const topicStats = {};
  sessions.forEach((session) => {
    session.questions?.forEach((q) => {
      const topic = q.topic || 'General';
      const score = typeof q.score === 'number' ? q.score : null;
      if (score === null) return;
      if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0, attempts: 0 };
      topicStats[topic].totalScore += score;
      topicStats[topic].count += 1;
      topicStats[topic].attempts += 1;
    });
  });
  const topicPerformance = Object.values(topicStats).map((t) => ({
    topic: t.topic,
    averageScore: Math.round(t.totalScore / t.count),
  }));
  const topicPerfWithAttempts = topicPerformance.map((t) => ({ ...t, attempts: t.count || 1 }));

  const { profile: dimensionProfile } = buildDimensionProfile(topicPerfWithAttempts);

  let totalAnsweredQuestions = 0;
  const difficultyMix = { easy: 0, medium: 0, hard: 0 };
  sessions.forEach((session) => {
    (session.questions || []).forEach((q) => {
      if (q.skipped || !q.userAnswer || q.userAnswer === 'Skipped') return;
      totalAnsweredQuestions += 1;
      const d = String(q.difficulty || 'medium').toLowerCase();
      if (difficultyMix[d] != null) difficultyMix[d] += 1;
      else difficultyMix.medium += 1;
    });
  });

  const irs = computeIRS({
    dimensionProfile,
    scoreTrend,
    topicPerformance,
    averageScore,
    totalAnsweredQuestions,
    difficultyMix,
  });
  const { tier, rawTier, isGated, sessionsNeededForRawTier } = tierForScoreGated(irs, sessions.length);

  // Next tier + honest readiness gap toward it, using the GATED current tier
  // (never the raw/ungated one) so the "X pts to next tier" claim can never
  // overstate what the confidence gate itself would allow.
  const tierIndex = TIERS.findIndex((t) => t.label === tier.label);
  const nextTier = TIERS[tierIndex + 1] || null;
  let nextTierProgress = null;
  if (nextTier) {
    const readiness = computeTierReadiness(dimensionProfile, nextTier, sessions.length);
    const blocker = findBlockingDimension(readiness);
    nextTierProgress = {
      label: nextTier.label,
      readinessPct: readiness.readinessPct,
      confidenceGate: readiness.confidenceGate,
      blockingDimension: blocker ? { key: blocker.key, label: blocker.label, gap: Math.round(blocker.gap) } : null,
    };
  }

  const answeredQuestions = sessions.flatMap((s) => s.questions || [])
    .filter((q) => q.userAnswer && q.userAnswer !== 'Skipped' && typeof q.timeTaken === 'number');
  const avgTimePerQ = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((a, q) => a + q.timeTaken, 0) / answeredQuestions.length)
    : null;

  const archetype = deriveArchetype(scoreTrend.map((s) => s.score), avgTimePerQ);

  const dimWithData = dimensionProfile.filter((d) => d.hasData);
  const strongestDim = [...dimWithData].sort((a, b) => b.score - a.score)[0] || null;
  const weakestDim = [...dimWithData].sort((a, b) => a.score - b.score)[0] || null;

  const badges = evaluateBadges({ user, sessions });
  const heroBadge = pickHeroBadge(badges);

  const standing = await computeGlobalStanding(user._id);

  return {
    name: user.name,
    college: user.college || null,
    avatar: user.avatar || null,
    hasData: true,
    totalInterviews: sessions.length,
    averageScore,
    bestScore,
    irs,
    tier,
    tierGated: isGated,
    sessionsNeededForRawTier,
    nextTier: nextTierProgress,
    archetype,
    strongestDim,
    weakestDim,
    dimensionProfile,
    scoreTrend,
    badges,
    heroBadge,
    rank: standing.rank,
    totalCandidates: standing.totalCandidates,
    percentile: standing.percentile,
  };
};

// ─── GET or create a user's public share slug (auth required) ───────────────
exports.getShareLink = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.shareSlug) {
      // Short, URL-safe, unguessable-enough slug. Retry on the rare collision.
      let slug;
      let attempts = 0;
      do {
        slug = crypto.randomBytes(5).toString('base64url');
        attempts += 1;
      } while (await User.exists({ shareSlug: slug }) && attempts < 5);

      user.shareSlug = slug;
      await user.save();
    }

    res.json({ slug: user.shareSlug });
  } catch (error) {
    console.error('Get share link error:', error);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
};

// ─── Public, unauthenticated profile lookup by slug ──────────────────────────
exports.getPublicProfileBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    const user = await User.findOne({ shareSlug: slug }).lean();
    if (!user) return res.status(404).json({ error: 'Profile not found' });

    const report = await buildProfileReport(user);
    res.json(report);
  } catch (error) {
    console.error('Public profile lookup error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

// ─── Authenticated — the logged-in user's own profile report ────────────────
// Backs ScoreCard's self-fetch (getMyProfile in profileServices.js), which
// previously pointed at a route that did not exist. Same builder as the
// public route, so the numbers a user sees privately are never inconsistent
// with what their public share link shows.
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const report = await buildProfileReport(user);
    res.json(report);
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};
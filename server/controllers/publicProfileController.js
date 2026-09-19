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
  { id: 'consistentClimber',  label: 'Consistent Climber'  },
  { id: 'speedRunner',        label: 'Speed Runner'        },
  { id: 'deepThinker',        label: 'Deep Thinker'        },
  { id: 'pressureCooker',     label: 'Pressure Cooker'     },
];

const deriveArchetype = (scores, avgTimePerQ) => {
  if (scores.length < 2) return ARCHETYPES[1];
  const sd    = stdDev(scores);
  const slope = trendSlope(scores);
  return sd > 18                                  ? ARCHETYPES[0]
    : slope > 2                                   ? ARCHETYPES[1]
    : avgTimePerQ != null && avgTimePerQ < 22     ? ARCHETYPES[2]
    : avgTimePerQ != null && avgTimePerQ > 52     ? ARCHETYPES[3]
    : ARCHETYPES[4];
};

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

const getGlobalStanding = async (userId) => {
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
  const percentile = totalCandidates > 1
    ? Math.round(((totalCandidates - rank) / (totalCandidates - 1)) * 100)
    : 100;
  return { rank, totalCandidates, percentile };
};

exports.getGlobalStanding = getGlobalStanding;

const buildProfileReport = async (user) => {
  const sessions = await Session.find({
    $or: [{ userId: user._id }, { user: user._id }],
    status: 'completed',
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!sessions.length) {
    return {
      name:            user.name,
      college:         user.college || null,
      avatar:          user.avatar || null,
      totalInterviews: 0,
      hasData:         false,
    };
  }

  const scores       = sessions.map((s) => s.totalScore).filter((s) => typeof s === 'number');
  const averageScore = scores.length ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length) : 0;
  const bestScore    = scores.length ? Math.max(...scores) : 0;

  const scoreTrend = sessions.map((s, i) => ({
    interview: i + 1,
    score:     s.totalScore || 0,
    date:      s.createdAt,
  }));

  const topicStats = {};
  sessions.forEach((session) => {
    session.questions?.forEach((question) => {
      const topic = question.topic || 'General';
      const score = typeof question.score === 'number' ? question.score : null;
      if (score === null) return;
      if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0 };
      topicStats[topic].totalScore += score;
      topicStats[topic].count      += 1;
    });
  });

  const topicPerformance = Object.values(topicStats).map((t) => ({
    topic:        t.topic,
    averageScore: Math.round(t.totalScore / t.count),
  }));

  const topicPerfDetail = topicPerformance.map((t) => ({ ...t, attempts: t.count || 1 }));
  const { profile: dimensionProfile } = buildDimensionProfile(topicPerfDetail);

  let totalAnswered = 0;
  const difficultyMix = { easy: 0, medium: 0, hard: 0 };
  sessions.forEach((session) => {
    (session.questions || []).forEach((question) => {
      if (question.skipped || !question.userAnswer || question.userAnswer === 'Skipped') return;
      totalAnswered += 1;
      const d = String(question.difficulty || 'medium').toLowerCase();
      if (difficultyMix[d] != null) difficultyMix[d] += 1;
      else difficultyMix.medium += 1;
    });
  });

  // FIX: pass `totalAnswered` (not totalAnsweredQuestions) — matches what scoringModel.js expects
  const irs = computeIRS({
    dimensionProfile,
    scoreTrend,
    topicPerformance,
    averageScore,
    totalAnswered,
    difficultyMix,
  });

  const { tier, isGated, sessionsNeededForRawTier } = tierForScoreGated(irs, sessions.length);

  const tierIndex = TIERS.findIndex((t) => t.label === tier.label);
  const nextTier  = TIERS[tierIndex + 1] || null;
  let tierProgress = null;
  if (nextTier) {
    const readiness = computeTierReadiness(dimensionProfile, nextTier, sessions.length);
    const blocker   = findBlockingDimension(readiness);
    tierProgress = {
      label:             nextTier.label,
      readinessPct:      readiness.readinessPct,
      confidenceGate:    readiness.confidenceGate,
      blockingDimension: blocker
        ? { key: blocker.key, label: blocker.label, gap: Math.round(blocker.gap) }
        : null,
    };
  }

  const answeredQuestions = sessions
    .flatMap((s) => s.questions || [])
    .filter((q) => q.userAnswer && q.userAnswer !== 'Skipped' && typeof q.timeTaken === 'number');

  const avgTimePerQ = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((a, q) => a + q.timeTaken, 0) / answeredQuestions.length)
    : null;

  const archetype    = deriveArchetype(scoreTrend.map((s) => s.score), avgTimePerQ);
  const activeDims  = dimensionProfile.filter((d) => d.hasData);
  const strongestDim = [...activeDims].sort((a, b) => b.score - a.score)[0] || null;
  const weakestDim   = [...activeDims].sort((a, b) => a.score - b.score)[0] || null;
  const badges       = evaluateBadges({ user, sessions });
  const heroBadge    = pickHeroBadge(badges);
  const standing     = await getGlobalStanding(user._id);

  return {
    name:                     user.name,
    college:                  user.college || null,
    avatar:                   user.avatar || null,
    hasData:                  true,
    totalInterviews:          sessions.length,
    averageScore,
    bestScore,
    irs,
    tier,
    tierGated:                isGated,
    sessionsNeededForRawTier,
    nextTier:                 tierProgress,
    archetype,
    strongestDim,
    weakestDim,
    dimensionProfile,
    scoreTrend,
    badges,
    heroBadge,
    rank:                     standing.rank,
    totalCandidates:          standing.totalCandidates,
    percentile:               standing.percentile,
  };
};

// FIX: renamed from getProfileBySlug → getPublicProfileBySlug (update your routes file)
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

exports.getShareLink = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.shareSlug) {
      let slug;
      let attempts = 0;
      do {
        slug     = crypto.randomBytes(5).toString('base64url');
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
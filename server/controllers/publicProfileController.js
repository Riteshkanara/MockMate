const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const {
  buildDimensionProfile,
  computeIRS,
  tierForScore,
  stdDev,
  trendSlope,
} = require('../utils/scoringModel');

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

    const sessions = await Session.find({ $or: [{ userId: user._id }, { user: user._id }], status: 'completed' })
      .sort({ createdAt: 1 })
      .lean();

    // No sessions yet — still return a minimal public card
    if (!sessions.length) {
      return res.json({
        name: user.name,
        avatar: user.avatar || null,
        totalInterviews: 0,
        hasData: false,
      });
    }

    const scores = sessions.map(s => s.totalScore).filter(s => typeof s === 'number');
    const averageScore = scores.length ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length) : 0;
    const bestScore = scores.length ? Math.max(...scores) : 0;

    const scoreTrend = sessions.map((s, i) => ({
      interview: i + 1,
      score: s.totalScore || 0,
      date: s.createdAt,
    }));

    // Topic performance (same aggregation as getPerformanceAnalytics)
    const topicStats = {};
    sessions.forEach(session => {
      session.questions?.forEach(q => {
        const topic = q.topic || 'General';
        const score = typeof q.score === 'number' ? q.score : null;
        if (score === null) return;
        if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0, attempts: 0 };
        topicStats[topic].totalScore += score;
        topicStats[topic].count += 1;
        topicStats[topic].attempts += 1;
      });
    });
    const topicPerformance = Object.values(topicStats).map(t => ({
      topic: t.topic,
      averageScore: Math.round(t.totalScore / t.count),
    }));

    const topicPerfWithAttempts = topicPerformance.map(t => ({
      ...t,
      attempts: t.count || 1,
    }));

    const { profile: dimensionProfile } = buildDimensionProfile(topicPerfWithAttempts);

    const irs = computeIRS({ dimensionProfile, scoreTrend, topicPerformance, averageScore });
    const tier = tierForScore(irs);

    const answeredQuestions = sessions.flatMap(s => s.questions || [])
      .filter(q => q.userAnswer && q.userAnswer !== 'Skipped' && typeof q.timeTaken === 'number');
    const avgTimePerQ = answeredQuestions.length
      ? Math.round(answeredQuestions.reduce((a, q) => a + q.timeTaken, 0) / answeredQuestions.length)
      : null;

    const archetype = deriveArchetype(scoreTrend.map(s => s.score), avgTimePerQ);

    const dimWithData = dimensionProfile.filter(d => d.hasData);
    const strongestDim = [...dimWithData].sort((a, b) => b.score - a.score)[0] || null;
    const weakestDim = [...dimWithData].sort((a, b) => a.score - b.score)[0] || null;

    res.json({
      name: user.name,
      avatar: user.avatar || null,
      hasData: true,
      totalInterviews: sessions.length,
      averageScore,
      bestScore,
      irs,
      tier,
      archetype,
      strongestDim,
      weakestDim,
      dimensionProfile,
    });
  } catch (error) {
    console.error('Public profile lookup error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};
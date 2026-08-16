const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');

// ─── Same dimension model used on the frontend Dashboard ────────────────────
// Keep this in sync with client DIMENSIONS if you ever change weights there.
const DIMENSIONS = [
  { key: 'technical',      label: 'Technical Depth',  weight: 0.28, topics: ['DSA', 'OOP', 'DBMS', 'OS', 'JavaScript', 'Web Development', 'System Design', 'Database'] },
  { key: 'problemSolving', label: 'Problem Solving',  weight: 0.22, topics: ['DSA', 'System Design', 'Algorithm'] },
  { key: 'communication',  label: 'Communication',    weight: 0.18, topics: ['Communication', 'HR', 'Behavioral'] },
  { key: 'behavioral',     label: 'Behavioral',       weight: 0.12, topics: ['HR', 'Behavioral', 'Leadership'] },
  { key: 'design',         label: 'System Design',    weight: 0.10, topics: ['System Design', 'Architecture', 'OOP', 'Scalability'] },
  { key: 'fundamentals',   label: 'CS Fundamentals',  weight: 0.10, topics: ['DBMS', 'OS', 'OOP', 'Networking', 'JavaScript'] },
];

const TIERS = [
  { label: '₹3–6 LPA',   minScore: 0  },
  { label: '₹6–12 LPA',  minScore: 38 },
  { label: '₹12–20 LPA', minScore: 60 },
  { label: '₹20 LPA+',   minScore: 80 },
];

const ARCHETYPES = [
  { id: 'inconsistentGenius', label: 'Inconsistent Genius' },
  { id: 'consistentClimber',  label: 'Consistent Climber' },
  { id: 'speedRunner',        label: 'Speed Runner' },
  { id: 'deepThinker',        label: 'Deep Thinker' },
  { id: 'pressureCooker',     label: 'Pressure Cooker' },
];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));

const ewma = (values, alpha = 0.35) => {
  if (!values.length) return 0;
  return values.reduce((acc, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * acc), values[0]);
};

const stdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const trendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xMean) * (v - yMean), 0);
  const den = values.reduce((a, _, i) => a + (i - xMean) ** 2, 0);
  return den ? num / den : 0;
};

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

const computeIRS = ({ dimensionProfile, scoreTrend, topicPerformance, averageScore }) => {
  const dimScore = dimensionProfile.reduce((acc, d) => {
    const cfg = DIMENSIONS.find(x => x.key === d.key);
    return acc + d.score * (cfg?.weight ?? 1 / DIMENSIONS.length);
  }, 0);
  const dimComponent = clamp(dimScore) * 0.40;

  const recentScores = scoreTrend.slice(-12).map(s => s.score || 0);
  const ewmaScore = recentScores.length ? ewma(recentScores) : averageScore;
  const ewmaComponent = clamp(ewmaScore) * 0.25;

  const uniqueTopics = topicPerformance.length;
  const breadthComponent = Math.min(uniqueTopics / 8, 1) * 100 * 0.15;

  const scores = scoreTrend.map(s => s.score || 0);
  const sd = stdDev(scores);
  const mean = scores.length ? scores.reduce((a, v) => a + v, 0) / scores.length : 0;
  const cv = mean > 0 ? sd / mean : 1;
  const consistencyScore = Math.max(0, (1 - Math.min(cv, 1)) * 100);
  const consistencyComponent = consistencyScore * 0.20;

  return clamp(dimComponent + ewmaComponent + breadthComponent + consistencyComponent);
};

const tierForScore = (irs) => {
  const reached = TIERS.filter(t => irs >= t.minScore);
  return reached[reached.length - 1] || TIERS[0];
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

    const sessions = await Session.find({ userId: user._id, status: 'completed' })
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
        if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0 };
        topicStats[topic].totalScore += score;
        topicStats[topic].count += 1;
      });
    });
    const topicPerformance = Object.values(topicStats).map(t => ({
      topic: t.topic,
      averageScore: Math.round(t.totalScore / t.count), // already 0–100
    }));

    const topicMap = {};
    topicPerformance.forEach(t => { topicMap[t.topic.toLowerCase()] = t.averageScore; });

    const dimensionProfile = DIMENSIONS.map(dim => {
      const vals = dim.topics.map(t => topicMap[t.toLowerCase()]).filter(v => typeof v === 'number' && v > 0);
      const score = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
      return { key: dim.key, label: dim.label, score: clamp(score), hasData: vals.length > 0 };
    });

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
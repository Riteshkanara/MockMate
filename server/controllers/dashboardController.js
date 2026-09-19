const Session = require('../models/Session');
const User = require('../models/User');

// Shared date-format options — single source of truth for en-IN locale display
const DATE_SHORT = { day: 'numeric', month: 'short' };
const DATE_LONG  = { day: 'numeric', month: 'short', year: 'numeric' };

// ---------------------------------------------------------------------------
// Helpers — extracted from getDashboardStats (Pass 3A Rule 3)
// ---------------------------------------------------------------------------

/**
 * Build the score-trend array (oldest → newest, for line chart x-axis).
 * WHY reversed: chart libs expect left-to-right chronological order.
 */
const buildScoreTrend = (sessions) =>
  sessions
    .slice()
    .reverse()
    .map((session, i) => ({
      session: `S${i + 1}`,
      score:   Math.round(session.averageScore ?? session.totalScore ?? 0),
      mode:    session.mode,
      date:    new Date(session.createdAt).toLocaleDateString('en-IN', DATE_SHORT),
    }));

/**
 * Average score per topic across all answered questions in the given sessions.
 */
const buildTopicBreakdown = (sessions) => {
  const map = {};
  sessions.forEach(session => {
    (session.questions || []).forEach(question => {
      if (!question.topic || typeof question.score !== 'number') return;
      const key = question.topic.toUpperCase();
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += question.score;
      map[key].count += 1;
    });
  });
  return Object.entries(map).map(([topic, val]) => ({
    topic,
    avg: Math.round(val.total / val.count),
  }));
};

/**
 * Normalize a raw session's score to a 0–100 display value.
 * WHY two-branch: older sessions stored cumulative totalScore, newer ones
 * store averageScore directly. Both must render consistently in the UI.
 */
const resolveDisplayScore = (session) => {
  if (typeof session.averageScore === 'number' && session.averageScore >= 0 && session.averageScore <= 100) {
    return Math.round(session.averageScore);
  }
  if (typeof session.totalScore === 'number' && session.totalScore >= 0) {
    const qCount = (session.questions || []).length;
    return qCount > 0 && session.totalScore > 100
      ? Math.round(session.totalScore / qCount)
      : Math.min(100, Math.round(session.totalScore));
  }
  return 0;
};

/**
 * Shape the last 5 sessions for the history card.
 */
const formatRecentSessions = (sessions) =>
  sessions.slice(0, 5).map(session => ({
    id:            session._id,
    mode:          session.mode,
    company:       session.company,
    topic:         session.topic,
    score:         resolveDisplayScore(session),
    questionCount: (session.questions || []).length,
    date:          new Date(session.createdAt).toLocaleDateString('en-IN', DATE_LONG),
  }));

// ---------------------------------------------------------------------------

/**
 * GET /dashboard/stats
 * Returns user stats, score trend, topic breakdown, and recent sessions
 * for the logged-in user's dashboard.
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // WHY -password: never leak credential fields in any response shape
    const user = await User.findById(userId).select(
      'name college branch plan streak badges totalSessions averageScore weakAreas'
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // WHY $or: covers both the current 'user' field and the legacy 'userId' field
    const sessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('totalScore averageScore mode company topic createdAt questions');

    const bestScore = sessions.length
      ? Math.max(...sessions.map(s => s.averageScore ?? s.totalScore ?? 0))
      : 0;
    const scoreTrend     = buildScoreTrend(sessions);
    const topicBreakdown = buildTopicBreakdown(sessions);
    const recentSessions = formatRecentSessions(sessions);

  res.json({
    user,
    stats: {
      totalSessions:  user.totalSessions ?? sessions.length,
      averageScore:   user.averageScore ?? 0,
      bestScore,
      currentStreak:  user.streak?.current ?? 0,
      longestStreak:  user.streak?.longest ?? 0,
    },
    scoreTrend,
    topicBreakdown,
    recentSessions,
  });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

module.exports = { getDashboardStats };






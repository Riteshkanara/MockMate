const Session = require('../models/Session');
const User = require('../models/User');

/**
 * GET /dashboard/stats
 * Returns user stats, score trend, topic breakdown, and recent sessions
 * for the logged-in user's dashboard.
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch user stats and profile fields needed for the dashboard
    const user = await User.findById(userId).select(
      'name college branch plan streak badges totalSessions averageScore weakAreas'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // $or covers both the current 'user' field and the legacy 'userId' field
    const sessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('totalScore averageScore mode company topic createdAt questions');

    // Best score across the last 10 sessions
    const bestScore = sessions.length
      ? Math.max(...sessions.map(s => s.averageScore ?? s.totalScore ?? 0))
      : 0;

    // Score trend for the line chart — reversed so oldest is on the left
    const scoreTrend = sessions
      .slice()
      .reverse()
      .map((s, i) => ({
        session: `S${i + 1}`,
        score: Math.round(s.averageScore ?? s.totalScore ?? 0),
        mode: s.mode,
        date: new Date(s.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
      }));

    // Topic radar — average score per topic across answered questions
    const topicMap = {};
    sessions.forEach(session => {
      (session.questions || []).forEach(q => {
        if (!q.topic || typeof q.score !== 'number') return;
        const key = q.topic.toUpperCase();
        if (!topicMap[key]) topicMap[key] = { total: 0, count: 0 };
        topicMap[key].total += q.score;
        topicMap[key].count += 1;
      });
    });

    const topicBreakdown = Object.entries(topicMap).map(([topic, val]) => ({
      topic,
      avg: Math.round(val.total / val.count),
    }));

    // Recent sessions list — last 5 for the history card
    const recentSessions = sessions.slice(0, 5).map(s => {
      let displayScore = 0;
      if (typeof s.averageScore === 'number' && s.averageScore >= 0 && s.averageScore <= 100) {
        displayScore = Math.round(s.averageScore);
      } else if (typeof s.totalScore === 'number' && s.totalScore >= 0) {
        const qCount = (s.questions || []).length;
        displayScore = qCount > 0 && s.totalScore > 100
          ? Math.round(s.totalScore / qCount)
          : Math.min(100, Math.round(s.totalScore));
      }
      return {
        id:            s._id,
        mode:          s.mode,
        company:       s.company,
        topic:         s.topic,
        score:         displayScore,
        questionCount: (s.questions || []).length,
        date:          new Date(s.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        }),
      };
    });

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
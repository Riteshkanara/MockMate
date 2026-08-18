const Session = require('../models/Session');
const User = require('../models/User');

// GET /dashboard/stats
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch user for streak + badges
    const user = await User.findById(userId).select(
      'name college branch plan streak badges totalSessions averageScore weakAreas'
    );

    // Fetch last 10 completed sessions for chart
const sessions = await Session.find({ userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('totalScore mode company topic createdAt questions');

    // Best score
    const bestScore = sessions.length
      ? Math.max(...sessions.map(s => s.totalScore ?? 0))
      : 0;

    // Score trend for line chart (reverse so oldest → newest)
    const scoreTrend = sessions
      .slice()
      .reverse()
      .map((s, i) => ({
        session: `S${i + 1}`,
        score: s.totalScore ?? 0,
        mode: s.mode,
        date: new Date(s.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short'
        })
      }));

    // Topic radar data — average score per topic across all sessions
    const topicMap = {};
    sessions.forEach(session => {
      session.questions.forEach(q => {
        if (!q.topic || !q.aiFeedback?.score) return;
        const t = q.topic.toUpperCase();
        if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
        topicMap[t].total += q.aiFeedback.score;
        topicMap[t].count += 1;
      });
    });

    const topicBreakdown = Object.entries(topicMap).map(([topic, val]) => ({
      topic,
      avg: Math.round((val.total / val.count) * 10) // scale to /100
    }));

    // Recent sessions list (last 5 for history card)
    const recentSessions = sessions.slice(0, 5).map(s => ({
      id: s._id,
      mode: s.mode,
      company: s.company,
      topic: s.topic,
      totalScore: s.totalScore,
      questionCount: s.questions.length,
      date: new Date(s.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    }));

    res.json({
      user,
      stats: {
        totalSessions: user.totalSessions ?? sessions.length,
        averageScore: user.averageScore ?? 0,
        bestScore,
        currentStreak: user.streak?.current ?? 0,
        longestStreak: user.streak?.longest ?? 0
      },
      scoreTrend,
      topicBreakdown,
      recentSessions
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
};

module.exports = { getDashboardStats };
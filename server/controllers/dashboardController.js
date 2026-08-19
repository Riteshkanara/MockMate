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
const sessions = await Session.find({ $or: [{ user: userId }, { userId }], status: 'completed' })
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
        if (!q.topic || typeof q.score !== 'number') return;
        const t = q.topic.toUpperCase();
        if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
        topicMap[t].total += q.score;
        topicMap[t].count += 1;
      });
    });

    const topicBreakdown = Object.entries(topicMap).map(([topic, val]) => ({
      topic,
      avg: Math.round(val.total / val.count)  
    }));

    // Recent sessions list (last 5 for history card)
    // Normalize score to 0–100 the same way History.jsx does
    const recentSessions = sessions.slice(0, 5).map(s => {
      let displayScore = 0;
      if (typeof s.averageScore === 'number' && s.averageScore >= 0 && s.averageScore <= 100) {
        displayScore = Math.round(s.averageScore);
      } else if (typeof s.totalScore === 'number' && s.totalScore >= 0) {
        const qCount = s.questions.length;
        displayScore = qCount > 0 && s.totalScore > 100
          ? Math.round(s.totalScore / qCount)
          : Math.min(100, Math.round(s.totalScore));
      }
      return {
        id: s._id,
        mode: s.mode,
        company: s.company,
        topic: s.topic,
        score: displayScore,
        questionCount: s.questions.length,
        date: new Date(s.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      };
    });

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
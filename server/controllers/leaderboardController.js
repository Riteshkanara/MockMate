const Session = require('../models/Session');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// Start of current week — Monday 12:00 AM, server local time
// ─────────────────────────────────────────────────────────────────────────────

const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard aggregation
//
// WHY resolvedUser: newer sessions use `user`; older ones may still have
// `userId`. We coalesce at query time rather than running a migration.
// ─────────────────────────────────────────────────────────────────────────────

const leaderboardStats = async (match) => {
  return Session.aggregate([
    { $match: match },
    {
      $addFields: {
        resolvedUser: { $ifNull: ['$user', '$userId'] },
      },
    },
    { $match: { resolvedUser: { $ne: null } } },
    {
      $group: {
        _id: '$resolvedUser',
        avgScore: { $avg: '$averageScore' },
        sessionCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        avgScore: { $round: ['$avgScore', 1] },
        sessionCount: 1,
        name: '$user.name',
        college: '$user.college',
        avatar: '$user.avatar',
        streak: '$user.streak.current',
      },
    },
    { $sort: { avgScore: -1 } },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Attach 1-based rank and isCurrentUser flag to every entry
// ─────────────────────────────────────────────────────────────────────────────

const rankEntries = (entries, userId) =>
  entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isCurrentUser: entry._id.toString() === userId.toString(),
  }));

// ─────────────────────────────────────────────────────────────────────────────
// Build one period (weekly / overall) of leaderboard data
//
// WHY rank globally before slicing: users outside the top 50 still need
// an accurate global rank returned in currentUser, not a capped one.
// ─────────────────────────────────────────────────────────────────────────────

const buildLeaderboard = (stats, userId, college) => {
  const globalRanked = rankEntries(stats, userId);
  const global = globalRanked.slice(0, 50);

  const collegeRanked = rankEntries(
    stats.filter((entry) => entry.college === college),
    userId
  );
  const collegeBoard = collegeRanked.slice(0, 50);

  const globalIndex = globalRanked.findIndex((e) => e.isCurrentUser);
  const globalRank = globalIndex >= 0 ? globalIndex + 1 : null;

  const collegeIndex = collegeRanked.findIndex((e) => e.isCurrentUser);
  const collegeRank = collegeIndex >= 0 ? collegeIndex + 1 : null;

  const userEntry = stats.find(
    (e) => e._id.toString() === userId.toString()
  );

  const globalRival =
    globalRank && globalRank > 1 ? globalRanked[globalRank - 2] : null;

  const collegeAheadOfUser =
    collegeRank && collegeRank > 1 ? collegeRanked[collegeRank - 2] : null;

  return {
    global,
    college: collegeBoard,
    globalTotal: globalRanked.length,
    collegeTotal: collegeRanked.length,
    currentUser: {
      globalRank,
      collegeRank,
      avgScore: userEntry?.avgScore ?? null,
      sessionCount: userEntry?.sessionCount ?? 0,
      globalRival: globalRival
        ? { name: globalRival.name, avgScore: globalRival.avgScore }
        : null,
      collegeAheadOfUser: collegeAheadOfUser
        ? { name: collegeAheadOfUser.name, avgScore: collegeAheadOfUser.avgScore }
        : null,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /leaderboard
// ─────────────────────────────────────────────────────────────────────────────

const getLeaderboard = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const currentUser = await User.findById(userId).select('college name');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const weekStart = getWeekStart();

    const [weeklyStats, overallStats] = await Promise.all([
      leaderboardStats({ status: 'completed', createdAt: { $gte: weekStart } }),
      leaderboardStats({ status: 'completed' }),
    ]);

    const weekly = buildLeaderboard(weeklyStats, userId, currentUser.college);
    const overall = buildLeaderboard(overallStats, userId, currentUser.college);

    return res.json({
      weekly: {
        global: weekly.global,
        college: weekly.college,
        globalTotal: weekly.globalTotal,
        collegeTotal: weekly.collegeTotal,
      },
      overall: {
        global: overall.global,
        college: overall.college,
        globalTotal: overall.globalTotal,
        collegeTotal: overall.collegeTotal,
      },
      currentUser: {
        name: currentUser.name,
        college: currentUser.college,
        weekly: weekly.currentUser,
        overall: overall.currentUser,
      },
      weekStart: weekStart.toISOString(),
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ message: 'Failed to load leaderboard' });
  }
};

module.exports = {
  getLeaderboard,
};






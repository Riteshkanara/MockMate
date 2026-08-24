const Session = require('../models/Session');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// Get start of current week — Monday 12:00 AM in server local time
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
// Build leaderboard statistics
//
// Weekly:
//   completed sessions created from current week start onward
//
// Overall:
//   all completed sessions
// ─────────────────────────────────────────────────────────────────────────────

const getLeaderboardStats = async (match) => {
  return Session.aggregate([
    {
      $match: match,
    },

    // New sessions use `user`.
    // Older sessions may still use `userId`.
    {
      $addFields: {
        resolvedUser: {
          $ifNull: ['$user', '$userId'],
        },
      },
    },

    // Ignore malformed sessions that have no owner.
    {
      $match: {
        resolvedUser: {
          $ne: null,
        },
      },
    },

    // One leaderboard entry per user.
    {
      $group: {
        _id: '$resolvedUser',
        avgScore: {
          $avg: '$averageScore',
        },
        sessionCount: {
          $sum: 1,
        },
      },
    },

    // Attach user information.
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },

    {
      $unwind: '$user',
    },

    // Shape the final leaderboard entry.
    {
      $project: {
        _id: 1,
        avgScore: {
          $round: ['$avgScore', 1],
        },
        sessionCount: 1,
        name: '$user.name',
        college: '$user.college',
        avatar: '$user.avatar',
        streak: '$user.streak.current',
      },
    },

    // Highest average score first.
    {
      $sort: {
        avgScore: -1,
      },
    },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Add ranking information
// ─────────────────────────────────────────────────────────────────────────────

const rankEntries = (entries, userId) => {
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isCurrentUser:
      entry._id.toString() === userId.toString(),
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Build one period of leaderboard data
// ─────────────────────────────────────────────────────────────────────────────

const buildPeriodLeaderboard = (
  stats,
  userId,
  college
) => {
  // Rank the entire dataset first.
  // This allows users outside the displayed top 50
  // to still have an accurate rank.
  const globalRanked = rankEntries(
    stats,
    userId
  );

  const global = globalRanked.slice(0, 50);

  // College leaderboard.
  const collegeRanked = rankEntries(
    stats.filter(
      (entry) => entry.college === college
    ),
    userId
  );

  const collegeLeaderboard =
    collegeRanked.slice(0, 50);

  // Current user's global rank.
  const globalIndex = globalRanked.findIndex(
    (entry) => entry.isCurrentUser
  );

  const globalRank =
    globalIndex >= 0
      ? globalIndex + 1
      : null;

  // Current user's college rank.
  const collegeIndex =
    collegeRanked.findIndex(
      (entry) => entry.isCurrentUser
    );

  const collegeRank =
    collegeIndex >= 0
      ? collegeIndex + 1
      : null;

  // Current user's statistics.
  const currentUserEntry = stats.find(
    (entry) =>
      entry._id.toString() ===
      userId.toString()
  );

  // User immediately above current user globally.
  const globalAheadOfUser =
    globalRank && globalRank > 1
      ? globalRanked[globalRank - 2]
      : null;

  // User immediately above current user in college.
  const collegeAheadOfUser =
    collegeRank && collegeRank > 1
      ? collegeRanked[collegeRank - 2]
      : null;

  return {
    global,
    college: collegeLeaderboard,

    globalTotal: globalRanked.length,
    collegeTotal: collegeRanked.length,

    currentUser: {
      globalRank,
      collegeRank,

      avgScore:
        currentUserEntry?.avgScore ?? null,

      sessionCount:
        currentUserEntry?.sessionCount ?? 0,

      globalAheadOfUser:
        globalAheadOfUser
          ? {
              name: globalAheadOfUser.name,
              avgScore:
                globalAheadOfUser.avgScore,
            }
          : null,

      collegeAheadOfUser:
        collegeAheadOfUser
          ? {
              name: collegeAheadOfUser.name,
              avgScore:
                collegeAheadOfUser.avgScore,
            }
          : null,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /leaderboard
// ─────────────────────────────────────────────────────────────────────────────

const getLeaderboard = async (req, res) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Unauthorized',
      });
    }

    const weekStart = getWeekStart();

    // Current user's basic information.
    const currentUser =
      await User.findById(userId)
        .select('college name');

    if (!currentUser) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    // Fetch weekly and overall statistics in parallel.
    const [
      weeklyStats,
      overallStats,
    ] = await Promise.all([
      // ── Weekly ──────────────────────────────────────────────
      getLeaderboardStats({
        status: 'completed',
        createdAt: {
          $gte: weekStart,
        },
      }),

      // ── Overall ─────────────────────────────────────────────
      getLeaderboardStats({
        status: 'completed',
      }),
    ]);

    // Build both periods.
    const weekly =
      buildPeriodLeaderboard(
        weeklyStats,
        userId,
        currentUser.college
      );

    const overall =
      buildPeriodLeaderboard(
        overallStats,
        userId,
        currentUser.college
      );

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

      weekStart:
        weekStart.toISOString(),
    });
  } catch (err) {
    console.error(
      'Leaderboard error:',
      err
    );

    return res.status(500).json({
      message:
        'Failed to load leaderboard',
    });
  }
};

module.exports = {
  getLeaderboard,
};